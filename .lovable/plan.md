

# Relatório de Estado Completo — Evolight Solar Platform

## 1. ARQUITETURA GERAL

```text
┌─────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite + Tailwind + TypeScript)    │
│  33 páginas · 7 query hooks · 6 services · logger   │
├─────────────────────────────────────────────────────┤
│  BACKEND (Lovable Cloud / Supabase)                 │
│  20 Edge Functions · 73 migrations · 18+ tabelas    │
│  RLS em todas as tabelas · 5 roles (app_role enum)  │
├─────────────────────────────────────────────────────┤
│  IA / AGENTES (JARVIS)                              │
│  5 agentes + 1 orquestrador · Claude + Lovable AI   │
└─────────────────────────────────────────────────────┘
```

---

## 2. PÁGINAS E ROTAS (33 rotas)

| Módulo | Rota | Status | Observação |
|--------|-------|--------|------------|
| Dashboard | `/` | OK | Index com DashboardStats |
| Auth | `/auth` | OK | Login/signup com verificação email |
| Tickets | `/tickets` | OK | Hooks migrados para `useTickets` |
| Work Orders | `/work-orders` | OK | CRUD + detail + create |
| RME Wizard | `/rme-wizard/:id` | OK | Migrado para `useRME` hooks |
| RME Scanner | `/rme` | OK | Usa hooks locais (não migrado) |
| Gerenciar RME | `/gerenciar-rme` | PENDENTE | Ainda usa `useRMEQuery.tsx` legado |
| Clientes | `/clientes` | OK | Hooks migrados para `useClientes` |
| Equipamentos | `/equipamentos` | OK | Hook em `useEquipamentos` |
| Técnicos | `/tecnicos` | OK | — |
| Prestadores | `/prestadores` | OK | Exportado via `useTickets` |
| Agenda | `/agenda` | OK | Com realtime |
| Rotas | `/routes` | OK | MapView + otimização OSRM |
| Insumos | `/insumos` | OK | CRUD completo |
| Sunflow Dashboard | `/sunflow` | OK | KPIs solares |
| Sunflow Plants | `/sunflow/plants` | OK | CRUD + detail |
| Sunflow Alerts | `/sunflow/alerts` | OK | Listagem com filtros |
| Sunflow Work Orders | `/sunflow/work-orders` | OK | — |
| Relatórios | `/relatorios` | OK | — |
| Audit Logs | `/audit-logs` | OK | Somente admin |
| Presença | `/confirmar-presenca` | OK | Rota pública com token |
| Dashboard Presença | `/dashboard-presenca` | OK | Admin/area_tecnica |
| Carga Trabalho | `/carga-trabalho` | OK | Admin/area_tecnica |
| Meu Painel | `/meu-painel` | OK | Somente cliente |
| Minhas OS | `/minhas-os` | OK | Todas as roles |
| Configurações | `/configuracoes` | OK | — |

---

## 3. HOOKS UNIFICADOS (`src/hooks/queries/`)

| Hook | Status | Consome |
|------|--------|---------|
| `useTickets` | OK | Tickets, Prestadores, mutações |
| `useClientes` | OK | Lista, detail, mutações |
| `useOS` | OK | Ordens de serviço |
| `useRME` | OK | RME relatórios + mutações |
| `useEquipamentos` | OK | Listagem + CRUD |
| `useSolar` | OK | Plants, metrics, alerts |
| `useDashboard` | OK | Stats do dashboard |

### Hooks legados AINDA existentes:
| Hook legado | Usado por | Ação necessária |
|-------------|-----------|-----------------|
| `useRMEQuery.tsx` | `GerenciarRME.tsx` | Migrar para `useRME` |
| `useWorkOrdersQuery.tsx` | Verificar consumidores | Pode ser eliminado |
| `useOrdensServico.tsx` | Verificar consumidores | Pode ser eliminado |
| `useRMEApprovals.tsx` | Verificar consumidores | Pode ser consolidado |

Hook deletado com sucesso: `useTicketsQuery.tsx` — sem referências restantes.

---

## 4. EDGE FUNCTIONS (20 funções)

