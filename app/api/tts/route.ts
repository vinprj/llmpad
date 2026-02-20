import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { text, language, speaker, apiKey } = await req.json()

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 401 })
  }
  if (!text) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 })
  }

  console.log(`[TTS] Request: lang=${language}, speaker=${speaker}, text_len=${text.length}`)

  try {
    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.slice(0, 2500), // Max 2500 chars
        target_language_code: language || 'en-IN',
        speaker: speaker || 'shubh',
        model: 'bulbul:v3',
        output_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.log(`[TTS] Sarvam error: ${response.status} - ${err.slice(0, 200)}`)
      return NextResponse.json({ error: `TTS error: ${response.status}` }, { status: response.status })
    }

    const data = await response.json()
    console.log(`[TTS] Success, audio length: ${data.audios?.[0]?.length || 0}`)

    return NextResponse.json({ audio: data.audios?.[0] })
  } catch (err: any) {
    console.log(`[TTS] Network error: ${err.message}`)
    return NextResponse.json({ error: `Network error: ${err.message}` }, { status: 502 })
  }
}
