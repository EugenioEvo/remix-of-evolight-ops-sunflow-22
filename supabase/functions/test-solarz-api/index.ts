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

async function testAuth(baseUrl: string, username: string, password: string): Promise<{ result: TestResult; token?: string }> {
  const start = Date.now()
  try {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const body = await res.json()
    if (!res.ok) {
      return { result: { step: 'auth', success: false, duration_ms: Date.now() - start, error: `HTTP ${res.status}: ${JSON.stringify(body)}` } }
    }
    return {
      result: { step: 'auth', success: true, duration_ms: Date.now() - start, data: { token_preview: body.token?.slice(0, 20) + '…', expiresAt: body.expiresAt } },
      token: body.token,
    }
  } catch (err) {
    return { result: { step: 'auth', success: false, duration_ms: Date.now() - start, error: String(err) } }
  }
}

async function testPlants(baseUrl: string, token: string): Promise<{ result: TestResult; plants?: any[] }> {
  const start = Date.now()
  try {
    const res = await fetch(`${baseUrl}/plants`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    if (!res.ok) {
      return { result: { step: 'plants', success: false, duration_ms: Date.now() - start, error: `HTTP ${res.status}: ${JSON.stringify(body)}` } }
    }
    const plants = Array.isArray(body) ? body : []
    return {
      result: { step: 'plants', success: true, duration_ms: Date.now() - start, data: { count: plants.length, plants: plants.slice(0, 5) } },
      plants,
    }
  } catch (err) {
    return { result: { step: 'plants', success: false, duration_ms: Date.now() - start, error: String(err) } }
  }
}

async function testMetrics(baseUrl: string, token: string, plantId: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const end = new Date().toISOString()
    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const qs = `start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(end)}`
    const res = await fetch(`${baseUrl}/plants/${plantId}/metrics?${qs}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    if (!res.ok) {
      return { step: 'metrics', success: false, duration_ms: Date.now() - start, error: `HTTP ${res.status}: ${JSON.stringify(body)}` }
    }
    const metrics = Array.isArray(body) ? body : []
    return { step: 'metrics', success: true, duration_ms: Date.now() - start, data: { plant_id: plantId, count: metrics.length, sample: metrics.slice(0, 3) } }
  } catch (err) {
    return { step: 'metrics', success: false, duration_ms: Date.now() - start, error: String(err) }
  }
}

async function testAlerts(baseUrl: string, token: string, plantId?: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const path = plantId ? `/plants/${plantId}/alerts` : '/alerts'
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    if (!res.ok) {
      return { step: 'alerts', success: false, duration_ms: Date.now() - start, error: `HTTP ${res.status}: ${JSON.stringify(body)}` }
    }
    const alerts = Array.isArray(body) ? body : []
    return { step: 'alerts', success: true, duration_ms: Date.now() - start, data: { count: alerts.length, alerts: alerts.slice(0, 5) } }
  } catch (err) {
    return { step: 'alerts', success: false, duration_ms: Date.now() - start, error: String(err) }
  }
}

async function testDevices(baseUrl: string, token: string, plantId: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const res = await fetch(`${baseUrl}/plants/${plantId}/devices`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    if (!res.ok) {
      return { step: 'devices', success: false, duration_ms: Date.now() - start, error: `HTTP ${res.status}: ${JSON.stringify(body)}` }
    }
    const devices = Array.isArray(body) ? body : []
    return { step: 'devices', success: true, duration_ms: Date.now() - start, data: { plant_id: plantId, count: devices.length, devices: devices.slice(0, 5) } }
  } catch (err) {
    return { step: 'devices', success: false, duration_ms: Date.now() - start, error: String(err) }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const totalStart = Date.now()
  const results: TestResult[] = []

  try {
    const baseUrl = (Deno.env.get('SOLARZ_API_URL') ?? '').replace(/\/$/, '')
    const username = Deno.env.get('SOLARZ_USERNAME') ?? ''
    const password = Deno.env.get('SOLARZ_PASSWORD') ?? ''

    if (!baseUrl || !username || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing secrets. Required: SOLARZ_API_URL, SOLARZ_USERNAME, SOLARZ_PASSWORD',
        configured: { SOLARZ_API_URL: !!baseUrl, SOLARZ_USERNAME: !!username, SOLARZ_PASSWORD: !!password },
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Parse request body
    let testMode = 'all'
    let plantId: string | undefined
    try {
      const body = await req.json()
      testMode = body.test ?? 'all'
      plantId = body.plant_id
    } catch { /* empty body is fine, default to 'all' */ }

    console.log(`[test-solarz-api] Mode: ${testMode}, Base URL: ${baseUrl}`)

    // Step 1: Auth
    const authResult = await testAuth(baseUrl, username, password)
    results.push(authResult.result)

    if (!authResult.token || testMode === 'auth') {
      return new Response(JSON.stringify({
        success: authResult.result.success,
        mode: testMode,
        total_duration_ms: Date.now() - totalStart,
        results,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = authResult.token

    // Step 2: Plants
    if (['all', 'plants', 'metrics', 'devices'].includes(testMode)) {
      const plantsResult = await testPlants(baseUrl, token)
      results.push(plantsResult.result)

      // Use first plant if no plant_id provided
      if (!plantId && plantsResult.plants && plantsResult.plants.length > 0) {
        plantId = plantsResult.plants[0].id
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

    // Step 3: Metrics + Alerts + Devices (parallel)
    if (plantId && ['all', 'metrics'].includes(testMode)) {
      const [metricsResult, alertsResult, devicesResult] = await Promise.all([
        testMetrics(baseUrl, token, plantId),
        testAlerts(baseUrl, token, plantId),
        testDevices(baseUrl, token, plantId),
      ])
      results.push(metricsResult, alertsResult, devicesResult)
    } else if (testMode === 'all') {
      const alertsResult = await testAlerts(baseUrl, token)
      results.push(alertsResult)
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
