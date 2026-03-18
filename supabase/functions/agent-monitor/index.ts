import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ── Detection thresholds ────────────────────────────────────
const OFFLINE_THRESHOLD_MIN = 30
const LOW_GENERATION_RATIO = 0.70
const HIGH_TEMP_CELSIUS = 65

// ── SolarZ API helpers ──────────────────────────────────────

async function solarzLogin(baseUrl: string, username: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SolarZ auth failed [${res.status}]: ${body}`)
  }
  const data = await res.json()
  return data.token
}

async function solarzFetch(baseUrl: string, token: string, path: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SolarZ ${path} failed [${res.status}]: ${body}`)
  }
  return res.json()
}

// ── Alert classification ────────────────────────────────────

function classifyAlert(type: string, rawSeverity?: string): { tipo: string; severidade: string } {
  const typeMap: Record<string, string> = {
    offline: 'offline',
    low_generation: 'baixa_geracao',
    inverter_error: 'erro_inversor',
    communication: 'comunicacao',
    temperature: 'temperatura',
  }
  const tipo = typeMap[type] ?? type

  // Override severity based on rules
  if (tipo === 'offline' || tipo === 'temperatura') return { tipo, severidade: 'critical' }
  if (tipo === 'erro_inversor') return { tipo, severidade: 'critical' }
  if (tipo === 'baixa_geracao' || tipo === 'comunicacao') return { tipo, severidade: 'warning' }

  const sevMap: Record<string, string> = { critical: 'critical', error: 'critical', warning: 'warning', info: 'info' }
  return { tipo, severidade: sevMap[rawSeverity ?? ''] ?? 'info' }
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

    // ── 2. Authenticate with SolarZ ──────────────────────
    const token = await solarzLogin(SOLARZ_API_URL, SOLARZ_USERNAME, SOLARZ_PASSWORD)

    // ── 3. Get all registered plants ─────────────────────
    const { data: plants, error: plantsErr } = await supabaseAdmin
      .from('solar_plants')
      .select('id, solarz_plant_id, nome, potencia_kwp')
      .eq('ativo', true)
      .not('solarz_plant_id', 'is', null)

    if (plantsErr) throw plantsErr
    if (!plants || plants.length === 0) {
      throw new Error('No active plants with solarz_plant_id found')
    }

    // ── 4. Process each plant ────────────────────────────
    for (const plant of plants) {
      plantsProcessed++
      const externalId = plant.solarz_plant_id!

      try {
        // 4a. Fetch SolarZ alerts
        const rawAlerts = await solarzFetch(SOLARZ_API_URL, token, `/plants/${externalId}/alerts`)
        const alertList = Array.isArray(rawAlerts) ? rawAlerts : (rawAlerts.data ?? [])

        for (const raw of alertList) {
          const alertExternalId = raw.id ?? raw.alert_id
          if (!alertExternalId) continue

          // Check if already exists (by dados_contexto->external_id)
          const { data: existing } = await supabaseAdmin
            .from('solar_alerts')
            .select('id')
            .eq('plant_id', plant.id)
            .contains('dados_contexto', { external_id: alertExternalId })
            .maybeSingle()

          if (existing) continue

          const { tipo, severidade } = classifyAlert(raw.type ?? raw.tipo, raw.severity)

          const { error: insertErr } = await supabaseAdmin
            .from('solar_alerts')
            .insert([{
              plant_id: plant.id,
              tipo,
              severidade,
              titulo: raw.title ?? raw.titulo ?? `Alerta: ${tipo}`,
              descricao: raw.description ?? raw.descricao ?? null,
              dados_contexto: { external_id: alertExternalId, raw_data: raw },
              status: 'aberto',
            }])

          if (insertErr) {
            console.error(`Failed to insert alert for plant ${plant.id}:`, insertErr)
          } else {
            alertsCreated++

            // If critical, invoke dispatcher (future JARVIS step)
            if (severidade === 'critical') {
              try {
                await supabaseAdmin.functions.invoke('agent-dispatcher', {
                  body: { plant_id: plant.id, alert_type: tipo, severity: severidade },
                })
              } catch (dispatchErr) {
                // Non-fatal: dispatcher may not exist yet
                console.warn('Dispatcher invocation failed (may not exist yet):', dispatchErr)
              }
            }
          }
        }

        // 4b. Fetch metrics (last 24h) and check generation
        const now = new Date()
        const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const metricsPath = `/plants/${externalId}/metrics?start=${since.toISOString()}&end=${now.toISOString()}`

        let rawMetrics: any[] = []
        try {
          const metricsRes = await solarzFetch(SOLARZ_API_URL, token, metricsPath)
          rawMetrics = Array.isArray(metricsRes) ? metricsRes : (metricsRes.data ?? [])
        } catch {
          console.warn(`Could not fetch metrics for plant ${externalId}`)
        }

        if (rawMetrics.length > 0) {
          metricsChecked++

          // Save metrics
          const metricRows = rawMetrics.map((m: any) => ({
            plant_id: plant.id,
            timestamp: m.timestamp,
            geracao_kwh: m.generation_kwh ?? m.geracao_kwh ?? null,
            potencia_instantanea_kw: m.instant_power_kw ?? null,
            irradiacao_wm2: m.irradiation_wm2 ?? null,
            temperatura_inversor: m.inverter_temp ?? null,
            tensao_dc: m.voltage_dc ?? null,
            corrente_dc: m.current_dc ?? null,
            tensao_ac: m.voltage_ac ?? null,
            corrente_ac: m.current_ac ?? null,
            frequencia_hz: m.frequency_hz ?? null,
            fator_potencia: m.power_factor ?? null,
            eficiencia_percent: m.efficiency ?? null,
          }))

          const { error: metricErr } = await supabaseAdmin
            .from('solar_metrics')
            .insert(metricRows)

          if (metricErr) {
            console.error(`Failed to insert metrics for plant ${plant.id}:`, metricErr)
          }

          // 4c. Compare with historical average (last 30 days)
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          const { data: historicalMetrics } = await supabaseAdmin
            .from('solar_metrics')
            .select('geracao_kwh')
            .eq('plant_id', plant.id)
            .gte('timestamp', thirtyDaysAgo.toISOString())
            .lt('timestamp', since.toISOString())

          if (historicalMetrics && historicalMetrics.length > 0) {
            const avgHistorical =
              historicalMetrics.reduce((sum, m) => sum + (Number(m.geracao_kwh) || 0), 0) /
              historicalMetrics.length

            const currentTotal = rawMetrics.reduce(
              (sum: number, m: any) => sum + (Number(m.generation_kwh ?? m.geracao_kwh) || 0),
              0,
            )
            const currentAvg = currentTotal / rawMetrics.length

            if (avgHistorical > 0 && currentAvg < avgHistorical * LOW_GENERATION_RATIO) {
              // Check if low_gen alert already exists for today
              const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
              const { data: existingLowGen } = await supabaseAdmin
                .from('solar_alerts')
                .select('id')
                .eq('plant_id', plant.id)
                .eq('tipo', 'baixa_geracao')
                .eq('status', 'aberto')
                .gte('created_at', todayStart)
                .maybeSingle()

              if (!existingLowGen) {
                const ratio = Math.round((currentAvg / avgHistorical) * 100)
                await supabaseAdmin.from('solar_alerts').insert([{
                  plant_id: plant.id,
                  tipo: 'baixa_geracao',
                  severidade: 'warning',
                  titulo: `Baixa geração: ${ratio}% da média`,
                  descricao: `Planta ${plant.nome} gerando ${ratio}% da média histórica (${avgHistorical.toFixed(1)} kWh avg vs ${currentAvg.toFixed(1)} kWh atual).`,
                  dados_contexto: { avg_historical: avgHistorical, current_avg: currentAvg, ratio },
                  status: 'aberto',
                }])
                alertsCreated++
              }
            }
          }

          // 4d. Check temperature alerts
          for (const m of rawMetrics) {
            const temp = Number(m.inverter_temp ?? 0)
            if (temp > HIGH_TEMP_CELSIUS) {
              const { data: existingTemp } = await supabaseAdmin
                .from('solar_alerts')
                .select('id')
                .eq('plant_id', plant.id)
                .eq('tipo', 'temperatura')
                .eq('status', 'aberto')
                .maybeSingle()

              if (!existingTemp) {
                await supabaseAdmin.from('solar_alerts').insert([{
                  plant_id: plant.id,
                  tipo: 'temperatura',
                  severidade: 'critical',
                  titulo: `Temperatura inversor elevada: ${temp.toFixed(1)}°C`,
                  descricao: `Inversor da planta ${plant.nome} atingiu ${temp.toFixed(1)}°C (limite: ${HIGH_TEMP_CELSIUS}°C).`,
                  dados_contexto: { temperature: temp, threshold: HIGH_TEMP_CELSIUS, timestamp: m.timestamp },
                  status: 'aberto',
                }])
                alertsCreated++

                // Critical → dispatch
                try {
                  await supabaseAdmin.functions.invoke('agent-dispatcher', {
                    body: { plant_id: plant.id, alert_type: 'temperatura', severity: 'critical' },
                  })
                } catch { /* dispatcher may not exist yet */ }
              }
              break // one temp alert per plant per run
            }
          }
        }

        // Update last sync timestamp
        await supabaseAdmin
          .from('solar_plants')
          .update({ ultima_sincronizacao: now.toISOString() })
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

  // ── 6. Log execution ──────────────────────────────────
  const durationMs = Date.now() - startTime

  try {
    await supabaseAdmin.from('solar_agent_logs').insert([{
      agent_name: 'monitor',
      action: 'sync_all_plants',
      status: errorMessage ? 'error' : 'success',
      duration_ms: durationMs,
      error_message: errorMessage,
      input_data: { plants_processed: plantsProcessed },
      output_data: { alerts_created: alertsCreated, metrics_checked: metricsChecked },
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
    error: errorMessage,
  }

  return new Response(JSON.stringify(result), {
    status: errorMessage ? 500 : 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
