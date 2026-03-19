

## Plano: Corrigir URL do Worker SolarZ

### Problema
O secret `SOLARZ_API_URL` está configurado como `solarz-proxy.eugenio-a45.workers.dev` (sem protocolo). O `fetch()` do Deno exige uma URL completa com `https://`.

### Solução (2 camadas de proteção)

1. **Atualizar o secret `SOLARZ_API_URL`** para incluir `https://` no início
2. **Adicionar fallback no código** do `agent-monitor` para que, se o protocolo estiver ausente, ele seja adicionado automaticamente:
   ```typescript
   let SOLARZ_API_URL = (Deno.env.get('SOLARZ_API_URL') ?? '').replace(/\/$/, '')
   if (SOLARZ_API_URL && !SOLARZ_API_URL.startsWith('http')) {
     SOLARZ_API_URL = 'https://' + SOLARZ_API_URL
   }
   ```

### Resultado esperado
A função `agent-monitor` conseguirá se conectar ao Cloudflare Worker e processar as plantas SolarZ.

