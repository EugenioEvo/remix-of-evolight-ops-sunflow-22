import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SYSTEM_PROMPT = `Você é o JARVIS, assistente de operações da Evolight Solar.
Analise o alerta e o contexto do cliente para decidir a melhor ação.
Considere: severidade do alerta, histórico de problemas da planta,
se já existe OS aberta para este cliente, e métricas de geração.

Use a função decide_action para retornar sua decisão.`

function buildUserPrompt(ctx: {
  alert: any
  plant: any
  cliente: any
  history: any[]
  openTickets: any[]
  metrics: any[]
}): string {
  const lines = [
    `## Alerta Atual`,
    `- Tipo: ${ctx.alert.tipo}`,
    `- Severidade: ${ctx.alert.severidade}`,
    `- Título: ${ctx.alert.titulo ?? 'N/A'}`,
    `- Descrição: ${ctx.alert.descricao ?? 'N/A'}`,
    ``,
    `## Planta`,
    `- Nome: ${ctx.plant.nome}`,
    `- Potência: ${ctx.plant.potencia_kwp ?? '?'} kWp`,
    `- Inversor: ${ctx.plant.marca_inversor ?? 'N/A'} ${ctx.plant.modelo_inversor ?? ''}`,
    `- Cidade: ${ctx.plant.cidade ?? 'N/A'} / ${ctx.plant.estado ?? 'N/A'}`,
    ``,
    `## Cliente`,
    `- Empresa: ${ctx.cliente?.empresa ?? 'N/A'}`,
    `- Cidade: ${ctx.cliente?.cidade ?? 'N/A'}`,
    ``,
    `## Histórico (últimos 10 alertas)`,
  ]

  if (ctx.history.length === 0) {
    lines.push('Nenhum alerta anterior.')
  } else {
    for (const h of ctx.history) {
      lines.push(`- [${h.created_at?.slice(0, 10)}] ${h.tipo} (${h.severidade}) — ${h.status}`)
    }
  }

  lines.push('', `## OS Abertas para este cliente: ${ctx.openTickets.length}`)
  for (const t of ctx.openTickets.slice(0, 5)) {
    lines.push(`- ${t.numero_ticket}: ${t.titulo} (${t.status})`)
  }

  lines.push('', `## Métricas últimas 24h: ${ctx.metrics.length} registros`)
  if (ctx.metrics.length > 0) {
    const avgGen = ctx.metrics.reduce((s, m) => s + (m.geracao_kwh ?? 0), 0) / ctx.metrics.length
    const avgTemp = ctx.metrics.filter(m => m.temperatura_inversor != null)
    const tempAvg = avgTemp.length > 0 ? avgTemp.reduce((s, m) => s + m.temperatura_inversor, 0) / avgTemp.length : null
    lines.push(`- Geração média: ${avgGen.toFixed(2)} kWh`)
    if (tempAvg !== null) lines.push(`- Temperatura média inversor: ${tempAvg.toFixed(1)} °C`)
  }

  return lines.join('\n')
}

