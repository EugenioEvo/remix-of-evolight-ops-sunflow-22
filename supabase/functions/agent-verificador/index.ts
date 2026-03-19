import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const RESOLUTION_THRESHOLD = 0.8 // 80% da média histórica

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  let rmeId: string | null = null
  let plantId: string | null = null

  try {
    const body = await req.json()
    rmeId = body.rme_id
    const osIdInput: string | null = body.os_id ?? null
    const ticketIdInput: string | null = body.ticket_id ?? null

    if (!rmeId) {
      throw new Error('Missing required field: rme_id')
    }

    // ── 1. Busca RME ──────────────────────────────────────
    const { data: rme, error: rmeErr } = await supabaseAdmin
      .from('rme_relatorios')
      .select('id, ordem_servico_id, ticket_id, tecnico_id, servicos_executados, condicoes_encontradas, data_execucao')
      .eq('id', rmeId)
      .single()

    if (rmeErr || !rme) throw new Error(`RME not found: ${rmeId}`)

    const osId = osIdInput ?? rme.ordem_servico_id
    const ticketId = ticketIdInput ?? rme.ticket_id

    // ── 2. Busca OS e Ticket ──────────────────────────────
    const [osRes, ticketRes] = await Promise.all([
      supabaseAdmin.from('ordens_servico').select('id, numero_os, ticket_id, tecnico_id').eq('id', osId).single(),
      supabaseAdmin.from('tickets').select('id, numero_ticket, titulo, cliente_id, origem').eq('id', ticketId).single(),
    ])

    if (osRes.error || !osRes.data) throw new Error(`OS not found: ${osId}`)
    if (ticketRes.error || !ticketRes.data) throw new Error(`Ticket not found: ${ticketId}`)

    const ticket = ticketRes.data

    // ── 3. Busca alerta solar vinculado ───────────────────
    const { data: alertas } = await supabaseAdmin
      .from('solar_alerts')
      .select('id, plant_id, tipo, severidade, status, created_at')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (!alertas || alertas.length === 0) {
      // Ticket manual, sem alerta solar — skip
      const durationMs = Date.now() - startTime
      await supabaseAdmin.from('solar_agent_logs').insert([{
        agent_name: 'verificador',
        action: 'verify_resolution',
        status: 'skipped',
        duration_ms: durationMs,
        input_data: { rme_id: rmeId, os_id: osId, ticket_id: ticketId },
        output_data: { reason: 'No solar alert linked — manual ticket' },
      }])

      return new Response(JSON.stringify({
        resolved: null,
        metrics: null,
        action_taken: 'skipped',
        reason: 'Ticket manual sem alerta solar vinculado',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const alerta = alertas[0]
    plantId = alerta.plant_id

    // ── 4. Métricas atuais (últimas 24h) ──────────────────
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    const { data: currentMetrics } = await supabaseAdmin
      .from('solar_metrics')
      .select('geracao_kwh, timestamp')
      .eq('plant_id', plantId)
      .gte('timestamp', last24h)
      .order('timestamp', { ascending: false })
      .limit(100)

    // ── 5. Média histórica (últimos 30 dias, excluindo últimas 24h) ──
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: historicalMetrics } = await supabaseAdmin
      .from('solar_metrics')
      .select('geracao_kwh')
      .eq('plant_id', plantId)
      .gte('timestamp', thirtyDaysAgo)
      .lt('timestamp', last24h)
      .limit(1000)

    // ── 6. Avalia resolução ───────────────────────────────
    const validCurrent = (currentMetrics ?? []).filter(m => m.geracao_kwh != null)
    const validHistorical = (historicalMetrics ?? []).filter(m => m.geracao_kwh != null)

    if (validCurrent.length === 0) {
      // Sem dados recentes — pendente
      const durationMs = Date.now() - startTime
      await supabaseAdmin.from('solar_agent_logs').insert([{
        agent_name: 'verificador',
        action: 'verify_resolution',
        plant_id: plantId,
        status: 'pending',
        duration_ms: durationMs,
        input_data: { rme_id: rmeId, alert_id: alerta.id },
        output_data: { reason: 'No current metrics available yet' },
      }])

      return new Response(JSON.stringify({
        resolved: null,
        metrics: { current_avg: null, historical_avg: null, ratio: null },
        action_taken: 'pending',
        reason: 'Sem métricas disponíveis nas últimas 24h',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const currentAvg = validCurrent.reduce((s, m) => s + (m.geracao_kwh ?? 0), 0) / validCurrent.length
    const historicalAvg = validHistorical.length > 0
      ? validHistorical.reduce((s, m) => s + (m.geracao_kwh ?? 0), 0) / validHistorical.length
      : currentAvg // sem histórico, usa atual como referência

    const ratio = historicalAvg > 0 ? currentAvg / historicalAvg : 1
    const resolved = ratio >= RESOLUTION_THRESHOLD

    const metrics = {
      current_avg: Math.round(currentAvg * 100) / 100,
      historical_avg: Math.round(historicalAvg * 100) / 100,
      ratio: Math.round(ratio * 1000) / 10, // percentage
      current_samples: validCurrent.length,
      historical_samples: validHistorical.length,
    }

    let actionTaken: string

    if (resolved) {
      // ── 7. RESOLVIDO ────────────────────────────────────
      await supabaseAdmin
        .from('solar_alerts')
        .update({ status: 'resolvido', resolvido_em: new Date().toISOString() })
        .eq('id', alerta.id)

      actionTaken = 'resolved'

      const durationMs = Date.now() - startTime
      await supabaseAdmin.from('solar_agent_logs').insert([{
        agent_name: 'verificador',
        action: 'verify_resolution',
        plant_id: plantId,
        status: 'success',
        duration_ms: durationMs,
        input_data: { rme_id: rmeId, alert_id: alerta.id, ticket_id: ticketId },
        output_data: { resolved: true, metrics, action_taken: actionTaken },
      }])
    } else {
      // ── 8. NÃO RESOLVIDO — escalar ─────────────────────
      const { data: newAlert, error: alertErr } = await supabaseAdmin
        .from('solar_alerts')
        .insert([{
          plant_id: plantId,
          tipo: 'verificacao_falha',
          severidade: 'warning',
          titulo: 'Problema não resolvido após manutenção',
          descricao: `Após execução da OS ${osRes.data.numero_os}, a geração atual (${metrics.current_avg} kWh) representa ${metrics.ratio}% da média histórica (${metrics.historical_avg} kWh), abaixo do limiar de ${RESOLUTION_THRESHOLD * 100}%.`,
          dados_contexto: {
            rme_id: rmeId,
            original_alert_id: alerta.id,
            geracao_atual: metrics.current_avg,
            media_historica: metrics.historical_avg,
            ratio: metrics.ratio,
            os_numero: osRes.data.numero_os,
            ticket_numero: ticket.numero_ticket,
          },
          ticket_id: ticketId,
        }])
        .select('id')
        .single()

      if (alertErr || !newAlert) {
        console.error('Failed to create escalation alert:', alertErr)
        throw new Error('Failed to create escalation alert')
      }

      // Invocar JARVIS para decidir próximo passo
      try {
        const { data: jarvisResult, error: jarvisErr } = await supabaseAdmin.functions.invoke('jarvis-orchestrator', {
          body: {
            alert_id: newAlert.id,
            plant_id: plantId,
            tipo: 'verificacao_falha',
            severidade: 'warning',
          },
        })
        if (jarvisErr) console.error('JARVIS invocation error:', jarvisErr)
        else console.log('[Verificador] JARVIS decision:', jarvisResult)
      } catch (jarvisErr) {
        console.error('JARVIS invocation failed:', jarvisErr)
      }

      actionTaken = 'escalated'

      const durationMs = Date.now() - startTime
      await supabaseAdmin.from('solar_agent_logs').insert([{
        agent_name: 'verificador',
        action: 'verify_resolution',
        plant_id: plantId,
        status: 'success',
        duration_ms: durationMs,
        input_data: { rme_id: rmeId, alert_id: alerta.id, ticket_id: ticketId },
        output_data: { resolved: false, metrics, action_taken: actionTaken, new_alert_id: newAlert.id },
      }])
    }

    return new Response(JSON.stringify({
      resolved,
      metrics,
      action_taken: actionTaken,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Verificador error:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - startTime

    try {
      await supabaseAdmin.from('solar_agent_logs').insert([{
        agent_name: 'verificador',
        action: 'verify_resolution',
        plant_id: plantId,
        status: 'error',
        duration_ms: durationMs,
        error_message: errorMessage,
        input_data: { rme_id: rmeId },
        output_data: {},
      }])
    } catch (logErr) {
      console.error('Failed to write agent log:', logErr)
    }

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
