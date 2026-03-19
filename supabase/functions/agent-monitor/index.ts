import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ── Detection thresholds ────────────────────────────────────
const OFFLINE_THRESHOLD_MIN = 30
const COMM_THRESHOLD_MIN = 120
const LOW_GENERATION_RATIO = 0.70

// ── SolarZ API helpers (Basic Auth) ─────────────────────────

function solarzHeaders(username: string, password: string): Record<string, string> {
  const credentials = btoa(`${username}:${password}`)
  return {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json',
  }
}

async function solarzFetch(baseUrl: string, headers: Record<string, string>, path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SolarZ ${path} failed [${res.status}]: ${body}`)
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
    const SOLARZ_API_URL = Deno.env.get('SOLARZ_API_URL')
    const SOLARZ_USERNAME = Deno.env.get('SOLARZ_USERNAME')
    const SOLARZ_PASSWORD = Deno.env.get('SOLARZ_PASSWORD')

    if (!SOLARZ_API_URL || !SOLARZ_USERNAME || !SOLARZ_PASSWORD) {
      throw new Error('SolarZ credentials not configured (SOLARZ_API_URL, SOLARZ_USERNAME, SOLARZ_PASSWORD)')
    }

    const headers = solarzHeaders(SOLARZ_USERNAME, SOLARZ_PASSWORD)
    const baseUrl = SOLARZ_API_URL.replace(/\/$/, '')

    // ── 2. Get all registered plants ─────────────────────
    const { data: plants, error: plantsErr } = await supabaseAdmin
      .from('solar_plants')
      .select('id, solarz_plant_id, nome, potencia_kwp')
      .eq('ativo', true)
      .not('solarz_plant_id', 'is', null)

    if (plantsErr) throw plantsErr
    if (!plants || plants.length === 0) {
      throw new Error('No active plants with solarz_plant_id found')
    }

    // ── 3. Process each plant ────────────────────────────
    for (const plant of plants) {
      plantsProcessed++
      const externalId = plant.solarz_plant_id!

      try {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

        // ── 3a. Fetch status ───────────────────────────
        let statusData: any = null
        try {
          statusData = await solarzFetch(baseUrl, headers, `/openApi/seller/plant/status?id=${externalId}`)
        } catch (err) {
          console.warn(`Could not fetch status for plant ${externalId}:`, err)
        }

        // ── 3b. Fetch performance ──────────────────────
        let perfData: any = null
        try {
          perfData = await solarzFetch(baseUrl, headers, `/openApi/seller/plant/performance/plantId/${externalId}`, {
            method: 'POST',
          })
        } catch (err) {
          console.warn(`Could not fetch performance for plant ${externalId}:`, err)
        }

        // ── 3c. Fetch power ────────────────────────────
        let powerData: any = null
        try {
          powerData = await solarzFetch(baseUrl, headers, `/openApi/seller/plant/power?id=${externalId}`)
        } catch (err) {
          console.warn(`Could not fetch power for plant ${externalId}:`, err)
        }

        // ── 3d. Derive alerts ──────────────────────────

        // Offline: status not NORMAL and last update > 30min
        if (statusData) {
          const lastUpdate = new Date(statusData.at)
          const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / 60_000

          if (statusData.status !== 'NORMAL' && minutesSinceUpdate > OFFLINE_THRESHOLD_MIN) {
            const alert = await insertAlertIfNew(supabaseAdmin, {
              plant_id: plant.id,
              tipo: 'offline',
              severidade: 'critical',
              titulo: `Planta offline: status ${statusData.status}`,
              descricao: `${plant.nome} — última atualização há ${Math.round(minutesSinceUpdate)} min.`,
              dados_contexto: { status: statusData.status, lastUpdate: statusData.at, minutesSinceUpdate },
              todayStart,
            })
            if (alert) {
              alertsCreated++
              await dispatchCritical(supabaseAdmin, plant.id, 'offline', 'critical')
            }
          }

          // Communication: last update > 2h
          if (minutesSinceUpdate > COMM_THRESHOLD_MIN) {
            const alert = await insertAlertIfNew(supabaseAdmin, {
              plant_id: plant.id,
              tipo: 'comunicacao',
              severidade: 'warning',
              titulo: `Sem comunicação há ${Math.round(minutesSinceUpdate)} min`,
              descricao: `${plant.nome} — última atualização: ${statusData.at}`,
              dados_contexto: { lastUpdate: statusData.at, minutesSinceUpdate },
              todayStart,
            })
            if (alert) {
              alertsCreated++
              jarvisInvocations++
              await dispatchJarvis(supabaseAdmin, alert.id, plant.id, 'comunicacao', 'warning')
            }
          }
        }

        // Low generation: real < 70% of expected
        if (perfData && perfData.expected1D > 0 && perfData.total1D > 0) {
          const ratio = perfData.total1D / perfData.expected1D
          if (ratio < LOW_GENERATION_RATIO) {
            const alert = await insertAlertIfNew(supabaseAdmin, {
              plant_id: plant.id,
              tipo: 'baixa_geracao',
              severidade: 'warning',
              titulo: `Baixa geração: ${Math.round(ratio * 100)}% do esperado`,
              descricao: `${plant.nome} — Geração: ${perfData.total1D.toFixed(1)} kWh, Esperado: ${perfData.expected1D.toFixed(1)} kWh`,
              dados_contexto: { ratio, total1D: perfData.total1D, expected1D: perfData.expected1D },
              todayStart,
            })
            if (alert) {
              alertsCreated++
              jarvisInvocations++
              await dispatchJarvis(supabaseAdmin, alert.id, plant.id, 'baixa_geracao', 'warning')
            }
          }
        }

        // Zero power during solar hours (6h-18h)
        if (powerData) {
          const hour = now.getHours()
          if (hour >= 6 && hour <= 18 && powerData.instantPower === 0) {
            const alert = await insertAlertIfNew(supabaseAdmin, {
              plant_id: plant.id,
              tipo: 'offline',
              severidade: 'warning',
              titulo: 'Potência instantânea zero em horário solar',
              descricao: `${plant.nome} — Potência instalada: ${powerData.installedPower} kWp`,
              dados_contexto: { instantPower: 0, installedPower: powerData.installedPower, hour },
              todayStart,
            })
            if (alert) {
              alertsCreated++
              jarvisInvocations++
              await dispatchJarvis(supabaseAdmin, alert.id, plant.id, 'offline', 'warning')
            }
          }
        }

        // ── 3e. Save metrics from power data ───────────
        if (powerData) {
          metricsChecked++
          const { error: metricErr } = await supabaseAdmin
            .from('solar_metrics')
            .insert([{
              plant_id: plant.id,
              timestamp: now.toISOString(),
              geracao_kwh: powerData.totalGenerated ?? null,
              potencia_instantanea_kw: powerData.instantPower ?? null,
            }])

          if (metricErr) {
            console.error(`Failed to insert metrics for plant ${plant.id}:`, metricErr)
          }
        }

        // ── 3f. Update last sync timestamp ─────────────
        await supabaseAdmin
          .from('solar_plants')
          .update({
            ultima_sincronizacao: now.toISOString(),
            solarz_status: statusData?.status ?? powerData?.status ?? null,
          })
          .eq('id', plant.id)

      } catch (plantErr) {
        console.error(`Error processing plant ${plant.id} (${externalId}):`, plantErr)
        errorMessage = errorMessage ?? (plantErr instanceof Error ? plantErr.message : String(plantErr))
      }
    }
  } catch (err) {
    console.error('Agent Monitor fatal error:', err)
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  // ── 4. Log execution ──────────────────────────────────
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
    error: errorMessage,
  }

  return new Response(JSON.stringify(result), {
    status: errorMessage ? 500 : 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

// ── Helper: insert alert only if no open alert of same type exists today ──

async function insertAlertIfNew(
  supabaseAdmin: any,
  params: {
    plant_id: string
    tipo: string
    severidade: string
    titulo: string
    descricao: string
    dados_contexto: Record<string, unknown>
    todayStart: string
  },
): Promise<{ id: string } | null> {
  const { data: existing } = await supabaseAdmin
    .from('solar_alerts')
    .select('id')
    .eq('plant_id', params.plant_id)
    .eq('tipo', params.tipo)
    .eq('status', 'aberto')
    .gte('created_at', params.todayStart)
    .maybeSingle()

  if (existing) return null

  const { data: inserted, error } = await supabaseAdmin
    .from('solar_alerts')
    .insert([{
      plant_id: params.plant_id,
      tipo: params.tipo,
      severidade: params.severidade,
      titulo: params.titulo,
      descricao: params.descricao,
      dados_contexto: params.dados_contexto,
      status: 'aberto',
    }])
    .select('id')
    .single()

  if (error) {
    console.error(`Failed to insert ${params.tipo} alert for plant ${params.plant_id}:`, error)
    return null
  }

  return inserted
}
