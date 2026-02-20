import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  // Log incoming request
  console.log(`[${new Date().toISOString()}] Request received`)

  const { messages, model, temperature, systemPrompt, apiKey } = await req.json()

  if (!apiKey) {
    console.log('[API] Missing API key')
    return NextResponse.json({ error: 'API key is required' }, { status: 401 })
  }
  if (!model) {
    console.log('[API] Missing model')
    return NextResponse.json({ error: 'Model is required' }, { status: 400 })
  }

  // Validate inputs
  if (messages && !Array.isArray(messages)) {
    console.log('[API] Invalid messages format')
    return NextResponse.json({ error: 'Messages must be an array' }, { status: 400 })
  }
  
  if (messages?.length > 50) {
    console.log('[API] Too many messages:', messages.length)
    return NextResponse.json({ error: 'Too many messages (max 50)' }, { status: 400 })
  }

  // Mask API key in logs
  const maskedKey = apiKey.length > 10 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '***'
  console.log(`[API] Model: ${model}, Messages: ${messages?.length || 0}, Temp: ${temperature}, Key: ${maskedKey}`)

  const allMessages = [
    ...(systemPrompt?.trim() ? [{ role: 'system', content: systemPrompt.trim() }] : []),
    ...messages,
  ]

  let response: Response
  try {
    const fetchStart = Date.now()
    response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: allMessages,
        temperature: temperature ?? 0.7,
        stream: true,
      }),
    })
    console.log(`[API] Sarvam fetch took ${Date.now() - fetchStart}ms, status: ${response.status}`)
  } catch (err: any) {
    console.log(`[API] Network error: ${err.message}`)
    return NextResponse.json({ error: `Network error: ${err.message}` }, { status: 502 })
  }

  if (!response.ok) {
    const text = await response.text()
    console.log(`[API] Sarvam error: ${response.status} - ${text.slice(0, 200)}`)
    let msg = text
    try {
      const j = JSON.parse(text)
      msg = j.error?.message || j.message || text
    } catch {}
    return NextResponse.json({ error: msg }, { status: response.status })
  }

  // Log successful response start
  console.log(`[API] Streaming started, total time: ${Date.now() - startTime}ms`)

  // Stream back with timing
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
