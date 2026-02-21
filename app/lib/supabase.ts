import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface DBConversation {
  id: string
  session_id: string
  title: string
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>
  created_at: string
  updated_at: string
  parent_conversation_id: string | null
  branch_depth: number
}
