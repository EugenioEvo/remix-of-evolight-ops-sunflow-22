import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ── Date helpers ────────────────────────────────────────────

function getMonthRange(mes: number, ano: number) {
  const firstDay = new Date(Date.UTC(ano, mes - 1, 1))
  const lastDay = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999))
  return { firstDay: firstDay.toISOString(), lastDay: lastDay.toISOString() }
}

function daysInMonth(mes: number, ano: number): number {
  return new Date(ano, mes, 0).getDate()
}

// ── KPI calculation per plant ───────────────────────────────

interface PlantKPIs {
  plant_id: string
  plant_name: string
  potencia_kwp: number | null
  geracao_total_kwh: number
  geracao_media_diaria_kwh: number
  dias_geracao_zero: number
  alertas_por_severidade: Record<string, number>
  os_abertas: number
  os_concluidas: number
}

function calculatePlantKPIs(
  plant: { id: string; nome: string; potencia_kwp: number | null },
  metrics: any[],
  alerts: any[],
  tickets: any[],
  totalDays: number,
): PlantKPIs {
  // Group metrics by day
  const dailyGeneration = new Map<string, number>()
  for (const m of metrics) {
    const day = m.timestamp?.substring(0, 10) ?? ''
    const kwh = Number(m.geracao_kwh) || 0
    dailyGeneration.set(day, (dailyGeneration.get(day) ?? 0) + kwh)
  }

  const geracaoTotal = Array.from(dailyGeneration.values()).reduce((s, v) => s + v, 0)
  const diasComDados = dailyGeneration.size
  const diasGeracaoZero = totalDays - diasComDados

  // Alerts by severity
  const alertasPorSeveridade: Record<string, number> = {}
  for (const a of alerts) {
    const sev = a.severidade ?? 'unknown'
    alertasPorSeveridade[sev] = (alertasPorSeveridade[sev] ?? 0) + 1
  }

  // OS stats
  const osAbertas = tickets.filter((t: any) => t.status !== 'concluido' && t.status !== 'cancelado').length
  const osConcluidas = tickets.filter((t: any) => t.status === 'concluido').length

  return {
    plant_id: plant.id,
    plant_name: plant.nome,
    potencia_kwp: plant.potencia_kwp,
    geracao_total_kwh: Math.round(geracaoTotal * 100) / 100,
    geracao_media_diaria_kwh: diasComDados > 0 ? Math.round((geracaoTotal / diasComDados) * 100) / 100 : 0,
    dias_geracao_zero: diasGeracaoZero,
    alertas_por_severidade: alertasPorSeveridade,
    os_abertas: osAbertas,
    os_concluidas: osConcluidas,
  }
}

// ── AI report generation ────────────────────────────────────

async function generateReportText(kpis: PlantKPIs[], mes: number, ano: number, clienteName: string): Promise<string> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
  if (!ANTHROPIC_API_KEY) {
    return buildFallbackReport(kpis, mes, ano, clienteName)
  }

  const systemPrompt = `Você é o assistente de relatórios da Evolight Solar. Gere um relatório mensal claro e profissional para o cliente. Use os dados fornecidos. Tom: profissional mas acessível. Formato: Resumo executivo, Desempenho por planta, Incidentes, Recomendações. Responda em texto puro (sem markdown).`

  const userPrompt = `Cliente: ${clienteName}
Período: ${String(mes).padStart(2, '0')}/${ano}

Dados por planta:
${JSON.stringify(kpis, null, 2)}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      console.error(`Claude API error [${response.status}]:`, await response.text())
      return buildFallbackReport(kpis, mes, ano, clienteName)
    }

    const data = await response.json()
    return data.content?.[0]?.text ?? buildFallbackReport(kpis, mes, ano, clienteName)
  } catch (err) {
    console.error('AI report generation failed:', err)
    return buildFallbackReport(kpis, mes, ano, clienteName)
  }
}

function buildFallbackReport(kpis: PlantKPIs[], mes: number, ano: number, clienteName: string): string {
  const totalGen = kpis.reduce((s, k) => s + k.geracao_total_kwh, 0)
  const totalAlertas = kpis.reduce((s, k) => s + Object.values(k.alertas_por_severidade).reduce((a, b) => a + b, 0), 0)
  const totalOS = kpis.reduce((s, k) => s + k.os_concluidas, 0)

  return `RELATÓRIO MENSAL - ${String(mes).padStart(2, '0')}/${ano}
Cliente: ${clienteName}

RESUMO EXECUTIVO
Geração total do portfólio: ${totalGen.toFixed(1)} kWh
Total de alertas no período: ${totalAlertas}
Ordens de serviço concluídas: ${totalOS}
Plantas monitoradas: ${kpis.length}

