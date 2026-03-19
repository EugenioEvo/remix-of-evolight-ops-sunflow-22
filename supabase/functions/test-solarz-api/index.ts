import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface TestResult {
  step: string
  success: boolean
  duration_ms: number
  data?: unknown
  error?: string
}

function proxyHeaders(proxySecret: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Proxy-Secret': proxySecret,
  }
}

async function testAuth(baseUrl: string, headers: Record<string, string>): Promise<TestResult> {
  const start = Date.now()
  try {
    const url = `${baseUrl}/openApi/seller/plantWithInfos/list`
    console.log(`[test-solarz-api] Testing auth at: ${url}`)
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ page: 0, pageSize: 1 }),
    })
    const rawText = await res.text()
    console.log(`[test-solarz-api] Response status: ${res.status}, content-type: ${res.headers.get('content-type')}`)
    console.log(`[test-solarz-api] Response body preview: ${rawText.substring(0, 200)}`)

    let body: any
    try {
      body = JSON.parse(rawText)
    } catch {
      return { step: 'auth', success: false, duration_ms: Date.now() - start, error: `Response is not JSON (status ${res.status}). Content-type: ${res.headers.get('content-type')}. Body preview: ${rawText.substring(0, 300)}` }
    }

    if (!res.ok) {
      return { step: 'auth', success: false, duration_ms: Date.now() - start, error: `HTTP ${res.status}: ${JSON.stringify(body)}` }
    }
    const count = Array.isArray(body.content) ? body.content.length : 0
    return { step: 'auth', success: true, duration_ms: Date.now() - start, data: { message: 'Proxy Auth OK', plants_in_page: count } }
  } catch (err) {
    return { step: 'auth', success: false, duration_ms: Date.now() - start, error: String(err) }
  }
}

