import type { AgentConfig } from './types';

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  monitor: {
    name: 'Monitor',
    description: 'Monitora alertas das plantas e detecta anomalias',
    enabled: true,
  },
  dispatcher: {
    name: 'Dispatcher',
    description: 'Cria OS e atribui técnicos automaticamente',
    enabled: true,
  },
  verifier: {
    name: 'Verifier',
    description: 'Verifica resolução após RME',
    enabled: true,
  },
  reporter: {
    name: 'Reporter',
    description: 'Gera relatórios para clientes',
    enabled: true,
  },
  analyst: {
    name: 'Analyst',
    description: 'Calcula KPIs e métricas de gestão',
    enabled: true,
  },
};
