import { Database } from '@/integrations/supabase/types';

// ===== TIPOS BASE (tabelas) =====
export type Ticket = Database['public']['Tables']['tickets']['Row'];
export type TicketInsert = Database['public']['Tables']['tickets']['Insert'];
export type TicketUpdate = Database['public']['Tables']['tickets']['Update'];

export type OrdemServico = Database['public']['Tables']['ordens_servico']['Row'];
export type OrdemServicoInsert = Database['public']['Tables']['ordens_servico']['Insert'];

export type Cliente = Database['public']['Tables']['clientes']['Row'];
export type ClienteInsert = Database['public']['Tables']['clientes']['Insert'];

export type Tecnico = Database['public']['Tables']['tecnicos']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

export type RMERelatorio = Database['public']['Tables']['rme_relatorios']['Row'];
export type RMEChecklistItem = Database['public']['Tables']['rme_checklist_items']['Row'];

export type Equipamento = Database['public']['Tables']['equipamentos']['Row'];
export type Insumo = Database['public']['Tables']['insumos']['Row'];
export type Movimentacao = Database['public']['Tables']['movimentacoes']['Row'];

export type Prestador = Database['public']['Tables']['prestadores']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
export type Notificacao = Database['public']['Tables']['notificacoes']['Row'];

// ===== ENUMS =====
export type TicketStatus = Database['public']['Enums']['ticket_status'];
export type PrioridadeTipo = Database['public']['Enums']['prioridade_tipo'];
export type EquipamentoTipo = Database['public']['Enums']['equipamento_tipo'];
export type UserRole = Database['public']['Enums']['user_role'];
export type AppRole = Database['public']['Enums']['app_role'];

// ===== TIPOS COMPOSTOS (com joins) =====
export type TicketComCliente = Ticket & {
  clientes: Cliente | null;
};

export type TicketComResponsavel = Ticket & {
  clientes: Cliente | null;
  responsavel: Profile | null;
};

export type OSComTicket = OrdemServico & {
  tickets: TicketComCliente | null;
};

export type OSComTecnico = OrdemServico & {
  tickets: TicketComCliente | null;
  tecnicos: (Tecnico & { profiles: Profile | null }) | null;
};

export type OSCompleta = OrdemServico & {
  tickets: TicketComCliente | null;
  tecnicos: (Tecnico & { profiles: Profile | null }) | null;
  rme_relatorios: RMERelatorio[] | null;
};

export type TecnicoComProfile = Tecnico & {
  profiles: Profile | null;
};

export type RMEComOS = RMERelatorio & {
  ordens_servico: OSComTicket | null;
};

// ===== CONFIGURAÇÕES DE STATUS =====
export const TICKET_STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: string }> = {
  aberto: { label: 'Aberto', color: 'blue', icon: 'CircleDot' },
  aguardando_aprovacao: { label: 'Aguardando Aprovação', color: 'yellow', icon: 'Clock' },
  aprovado: { label: 'Aprovado', color: 'green', icon: 'CheckCircle' },
  rejeitado: { label: 'Rejeitado', color: 'red', icon: 'XCircle' },
  ordem_servico_gerada: { label: 'OS Gerada', color: 'purple', icon: 'FileText' },
  em_execucao: { label: 'Em Execução', color: 'orange', icon: 'Play' },
  aguardando_rme: { label: 'Aguardando RME', color: 'yellow', icon: 'FileQuestion' },
  concluido: { label: 'Concluído', color: 'green', icon: 'CheckCircle2' },
  cancelado: { label: 'Cancelado', color: 'gray', icon: 'Ban' },
};

export const PRIORIDADE_CONFIG: Record<PrioridadeTipo, { label: string; color: string; order: number }> = {
  baixa: { label: 'Baixa', color: 'slate', order: 1 },
  media: { label: 'Média', color: 'blue', order: 2 },
  alta: { label: 'Alta', color: 'orange', order: 3 },
  critica: { label: 'Crítica', color: 'red', order: 4 },
};

// ===== TIPOS PARA AGENTES IA (futuro) =====
export interface AgentContext {
  ticketId?: string;
  osId?: string;
  plantaId?: string;
  clienteId?: string;
  tecnicoId?: string;
  rmeId?: string;
}

export interface AgentAction {
  type: 'create_ticket' | 'create_os' | 'assign_tecnico' | 'verify_resolution' | 'generate_report' | 'send_notification';
  payload: Record<string, unknown>;
  reasoning?: string;
}

export interface PlantAlert {
  id: string;
  plantaId: string;
  clienteId: string;
  tipo: 'falha_inversor' | 'baixa_geracao' | 'desconexao' | 'alarme_sistema' | 'manutencao_preventiva';
  severidade: PrioridadeTipo;
  timestamp: string;
  dados: {
    equipamentoId?: string;
    geracaoEsperada?: number;
    geracaoReal?: number;
    perdaPercentual?: number;
    mensagem?: string;
  };
}

export interface VerificationResult {
  osId: string;
  resolved: boolean;
  metrics: {
    before: { geracao: number; disponibilidade: number };
    after: { geracao: number; disponibilidade: number };
  };
  impact: {
    energiaPerdidaKwh: number;
    downtimeHoras: number;
    custoEstimado: number;
  };
  needsFollowUp: boolean;
  followUpReason?: string;
}