async function testPlants(baseUrl: string, headers: Record<string, string>): Promise<{ result: TestResult; plants?: any[] }> {
  const start = Date.now()
  try {
    const res = await fetch(`${baseUrl}/openApi/seller/plantWithInfos/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ page: 0, pageSize: 10 }),
    })
    const body = await res.json()
    if (!res.ok) {
      return { result: { step: 'plants', success: false, duration_ms: Date.now() - start, error: `HTTP ${res.status}: ${JSON.stringify(body)}` } }
    }
    const plants = Array.isArray(body.content) ? body.content : []
    return {
      result: { step: 'plants', success: true, duration_ms: Date.now() - start, data: { count: plants.length, plants: plants.slice(0, 5) } },
      plants,
    }
  } catch (err) {
    return { result: { step: 'plants', success: false, duration_ms: Date.now() - start, error: String(err) } }
  }
}

async function testStatus(baseUrl: string, headers: Record<string, string>, plantId: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const res = await fetch(`${baseUrl}/openApi/seller/plant/status?id=${plantId}`, { headers })
    const body = await res.json()
    if (!res.ok) {
      return { step: 'status', success: false, duration_ms: Date.now() - start, error: `HTTP ${res.status}: ${JSON.stringify(body)}` }
    }
    return { step: 'status', success: true, duration_ms: Date.now() - start, data: body }
  } catch (err) {
    return { step: 'status', success: false, duration_ms: Date.now() - start, error: String(err) }
  }
}

async function testPower(baseUrl: string, headers: Record<string, string>, plantId: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const res = await fetch(`${baseUrl}/openApi/seller/plant/power?id=${plantId}`, { headers })
    const body = await res.json()
    if (!res.ok) {
      return { step: 'power', success: false, duration_ms: Date.now() - start, error: `HTTP ${res.status}: ${JSON.stringify(body)}` }
    }
    return { step: 'power', success: true, duration_ms: Date.now() - start, data: body }
  } catch (err) {
    return { step: 'power', success: false, duration_ms: Date.now() - start, error: String(err) }
  }
}

async function testPerformance(baseUrl: string, headers: Record<string, string>, plantId: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const res = await fetch(`${baseUrl}/openApi/seller/plant/performance/plantId/${plantId}`, {
      method: 'POST',
      headers,
    })
    const body = await res.json()
    if (!res.ok) {
      return { step: 'performance', success: false, duration_ms: Date.now() - start, error: `HTTP ${res.status}: ${JSON.stringify(body)}` }
    }
    return { step: 'performance', success: true, duration_ms: Date.now() - start, data: body }
  } catch (err) {
    return { step: 'performance', success: false, duration_ms: Date.now() - start, error: String(err) }
  }
}

async function testEnergy(baseUrl: string, headers: Record<string, string>, plantId: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const now = new Date()
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fromDate = from.toISOString().substring(0, 10)
    const toDate = now.toISOString().substring(0, 10)
    const res = await fetch(
      `${baseUrl}/openApi/seller/plant/energy/dayRange?plantId=${plantId}&fromLocalDate=${fromDate}&toLocalDate=${toDate}`,
      { method: 'POST', headers, body: JSON.stringify({ plantId: parseInt(plantId), fromLocalDate: fromDate, toLocalDate: toDate }) },
    )
    const body = await res.json()
    if (!res.ok) {
      return { step: 'energy', success: false, duration_ms: Date.now() - start, error: `HTTP ${res.status}: ${JSON.stringify(body)}` }
    }
    const entries = Array.isArray(body) ? body : []
    return { step: 'energy', success: true, duration_ms: Date.now() - start, data: { count: entries.length, sample: entries.slice(0, 3) } }
  } catch (err) {
    return { step: 'energy', success: false, duration_ms: Date.now() - start, error: String(err) }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const totalStart = Date.now()
  const results: TestResult[] = []

  try {
    let baseUrl = (Deno.env.get('SOLARZ_API_URL') ?? '').replace(/\/$/, '')
    if (baseUrl && !baseUrl.startsWith('http')) {
      baseUrl = 'https://' + baseUrl
    }
    const proxySecret = Deno.env.get('SOLARZ_PROXY_SECRET') ?? ''

    if (!baseUrl || !proxySecret) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing secrets: SOLARZ_API_URL and/or SOLARZ_PROXY_SECRET',
        configured: { SOLARZ_API_URL: !!baseUrl, SOLARZ_PROXY_SECRET: !!proxySecret },
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const headers = proxyHeaders(proxySecret)

    let testMode = 'all'
    let plantId: string | undefined
    try {
      const body = await req.json()
      testMode = body.test ?? 'all'
      plantId = body.plant_id
    } catch { /* default to 'all' */ }

    console.log(`[test-solarz-api] Mode: ${testMode}, Base URL: ${baseUrl}`)

    // Step 1: Auth test (via plant list)
    const authResult = await testAuth(baseUrl, headers)
    results.push(authResult)

    if (!authResult.success || testMode === 'auth') {
      return new Response(JSON.stringify({
        success: authResult.success,
        mode: testMode,
        total_duration_ms: Date.now() - totalStart,
        results,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Step 2: Plants
    if (['all', 'plants'].includes(testMode)) {
      const plantsResult = await testPlants(baseUrl, headers)
      results.push(plantsResult.result)
      if (!plantId && plantsResult.plants && plantsResult.plants.length > 0) {
        plantId = String(plantsResult.plants[0].id)
      }
    }

    if (testMode === 'plants') {
      return new Response(JSON.stringify({
        success: results.every(r => r.success),
        mode: testMode,
        total_duration_ms: Date.now() - totalStart,
        results,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Step 3: Detailed tests for a specific plant
    if (plantId && ['all', 'metrics'].includes(testMode)) {
      const [statusResult, powerResult, perfResult, energyResult] = await Promise.all([
        testStatus(baseUrl, headers, plantId),
        testPower(baseUrl, headers, plantId),
        testPerformance(baseUrl, headers, plantId),
        testEnergy(baseUrl, headers, plantId),
      ])
      results.push(statusResult, powerResult, perfResult, energyResult)
    }

    const allSuccess = results.every(r => r.success)
    return new Response(JSON.stringify({
      success: allSuccess,
      mode: testMode,
      total_duration_ms: Date.now() - totalStart,
      results,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('[test-solarz-api] Unexpected error:', err)
    return new Response(JSON.stringify({
      success: false,
      total_duration_ms: Date.now() - totalStart,
      error: String(err),
      results,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
