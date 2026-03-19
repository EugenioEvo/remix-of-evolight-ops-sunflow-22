import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const LOW_GENERATION_RATIO = 0.70

// ── SolarZ via Cloudflare Worker proxy ──────────────────────

function proxyHeaders(): Record<string, string> {
  const secret = Deno.env.get('SOLARZ_PROXY_SECRET') || ''
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Proxy-Secret': secret,
  }
}

async function solarzGet(url: string) {
  const headers = proxyHeaders()
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const errorBody = await res.text()
    console.error(`SolarZ GET ${url} failed: ${res.status}`, errorBody.substring(0, 500))
    throw new Error(`SolarZ GET ${url} failed: ${res.status} - ${errorBody.substring(0, 200)}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const preview = (await res.text()).substring(0, 300)
    throw new Error(`Non-JSON response from ${url}: ${contentType} - ${preview}`)
  }
  return res.json()
}

async function solarzPost(url: string, body?: any) {
  const headers = proxyHeaders()
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : '{}',
  })
  if (!res.ok) {
    const errorBody = await res.text()
    console.error(`SolarZ POST ${url} failed: ${res.status}`, errorBody.substring(0, 500))
    throw new Error(`SolarZ POST ${url} failed: ${res.status} - ${errorBody.substring(0, 200)}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const preview = (await res.text()).substring(0, 300)
    throw new Error(`Non-JSON response from ${url}: ${contentType} - ${preview}`)
  }
  return res.json()
}

// ── Dispatch helpers ────────────────────────────────────────

async function dispatchCritical(supabaseAdmin: any, plantId: string, tipo: string, severidade: string) {
  try {
    await supabaseAdmin.functions.invoke('agent-dispatcher', {
      body: { plant_id: plantId, alert_type: tipo, severity: severidade },
    })
  } catch (err) {
    console.warn('Dispatcher invocation failed:', err)
  }
}

async function dispatchJarvis(supabaseAdmin: any, alertId: string, plantId: string, tipo: string, severidade: string) {
  try {
    await supabaseAdmin.functions.invoke('jarvis-orchestrator', {
      body: { alert_id: alertId, plant_id: plantId, tipo, severidade },
    })
  } catch (err) {
    console.warn('JARVIS invocation failed:', err)
  }
}

