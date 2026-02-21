'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { supabase, type DBConversation } from './lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

/* ── Types ── */
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const MODELS = [
  { id: 'sarvam-m', label: 'Default (sarvam-m)' },
  { id: 'custom', label: 'Custom model...' },
]

const STARTERS = [
  'What is artificial intelligence in simple terms?',
  'Give me 5 tips to be more productive',
  'Explain quantum computing to a 10-year-old',
  'Write a short story about a time traveler',
  'What are the best ways to learn a new language?',
  'Help me plan a healthy weekly meal plan',
]

const TTS_LANGUAGES = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'bn-IN', label: 'Bengali' },
]

const TTS_SPEAKERS = [
  { id: 'shubh', label: 'Shubh (M)', gender: 'male' },
  { id: 'aditya', label: 'Aditya (M)', gender: 'male' },
  { id: 'rahul', label: 'Rahul (M)', gender: 'male' },
  { id: 'rohan', label: 'Rohan (M)', gender: 'male' },
  { id: 'amit', label: 'Amit (M)', gender: 'male' },
  { id: 'dev', label: 'Dev (M)', gender: 'male' },
  { id: 'ritu', label: 'Ritu (F)', gender: 'female' },
  { id: 'priya', label: 'Priya (F)', gender: 'female' },
  { id: 'neha', label: 'Neha (F)', gender: 'female' },
  { id: 'pooja', label: 'Pooja (F)', gender: 'female' },
  { id: 'simran', label: 'Simran (F)', gender: 'female' },
  { id: 'kavya', label: 'Kavya (F)', gender: 'female' },
  { id: 'ishita', label: 'Ishita (F)', gender: 'female' },
  { id: 'shreya', label: 'Shreya (F)', gender: 'female' },
  { id: 'roopa', label: 'Roopa (F)', gender: 'female' },
]

/* ── Helpers ── */
function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ── Action Buttons ── */
// All action buttons now use icon-only style for clarity and consistency
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
        copied
          ? 'bg-green-100 dark:bg-green-500/30 text-green-600 dark:text-green-400'
          : 'bg-gray-50 dark:bg-[#1a1a1a] text-gray-500 dark:text-[#888] hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-white'
      }`}
      title="Copy"
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        {copied ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </>
        )}
      </svg>
    </button>
  )
}

function SpeakButton({ msgId, text, language, speaker, isPlaying, onClick }: { msgId: string; text: string; language: string; speaker: string; isPlaying: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!text}
      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
        isPlaying
          ? 'bg-[#ff9500] text-white hover:bg-[#e68600]'
          : 'bg-gray-50 dark:bg-[#1a1a1a] text-gray-500 dark:text-[#888] hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-[#ff9500]'
      } disabled:opacity-30`}
      title={isPlaying ? 'Stop' : 'Speak'}
    >
      <svg width="16" height="16" fill={isPlaying ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        {isPlaying ? (
          <>
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="7" width="4" height="10" rx="1" />
          </>
        ) : (
          <>
            <path d="M3 10v4c0 1.1.9 2 2 2h2a2 2 0 002-2v-2c0-1.1.9-2 2-2h2a2 2 0 002-2v-4a2 2 0 00-2-2H7a2 2 0 00-2 2v4z" />
            <path d="M8 12a3 3 0 000 6c0 1.66 1.34 3 3 3s3-1.34 3-3" />
          </>
        )}
      </svg>
    </button>
  )
}

function RetryButton({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-50 dark:bg-[#1a1a1a] text-gray-500 dark:text-[#888] hover:bg-orange-100 dark:hover:bg-orange-900/40 hover:text-orange-500 dark:hover:text-orange-400 transition-all"
      title="Retry with reasoning"
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    </button>
  )
}

/* ── Code Block ── */
function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-gray-200 dark:border-[#1f1f1f]">
      <div className="flex items-center justify-between bg-[#1a1a1a] px-4 py-2 border-b border-[#2a2a2a]">
        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
          className="text-xs text-gray-400 hover:text-[#ff9500] transition-colors font-mono"
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus as any} language={language || 'text'} PreTag="div"
        customStyle={{ margin: 0, padding: '16px', background: '#0d0d0d', fontSize: '13px', lineHeight: '1.6' }}
      >
        {children.replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  )
}

function SunIcon() {
  return <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
}
function MoonIcon() {
  return <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
}

