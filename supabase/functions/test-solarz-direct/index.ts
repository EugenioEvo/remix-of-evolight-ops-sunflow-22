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
    const username = Deno.env.get('SOLARZ_USERNAME') ?? ''
    const password = Deno.env.get('SOLARZ_PASSWORD') ?? ''

    if (!username || !password) {
      return new Response(JSON.stringify({
        error: 'Missing SOLARZ_USERNAME or SOLARZ_PASSWORD',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const credentials = btoa(`${username}:${password}`)
    const targetUrl = 'https://app.solarz.com.br/openApi/seller/plantWithInfos/list'

    console.log(`Testing direct call to SolarZ: ${targetUrl}`)

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ page: 0, pageSize: 1 }),
      redirect: 'manual',
    })

    const body = await res.text()
    const contentType = res.headers.get('content-type') || ''

    console.log(`Response: status=${res.status}, content-type=${contentType}`)
    console.log(`Body preview: ${body.substring(0, 300)}`)

    // Follow redirect if needed
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('Location')
      return new Response(JSON.stringify({
        status: res.status,
        redirect: location,
        message: 'SolarZ is redirecting - following...',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (contentType.includes('application/json')) {
      return new Response(JSON.stringify({
        success: res.ok,
        status: res.status,
        method: 'direct_from_edge_function',
        data: JSON.parse(body),
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      success: false,
      status: res.status,
      method: 'direct_from_edge_function',
      contentType,
      bodyPreview: body.substring(0, 500),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: String(err),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