DESEMPENHO POR PLANTA
${kpis.map(k => `- ${k.plant_name}: ${k.geracao_total_kwh.toFixed(1)} kWh (média ${k.geracao_media_diaria_kwh.toFixed(1)} kWh/dia, ${k.dias_geracao_zero} dias sem geração)`).join('\n')}

INCIDENTES
${kpis.map(k => {
  const total = Object.values(k.alertas_por_severidade).reduce((a, b) => a + b, 0)
  if (total === 0) return `- ${k.plant_name}: Nenhum alerta registrado`
  const detail = Object.entries(k.alertas_por_severidade).map(([s, c]) => `${s}: ${c}`).join(', ')
  return `- ${k.plant_name}: ${total} alertas (${detail})`
}).join('\n')}

Relatório gerado automaticamente pelo sistema Evolight Solar.`
}

// ── Main handler ────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    const { cliente_id, mes, ano } = await req.json()

    if (!cliente_id || !mes || !ano) {
      return new Response(JSON.stringify({ error: 'cliente_id, mes, and ano are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { firstDay, lastDay } = getMonthRange(mes, ano)
    const totalDays = daysInMonth(mes, ano)

    // Fetch client info
    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('id, empresa, cidade, estado')
      .eq('id', cliente_id)
      .single()

    if (!cliente) {
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch all plants for client
    const { data: plants } = await supabaseAdmin
      .from('solar_plants')
      .select('id, nome, potencia_kwp')
      .eq('cliente_id', cliente_id)
      .eq('ativo', true)

    if (!plants || plants.length === 0) {
      return new Response(JSON.stringify({ error: 'No active plants found for this client' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const plantIds = plants.map(p => p.id)

    // Fetch metrics, alerts, and tickets in parallel
    const [metricsResult, alertsResult, ticketsResult] = await Promise.all([
      supabaseAdmin
        .from('solar_metrics')
        .select('plant_id, timestamp, geracao_kwh')
        .in('plant_id', plantIds)
        .gte('timestamp', firstDay)
        .lte('timestamp', lastDay)
        .order('timestamp', { ascending: true }),
      supabaseAdmin
        .from('solar_alerts')
        .select('plant_id, tipo, severidade, status, created_at')
        .in('plant_id', plantIds)
        .gte('created_at', firstDay)
        .lte('created_at', lastDay),
      supabaseAdmin
        .from('tickets')
        .select('id, status, data_conclusao, equipamento_tipo')
        .eq('cliente_id', cliente_id)
        .gte('data_conclusao', firstDay)
        .lte('data_conclusao', lastDay),
    ])

    const allMetrics = metricsResult.data ?? []
    const allAlerts = alertsResult.data ?? []
    const allTickets = ticketsResult.data ?? []

    // Calculate KPIs per plant
    const plantKPIs: PlantKPIs[] = plants.map(plant => {
      const plantMetrics = allMetrics.filter((m: any) => m.plant_id === plant.id)
      const plantAlerts = allAlerts.filter((a: any) => a.plant_id === plant.id)
      return calculatePlantKPIs(plant, plantMetrics, plantAlerts, allTickets, totalDays)
    })

    // Generate AI report text
    const reportText = await generateReportText(plantKPIs, mes, ano, cliente.empresa ?? 'Cliente')

    // Log execution
    const durationMs = Date.now() - startTime
    await supabaseAdmin.from('solar_agent_logs').insert([{
      agent_name: 'relator',
      action: 'generate_monthly_report',
      input_data: { cliente_id, mes, ano },
      output_data: { report_text: reportText.substring(0, 500) + '...', kpis_summary: plantKPIs },
      status: 'success',
      duration_ms: durationMs,
    }])

    return new Response(JSON.stringify({
      report_text: reportText,
      kpis: plantKPIs,
      plants_summary: {
        total_plants: plants.length,
        total_generation_kwh: plantKPIs.reduce((s, k) => s + k.geracao_total_kwh, 0),
        total_alerts: allAlerts.length,
        total_os_concluidas: allTickets.filter((t: any) => t.status === 'concluido').length,
      },
      periodo: `${String(mes).padStart(2, '0')}/${ano}`,
      cliente: cliente.empresa,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Agent Relator error:', err)
    const durationMs = Date.now() - startTime
    const errorMsg = err instanceof Error ? err.message : String(err)

    try {
      await supabaseAdmin.from('solar_agent_logs').insert([{
        agent_name: 'relator',
        action: 'generate_monthly_report',
        status: 'error',
        error_message: errorMsg,
        duration_ms: durationMs,
      }])
    } catch { /* ignore log failure */ }

    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