function fallbackDecision(severidade: string): { action: string; reason: string; priority: string } {
  if (severidade === 'critical' || severidade === 'warning') {
    return { action: 'criar_os', reason: 'Fallback: IA indisponível, severidade requer ação imediata', priority: severidade === 'critical' ? 'critica' : 'alta' }
  }
  return { action: 'aguardar', reason: 'Fallback: IA indisponível, severidade baixa permite aguardar', priority: 'baixa' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  let plantId: string | null = null
  let alertType: string | null = null
  let severidade: string | null = null

  try {
    const body = await req.json()
    const alertId: string = body.alert_id
    plantId = body.plant_id
    alertType = body.tipo
    severidade = body.severidade

    if (!alertId || !plantId || !alertType || !severidade) {
      throw new Error('Missing required fields: alert_id, plant_id, tipo, severidade')
    }

    // ── 1. Fetch context in parallel ──────────────────────
    const [plantRes, alertRes, historyRes] = await Promise.all([
      supabaseAdmin
        .from('solar_plants')
        .select('id, nome, endereco, cidade, estado, cliente_id, potencia_kwp, marca_inversor, modelo_inversor, serial_inversor')
        .eq('id', plantId)
        .single(),
      supabaseAdmin
        .from('solar_alerts')
        .select('id, titulo, descricao, tipo, severidade, status, dados_contexto')
        .eq('id', alertId)
        .single(),
      supabaseAdmin
        .from('solar_alerts')
        .select('id, tipo, severidade, status, created_at')
        .eq('plant_id', plantId)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    if (plantRes.error || !plantRes.data) throw new Error(`Plant not found: ${plantId}`)
    const plant = plantRes.data
    const alert = alertRes.data ?? { tipo: alertType, severidade, titulo: null, descricao: null }
    const history = historyRes.data ?? []

    const [clienteRes, ticketsRes, metricsRes] = await Promise.all([
      supabaseAdmin
        .from('clientes')
        .select('id, empresa, cidade, estado')
        .eq('id', plant.cliente_id)
        .single(),
      supabaseAdmin
        .from('tickets')
        .select('id, numero_ticket, titulo, status')
        .eq('cliente_id', plant.cliente_id)
        .not('status', 'in', '("concluido","cancelado")'),
      supabaseAdmin
        .from('solar_metrics')
        .select('geracao_kwh, temperatura_inversor, potencia_instantanea_kw, timestamp')
        .eq('plant_id', plantId)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(50),
    ])

    const cliente = clienteRes.data
    const openTickets = ticketsRes.data ?? []
    const metrics = metricsRes.data ?? []

    // ── 2. Call AI via Lovable AI Gateway ──────────────────
    const userPrompt = buildUserPrompt({ alert, plant, cliente, history, openTickets, metrics })

    let decision: { action: string; reason: string; priority: string }
    let aiRaw: string | null = null

    try {
      const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
      if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

      const aiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      })

      if (!aiResponse.ok) {
        const errText = await aiResponse.text()
        console.error('Claude API error:', aiResponse.status, errText)
        throw new Error(`Claude API returned ${aiResponse.status}`)
      }

      const aiData = await aiResponse.json()
      const content = aiData.content?.[0]?.text ?? ''
      aiRaw = content

      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        decision = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No valid JSON in Claude response')
      }

      // Validate
      const validActions = ['criar_os', 'notificar_cliente', 'aguardar', 'escalar']
      if (!validActions.includes(decision.action)) {
        throw new Error(`Invalid action: ${decision.action}`)
      }
    } catch (aiErr) {
      console.error('AI decision failed, using fallback:', aiErr)
      decision = fallbackDecision(severidade)
      aiRaw = `fallback: ${(aiErr as Error).message}`
    }

    // ── 3. Dispatch based on decision ─────────────────────
    let dispatchedTo: string | null = null

    if (decision.action === 'criar_os') {
      const { data, error } = await supabaseAdmin.functions.invoke('agent-dispatcher', {
        body: { plant_id: plantId, alert_type: alertType, severity: severidade, reason: decision.reason, priority: decision.priority },
      })
      dispatchedTo = 'agent-dispatcher'
      if (error) console.error('Dispatcher invocation error:', error)
      else console.log('Dispatcher result:', data)
    } else if (decision.action === 'escalar') {
      await supabaseAdmin
        .from('solar_alerts')
        .update({ severidade: 'critical' })
        .eq('id', alertId)

      const { data, error } = await supabaseAdmin.functions.invoke('agent-dispatcher', {
        body: { plant_id: plantId, alert_type: alertType, severity: 'critical', reason: decision.reason, priority: 'critica' },
      })
      dispatchedTo = 'agent-dispatcher (escalado)'
      if (error) console.error('Dispatcher invocation error:', error)
    } else if (decision.action === 'notificar_cliente') {
      dispatchedTo = 'notificacao (pendente implementação)'
      console.log(`[JARVIS] Notificar cliente: ${decision.reason}`)
    } else {
      dispatchedTo = null
      console.log(`[JARVIS] Aguardar: ${decision.reason}`)
    }

    // ── 4. Log execution ──────────────────────────────────
    const durationMs = Date.now() - startTime
    await supabaseAdmin.from('solar_agent_logs').insert([{
      agent_name: 'jarvis',
      action: 'orchestrate_decision',
      plant_id: plantId,
      status: 'success',
      duration_ms: durationMs,
      input_data: { alert_id: alertId, tipo: alertType, severidade, context_summary: `${history.length} alerts, ${openTickets.length} open tickets, ${metrics.length} metrics` },
      output_data: { decision, ai_raw: aiRaw, dispatched_to: dispatchedTo },
    }])

    return new Response(JSON.stringify({
      success: true,
      decision: decision.action,
      reason: decision.reason,
      priority: decision.priority,
      dispatched_to: dispatchedTo,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('JARVIS error:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - startTime

    try {
      await supabaseAdmin.from('solar_agent_logs').insert([{
        agent_name: 'jarvis',
        action: 'orchestrate_decision',
        plant_id: plantId,
        status: 'error',
        duration_ms: durationMs,
        error_message: errorMessage,
        input_data: { tipo: alertType, severidade },
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