/* ══════════════════════════════════════════
   Main Component
══════════════════════════════════════════ */
export default function ChatPage() {
  /* Chat state */
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const [currentStarter, setCurrentStarter] = useState(0)

  /* Rotate starter questions every 4 seconds */
  useEffect(() => {
    if (messages.length > 0) return // stop when chat has messages
    const interval = setInterval(() => {
      setCurrentStarter(i => (i + 1) % STARTERS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [messages])

  /* File upload for Vision */
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessingVision, setIsProcessingVision] = useState(false)
  const [visionError, setVisionError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* Settings */
  const [apiKey, setApiKey] = useState('')
  const [openrouterKey, setOpenrouterKey] = useState('')
  const [reasoningModel, setReasoningModel] = useState('arcee-ai/trinity-large-preview:free')
  const [reasoningMode, setReasoningMode] = useState(false)
  const [model, setModel] = useState('sarvam-m')
  const [customModel, setCustomModel] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [instructions, setInstructions] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)

  /* Sidebar */
  const [showSidebar, setShowSidebar] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'settings'>('chats')
  const [showInstructions, setShowInstructions] = useState(false)

  /* Conversations */
  const [conversations, setConversations] = useState<DBConversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [convLoading, setConvLoading] = useState(true)
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === 'undefined') return ''
    const stored = localStorage.getItem('llmpad_session')
    if (stored) return stored
    const newId = generateId()
    localStorage.setItem('llmpad_session', newId)
    return newId
  })
  const [editingConvId, setEditingConvId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  /* Branching & Context */
  const [showContextModal, setShowContextModal] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState<string[]>([])
  const [importingConvId, setImportingConvId] = useState<string | null>(null)

  /* Theme */
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  /* Auth */
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoadingSubmit, setAuthLoadingSubmit] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  /* TTS */
  const [ttsLanguage, setTtsLanguage] = useState('en-IN')
  const [ttsSpeaker, setTtsSpeaker] = useState('shubh')
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  /* Vision */
  const [visionLanguage, setVisionLanguage] = useState('en-IN')

  /* Refs */
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const currentConvIdRef = useRef<string | null>(null)

  /* Keep ref in sync */
  useEffect(() => { currentConvIdRef.current = currentConvId }, [currentConvId])

  /* ── Init ── */
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setTheme(isDark ? 'dark' : 'light')

    const k = localStorage.getItem('sarvam_api_key'); if (k) setApiKey(k)
    const m = localStorage.getItem('sarvam_model'); if (m) setModel(m)
    const t = localStorage.getItem('sarvam_temp'); if (t) setTemperature(parseFloat(t))
    const s = localStorage.getItem('sarvam_instructions'); if (s) setInstructions(s)
    const cm = localStorage.getItem('sarvam_custom_model'); if (cm) setCustomModel(cm)
    const ork = localStorage.getItem('llmpad_openrouter_key'); if (ork) setOpenrouterKey(ork)
    const rm = localStorage.getItem('llmpad_reasoning_model'); if (rm) setReasoningModel(rm)
    const tl = localStorage.getItem('llmpad_tts_lang'); if (tl) setTtsLanguage(tl)
    const ts = localStorage.getItem('llmpad_tts_speaker'); if (ts) setTtsSpeaker(ts)

    // Check Supabase auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      // Clear unauth message counter on successful login
      if (session?.user) {
        localStorage.removeItem('llmpad_unauth_messages')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  /* ── Load conversations when sessionId is ready ── */
  useEffect(() => {
    if (!sessionId) return
    loadConversations(sessionId)
  }, [sessionId, user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeModel = model === 'custom' ? customModel : model

  /* ── Supabase ops ── */
  const loadConversations = async (sid: string) => {
    setConvLoading(true)
    let query = supabase
      .from('llmpad_conversations')
      .select('id, session_id, title, created_at, updated_at, messages, parent_conversation_id, branch_depth, user_id')
      .order('updated_at', { ascending: false })
      .limit(50)

    if (user) {
      query = query.eq('user_id', user.id)
    } else {
      query = query.eq('session_id', sid)
    }

    const { data } = await query
    if (data) setConversations(data as DBConversation[])
    setConvLoading(false)
  }

  const saveConversation = useCallback(async (msgs: Message[], convId: string | null, sid: string) => {
    if (!msgs.length || !sid) return
    const serialized = msgs.map(m => ({ ...m, timestamp: m.timestamp.toISOString() }))

    const payload: any = {
      messages: serialized,
      updated_at: new Date().toISOString()
    }
    if (user) payload.user_id = user.id

    if (convId) {
      await supabase
        .from('llmpad_conversations')
        .update(payload)
        .eq('id', convId)
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, ...payload } : c))
    } else {
      const title = msgs.find(m => m.role === 'user')?.content.slice(0, 50) + (msgs[0]?.content.length > 50 ? '…' : '') || 'New Conversation'
      const insertPayload = {
        session_id: sid,
        title,
        messages: serialized,
        user_id: user?.id
      }
      const { data } = await supabase
        .from('llmpad_conversations')
        .insert(insertPayload)
        .select()
        .single()
      if (data) {
        setCurrentConvId(data.id)
        currentConvIdRef.current = data.id
        setConversations(prev => [data as DBConversation, ...prev])
      }
    }
  }, [])

  const loadConversation = (conv: DBConversation) => {
    const msgs: Message[] = conv.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }))
    setMessages(msgs)
    setCurrentConvId(conv.id)
    setError('')
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from('llmpad_conversations').delete().eq('id', id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (currentConvId === id) { setMessages([]); setCurrentConvId(null) }
  }

  const renameConversation = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) { setEditingConvId(null); return }
    await supabase.from('llmpad_conversations').update({ title: newTitle.trim() }).eq('id', id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle.trim() } : c))
    setEditingConvId(null)
  }

  const startEditing = (conv: DBConversation, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingConvId(conv.id)
    setEditingTitle(conv.title)
  }

  const branchConversation = async (conv: DBConversation, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!sessionId || !user) return

    const title = `${conv.title} (branch)`
    const parentId = conv.parent_conversation_id || conv.id
    const branchDepth = (conv.branch_depth || 0) + 1

    const { data } = await supabase
      .from('llmpad_conversations')
      .insert({
        session_id: sessionId,
        title,
        messages: conv.messages,
        parent_conversation_id: parentId,
        branch_depth: branchDepth,
        user_id: user.id
      })
      .select()
      .single()

    if (data) {
      setConversations(prev => [data as DBConversation, ...prev])
      // Load the new branched conversation
      loadConversation(data as DBConversation)
    }
  }

  // Fork a conversation from a specific message (includes all messages up to that index)
  const handleFork = async (convId: string, messageIdx: number) => {
    if (!sessionId || !user) return

    const conv = conversations.find(c => c.id === convId)
    if (!conv) return

    // Clamp index to valid range
    const forkIdx = Math.max(0, Math.min(messageIdx, conv.messages.length - 1))
    const forkedMessages = conv.messages.slice(0, forkIdx + 1) // include the forked message

    // Build a title that indicates it's a fork
    const title = `Forked: ${conv.title}`

    const { data } = await supabase
      .from('llmpad_conversations')
      .insert({
        session_id: sessionId,
        title,
        messages: forkedMessages,
        parent_conversation_id: conv.id,
        branch_depth: (conv.branch_depth || 0) + 1,
        user_id: user.id
      })
      .select()
      .single()

    if (data) {
      setConversations(prev => [data as DBConversation, ...prev])
      // Switch to the forked conversation
      loadConversation(data as DBConversation)
    }
  }

  const importContext = async (convId: string) => {
    const conv = conversations.find(c => c.id === convId)
    if (!conv) return

    // Show messages selection modal
    setImportingConvId(convId)
    setSelectedMessages([])
    setShowContextModal(true)
  }

  const confirmImportContext = () => {
    if (!importingConvId || selectedMessages.length === 0) return

    const conv = conversations.find(c => c.id === importingConvId)
    if (!conv) return

    // Get selected messages
    const importedMsgs = conv.messages.filter(m => selectedMessages.includes(m.id))

    // Add to current conversation messages
    const newMsgs: Message[] = importedMsgs.map(m => ({
      ...m,
      id: generateId(),
      timestamp: new Date(m.timestamp),
    }))

    setMessages(prev => [...newMsgs, ...prev])
    setShowContextModal(false)
    setImportingConvId(null)
    setSelectedMessages([])
  }

  const newConversation = () => {
    setMessages([])
    setCurrentConvId(null)
    setError('')
  }

  /* ── Settings ── */
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('llmpad_theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }

  const saveSettings = () => {
    localStorage.setItem('sarvam_api_key', apiKey)
    localStorage.setItem('sarvam_model', model)
    localStorage.setItem('sarvam_temp', temperature.toString())
    localStorage.setItem('sarvam_instructions', instructions)
    localStorage.setItem('sarvam_custom_model', customModel)
    localStorage.setItem('llmpad_openrouter_key', openrouterKey)
    localStorage.setItem('llmpad_reasoning_model', reasoningModel)
    localStorage.setItem('llmpad_tts_lang', ttsLanguage)
    localStorage.setItem('llmpad_tts_speaker', ttsSpeaker)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  const maskKey = (k: string) => k.length > 10 ? `${k.slice(0, 6)}${'•'.repeat(8)}${k.slice(-4)}` : '••••••••••'

  /* ── Auth ── */
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setAuthLoadingSubmit(true)

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword })
        if (error) throw error
        setAuthError('Check your email for the confirmation link!')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        if (error) throw error
        // Close modal on successful login
        setShowLoginModal(false)
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed')
    } finally {
      setAuthLoadingSubmit(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    // Reset unauth message counter on logout
    localStorage.removeItem('llmpad_unauth_messages')
  }

  /* ── TTS ── */
  const handleSpeak = useCallback(async (msgId: string, text: string) => {
    // If already speaking a different message, stop it first
    if (audioRef.current && speakingMsgId && speakingMsgId !== msgId) {
      audioRef.current.pause()
      audioRef.current = null
      setSpeakingMsgId(null)
    }

    // If clicking the same message that's playing, stop it
    if (speakingMsgId === msgId) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setSpeakingMsgId(null)
      return
    }

    if (!apiKey || !text) return

    setError('')

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: ttsLanguage, speaker: ttsSpeaker, apiKey }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'TTS failed')
      }

      const data = await res.json()
      if (!data.audio) {
        throw new Error('No audio returned')
      }

      setSpeakingMsgId(msgId)

      // Play audio
      const audio = new Audio(`data:audio/mp3;base64,${data.audio}`)
      audioRef.current = audio

      audio.onended = () => {
        setSpeakingMsgId(null)
        audioRef.current = null
      }

      audio.onerror = () => {
        setSpeakingMsgId(null)
        setError('Audio playback failed')
        audioRef.current = null
      }

      await audio.play()
    } catch (err: any) {
      setError(err.message || 'TTS failed')
      setSpeakingMsgId(null)
    }
  }, [apiKey, ttsLanguage, ttsSpeaker, speakingMsgId])

  /* ── Send ── */
  // Auth gate: track message count for unauthenticated users
  const getUnauthMessageCount = () => {
    if (typeof window === 'undefined') return 0
    return parseInt(localStorage.getItem('llmpad_unauth_messages') || '0', 10)
  }
  const incrementUnauthMessageCount = () => {
    if (typeof window === 'undefined') return
    const count = getUnauthMessageCount() + 1
    localStorage.setItem('llmpad_unauth_messages', count.toString())
  }

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isStreaming) return

    // Auth gate: prompt sign-in after first message for unauthenticated users
    if (!user) {
      const msgCount = getUnauthMessageCount()
      if (msgCount >= 1) {
        setShowLoginModal(true)
        setError('Please sign in to continue chatting')
        return
      }
      // First message allowed - increment counter
      incrementUnauthMessageCount()
    }

    setError('')

    // Process attachment through vision if present
    let visionContext = ''
    if (uploadedFile) {
      // Need Sarvam API key for vision processing
      if (!apiKey) {
        setVisionError('Sarvam API key required for vision. Add it in Settings.')
        return
      }

      setIsProcessingVision(true)
      try {
        const formData = new FormData()
        formData.append('file', uploadedFile)
        formData.append('language', visionLanguage)

        const visionRes = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'x-api-key': apiKey },
          body: formData,
        })

        if (visionRes.ok) {
          const visionData = await visionRes.json()
          if (visionData.content) {
            visionContext = `\n\n[Document "${uploadedFile.name}" analysis]\n${visionData.content}\n[/Document analysis]`
          }
        }
      } catch (err) {
        console.error('Vision processing error:', err)
      } finally {
        setIsProcessingVision(false)
        clearAttachment()
      }
    }

    const userMsg: Message = { id: generateId(), role: 'user', content: content + visionContext, timestamp: new Date() }
    const asstMsg: Message = { id: generateId(), role: 'assistant', content: '', timestamp: new Date() }

    setMessages(prev => [...prev, userMsg, asstMsg])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    let finalMsgs: Message[] = []

    try {
      // Use OpenRouter for reasoning mode, otherwise use Sarvam via proxy
      const isReasoning = reasoningMode && openrouterKey
      console.log('[Chat] isReasoning:', isReasoning, 'reasoningMode:', reasoningMode, 'openrouterKey exists:', !!openrouterKey)
      const endpoint = isReasoning
        ? '/api/openrouter'
        : '/api/chat'

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      let body: Record<string, unknown>

      if (isReasoning) {
        console.log('[Chat] Sending to OpenRouter, userMsg content:', userMsg.content.slice(0, 200))
        body = {
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          model: reasoningModel,
          temperature,
          apiKey: openrouterKey,
        }
      } else {
        console.log('[Chat] Sending to Sarvam, userMsg content:', userMsg.content.slice(0, 200))
        body = {
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          model: activeModel,
          temperature,
          systemPrompt: instructions,
          apiKey,
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abort.signal,
      })

      console.log('[Chat] Fetch response:', res.status, res.statusText)

    if (!res.ok) {
        const contentType = res.headers.get('content-type') || ''
        const text = await res.text()

        // If not streaming, try to parse as JSON error
        if (!contentType.includes('text/event-stream')) {
          console.log('[Chat] Non-streaming response, content-type:', contentType, 'body:', text.slice(0, 300))
          let msg = text
          try { const j = JSON.parse(text); msg = j.error?.message || j.message || msg } catch {}
          throw new Error(msg)
        }
        // For streaming errors, still try to parse
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      }

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        const text = await res.text()
        console.log('[Chat] Not streaming, content-type:', contentType, 'body:', text.slice(0, 500))
        throw new Error('Expected streaming response but got: ' + contentType)
      }

      console.log('[Chat] Starting stream parse, status:', res.status)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let chunkCount = 0
      let totalChars = 0
      let inThinkBlock = false  // track think tag state across chunks
      let thinkBuffer = ''      // accumulate think content to discard

      console.log('[Chat] Starting stream parse, status:', res.status)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            console.log('[Chat] Stream done, chunks:', chunkCount, 'chars:', totalChars)
            continue
          }
          try {
            const parsed = JSON.parse(data)
            let delta = parsed.choices?.[0]?.delta?.content || ''
            if (!delta) continue

            // Stateful think-tag filtering across streaming chunks
            let visible = ''
            let i = 0
            while (i < delta.length) {
              if (!inThinkBlock) {
                const open = delta.indexOf('<think>', i)
                if (open === -1) {
                  visible += delta.slice(i)
                  break
                }
                visible += delta.slice(i, open)
                inThinkBlock = true
                thinkBuffer = ''
                i = open + 7
              } else {
                const close = delta.indexOf('</think>', i)
                if (close === -1) {
                  thinkBuffer += delta.slice(i)
                  break
                }
                inThinkBlock = false
                thinkBuffer = ''
                i = close + 8
              }
            }

            delta = visible
            if (delta) {
              chunkCount++
              totalChars += delta.length
              setMessages(prev => {
                const updated = [...prev]
                const last = { ...updated[updated.length - 1] }
                last.content += delta
                updated[updated.length - 1] = last
                finalMsgs = updated
                return updated
              })
            }
          } catch {}
        }
      }
    } catch (err: any) {
      console.log('[Chat] Error:', err.message, err.name, err.stack)
      if (err.name !== 'AbortError') {
        setError(err.message || 'Request failed')
        setMessages(prev => {
          const last = prev[prev.length - 1]
          return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev
        })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
      // Save after stream completes
      if (finalMsgs.length > 0 && sessionId) {
        saveConversation(finalMsgs, currentConvIdRef.current, sessionId)
      }
    }
  }, [input, isStreaming, apiKey, openrouterKey, reasoningModel, reasoningMode, messages, activeModel, temperature, instructions, sessionId, saveConversation])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleRetry = useCallback((text: string) => {
    setInput(text)
    // Focus the textarea
    textareaRef.current?.focus()
  }, [])

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      setVisionError('')
    }
  }

  // Clear/remove attachment
  const clearAttachment = () => {
    setUploadedFile(null)
    setVisionError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle file upload to Vision API
  const handleVisionUpload = async () => {
    if (!uploadedFile || !apiKey) {
      setVisionError('Please add your API key in Settings first')
      return
    }

    setIsProcessingVision(true)
    setVisionError('')

    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      formData.append('language', visionLanguage)

      const response = await fetch('/api/vision', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process document')
      }

      // Add the vision result as a user message with the analysis
      const fileName = uploadedFile.name
      const resultContent = data.content || 'Document processed successfully. Please check the attachment.'

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: `[Analyzed: ${fileName}]\n\n${resultContent}`,
        timestamp: new Date(),
      }

      // Add assistant response with the full analysis
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resultContent,
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, userMsg, assistantMsg])
      setUploadedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

    } catch (err: any) {
      console.error('Vision error:', err)
      setVisionError(err.message || 'Failed to process document')
    } finally {
      setIsProcessingVision(false)
    }
  }

  // Trigger file input click
  const triggerFileUpload = () => {
    fileInputRef.current?.click()
  }

  /* ══════════════ RENDER ══════════════ */
  // Auth loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-[#080808]">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    )
  }

  // Main app - show chat by default, auth is optional
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#080808] text-gray-900 dark:text-[#e0e0e0] font-sans overflow-hidden transition-colors duration-200">

      {/* ═══════════ SIDEBAR ═══════════ */}
      <aside
        className="flex-shrink-0 overflow-hidden border-r border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#090909] transition-all duration-300 flex flex-col"
        style={{ width: showSidebar ? '272px' : '0px' }}
      >
        <div className="w-[272px] h-full flex flex-col">

          {/* Brand + New Chat */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 dark:border-[#141414] flex-shrink-0">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-xl font-bold text-[#ff9500]">LLM</span>
              <span className="font-display text-xl font-bold text-gray-900 dark:text-[#e0e0e0]">Pad</span>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <button
                  onClick={newConversation}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#ff9500]/10 text-[#ff9500] hover:bg-[#ff9500]/20 border border-[#ff9500]/20 transition-all"
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>
                  New
              </button>
              )}
            </div>
          </div>

          {/* User Info / Login */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#141414] flex-shrink-0">
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#ff9500]/20 flex items-center justify-center text-[#ff9500] text-sm font-medium flex-shrink-0">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-[#e0e0e0] truncate">{user.email?.split('@')[0]}</p>
                    <p className="text-xs text-gray-400 dark:text-[#555] truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-xs text-gray-400 hover:text-red-500 dark:text-[#555] dark:hover:text-red-400 transition-colors flex-shrink-0"
                  title="Sign out"
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-lg bg-[#ff9500]/10 text-[#ff9500] hover:bg-[#ff9500]/20 border border-[#ff9500]/20 transition-all"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>
                Sign In
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-[#141414] flex-shrink-0">
            {(['chats', 'settings'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-widest transition-colors ${
                  sidebarTab === tab
                    ? 'text-[#ff9500] border-b-2 border-[#ff9500]'
                    : 'text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#888]'
                }`}
              >
                {tab === 'chats' ? '💬 Chats' : '⚙ Settings'}
              </button>
            ))}
          </div>

          {/* ─── Conversations tab ─── */}
          {sidebarTab === 'chats' && (
            <div className="flex-1 overflow-y-auto">
              {!user ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="text-xs text-[#ff9500] hover:text-[#ffad33] font-medium"
                  >
                    Sign In →
                  </button>
                </div>
              ) : convLoading ? (
                <div className="flex items-center justify-center h-20 text-sm text-gray-400 dark:text-[#444]">Loading…</div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center">
                  <p className="text-sm text-gray-400 dark:text-[#555]">No saved conversations yet</p>
                  <p className="text-xs text-gray-300 dark:text-[#333]">Start chatting to save automatically</p>
                </div>
              ) : (
                <div className="py-2">
                  {conversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => loadConversation(conv)}
                      className={`group flex items-start justify-between gap-2 px-4 py-3 cursor-pointer transition-colors ${
                        currentConvId === conv.id
                          ? 'bg-[#ff9500]/8 border-r-2 border-[#ff9500]'
                          : 'hover:bg-gray-50 dark:hover:bg-[#1a1a1a]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        {editingConvId === conv.id ? (
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            onBlur={() => renameConversation(conv.id, editingTitle)}
                            onKeyDown={e => { if (e.key === 'Enter') renameConversation(conv.id, editingTitle); if (e.key === 'Escape') setEditingConvId(null) }}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                            className="w-full text-sm font-medium bg-white dark:bg-[#1a1a1a] border border-[#ff9500] rounded px-2 py-0.5 text-gray-900 dark:text-[#e0e0e0] focus:outline-none"
                          />
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              {conv.branch_depth > 0 && (
                                <span className="flex-shrink-0 text-[10px] px-1 py-0.5 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 font-medium" title={`Branched (depth ${conv.branch_depth})`}>
                                  ⎔
                                </span>
                              )}
                              <p className={`text-sm font-medium truncate leading-tight ${
                                currentConvId === conv.id ? 'text-gray-900 dark:text-[#e0e0e0]' : 'text-gray-700 dark:text-[#bbb]'
                              }`}>
                                {conv.title}
                              </p>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-[#555] mt-0.5">{timeAgo(conv.updated_at)}</p>
                          </>
                        )}
                      </div>
                      {editingConvId !== conv.id && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button
                            onClick={e => branchConversation(conv, e)}
                            className="flex-shrink-0 p-1 rounded text-gray-300 dark:text-[#333] hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-all"
                            title="Branch"
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                          </button>
                          <button
                            onClick={e => startEditing(conv, e)}
                            className="flex-shrink-0 p-1 rounded text-gray-300 dark:text-[#333] hover:text-[#ff9500] dark:hover:text-[#ff9500] hover:bg-gray-100 dark:hover:bg-[#222] transition-all"
                            title="Rename"
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18.75V8.25a2.25 2.25 0 012.25-2.25h11.5a2.25 2.25 0 012.25 2.25v11.5a2.25 2.25 0 01-2.25 2.25h-2.25" />
                            </svg>
                          </button>
                          <button
                            onClick={e => deleteConversation(conv.id, e)}
                            className="flex-shrink-0 p-1 rounded text-gray-300 dark:text-[#333] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                            title="Delete"
                          >
                            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Settings tab ─── */}
          {sidebarTab === 'settings' && (
            <div className="flex-1 overflow-y-auto">
              {!user ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center">
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="text-xs text-[#ff9500] hover:text-[#ffad33] font-medium"
                  >
                    Sign In →
                  </button>
                </div>
              ) : (
                <div className="px-4 py-4 space-y-5">

                {/* API Key */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-[#bbb] uppercase tracking-widest block">Sarvam API Key</label>
                  <input
                    type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder="Paste your Sarvam API key"
                    className="w-full bg-gray-100 dark:bg-[#141414] border border-gray-300 dark:border-[#252525] rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-[#e0e0e0] placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:border-[#ff9500]/70 transition-colors font-mono"
                  />
                  {apiKey && <p className="text-xs text-gray-400 dark:text-[#555] font-mono">{maskKey(apiKey)}</p>}
                </div>

                {/* OpenRouter API Key */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-[#bbb] uppercase tracking-widest block">OpenRouter API Key</label>
                  <input
                    type="password" value={openrouterKey} onChange={e => setOpenrouterKey(e.target.value)}
                    placeholder="For reasoning mode (optional)"
                    className="w-full bg-gray-100 dark:bg-[#141414] border border-gray-300 dark:border-[#252525] rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-[#e0e0e0] placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:border-[#ff9500]/70 transition-colors font-mono"
                  />
                  {openrouterKey && <p className="text-xs text-gray-400 dark:text-[#555] font-mono">{maskKey(openrouterKey)}</p>}
                  <p className="text-xs text-gray-400 dark:text-[#444]">Get free key at openrouter.ai</p>
                </div>

                {/* OpenRouter Model - show when reasoning mode is on */}
                {reasoningMode && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 dark:text-[#bbb] uppercase tracking-widest block">Reasoning Model</label>
                    <select
                      value={reasoningModel} onChange={e => setReasoningModel(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-[#141414] border border-gray-300 dark:border-[#252525] rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-[#e0e0e0] focus:outline-none focus:border-[#ff9500]/70 transition-colors cursor-pointer"
                    >
                      <option value="arcee-ai/trinity-large-preview:free">Trinity Large (free) - 128k context</option>
                      <option value="stepfun/step-3.5-flash:free">Step 3.5 Flash (free) - Fast</option>
                    </select>
                    <p className="text-xs text-gray-400 dark:text-[#444]">Used when Reasoning mode is ON</p>
                  </div>
                )}

                {/* Model */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-[#bbb] uppercase tracking-widest block">Model</label>
                  <select
                    value={model} onChange={e => setModel(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-[#141414] border border-gray-300 dark:border-[#252525] rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-[#e0e0e0] focus:outline-none focus:border-[#ff9500]/70 transition-colors cursor-pointer"
                  >
                    {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  {model === 'custom' && (
                    <input
                      type="text" value={customModel} onChange={e => setCustomModel(e.target.value)}
                      placeholder="model-id"
                      className="w-full bg-gray-100 dark:bg-[#141414] border border-[#ff9500]/40 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-[#e0e0e0] placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:border-[#ff9500]/70 font-mono"
                    />
                  )}
                </div>

                {/* Temperature */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500 dark:text-[#bbb] uppercase tracking-widest">Temperature</label>
                    <span className="text-sm font-mono text-[#ff9500]">{temperature.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0" max="2" step="0.1" value={temperature}
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-400 dark:text-[#555]">
                    <span>Precise</span><span>Balanced</span><span>Creative</span>
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-500 dark:text-[#bbb] uppercase tracking-widest">Instructions</label>
                    {instructions.trim() && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#ff9500]/15 text-[#ff9500] font-mono border border-[#ff9500]/30">active</span>
                    )}
                  </div>
                  <textarea
                    value={instructions} onChange={e => setInstructions(e.target.value)}
                    placeholder="You are a helpful assistant. Set tone, language, persona, constraints…"
                    rows={5}
                    className="w-full bg-gray-100 dark:bg-[#141414] border border-gray-300 dark:border-[#252525] rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-[#e0e0e0] placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:border-[#ff9500]/70 resize-none leading-relaxed"
                  />
                  <p className="text-xs text-gray-400 dark:text-[#444]">Injected as system prompt before every conversation.</p>
                </div>

                {/* TTS Voice */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-[#bbb] uppercase tracking-widest block">TTS Voice</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={ttsLanguage} onChange={e => setTtsLanguage(e.target.value)}
                      className="bg-gray-100 dark:bg-[#141414] border border-gray-300 dark:border-[#252525] rounded-lg px-2 py-2 text-xs text-gray-900 dark:text-[#e0e0e0] focus:outline-none focus:border-[#ff9500]/70 cursor-pointer"
                    >
                      {TTS_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                    <select
                      value={ttsSpeaker} onChange={e => setTtsSpeaker(e.target.value)}
                      className="bg-gray-100 dark:bg-[#141414] border border-gray-300 dark:border-[#252525] rounded-lg px-2 py-2 text-xs text-gray-900 dark:text-[#e0e0e0] focus:outline-none focus:border-[#ff9500]/70 cursor-pointer"
                    >
                      {TTS_SPEAKERS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-[#444]">Voice for text-to-speech.</p>
                </div>

                {/* Vision Language */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-[#bbb] uppercase tracking-widest block">Vision Language</label>
                  <select
                    value={visionLanguage} onChange={e => setVisionLanguage(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-[#141414] border border-gray-300 dark:border-[#252525] rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-[#e0e0e0] focus:outline-none focus:border-[#ff9500]/70 transition-colors cursor-pointer"
                  >
                    <option value="en-IN">English</option>
                    <option value="hi-IN">Hindi (हिन्दी)</option>
                    <option value="bn-IN">Bengali (বাংলা)</option>
                    <option value="ta-IN">Tamil (தமிழ்)</option>
                    <option value="te-IN">Telugu (తెలుగు)</option>
                    <option value="mr-IN">Marathi (मराठी)</option>
                    <option value="gu-IN">Gujarati (ગુજરાતી)</option>
                    <option value="kn-IN">Kannada (ಕನ್ನಡ)</option>
                    <option value="ml-IN">Malayalam (മലയാളം)</option>
                    <option value="pa-IN">Punjabi (ਪੰਜਾਬੀ)</option>
                    <option value="ur-IN">Urdu (اردو)</option>
                  </select>
                  <p className="text-xs text-gray-400 dark:text-[#444]">Language for document vision analysis.</p>
                </div>

              </div>
              )}

              {/* Save */}
              {user && (
                <div className="px-4 pb-5">
                  <button
                    onClick={saveSettings}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      settingsSaved
                        ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-500/30'
                        : 'bg-[#ff9500] text-black hover:bg-[#ffad33]'
                    }`}
                  >
                    {settingsSaved ? '✓ Saved' : 'Save Settings'}
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </aside>

      {/* ═══════════ MAIN ═══════════ */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#090909] flex-shrink-0">
          <button onClick={() => setShowSidebar(s => !s)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#111] transition-colors text-gray-400 dark:text-[#555] hover:text-gray-700 dark:hover:text-[#ccc]">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            {/* Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-[#111] border border-gray-200 dark:border-[#1a1a1a]">
              <span className={`w-1.5 h-1.5 rounded-full ${apiKey ? 'bg-[#ff9500]' : 'bg-gray-300 dark:bg-[#333]'}`} />
              <span className="text-xs font-mono text-gray-500 dark:text-[#777]">
                {reasoningMode && openrouterKey ? reasoningModel : (activeModel || 'sarvam-m')}
              </span>
            </div>
            {/* Instructions toggle */}
            <button
              onClick={() => setShowInstructions(s => !s)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                instructions.trim()
                  ? 'bg-[#ff9500]/10 border-[#ff9500]/30 text-[#ff9500] hover:bg-[#ff9500]/20'
                  : 'bg-gray-100 dark:bg-[#111] border-gray-200 dark:border-[#1a1a1a] text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#888]'
              }`}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              Instructions{instructions.trim() ? ' ●' : ''}
            </button>
            {/* Reasoning toggle - only show for signed in users */}
            {user && (
              <button
                onClick={() => setReasoningMode(r => !r)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  reasoningMode
                    ? 'bg-orange-100 dark:bg-orange-500/20 border-orange-300 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-500/30'
                    : 'bg-gray-100 dark:bg-[#111] border-gray-200 dark:border-[#1a1a1a] text-gray-400 dark:text-[#555] hover:text-gray-600 dark:hover:text-[#888]'
                }`}
                title="Use OpenRouter for reasoning responses"
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
                Reason{reasoningMode ? ' ●' : ''}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#111] transition-colors text-gray-400 dark:text-[#555] hover:text-gray-700 dark:hover:text-[#ccc]">
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            {user && (
              <button onClick={newConversation} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#111] transition-colors text-gray-400 dark:text-[#555] hover:text-gray-700 dark:hover:text-[#ccc]" title="New chat">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </button>
            )}
          </div>
        </header>

        {/* Instructions panel */}
        {showInstructions && (
          <div className="border-b border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0c0c0c] px-5 py-4 flex-shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-[#bbb] uppercase tracking-widest flex items-center gap-2">
                  Instructions
                  {instructions.trim() && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#ff9500]/15 text-[#ff9500] border border-[#ff9500]/30 normal-case font-mono">active</span>}
                </span>
                <button onClick={saveSettings} className="text-xs text-[#ff9500] hover:text-[#ffad33] font-medium">
                  {settingsSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
              <textarea
                value={instructions} onChange={e => setInstructions(e.target.value)}
                placeholder="You are a helpful assistant. Describe tone, language, persona, constraints…"
                rows={3}
                className="w-full bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-[#252525] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-[#e0e0e0] placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:border-[#ff9500]/60 resize-none leading-relaxed"
              />
              <p className="text-xs text-gray-400 dark:text-[#444] mt-1.5">Sent as a system message before every conversation.</p>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-6 px-4 bg-gray-50 dark:bg-[#080808]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 max-w-lg mx-auto text-center">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/25 flex items-center justify-center mx-auto mb-4 text-xl">⚡</div>
                <h2 className="font-display text-2xl font-bold text-gray-900 dark:text-[#e0e0e0]">LLMPad</h2>
                <p className="text-sm text-gray-500 dark:text-[#777] mt-2">
                  Start a conversation below
                </p>
              </div>
              <div className="w-full">
                <div className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-[#1f1f1f] bg-white dark:bg-[#0c0c0c]">
                  {STARTERS.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className={`w-full text-center p-4 text-sm text-gray-600 dark:text-[#888] hover:text-gray-900 dark:hover:text-[#eee] hover:bg-gray-50 dark:hover:bg-[#111] transition-all duration-300 ${
                        i === currentStarter ? 'opacity-100 translate-y-0' : 'absolute top-0 left-0 opacity-0 translate-y-2 pointer-events-none'
                      }`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, idx) => (
                <div key={msg.id} className={`flex gap-3 msg-enter ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-[#ff9500]/10 border border-[#ff9500]/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">⚡</div>
                  )}
                  <div className={`group ${msg.role === 'user' ? 'max-w-[70%]' : 'flex-1 min-w-0'}`}>
                    {msg.role === 'user' ? (
                      <div className="bg-[#ff9500] text-black rounded-2xl rounded-tr-sm px-4 py-3 text-base leading-relaxed font-medium whitespace-pre-wrap">{msg.content}</div>
                    ) : (
                      <div className="text-base leading-relaxed">
                        {msg.content ? (
                          <div className="prose prose-gray dark:prose-invert prose-sm max-w-none
                            prose-p:text-gray-800 dark:prose-p:text-[#d0d0d0] prose-p:leading-relaxed
                            prose-headings:text-gray-900 dark:prose-headings:text-[#e0e0e0]
                            prose-strong:text-gray-900 dark:prose-strong:text-[#e8e8e8]
                            prose-a:text-[#ff9500] prose-a:no-underline hover:prose-a:underline
                            prose-blockquote:border-[#ff9500]/40
                            prose-hr:border-gray-200 dark:prose-hr:border-[#1f1f1f]
                            prose-li:text-gray-800 dark:prose-li:text-[#d0d0d0]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                              code({ className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '')
                                if (!match) return <code className="bg-amber-50 dark:bg-[#1a1a1a] text-amber-700 dark:text-[#ff9500] px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
                                return <CodeBlock language={match[1]}>{String(children)}</CodeBlock>
                              },
                              pre({ children }: any) { return <>{children}</> },
                              table({ children }: any) { return <div className="overflow-x-auto my-3"><table className="text-sm border-collapse w-full">{children}</table></div> },
                              th({ children }: any) { return <th className="border border-gray-200 dark:border-[#1f1f1f] bg-gray-50 dark:bg-[#0f0f0f] px-3 py-2 text-left text-gray-600 dark:text-[#888] font-semibold">{children}</th> },
                              td({ children }: any) { return <td className="border border-gray-200 dark:border-[#1a1a1a] px-3 py-2 text-gray-700 dark:text-[#bbb]">{children}</td> },
                            }}>
                              {msg.content}
                            </ReactMarkdown>
                            {isStreaming && idx === messages.length - 1 && (
                              <span className="inline-block w-2 h-[15px] bg-[#ff9500] rounded-sm cursor-blink ml-0.5 align-middle" />
                            )}
                          </div>
                        ) : (
                          isStreaming && idx === messages.length - 1 && (
                            <span className="inline-block w-2 h-[15px] bg-[#ff9500] rounded-sm cursor-blink align-middle" />
                          )
                        )}
                      </div>
                    )}
                    <div className={`flex flex-col gap-1.5 mt-1.5 text-xs text-gray-400 dark:text-[#555] opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.content && (
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => handleFork(currentConvId || '', idx)}
                            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] text-gray-500 dark:text-[#aaa] hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/40 hover:text-orange-600 dark:hover:text-orange-400 transition-all"
                            title="Fork from this point"
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 6l4 4-4 4" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h8" />
                            </svg>
                            <span>Fork</span>
                          </button>

                          <div className="flex items-center gap-1.5">
                            <CopyButton text={msg.content} />
                            <SpeakButton
                              msgId={msg.id}
                              text={msg.content}
                              language={ttsLanguage}
                              speaker={ttsSpeaker}
                              isPlaying={speakingMsgId === msg.id}
                              onClick={() => handleSpeak(msg.id, msg.content)}
                            />
                            {msg.role === 'user' && (
                              <RetryButton text={msg.content} onClick={() => handleRetry(msg.content)} />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#222] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-semibold text-gray-500 dark:text-[#555]">V</div>
                  )}
                </div>
              ))}

              {error && (
                <div className="mx-auto max-w-xl p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/30 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
                  <span>⚠</span><span>{error}</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-[#1a1a1a] bg-white dark:bg-[#090909] p-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 border transition-all ${
              apiKey
                ? 'bg-white dark:bg-[#0f0f0f] border-gray-300 dark:border-[#444] focus-within:border-[#ff9500] focus-within:ring-2 focus-within:ring-[#ff9500]/40'
                : 'bg-gray-50 dark:bg-[#0f0f0f] border-gray-200 dark:border-[#161616]'
            }`}>
              {/* Add Context Button */}
              <button
                onClick={() => setShowContextModal(true)}
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 dark:bg-[#1a1a1a] text-gray-500 dark:text-[#888] hover:bg-orange-100 dark:hover:bg-orange-900/40 hover:text-orange-500 dark:hover:text-orange-400 transition-all"
                title="Add context from other chats"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              <textarea
                ref={textareaRef} value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
                }}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                rows={1} disabled={isStreaming}
                className="flex-1 bg-transparent text-gray-900 dark:text-[#e0e0e0] placeholder-gray-400 dark:placeholder-[#666] focus:outline-none resize-none text-base leading-relaxed py-2.5 disabled:opacity-50"
                style={{ maxHeight: '180px', minHeight: '44px' }}
              />
              <button
                onClick={isStreaming ? () => abortRef.current?.abort() : () => handleSend()}
                disabled={!input.trim() && !isStreaming}
                className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                  isStreaming
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-[#ff9500] text-black hover:bg-[#e68600] disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
                title={isStreaming ? 'Stop' : 'Send'}
              >
                {isStreaming
                  ? <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  : <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                }
              </button>
            </div>
            
            {/* Vision error message */}
            {visionError && (
              <p className="text-center text-xs text-red-500 dark:text-red-400 mt-2.5 font-medium">{visionError}</p>
            )}
            
            {/* Uploaded file preview */}
            {uploadedFile && (
              <div className="flex items-center justify-center gap-3 mt-3">
                <div className="flex items-center gap-2.5 px-3.5 py-2 bg-gray-100 dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-[#333]">
                  {/* File icon */}
                  {uploadedFile.type === 'application/pdf' ? (
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 13.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H9a.5.5 0 0 1-.5-.5v-3zm.5 1h1v2h-1V2z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  )}
                  <span className="text-sm font-medium text-gray-700 dark:text-[#ccc] max-w-[200px] truncate">{uploadedFile.name}</span>
                </div>
                <button
                  onClick={clearAttachment}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-500 dark:hover:text-red-400 transition-all"
                  title="Remove attachment"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            )}
            
            <p className="text-center text-xs text-gray-400 dark:text-[#666] mt-2.5 text-[0.75rem]">
              Enter to send · Shift+Enter for new line · Click ■ to stop
            </p>
          </div>
        </div>
      </main>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowLoginModal(false)}>
          <div className="w-full max-w-md bg-white dark:bg-[#111111] rounded-2xl border border-gray-200 dark:border-[#222222] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-[#e0e0e0]">Sign In to LLMPad</h2>
              <button onClick={() => setShowLoginModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-[#ccc]">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex mb-6 bg-gray-100 dark:bg-[#1a1a1a] rounded-lg p-1">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${authMode === 'login' ? 'bg-white dark:bg-[#222] text-gray-900 dark:text-[#e0e0e0] shadow-sm' : 'text-gray-500 dark:text-[#666]'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${authMode === 'signup' ? 'bg-white dark:bg-[#222] text-gray-900 dark:text-[#e0e0e0] shadow-sm' : 'text-gray-500 dark:text-[#666]'}`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-[#666] mb-1">Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-[#e0e0e0] focus:outline-none focus:border-[#ff9500] transition-colors"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-[#666] mb-1">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-lg text-gray-900 dark:text-[#e0e0e0] focus:outline-none focus:border-[#ff9500] transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {authError && (
                <div className={`text-sm p-3 rounded-lg ${authError.includes('Check your email') ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'}`}>
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authLoadingSubmit}
                className="w-full py-2.5 bg-[#ff9500] hover:bg-[#e68600] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {authLoadingSubmit ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 dark:text-[#555] mt-4">
              Sign in to save your conversations to the cloud
            </p>
          </div>
        </div>
      )}

      {/* Context Import Modal */}
      {showContextModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" onClick={() => setShowContextModal(false)}>
          <div className="w-full max-w-lg bg-white dark:bg-[#111111] rounded-2xl border border-gray-200 dark:border-[#222222] p-6 shadow-xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-[#e0e0e0]">Add Context</h2>
              <button onClick={() => setShowContextModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-[#ccc]">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {!importingConvId ? (
              <>
                <p className="text-sm text-gray-500 dark:text-[#666] mb-4">Select a conversation to import messages from:</p>
                <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh]">
                  {conversations
                    .filter(c => c.id !== currentConvId)
                    .map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => importContext(conv.id)}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-[#2a2a2a] hover:border-orange-400 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          {conv.branch_depth > 0 && <span className="text-[10px]">⎔</span>}
                          <span className="font-medium text-gray-900 dark:text-[#e0e0e0] truncate">{conv.title}</span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-[#555] mt-1">{conv.messages.length} messages · {timeAgo(conv.updated_at)}</p>
                      </button>
                    ))}
                  {conversations.filter(c => c.id !== currentConvId).length === 0 && (
                    <p className="text-sm text-gray-400 dark:text-[#555] text-center py-8">No other conversations available</p>
                  )}
                </div>
              </>
            ) : (
              <>
                {(() => {
                  const conv = conversations.find(c => c.id === importingConvId)
                  return (
                    <>
                      <p className="text-sm text-gray-500 dark:text-[#666] mb-4">
                        Select messages to import from <span className="font-medium text-gray-900 dark:text-[#e0e0e0]">{conv?.title}</span>:
                      </p>
                      <div className="flex-1 overflow-y-auto space-y-2 max-h-[50vh] mb-4">
                        {conv?.messages.map(msg => (
                          <label
                            key={msg.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedMessages.includes(msg.id)
                                ? 'border-orange-400 dark:border-orange-500 bg-orange-50 dark:bg-orange-950/20'
                                : 'border-gray-200 dark:border-[#2a2a2a] hover:border-orange-300 dark:hover:border-orange-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedMessages.includes(msg.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedMessages(prev => [...prev, msg.id])
                                } else {
                                  setSelectedMessages(prev => prev.filter(id => id !== msg.id))
                                }
                              }}
                              className="mt-1 w-4 h-4 text-orange-500 rounded border-gray-300 dark:border-[#444] focus:ring-orange-500"
                            />
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-medium ${
                                msg.role === 'user' ? 'text-[#ff9500]' : 'text-orange-500'
                              }`}>
                                {msg.role === 'user' ? 'You' : 'Assistant'}
                              </span>
                              <p className="text-sm text-gray-700 dark:text-[#bbb] line-clamp-2">{msg.content}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setImportingConvId(null)}
                          className="flex-1 py-2 px-4 text-sm font-medium text-gray-600 dark:text-[#888] bg-gray-100 dark:bg-[#1a1a1a] rounded-lg hover:bg-gray-200 dark:hover:bg-[#222] transition-colors"
                        >
                          Back
                        </button>
                        <button
                          onClick={confirmImportContext}
                          disabled={selectedMessages.length === 0}
                          className="flex-1 py-2 px-4 text-sm font-medium text-black bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Import {selectedMessages.length} message{selectedMessages.length !== 1 ? 's' : ''}
                        </button>
                      </div>
                    </>
                  )
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
// cache bust
