

# Revisão de Estado do Projeto SunFlow O&M Pro

## Arquitetura Geral
- 33 páginas, 13 edge functions, 72+ migrations, 24 hooks, 5 services
- React + Vite + Tailwind + Supabase (Lovable Cloud)
- React Query configurado globalmente com staleTime 5min
- Auth com roles (admin, area_tecnica, tecnico_campo, cliente)
- RLS completo em todas as tabelas

---

## Migração para React Query — Status por Página

| Página | Status | Chamadas diretas restantes |
|--------|--------|---------------------------|
| **Tickets.tsx** | Migrada | 3 (edge function `gerar-ordem-servico`, 2x storage `createSignedUrl`) |
| **MinhasOS.tsx** | Migrada | Limpa |
| **Agenda.tsx** | Migrada | Limpa |
| **WorkOrders.tsx** | Migrada | Limpa |
| **Index.tsx** | Manual | 2x `supabase.from()` (status_historico, tickets) |
| **RME.tsx** | Manual | 4x (storage upload/getPublicUrl, `from('equipamentos')`, edge function) |
| **RMEWizard.tsx** | Manual | 1x `supabase.rpc()` |
| **GerenciarRME.tsx** | Manual | 1x edge function |
| **WorkOrderCreate.tsx** | Manual | 1x `supabase.auth.getUser()` |
| **WorkOrderDetail.tsx** | Manual | 1x edge function |
| **Configuracoes.tsx** | Manual | 1x `supabase.auth.updateUser()` |
| **Auth.tsx** | Aceitável | Auth calls (signIn, signUp, getSession) — correto estar direto |
| **DashboardPresenca.tsx** | Manual | 1x realtime channel |

### Componentes com chamadas diretas
| Componente | Chamadas |
|------------|----------|
| **DashboardStats.tsx** | 1x `supabase.rpc()` |
| **FileUpload.tsx** | 4x storage (upload, remove, download, signedUrl) |
| **GerarOSDialog.tsx** | 1x edge function |
| **RouteMap.tsx** | 1x edge function |
| **AppSidebar.tsx** | 1x realtime channel |

---

## O que está pronto

1. **Camada de serviços** — `api.ts`, `ticketService.ts`, `osService.ts`, `clienteService.ts`, `rmeService.ts`
2. **Hooks React Query** — `useTicketsQuery`, `useOrdensServico`, `useAgendaQuery`, `useWorkOrdersQuery` + queries de clientes/prestadores
3. **Tabelas Solar** — `solar_plants`, `solar_metrics`, `solar_alerts`, `solar_agent_logs` criadas com RLS
4. **Infraestrutura** — Auth, ErrorBoundary, logger, paginação, realtime subscriptions
5. **Edge Functions** — 13 funções (OS, RME email, calendário, geocoding, presença, etc.)

## O que falta migrar

1. **Index.tsx** — Ainda usa `supabase.from()` direto para atividade recente e métricas
2. **RME.tsx** — Maior pendência: storage + query de equipamentos diretos
3. **RMEWizard.tsx** — RPC direto para checklist
4. **DashboardStats.tsx** — RPC direto (candidato a hook `useDashboardStats`)
5. **FileUpload.tsx** — Storage direto (candidato a serviço `storageService.ts`)
6. **Páginas Sunflow** — `SunflowDashboard`, `Plants`, `PlantDetail`, `SunflowAlerts` precisam de hooks para as novas tabelas solar

## Resumo Quantitativo

```text
Chamadas diretas restantes:
  Pages:     ~12 chamadas em 8 páginas
  Components: ~8 chamadas em 5 componentes
  Total:      ~20 chamadas diretas ao Supabase

Já migradas:
  4 páginas completamente migradas (Tickets, MinhasOS, Agenda, WorkOrders)
  5 services criados
  6 hooks React Query dedicados

Progresso estimado: ~60% da migração concluída
```

## Próximos Passos Prioritários

1. **Criar hooks para as tabelas solar** — `useSolarPlants`, `useSolarMetrics`, `useSolarAlerts` para alimentar as páginas Sunflow
2. **Migrar Index.tsx** — Criar `useDashboardStats` e `useRecentActivity` hooks
3. **Migrar RME.tsx / RMEWizard.tsx** — Usar `useRMEQuery` existente + criar storage helper
4. **Criar storageService.ts** — Centralizar upload/download/signedUrl do FileUpload

