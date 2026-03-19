

# Plano: Edge Function para Testar API SolarZ

## Objetivo
Criar uma Edge Function dedicada (`test-solarz-api`) que testa a conectividade e autenticação com a API SolarZ e retorna os dados brutos para validação.

## O que será criado

### 1. `supabase/functions/test-solarz-api/index.ts`

Edge Function que:
- Lê credenciais dos secrets existentes (`SOLARZ_API_URL`, `SOLARZ_USERNAME`, `SOLARZ_PASSWORD`)
- Tenta autenticar na API SolarZ (`POST /auth/login`)
- Se autenticação OK, busca lista de plantas (`GET /plants`)
- Para a primeira planta encontrada, busca métricas recentes e alertas
- Retorna um JSON consolidado com:
  - Status da autenticação (token obtido? tempo de resposta?)
  - Lista de plantas encontradas
  - Amostra de métricas (últimas 24h da primeira planta)
  - Alertas ativos
  - Erros encontrados em cada etapa

Aceita POST com body opcional:
- `{ test: "auth" }` — testa só autenticação
- `{ test: "plants" }` — lista plantas
- `{ test: "metrics", plant_id: "..." }` — métricas de uma planta específica
- `{ test: "all" }` (default) — executa tudo

### 2. Atualizar `supabase/config.toml`

Registrar a nova função com `verify_jwt = false`.

## Padrão seguido
- Mesmo CORS headers das demais Edge Functions
- Usa os secrets já configurados (`SOLARZ_API_URL`, `SOLARZ_USERNAME`, `SOLARZ_PASSWORD`)
- Não altera nenhum dado no banco — apenas leitura da API externa
- Loga resultados no console para debugging via edge function logs

