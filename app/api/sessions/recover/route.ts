import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { sessionId, userId } = await req.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    console.log(`[Sessions] Looking for session: ${sessionId}, user: ${userId}`)

    // Query conversations by session_id
    const { data: conversations, error } = await supabase
      .from('llmpad_conversations')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      console.log(`[Sessions] Error querying: ${error.message}`)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ 
        found: false, 
        message: 'No conversations found for this session ID' 
      })
    }

    // If userId is provided, verify ownership
    if (userId) {
      const userConversations = conversations.filter(c => c.user_id === userId)
      if (userConversations.length === 0) {
        return NextResponse.json({ 
          found: false, 
          message: 'No conversations found for this session ID' 
        })
      }
      return NextResponse.json({ 
        found: true, 
        conversations: userConversations 
      })
    }

    return NextResponse.json({ 
      found: true, 
      conversations 
    })

  } catch (err: any) {
    console.log(`[Sessions] Error: ${err.message}`)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
