import type { PlantAlert, AgentAction, VerificationResult } from '@/types';

export interface AgentConfig {
  name: string;
  description: string;
  enabled: boolean;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentResult {
  success: boolean;
  actions: AgentAction[];
  message?: string;
  error?: string;
}

export interface MonitorAgentInput {
  alerts: PlantAlert[];
}

export interface DispatcherAgentInput {
  ticketId: string;
  prioridade: string;
  clienteId: string;
  localizacao?: { lat: number; lng: number };
}

export interface VerifierAgentInput {
  osId: string;
  rmeId: string;
  plantaId: string;
}

export interface ReporterAgentInput {
  osId: string;
  clienteId: string;
  verification: VerificationResult;
}

export interface AnalystAgentInput {
  periodo: { inicio: string; fim: string };
  clienteId?: string;
  plantaId?: string;
}
