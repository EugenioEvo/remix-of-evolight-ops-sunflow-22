import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// ── Alert → Ticket mapping ─────────────────────────────────

function buildTicketTitle(alertType: string, plantName: string): string {
  const titles: Record<string, string> = {
    offline: `Inversor offline - ${plantName}`,
    temperatura: `Temperatura elevada inversor - ${plantName}`,
    baixa_geracao: `Baixa geração detectada - ${plantName}`,
    erro_inversor: `Erro no inversor - ${plantName}`,
    comunicacao: `Falha de comunicação - ${plantName}`,
  }
  return titles[alertType] ?? `Alerta ${alertType} - ${plantName}`
}

function mapSeverityToPriority(severity: string): string {
  if (severity === 'critical') return 'critica'
  if (severity === 'warning') return 'alta'
  return 'media'
}

function mapAlertToEquipamento(alertType: string): string {
  if (['offline', 'erro_inversor', 'temperatura'].includes(alertType)) return 'inversor'
  if (alertType === 'baixa_geracao') return 'painel_solar'
  if (alertType === 'comunicacao') return 'monitoramento'
  return 'inversor'
}

// ── Main handler ────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()
  let errorMessage: string | null = null
  let outputData: Record<string, unknown> = {}

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  let plantId: string | null = null
  let alertType: string | null = null
  let severity: string | null = null

  try {
    const body = await req.json()
    plantId = body.plant_id
    alertType = body.alert_type
    severity = body.severity
    const reason: string | undefined = body.reason
    const priorityOverride: string | undefined = body.priority

    if (!plantId || !alertType || !severity) {
      throw new Error('Missing required fields: plant_id, alert_type, severity')
    }

    // ── 1. Fetch plant + client data ──────────────────────
    const { data: plant, error: plantErr } = await supabaseAdmin
      .from('solar_plants')
      .select('id, nome, endereco, cidade, estado, cliente_id, potencia_kwp, marca_inversor, modelo_inversor, serial_inversor')
      .eq('id', plantId)
      .single()

    if (plantErr || !plant) {
      throw new Error(`Plant not found: ${plantId}`)
    }

    const { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('id, empresa, endereco, cidade, estado, cep')
      .eq('id', plant.cliente_id)
      .single()

    // ── 2. Fetch latest open alert ────────────────────────
    const { data: latestAlert } = await supabaseAdmin
      .from('solar_alerts')
      .select('id, titulo, descricao, dados_contexto')
      .eq('plant_id', plantId)
      .eq('tipo', alertType)
      .eq('status', 'aberto')
      .is('ticket_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // ── 3. Check for existing open ticket for same plant+type
    const { data: existingTicket } = await supabaseAdmin
      .from('tickets')
      .select('id, numero_ticket')
      .eq('cliente_id', plant.cliente_id)
      .eq('origem', 'agente_monitor')
      .in('status', ['aberto', 'aguardando_aprovacao', 'aprovado', 'ordem_servico_gerada', 'em_execucao'])
      .ilike('titulo', `%${plant.nome}%`)
      .maybeSingle()

    if (existingTicket) {
      // Link alert to existing ticket if needed
      if (latestAlert) {
        await supabaseAdmin
          .from('solar_alerts')
          .update({ ticket_id: existingTicket.id })
          .eq('id', latestAlert.id)
      }

      outputData = {
        action: 'skipped_duplicate',
        existing_ticket_id: existingTicket.id,
        existing_ticket_numero: existingTicket.numero_ticket,
      }

      await logExecution(supabaseAdmin, plantId, alertType, severity, outputData, null, startTime)

      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        message: `Ticket já existe para esta planta: ${existingTicket.numero_ticket}`,
        ticket_id: existingTicket.id,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 4. Find best available technician ─────────────────
    const { data: prestadores } = await supabaseAdmin
      .from('prestadores')
      .select('id, nome, email, cidade')
      .eq('categoria', 'tecnico')
      .eq('ativo', true)

    let selectedTecnico: { id: string; nome: string } | null = null

    if (prestadores && prestadores.length > 0) {
      // Count open OS per technician
      const tecnicosWithLoad = await Promise.all(
        prestadores.map(async (p) => {
          // Find tecnico_id via prestador email → tecnicos table
          const { data: tecnico } = await supabaseAdmin
            .from('tecnicos')
            .select('id, profiles!inner(email)')
            .ilike('profiles.email', p.email)
            .maybeSingle()

          const tecnicoId = tecnico?.id ?? null

          let openOsCount = 0
          if (tecnicoId) {
            const { count } = await supabaseAdmin
              .from('ordens_servico')
              .select('id', { count: 'exact', head: true })
              .eq('tecnico_id', tecnicoId)

            openOsCount = count ?? 0
          }

          return {
            prestadorId: p.id,
            prestadorNome: p.nome,
            cidade: p.cidade,
            openOsCount,
          }
        })
      )

      const clientCity = cliente?.cidade?.toLowerCase() ?? ''

      // Prefer technicians in same city, then least loaded
      const sameCityTecnicos = tecnicosWithLoad
        .filter((t) => t.cidade?.toLowerCase() === clientCity)
        .sort((a, b) => a.openOsCount - b.openOsCount)

      const allSorted = tecnicosWithLoad
        .sort((a, b) => a.openOsCount - b.openOsCount)

      const chosen = sameCityTecnicos[0] ?? allSorted[0]

      if (chosen) {
        selectedTecnico = { id: chosen.prestadorId, nome: chosen.prestadorNome }
      }
    }

    // ── 5. Get a created_by user (admin) ──────────────────
    // created_by has FK to auth.users, so we must use user_id directly
    const { data: adminRole } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    const createdBy = adminRole?.user_id ?? '00000000-0000-0000-0000-000000000000'

    // ── 6. Build ticket description ───────────────────────
    const endereco = plant.endereco ?? cliente?.endereco ?? 'Endereço não informado'
    const alertDesc = latestAlert?.descricao ?? reason ?? `Alerta ${alertType} detectado automaticamente`
    const description = [
      `🤖 Ticket gerado automaticamente pelo Agente Monitor.`,
      ``,
      `**Alerta:** ${latestAlert?.titulo ?? alertType}`,
      `**Severidade:** ${severity}`,
      `**Planta:** ${plant.nome} (${plant.potencia_kwp ?? '?'} kWp)`,
      `**Cliente:** ${cliente?.empresa ?? 'N/A'}`,
      plant.marca_inversor ? `**Inversor:** ${plant.marca_inversor} ${plant.modelo_inversor ?? ''} (S/N: ${plant.serial_inversor ?? 'N/A'})` : null,
      ``,
      `**Detalhes:** ${alertDesc}`,
    ]
      .filter(Boolean)
      .join('\n')

    const priority = priorityOverride ?? mapSeverityToPriority(severity)

    // ── 7. Create ticket ──────────────────────────────────
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from('tickets')
      .insert({
        titulo: buildTicketTitle(alertType, plant.nome),
        descricao: description,
        cliente_id: plant.cliente_id,
        prioridade: priority,
        equipamento_tipo: mapAlertToEquipamento(alertType),
        endereco_servico: endereco,
        tecnico_responsavel_id: selectedTecnico?.id ?? null,
        created_by: createdBy,
        origem: 'agente_monitor',
        status: selectedTecnico ? 'aprovado' : 'aberto',
      })
      .select('id, numero_ticket')
      .single()

    if (ticketErr || !ticket) {
      throw new Error(`Failed to create ticket: ${ticketErr?.message ?? 'unknown'}`)
    }

    console.log(`Ticket created: ${ticket.numero_ticket} for plant ${plant.nome}`)

    // ── 8. Generate OS via edge function ──────────────────
    let osResult: any = null
    if (selectedTecnico) {
      try {
        const { data: osData, error: osErr } = await supabaseAdmin.functions.invoke('gerar-ordem-servico', {
          body: {
            ticketId: ticket.id,
            servico_solicitado: 'MANUTENÇÃO CORRETIVA',
            tipo_trabalho: ['corretiva'],
          },
          headers: {
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
        })

        if (osErr) {
          console.error('OS generation error:', osErr)
        } else {
          osResult = osData
          console.log(`OS generated for ticket ${ticket.numero_ticket}`)
        }
      } catch (osInvokeErr) {
        console.error('OS invocation failed:', osInvokeErr)
      }
    }

    // ── 9. Link alert to ticket ───────────────────────────
    if (latestAlert) {
      await supabaseAdmin
        .from('solar_alerts')
        .update({ ticket_id: ticket.id })
        .eq('id', latestAlert.id)
    }

    outputData = {
      ticket_id: ticket.id,
      ticket_numero: ticket.numero_ticket,
      tecnico_id: selectedTecnico?.id ?? null,
      tecnico_nome: selectedTecnico?.nome ?? null,
      os_created: !!osResult?.success,
      alert_linked: !!latestAlert,
    }

    await logExecution(supabaseAdmin, plantId, alertType, severity, outputData, null, startTime)

    return new Response(JSON.stringify({
      success: true,
      ticket_id: ticket.id,
      ticket_numero: ticket.numero_ticket,
      tecnico: selectedTecnico?.nome ?? null,
      os_created: !!osResult?.success,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Agent Dispatcher error:', err)
    errorMessage = err instanceof Error ? err.message : String(err)

    await logExecution(supabaseAdmin, plantId, alertType, severity, outputData, errorMessage, startTime)

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ── Logging helper ──────────────────────────────────────────

async function logExecution(
  supabase: any,
  plantId: string | null,
  alertType: string | null,
  severity: string | null,
  outputData: Record<string, unknown>,
  errorMessage: string | null,
  startTime: number,
) {
  const durationMs = Date.now() - startTime
  try {
    await supabase.from('solar_agent_logs').insert([{
      agent_name: 'dispatcher',
      action: 'create_ticket_and_os',
      plant_id: plantId,
      status: errorMessage ? 'error' : 'success',
      duration_ms: durationMs,
      error_message: errorMessage,
      input_data: { alert_type: alertType, severity },
      output_data: outputData,
    }])
  } catch (logErr) {
    console.error('Failed to write agent log:', logErr)
  }
}
