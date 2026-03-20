

## Plano: Testar chamada à API Claude via Edge Function

A `ANTHROPIC_API_KEY` já está configurada no projeto. Existem duas opções para testar:

### Opção recomendada: Usar Lovable AI Gateway

O projeto já tem `LOVABLE_API_KEY` configurada. O Lovable AI Gateway suporta modelos equivalentes e não requer manutenção de chave externa. Posso criar um script rápido via `lov-exec` para testar uma chamada simples.

### Opção alternativa: Testar via Edge Function existente

Invocar a edge function `jarvis-orchestrator` ou `agent-relator` que já usam Claude diretamente.

### O que vou fazer

1. **Criar um script de teste** que chama o Lovable AI Gateway (`/tmp/lovable_ai.py`) com um prompt simples em português
2. **Executar o script** e mostrar o resultado no chat
3. **Sem alterações no código** — apenas um teste de conectividade

Nenhuma alteração de código será necessária.

