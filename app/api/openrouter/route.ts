import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { messages, model, temperature, apiKey } = await req.json()

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 401 })
  }
  if (!model) {
    return NextResponse.json({ error: 'Model is required' }, { status: 400 })
  }

  console.log(`[OpenRouter] Model: ${model}, Messages: ${messages?.length || 0}, Temp: ${temperature}`)

  try {
    const response = await fetch('https://openrouter.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://llmpad.vercel.app',
        'X-Title': 'LLMPad',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: temperature ?? 0.7,
        stream: true,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.log(`[OpenRouter] Error: ${response.status} - ${text.slice(0, 200)}`)
      return NextResponse.json({ error: text }, { status: response.status })
    }

    console.log(`[OpenRouter] Streaming started`)

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err: any) {
    console.log(`[OpenRouter] Network error: ${err.message}`)
    return NextResponse.json({ error: `Network error: ${err.message}` }, { status: 502 })
  }
}