// ── Main handler ────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  let alertsCreated = 0
  let metricsChecked = 0
  let plantsProcessed = 0
  let jarvisInvocations = 0
  let errorMessage: string | null = null

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    // ── 1. Validate env ──────────────────────────────────
    let SOLARZ_API_URL = (Deno.env.get('SOLARZ_API_URL') ?? '').replace(/\/$/, '')
    if (SOLARZ_API_URL && !SOLARZ_API_URL.startsWith('http')) {
      SOLARZ_API_URL = 'https://' + SOLARZ_API_URL
    }
    const SOLARZ_PROXY_SECRET = Deno.env.get('SOLARZ_PROXY_SECRET')

    if (!SOLARZ_API_URL || !SOLARZ_PROXY_SECRET) {
      throw new Error('SOLARZ_API_URL and SOLARZ_PROXY_SECRET must be configured')
    }

    console.log('SolarZ Worker URL:', SOLARZ_API_URL)

    // ── 2. Fetch ALL plants from SolarZ (paginated) ──────
    let allSolarzPlants: any[] = []
    let page = 1
    while (true) {
      const res = await solarzPost(
        `${SOLARZ_API_URL}/openApi/seller/plantWithInfos/list?page=${page}&pageSize=100`,
      )
      allSolarzPlants.push(...(res.content || []))
      if (res.last === true || (res.content || []).length === 0) break
      page++
    }

    console.log(`Fetched ${allSolarzPlants.length} plants from SolarZ`)

    // ── 3. Get registered plants from Supabase ───────────
    const { data: dbPlants, error: dbErr } = await supabaseAdmin
      .from('solar_plants')
      .select('id, solarz_plant_id, nome, potencia_kwp')
      .eq('ativo', true)
      .not('solarz_plant_id', 'is', null)

    if (dbErr) throw dbErr

    const dbMap = new Map((dbPlants ?? []).map((p: any) => [p.solarz_plant_id, p]))
    const todayStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // ── 4. Process each SolarZ plant ─────────────────────
    for (const szPlant of allSolarzPlants) {
      const dbPlant = dbMap.get(String(szPlant.id))
      if (!dbPlant) continue // not registered in our system

      plantsProcessed++
      const status = szPlant.status?.status // "OK", "ALERTA", "CRITICO", "DESCONHECIDO"

      try {
        // ── 4a. Derive alerts from status ────────────────
        let tipo: string | null = null
        let severidade: string | null = null

        if (status === 'CRITICO') {
          tipo = 'erro_inversor'
          severidade = 'critical'
        } else if (status === 'DESCONHECIDO') {
          tipo = 'comunicacao'
          severidade = 'critical'
        } else if (status === 'ALERTA') {
          tipo = 'alerta_sistema'
          severidade = 'warning'
        }
        // "OK" = no alert

        if (tipo && severidade) {
          const { data: existing } = await supabaseAdmin
            .from('solar_alerts')
            .select('id')
            .eq('plant_id', dbPlant.id)
            .eq('tipo', tipo)
            .eq('status', 'aberto')
            .gte('created_at', todayStart)
            .maybeSingle()

          if (!existing) {
            const { data: insertedAlert } = await supabaseAdmin
              .from('solar_alerts')
              .insert([{
                plant_id: dbPlant.id,
                tipo,
                severidade,
                titulo: `${status}: ${szPlant.name}`,
                descricao: `Planta ${szPlant.name} com status ${status}. Potência: ${szPlant.installedPower} kWp. Cliente: ${szPlant.cliente?.nome || 'N/A'}`,
                dados_contexto: {
                  solarz_status: status,
                  solarz_plant_id: szPlant.id,
                  last_update: szPlant.status?.at,
                  installed_power: szPlant.installedPower,
                  energy_produced: szPlant.energyProducedKwh,
                },
                status: 'aberto',
              }])
              .select('id')
              .single()

            if (insertedAlert) {
              alertsCreated++
              if (severidade === 'critical') {
                await dispatchCritical(supabaseAdmin, dbPlant.id, tipo, severidade)
              } else {
                jarvisInvocations++
                await dispatchJarvis(supabaseAdmin, insertedAlert.id, dbPlant.id, tipo, severidade)
              }
            }
          }
        }

        // ── 4b. Low generation check ─────────────────────
        try {
          const perfData = await solarzPost(
            `${SOLARZ_API_URL}/openApi/seller/plant/performance/plantId/${szPlant.id}`,
          )

          if (perfData.expected1D > 0 && perfData.total1D > 0) {
            const ratio = perfData.total1D / perfData.expected1D
            if (ratio < LOW_GENERATION_RATIO) {
              const { data: existingLow } = await supabaseAdmin
                .from('solar_alerts')
                .select('id')
                .eq('plant_id', dbPlant.id)
                .eq('tipo', 'baixa_geracao')
                .eq('status', 'aberto')
                .gte('created_at', todayStart)
                .maybeSingle()

              if (!existingLow) {
                const pct = Math.round(ratio * 100)
                const { data: insertedAlert } = await supabaseAdmin
                  .from('solar_alerts')
                  .insert([{
                    plant_id: dbPlant.id,
                    tipo: 'baixa_geracao',
                    severidade: 'warning',
                    titulo: `Baixa geração: ${pct}% - ${szPlant.name}`,
                    descricao: `Geração ${perfData.total1D?.toFixed(1)} kWh vs esperado ${perfData.expected1D?.toFixed(1)} kWh (${pct}%)`,
                    dados_contexto: { ratio: pct, total1D: perfData.total1D, expected1D: perfData.expected1D },
                    status: 'aberto',
                  }])
                  .select('id')
                  .single()

                if (insertedAlert) {
                  alertsCreated++
                  jarvisInvocations++
                  await dispatchJarvis(supabaseAdmin, insertedAlert.id, dbPlant.id, 'baixa_geracao', 'warning')
                }
              }
            }
          }
        } catch {
          // performance endpoint may fail for some plants
        }

        // ── 4c. Save metrics ─────────────────────────────
        try {
          const powerData = await solarzGet(
            `${SOLARZ_API_URL}/openApi/seller/plant/power?id=${szPlant.id}`,
          )

          await supabaseAdmin.from('solar_metrics').insert([{
            plant_id: dbPlant.id,
            timestamp: new Date().toISOString(),
            geracao_kwh: powerData.totalGenerated ?? null,
            potencia_instantanea_kw: powerData.instantPower ?? null,
          }])
          metricsChecked++
        } catch {
          // power endpoint may fail
        }

        // ── 4d. Update last sync ─────────────────────────
        await supabaseAdmin
          .from('solar_plants')
          .update({
            ultima_sincronizacao: new Date().toISOString(),
            solarz_status: status ?? null,
          })
          .eq('id', dbPlant.id)

      } catch (plantErr) {
        console.error(`Error processing plant ${dbPlant.id} (${szPlant.id}):`, plantErr)
        errorMessage = errorMessage ?? (plantErr instanceof Error ? plantErr.message : String(plantErr))
      }
    }
  } catch (err) {
    console.error('Agent Monitor fatal error:', err)
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  // ── 5. Log execution ──────────────────────────────────
  const durationMs = Date.now() - startTime

  try {
    await supabaseAdmin.from('solar_agent_logs').insert([{
      agent_name: 'monitor',
      action: 'sync_all_plants',
      status: errorMessage ? 'error' : 'success',
      duration_ms: durationMs,
      error_message: errorMessage,
      input_data: { plants_processed: plantsProcessed },
      output_data: { alerts_created: alertsCreated, metrics_checked: metricsChecked, jarvis_invocations: jarvisInvocations },
    }])
  } catch (logErr) {
    console.error('Failed to write agent log:', logErr)
  }

  const result = {
    success: !errorMessage,
    duration_ms: durationMs,
    plants_processed: plantsProcessed,
    alerts_created: alertsCreated,
    metrics_checked: metricsChecked,
    jarvis_invocations: jarvisInvocations,
    solarz_plants_found: 0,
    error: errorMessage,
  }

  return new Response(JSON.stringify(result), {
    status: errorMessage ? 500 : 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
