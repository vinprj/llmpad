import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const { messages, model, temperature, systemPrompt, apiKey } = await req.json()

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 401 })
  }
  if (!model) {
    return NextResponse.json({ error: 'Model is required' }, { status: 400 })
  }

  const allMessages = [
    ...(systemPrompt?.trim() ? [{ role: 'system', content: systemPrompt.trim() }] : []),
    ...messages,
  ]

  let response: Response
  try {
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
  } catch (err: any) {
    return NextResponse.json({ error: `Network error: ${err.message}` }, { status: 502 })
  }

  if (!response.ok) {
    const text = await response.text()
    let msg = text
    try {
      const j = JSON.parse(text)
      msg = j.error?.message || j.message || text
    } catch {}
    return NextResponse.json({ error: msg }, { status: response.status })
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
