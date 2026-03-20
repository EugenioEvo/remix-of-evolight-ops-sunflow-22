import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const cfApiKey = Deno.env.get('CLOUDFLARE_API_KEY')!
    const cfAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!
    const cfEmail = Deno.env.get('CLOUDFLARE_EMAIL')!
    const solarzUsername = Deno.env.get('SOLARZ_USERNAME')!
    const solarzPassword = Deno.env.get('SOLARZ_PASSWORD')!
    const solarzProxySecret = Deno.env.get('SOLARZ_PROXY_SECRET')!

    const workerName = 'solarz-proxy'

    // Set secrets/environment variables on the worker
    const secrets = {
      SOLARZ_USERNAME: solarzUsername,
      SOLARZ_PASSWORD: solarzPassword,
      SOLARZ_PROXY_SECRET: solarzProxySecret,
    }

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/workers/scripts/${workerName}/secrets`,
      {
        method: 'PUT',
        headers: {
          'X-Auth-Email': cfEmail,
          'X-Auth-Key': cfApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(Object.entries(secrets).map(([name, text]) => ({
          name,
          text,
          type: 'secret_text',
        }))),
      }
    )

    const body = await res.json()

    if (!res.ok) {
      // Try setting them one by one as fallback
      const results = []
      for (const [name, text] of Object.entries(secrets)) {
        const r = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/workers/scripts/${workerName}/secrets`,
          {
            method: 'PUT',
            headers: {
              'X-Auth-Email': cfEmail,
              'X-Auth-Key': cfApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, text, type: 'secret_text' }),
          }
        )
        const rb = await r.json()
        results.push({ name, success: r.ok, status: r.status, response: rb })
      }

      return new Response(JSON.stringify({
        success: results.every(r => r.success),
        method: 'individual',
        results,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Worker secrets configured successfully!',
      response: body,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: String(err),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