| Função | Categoria | Status | Notas |
|--------|-----------|--------|-------|
| `agent-monitor` | IA/JARVIS | OK | HTTPS fallback implementado |
| `agent-dispatcher` | IA/JARVIS | OK | Cria OS automaticamente |
| `agent-verificador` | IA/JARVIS | OK | Verifica resolução pós-RME |
| `agent-relator` | IA/JARVIS | OK | Relatório mensal com Claude |
| `agent-analista` | IA/JARVIS | OK | KPIs e métricas |
| `jarvis-orchestrator` | IA/JARVIS | OK | Decisões com Claude API |
| `test-solarz-api` | Solar | OK | Migrado para X-Proxy-Secret |
| `geocode-address` | Geo | OK | Geocodificação com cache |
| `mapbox-geocode` | Geo | OK | — |
| `mapbox-directions` | Geo | OK | — |
| `optimize-route-osrm` | Geo | OK | Otimização de rotas |
| `process-pending-geocoding` | Geo | OK | Batch processing |
| `gerar-ordem-servico` | OS | OK | Gera OS a partir de ticket |
| `create-user-profile` | Auth | OK | Trigger on signup |
| `confirm-presence` | Presença | OK | Token-based |
| `send-calendar-invite` | Email | OK | Convites de calendário |
| `send-os-reminders` | Email | OK | Lembretes automáticos |
| `send-rme-email` | Email | OK | Envio pós-RME |
| `process-email-retries` | Email | OK | Fila de retry |
| `api-export` | Export | OK | Exportação de dados |

---

## 5. SERVIÇOS FRONTEND (`src/services/`)

| Serviço | Status | Notas |
|---------|--------|-------|
| `api.ts` | OK | Configuração base |
| `ticketService.ts` | OK | CRUD tickets |
| `osService.ts` | OK | CRUD ordens de serviço |
| `clienteService.ts` | OK | CRUD clientes |
| `rmeService.ts` | OK | CRUD relatórios RME |
| `storageService.ts` | OK | Upload de arquivos |
| `solar/solarzAdapter.ts` | OK | HTTPS fallback + retry + proxy |
| `solar/solarService.ts` | OK | Abstração solar |
| `solar/types.ts` | OK | Interfaces ISolarMonitoringSource |

---

## 6. INFRAESTRUTURA TRANSVERSAL

| Componente | Status | Notas |
|-----------|--------|-------|
| `logger.ts` | OK | Migrado em 14 arquivos; prod=error only |
| `ErrorBoundary` | OK | Wrapper global no App |
| RLS Policies | OK | Todas as 18+ tabelas com policies |
| Roles (app_role) | OK | admin, area_tecnica, tecnico_campo, cliente |
| Realtime | OK | Tickets + Agenda com subscriptions |
| QueryClient | OK | staleTime=5min, gcTime=30min, retry=1 |
| Auth (Supabase) | OK | Email verification ativo |

---

## 7. APIs EXTERNAS VALIDADAS

| API | Status | Método de teste |
|-----|--------|-----------------|
| Anthropic (Claude) | OK | Teste direto com `claude-sonnet-4-20250514` — 200 OK |
| Lovable AI Gateway | OK | Teste com `openai/gpt-5-mini` — resposta OK |
| ANTHROPIC_API_KEY | Configurada | Secret presente no ambiente |
| LOVABLE_API_KEY | Configurada | Secret presente no ambiente |

---

## 8. PENDÊNCIAS E DÍVIDA TÉCNICA

1. **`GerenciarRME.tsx` ainda usa `useRMEQuery.tsx` legado** — não foi migrado para os hooks unificados em `src/hooks/queries/useRME.ts`
2. **Hooks legados não eliminados**: `useRMEQuery.tsx`, `useWorkOrdersQuery.tsx`, `useOrdensServico.tsx`, `useRMEApprovals.tsx` — precisam ser verificados e potencialmente consolidados
3. **`RME.tsx` com filtros `.or()` dinâmicos** — incompatível com hook genérico de equipamentos; sugestão: criar `useEquipamentoSearch`
4. **Sem testes unitários** — nenhum teste Vitest para hooks em `src/hooks/queries/`
5. **Dados de teste vazios** — nenhum cliente ou planta solar cadastrados no banco; edge functions JARVIS não podem ser testadas end-to-end
6. **Edge functions usam Claude diretamente** — poderiam migrar para Lovable AI Gateway para eliminar dependência da `ANTHROPIC_API_KEY`

---

## 9. RESUMO QUANTITATIVO

- **33 rotas** registradas no App.tsx
- **20 edge functions** deployadas
- **7 query hooks** unificados + 4 legados pendentes
- **6 serviços** frontend + adaptador solar
- **73 migrations** aplicadas
- **18+ tabelas** com RLS completo
- **2 APIs de IA** validadas e funcionais
- **Build**: passando sem erros

