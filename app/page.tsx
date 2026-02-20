'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { supabase, type DBConversation } from './lib/supabase'

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
  'Explain the difference between LLMs and traditional ML models',
  'Write a Python function to safely parse JSON from a string',
  'What are the best practices for prompt engineering?',
  'Debug this: print("hello" + 42)',
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

/* ── Copy Button ── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="text-xs text-gray-400 dark:text-[#666] hover:text-gray-600 dark:hover:text-[#ccc] transition-colors flex items-center gap-1"
    >
      {copied
        ? <><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>copied</>
        : <><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>copy</>}
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

  /* Settings */
  const [apiKey, setApiKey] = useState('')
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
  const [sessionId, setSessionId] = useState('')

  /* Theme */
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

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

    // Session ID
    let sid = localStorage.getItem('llmpad_session')
    if (!sid) { sid = generateId(); localStorage.setItem('llmpad_session', sid) }
    setSessionId(sid)
  }, [])

  /* ── Load conversations when sessionId is ready ── */
  useEffect(() => {
    if (!sessionId) return
    loadConversations(sessionId)
  }, [sessionId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeModel = model === 'custom' ? customModel : model

  /* ── Supabase ops ── */
  const loadConversations = async (sid: string) => {
    setConvLoading(true)
    const { data } = await supabase
      .from('llmpad_conversations')
      .select('id, session_id, title, created_at, updated_at, messages')
      .eq('session_id', sid)
      .order('updated_at', { ascending: false })
      .limit(50)
    if (data) setConversations(data as DBConversation[])
    setConvLoading(false)
  }

  const saveConversation = useCallback(async (msgs: Message[], convId: string | null, sid: string) => {
    if (!msgs.length || !sid) return
    const serialized = msgs.map(m => ({ ...m, timestamp: m.timestamp.toISOString() }))
    if (convId) {
      await supabase
        .from('llmpad_conversations')
        .update({ messages: serialized, updated_at: new Date().toISOString() })
        .eq('id', convId)
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, messages: serialized, updated_at: new Date().toISOString() } : c))
    } else {
      const title = msgs.find(m => m.role === 'user')?.content.slice(0, 50) + (msgs[0]?.content.length > 50 ? '…' : '') || 'New Conversation'
      const { data } = await supabase
        .from('llmpad_conversations')
        .insert({ session_id: sid, title, messages: serialized })
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
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  const maskKey = (k: string) => k.length > 10 ? `${k.slice(0, 6)}${'•'.repeat(8)}${k.slice(-4)}` : '••••••••••'

  /* ── Send ── */
  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isStreaming || !apiKey) return
    setError('')

    const userMsg: Message = { id: generateId(), role: 'user', content, timestamp: new Date() }
    const asstMsg: Message = { id: generateId(), role: 'assistant', content: '', timestamp: new Date() }

    setMessages(prev => [...prev, userMsg, asstMsg])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    let finalMsgs: Message[] = []

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          model: activeModel,
          temperature,
          systemPrompt: instructions,
          apiKey,
        }),
        signal: abort.signal,
      })

    if (!res.ok) {
        const contentType = res.headers.get('content-type') || ''
        const text = await res.text()
        
        // If not streaming, try to parse as JSON error
        if (!contentType.includes('text/event-stream')) {
          let msg = text
          try { const j = JSON.parse(text); msg = j.error?.message || j.message || msg } catch {}
          throw new Error(msg)
        }
        // For streaming errors, still try to parse
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      }

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        throw new Error('Expected streaming response but got: ' + contentType)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content || ''
            if (delta) {
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
  }, [input, isStreaming, apiKey, messages, activeModel, temperature, instructions, sessionId, saveConversation])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  /* ══════════════ RENDER ══════════════ */
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
            <button
              onClick={newConversation}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#ff9500]/10 text-[#ff9500] hover:bg-[#ff9500]/20 border border-[#ff9500]/20 transition-all"
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M12 5v14M5 12h14"/></svg>
              New
            </button>
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
              {convLoading ? (
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
                          : 'hover:bg-gray-50 dark:hover:bg-[#0f0f0f]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate leading-tight ${
                          currentConvId === conv.id ? 'text-gray-900 dark:text-[#e0e0e0]' : 'text-gray-700 dark:text-[#bbb]'
                        }`}>
                          {conv.title}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-[#555] mt-0.5">{timeAgo(conv.updated_at)}</p>
                      </div>
                      <button
                        onClick={e => deleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded text-gray-300 dark:text-[#333] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                        title="Delete"
                      >
                        <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Settings tab ─── */}
          {sidebarTab === 'settings' && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-4 space-y-5">

                {/* API Key */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 dark:text-[#bbb] uppercase tracking-widest block">API Key</label>
                  <input
                    type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder="Paste your API key"
                    className="w-full bg-gray-100 dark:bg-[#141414] border border-gray-300 dark:border-[#252525] rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-[#e0e0e0] placeholder-gray-400 dark:placeholder-[#555] focus:outline-none focus:border-[#ff9500]/70 transition-colors font-mono"
                  />
                  {apiKey && <p className="text-xs text-gray-400 dark:text-[#555] font-mono">{maskKey(apiKey)}</p>}
                </div>

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

              </div>

              {/* Save */}
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
                {apiKey ? (activeModel || 'select model') : 'no api key'}
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
          </div>

          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#111] transition-colors text-gray-400 dark:text-[#555] hover:text-gray-700 dark:hover:text-[#ccc]">
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button onClick={newConversation} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#111] transition-colors text-gray-400 dark:text-[#555] hover:text-gray-700 dark:hover:text-[#ccc]" title="New chat">
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </button>
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
                  {apiKey ? 'Start a conversation below' : 'Add your API key in Settings to begin'}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {STARTERS.map(s => (
                  <button key={s} onClick={() => handleSend(s)} disabled={!apiKey}
                    className="text-left p-3.5 rounded-xl border border-gray-200 dark:border-[#1f1f1f] hover:border-[#ff9500]/40 text-sm text-gray-600 dark:text-[#888] hover:text-gray-900 dark:hover:text-[#eee] transition-all bg-white dark:bg-[#0c0c0c] hover:bg-gray-50 dark:hover:bg-[#111] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >{s}</button>
                ))}
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
                    <div className={`flex items-center gap-2.5 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-xs text-gray-400 dark:text-[#555]">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.content && <CopyButton text={msg.content} />}
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
            {!apiKey && (
              <p className="text-center text-sm text-gray-400 dark:text-[#555] mb-3">
                ⚡ Add your API key in <button onClick={() => { setShowSidebar(true); setSidebarTab('settings') }} className="text-[#ff9500] hover:underline">Settings</button> to start chatting
              </p>
            )}
            <div className={`flex gap-3 items-end rounded-2xl px-4 py-3 border transition-colors ${
              apiKey
                ? 'bg-gray-50 dark:bg-[#0f0f0f] border-gray-300 dark:border-[#1e1e1e] focus-within:border-[#ff9500]/50'
                : 'bg-gray-50 dark:bg-[#0f0f0f] border-gray-200 dark:border-[#161616]'
            }`}>
              <textarea
                ref={textareaRef} value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
                }}
                onKeyDown={handleKeyDown}
                placeholder={apiKey ? 'Send a message...' : 'Add API key to start...'}
                rows={1} disabled={!apiKey || isStreaming}
                className="flex-1 bg-transparent text-gray-900 dark:text-[#e0e0e0] placeholder-gray-400 dark:placeholder-[#444] focus:outline-none resize-none text-base leading-relaxed disabled:opacity-40"
                style={{ maxHeight: '180px' }}
              />
              <button
                onClick={isStreaming ? () => abortRef.current?.abort() : () => handleSend()}
                disabled={!apiKey || (!input.trim() && !isStreaming)}
                className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  isStreaming
                    ? 'bg-red-100 dark:bg-red-500/15 text-red-500 dark:text-red-400 hover:bg-red-200'
                    : 'bg-[#ff9500] text-black hover:bg-[#ffad33] disabled:opacity-25 disabled:cursor-not-allowed'
                }`}
              >
                {isStreaming
                  ? <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
                  : <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                }
              </button>
            </div>
            <p className="text-center text-xs text-gray-300 dark:text-[#333] mt-2">Enter to send · Shift+Enter for new line · Click ■ to stop</p>
          </div>
        </div>
      </main>
    </div>
  )
}
