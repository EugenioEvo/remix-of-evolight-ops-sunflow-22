import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WORKER_SCRIPT = `
export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    // Validate proxy secret
    const proxySecret = request.headers.get('X-Proxy-Secret');
    if (!proxySecret || proxySecret !== env.SOLARZ_PROXY_SECRET) {
      return Response.json({ error: 'Unauthorized proxy request' }, { status: 401 });
    }

    // Build target URL
    const url = new URL(request.url);
    const targetUrl = 'https://app.solarz.com.br' + url.pathname + url.search;

    // Basic Auth credentials
    const credentials = btoa(env.SOLARZ_USERNAME + ':' + env.SOLARZ_PASSWORD);

    // Clone headers, add auth and anti-bot headers
    const headers = new Headers();
    headers.set('Authorization', 'Basic ' + credentials);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    headers.set('X-Requested-With', 'XMLHttpRequest');
    headers.set('Origin', 'https://app.solarz.com.br');
    headers.set('Referer', 'https://app.solarz.com.br/');

    try {
      // Manual redirect handling to preserve auth headers
      let response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() || '{}' : undefined,
        redirect: 'manual',
      });

      // Follow redirects manually (preserving auth)
      let redirectCount = 0;
      while ((response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) && redirectCount < 5) {
        const location = response.headers.get('Location');
        if (!location) break;
        const redirectUrl = location.startsWith('http') ? location : 'https://app.solarz.com.br' + location;
        response = await fetch(redirectUrl, {
          method: request.method,
          headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? '{}' : undefined,
          redirect: 'manual',
        });
        redirectCount++;
      }

      // Check content type
      const contentType = response.headers.get('content-type') || '';
      const body = await response.text();

      if (!response.ok) {
        // If SolarZ returned an error, pass details back
        if (contentType.includes('application/json')) {
          return new Response(body, {
            status: response.status,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
        return Response.json({
          error: 'SolarZ returned non-JSON response',
          status: response.status,
          contentType,
          preview: body.substring(0, 500),
          targetUrl,
        }, {
          status: 502,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Validate JSON response
      if (!contentType.includes('application/json')) {
        return Response.json({
          error: 'SolarZ returned non-JSON response',
          status: response.status,
          contentType,
          preview: body.substring(0, 500),
          targetUrl,
        }, {
          status: 502,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (err) {
      return Response.json({
        error: 'Proxy fetch failed',
        message: err.message,
        targetUrl,
      }, {
        status: 502,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const cfApiKey = Deno.env.get('CLOUDFLARE_API_KEY')
    const cfAccountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
    const cfEmail = Deno.env.get('CLOUDFLARE_EMAIL')

    if (!cfApiKey || !cfAccountId || !cfEmail) {
      return new Response(JSON.stringify({
        error: 'Missing Cloudflare credentials',
        configured: {
          CLOUDFLARE_API_KEY: !!cfApiKey,
          CLOUDFLARE_ACCOUNT_ID: !!cfAccountId,
          CLOUDFLARE_EMAIL: !!cfEmail,
        },
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const workerName = 'solarz-proxy'

    // Step 1: Deploy the worker script using the Cloudflare API
    const formData = new FormData()
    
    // Create metadata
    const metadata = {
      main_module: 'worker.js',
      compatibility_date: '2024-01-01',
    }
    
    formData.append('metadata', JSON.stringify(metadata), )
    formData.append('worker.js', new Blob([WORKER_SCRIPT], { type: 'application/javascript+module' }), 'worker.js')

    console.log(`Deploying worker '${workerName}' to account '${cfAccountId}'...`)

    const deployRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/workers/scripts/${workerName}`,
      {
        method: 'PUT',
        headers: {
          'X-Auth-Email': cfEmail,
          'X-Auth-Key': cfApiKey,
        },
        body: formData,
      }
    )

    const deployBody = await deployRes.json()
    
    if (!deployRes.ok) {
      return new Response(JSON.stringify({
        success: false,
        step: 'deploy_script',
        status: deployRes.status,
        errors: deployBody.errors,
        messages: deployBody.messages,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log('Worker deployed successfully!')

    return new Response(JSON.stringify({
      success: true,
      message: `Worker '${workerName}' deployed successfully!`,
      deploy_result: {
        id: deployBody.result?.id,
        etag: deployBody.result?.etag,
        modified_on: deployBody.result?.modified_on,
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('Deploy error:', err)
    return new Response(JSON.stringify({
      success: false,
      error: String(err),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
