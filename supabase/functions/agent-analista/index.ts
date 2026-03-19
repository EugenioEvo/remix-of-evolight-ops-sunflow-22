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

// Estimated peak sun hours by month (average for Brazil)
const PEAK_SUN_HOURS: Record<number, number> = {
  1: 5.0, 2: 5.2, 3: 5.0, 4: 4.5, 5: 4.0, 6: 3.8,
  7: 4.0, 8: 4.5, 9: 4.8, 10: 5.0, 11: 5.2, 12: 5.0,
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
    const { mes, ano, cliente_id } = await req.json()

    if (!mes || !ano) {
      return new Response(JSON.stringify({ error: 'mes and ano are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { firstDay, lastDay } = getMonthRange(mes, ano)
    const totalDays = daysInMonth(mes, ano)
    const peakSunHours = PEAK_SUN_HOURS[mes] ?? 4.5

    // ── Build plant query ───────────────────────────────
    let plantsQuery = supabaseAdmin
      .from('solar_plants')
      .select('id, nome, potencia_kwp, cliente_id')
      .eq('ativo', true)

    if (cliente_id) {
      plantsQuery = plantsQuery.eq('cliente_id', cliente_id)
    }

    const { data: plants, error: plantsErr } = await plantsQuery
    if (plantsErr) throw plantsErr

    const plantIds = (plants ?? []).map(p => p.id)

    // ── Parallel data fetching ──────────────────────────
    const [alertsResult, metricsResult, ticketsResult, resolvedAlertsResult] = await Promise.all([
      // All alerts in period
      supabaseAdmin
        .from('solar_alerts')
        .select('id, plant_id, tipo, severidade, status, created_at, resolvido_em')
        .gte('created_at', firstDay)
        .lte('created_at', lastDay)
        .in('plant_id', plantIds.length > 0 ? plantIds : ['00000000-0000-0000-0000-000000000000']),
      // All metrics in period
      supabaseAdmin
        .from('solar_metrics')
        .select('plant_id, timestamp, geracao_kwh')
        .gte('timestamp', firstDay)
        .lte('timestamp', lastDay)
        .in('plant_id', plantIds.length > 0 ? plantIds : ['00000000-0000-0000-0000-000000000000']),
      // Tickets in period
      (() => {
        let q = supabaseAdmin
          .from('tickets')
          .select('id, status, data_abertura, data_conclusao, equipamento_tipo, cliente_id')
          .gte('data_abertura', firstDay)
          .lte('data_abertura', lastDay)
        if (cliente_id) q = q.eq('cliente_id', cliente_id)
        return q
      })(),
      // Resolved alerts for MTTR
      supabaseAdmin
        .from('solar_alerts')
        .select('id, plant_id, created_at, resolvido_em')
        .eq('status', 'resolvido')
        .not('resolvido_em', 'is', null)
        .gte('created_at', firstDay)
        .lte('created_at', lastDay)
        .in('plant_id', plantIds.length > 0 ? plantIds : ['00000000-0000-0000-0000-000000000000']),
    ])

    const alerts = alertsResult.data ?? []
    const metrics = metricsResult.data ?? []
    const tickets = ticketsResult.data ?? []
    const resolvedAlerts = resolvedAlertsResult.data ?? []

    // ── 1. Alerts by severity ───────────────────────────
    const alertsBySeverity: Record<string, number> = {}
    for (const a of alerts) {
      const sev = a.severidade ?? 'unknown'
      alertsBySeverity[sev] = (alertsBySeverity[sev] ?? 0) + 1
    }

    // ── 2. MTTR (Mean Time To Repair) ───────────────────
    const repairTimesHours: number[] = []
    for (const a of resolvedAlerts) {
      if (a.created_at && a.resolvido_em) {
        const created = new Date(a.created_at).getTime()
        const resolved = new Date(a.resolvido_em).getTime()
        const diffHours = (resolved - created) / (1000 * 60 * 60)
        if (diffHours >= 0) repairTimesHours.push(diffHours)
      }
    }
    const mttrHours = repairTimesHours.length > 0
      ? Math.round((repairTimesHours.reduce((s, v) => s + v, 0) / repairTimesHours.length) * 10) / 10
      : null

    // ── 3. Resolution rate ──────────────────────────────
    const totalAlerts = alerts.length
    const resolvedCount = alerts.filter(a => a.status === 'resolvido').length
    const resolutionRate = totalAlerts > 0 ? Math.round((resolvedCount / totalAlerts) * 1000) / 10 : null

    // ── 4. Top 5 plants with most incidents ─────────────
    const incidentsByPlant = new Map<string, { count: number; name: string }>()
    for (const a of alerts) {
      const plant = (plants ?? []).find(p => p.id === a.plant_id)
      const entry = incidentsByPlant.get(a.plant_id) ?? { count: 0, name: plant?.nome ?? 'Unknown' }
      entry.count++
      incidentsByPlant.set(a.plant_id, entry)
    }
    const top5Incidents = Array.from(incidentsByPlant.entries())
      .map(([id, v]) => ({ plant_id: id, plant_name: v.name, incident_count: v.count }))
      .sort((a, b) => b.incident_count - a.incident_count)
      .slice(0, 5)

    // ── 5. Generation vs capacity (Performance Ratio) ───
    const generationByPlant = new Map<string, number>()
    for (const m of metrics) {
      const kwh = Number(m.geracao_kwh) || 0
      generationByPlant.set(m.plant_id, (generationByPlant.get(m.plant_id) ?? 0) + kwh)
    }

    const totalCapacityKwp = (plants ?? []).reduce((s, p) => s + (Number(p.potencia_kwp) || 0), 0)
    const expectedGenerationKwh = totalCapacityKwp * peakSunHours * totalDays
    const actualGenerationKwh = Array.from(generationByPlant.values()).reduce((s, v) => s + v, 0)
    const performanceRatio = expectedGenerationKwh > 0
      ? Math.round((actualGenerationKwh / expectedGenerationKwh) * 1000) / 10
      : null

    // ── 6. Plant availability ───────────────────────────
    const plantAvailability = (plants ?? []).map(plant => {
      // Count days with any generation
      const plantMetrics = metrics.filter(m => m.plant_id === plant.id)
      const daysWithData = new Set(plantMetrics.map(m => m.timestamp?.substring(0, 10))).size
      const availability = Math.round((daysWithData / totalDays) * 1000) / 10
      return {
        plant_id: plant.id,
        plant_name: plant.nome,
        days_online: daysWithData,
        days_total: totalDays,
        availability_percent: availability,
      }
    })

    const portfolioAvailability = plantAvailability.length > 0
      ? Math.round((plantAvailability.reduce((s, p) => s + p.availability_percent, 0) / plantAvailability.length) * 10) / 10
      : null

    // ── 7. OS statistics ────────────────────────────────
    const osAbertas = tickets.length
    const osConcluidas = tickets.filter(t => t.status === 'concluido').length
    const osCanceladas = tickets.filter(t => t.status === 'cancelado').length

    // Average completion time
    const completionTimesHours: number[] = []
    for (const t of tickets) {
      if (t.data_abertura && t.data_conclusao) {
        const opened = new Date(t.data_abertura).getTime()
        const closed = new Date(t.data_conclusao).getTime()
        const diffHours = (closed - opened) / (1000 * 60 * 60)
        if (diffHours >= 0) completionTimesHours.push(diffHours)
      }
    }
    const avgCompletionHours = completionTimesHours.length > 0
      ? Math.round((completionTimesHours.reduce((s, v) => s + v, 0) / completionTimesHours.length) * 10) / 10
      : null

    // OS by equipment type
    const osByEquipType: Record<string, number> = {}
    for (const t of tickets) {
      const tipo = t.equipamento_tipo ?? 'outros'
      osByEquipType[tipo] = (osByEquipType[tipo] ?? 0) + 1
    }

    // ── Build result ────────────────────────────────────
    const kpis = {
      periodo: `${String(mes).padStart(2, '0')}/${ano}`,
      cliente_id: cliente_id ?? null,
      portfolio: {
        total_plants: (plants ?? []).length,
        total_capacity_kwp: totalCapacityKwp,
        actual_generation_kwh: Math.round(actualGenerationKwh * 100) / 100,
        expected_generation_kwh: Math.round(expectedGenerationKwh * 100) / 100,
        performance_ratio_percent: performanceRatio,
        portfolio_availability_percent: portfolioAvailability,
      },
      alerts: {
        total: totalAlerts,
        by_severity: alertsBySeverity,
        resolved: resolvedCount,
        resolution_rate_percent: resolutionRate,
        mttr_hours: mttrHours,
      },
      top_incident_plants: top5Incidents,
      plant_availability: plantAvailability,
      work_orders: {
        total_opened: osAbertas,
        total_completed: osConcluidas,
        total_cancelled: osCanceladas,
        avg_completion_hours: avgCompletionHours,
        by_equipment_type: osByEquipType,
      },
    }

    // ── Log execution ───────────────────────────────────
    const durationMs = Date.now() - startTime
    await supabaseAdmin.from('solar_agent_logs').insert([{
      agent_name: 'analista',
      action: 'generate_kpis',
      input_data: { mes, ano, cliente_id: cliente_id ?? null },
      output_data: kpis,
      status: 'success',
      duration_ms: durationMs,
    }])

    return new Response(JSON.stringify(kpis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Agent Analista error:', err)
    const durationMs = Date.now() - startTime
    const errorMsg = err instanceof Error ? err.message : String(err)

    try {
      await supabaseAdmin.from('solar_agent_logs').insert([{
        agent_name: 'analista',
        action: 'generate_kpis',
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
