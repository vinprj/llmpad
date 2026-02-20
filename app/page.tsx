'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SARVAM_MODELS = [
  { id: 'sarvam-m', label: 'Sarvam-M', desc: 'General purpose' },
  { id: 'sarvam-2b-v0.5', label: 'Sarvam 2B', desc: 'Fast & light' },
  { id: 'sarvam-30b', label: 'Sarvam 30B', desc: 'New ✦' },
  { id: 'sarvam-105b', label: 'Sarvam 105B', desc: 'New — flagship ✦' },
  { id: 'custom', label: 'Custom model...', desc: '' },
]

const STARTERS = [
  'Explain HRV and why it matters for fitness',
  'Write a short poem about Mumbai monsoon in English',
  'What makes Sarvam-105B different from other Indian LLMs?',
  'Debug this Python snippet: print("hello" + 42)',
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="text-[10px] text-[#3a3a3a] hover:text-[#888] transition-colors flex items-center gap-1"
    >
      {copied ? (
        <><CheckIcon /> copied</>
      ) : (
        <><CopyIcon /> copy</>
      )}
    </button>
  )
}

function CopyIcon() {
  return (
    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-[#1f1f1f]">
      <div className="flex items-center justify-between bg-[#0d0d0d] px-4 py-2 border-b border-[#1f1f1f]">
        <span className="text-[10px] font-mono text-[#555] uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={copy}
          className="text-[10px] text-[#444] hover:text-[#ff9500] transition-colors flex items-center gap-1 font-mono"
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus as any}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '16px',
          background: '#0a0a0a',
          fontSize: '12px',
          lineHeight: '1.6',
        }}
      >
        {children.replace(/\n$/, '')}
      </SyntaxHighlighter>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('sarvam-m')
  const [customModel, setCustomModel] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [showSettings, setShowSettings] = useState(true)
  const [error, setError] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const k = localStorage.getItem('sarvam_api_key')
    if (k) setApiKey(k)
    const m = localStorage.getItem('sarvam_model')
    if (m) setModel(m)
    const t = localStorage.getItem('sarvam_temp')
    if (t) setTemperature(parseFloat(t))
    const s = localStorage.getItem('sarvam_system')
    if (s) setSystemPrompt(s)
    const cm = localStorage.getItem('sarvam_custom_model')
    if (cm) setCustomModel(cm)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const activeModel = model === 'custom' ? customModel : model

  const saveSettings = () => {
    localStorage.setItem('sarvam_api_key', apiKey)
    localStorage.setItem('sarvam_model', model)
    localStorage.setItem('sarvam_temp', temperature.toString())
    localStorage.setItem('sarvam_system', systemPrompt)
    localStorage.setItem('sarvam_custom_model', customModel)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isStreaming || !apiKey) return
    setError('')

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    }
    const assistantMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setIsStreaming(true)

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          model: activeModel,
          temperature,
          systemPrompt,
          apiKey,
        }),
        signal: abort.signal,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
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
          // Remove empty assistant msg
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && !last.content) return prev.slice(0, -1)
          return prev
        })
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, isStreaming, apiKey, messages, activeModel, temperature, systemPrompt])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const stopStreaming = () => abortRef.current?.abort()
  const clearChat = () => { setMessages([]); setError('') }

  const maskKey = (k: string) => k ? `${k.slice(0, 6)}${'•'.repeat(Math.min(k.length - 10, 10))}${k.slice(-4)}` : ''

  return (
    <div className="flex h-screen bg-[#080808] text-[#e0e0e0] font-sans overflow-hidden">

      {/* ── Sidebar ── */}
      <aside
        className="flex-shrink-0 overflow-hidden border-r border-[#161616] transition-all duration-300"
        style={{ width: showSettings ? '288px' : '0px' }}
      >
        <div className="w-72 h-full flex flex-col py-5 overflow-y-auto">
          {/* Brand */}
          <div className="px-5 pb-4">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-bold text-[#ff9500]">sarvam</span>
              <span className="font-display text-2xl font-bold text-[#333]">/</span>
              <span className="font-display text-2xl font-bold text-[#e0e0e0]">chat</span>
            </div>
            <p className="text-[10px] text-[#333] mt-0.5 font-mono tracking-wider">INDIA&apos;S SOVEREIGN LLM</p>
          </div>

          <div className="mx-5 h-px bg-[#161616] mb-4" />

          <div className="px-5 space-y-5 flex-1">
            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[#444] uppercase tracking-widest block">
                API Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Enter your Sarvam API key"
                  className="w-full bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-xs text-[#e0e0e0] placeholder-[#2a2a2a] focus:outline-none focus:border-[#ff9500]/60 transition-colors font-mono"
                />
              </div>
              {apiKey && (
                <p className="text-[10px] text-[#2a2a2a] font-mono">{maskKey(apiKey)}</p>
              )}
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[#444] uppercase tracking-widest block">
                Model
              </label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-xs text-[#e0e0e0] focus:outline-none focus:border-[#ff9500]/60 transition-colors cursor-pointer"
              >
                {SARVAM_MODELS.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.label}{m.desc ? ` — ${m.desc}` : ''}
                  </option>
                ))}
              </select>
              {model === 'custom' && (
                <input
                  type="text"
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  placeholder="model-id-here"
                  className="w-full bg-[#0f0f0f] border border-[#ff9500]/30 rounded-lg px-3 py-2.5 text-xs text-[#e0e0e0] placeholder-[#2a2a2a] focus:outline-none focus:border-[#ff9500]/60 transition-colors font-mono mt-1.5"
                />
              )}
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-[#444] uppercase tracking-widest">
                  Temperature
                </label>
                <span className="text-xs font-mono text-[#ff9500] tabular-nums">
                  {temperature.toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={e => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1 rounded-full cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-[#2a2a2a] uppercase tracking-wider">
                <span>Precise</span>
                <span>Balanced</span>
                <span>Creative</span>
              </div>
            </div>

            {/* System Prompt */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-[#444] uppercase tracking-widest block">
                System Prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant..."
                rows={4}
                className="w-full bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg px-3 py-2.5 text-xs text-[#e0e0e0] placeholder-[#2a2a2a] focus:outline-none focus:border-[#ff9500]/60 transition-colors resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* Save */}
          <div className="px-5 mt-5">
            <button
              onClick={saveSettings}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
                settingsSaved
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-[#ff9500] text-black hover:bg-[#ffad33]'
              }`}
            >
              {settingsSaved ? '✓ Saved' : 'Save Settings'}
            </button>

            <a
              href="https://dashboard.sarvam.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-[10px] text-[#2a2a2a] hover:text-[#555] transition-colors mt-3"
            >
              Get API key at dashboard.sarvam.ai ↗
            </a>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-[#111] flex-shrink-0">
          <button
            onClick={() => setShowSettings(s => !s)}
            className="p-2 rounded-lg hover:bg-[#111] transition-colors text-[#444] hover:text-[#888]"
            title="Toggle sidebar"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Status pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0f0f0f] border border-[#1a1a1a]">
            <span className={`w-1.5 h-1.5 rounded-full ${apiKey ? 'bg-[#ff9500]' : 'bg-[#2a2a2a]'}`} />
            <span className="text-[10px] font-mono text-[#444]">
              {apiKey ? activeModel || 'select model' : 'no api key'}
            </span>
          </div>

          <button
            onClick={clearChat}
            className="p-2 rounded-lg hover:bg-[#111] transition-colors text-[#444] hover:text-[#888]"
            title="Clear chat"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-6 px-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 max-w-lg mx-auto text-center">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-[#ff9500]/10 border border-[#ff9500]/20 flex items-center justify-center mx-auto mb-4 text-xl">
                  ⚡
                </div>
                <h2 className="font-display text-2xl font-bold text-[#e0e0e0]">
                  Chat with Sarvam
                </h2>
                <p className="text-sm text-[#333] mt-2 leading-relaxed">
                  {apiKey
                    ? 'Start a conversation below'
                    : 'Add your API key in the sidebar to begin'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    disabled={!apiKey}
                    className="text-left p-3.5 rounded-xl border border-[#161616] hover:border-[#ff9500]/30 text-xs text-[#333] hover:text-[#aaa] transition-all bg-[#0c0c0c] hover:bg-[#111] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, idx) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 msg-enter ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Assistant avatar */}
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-[#ff9500]/10 border border-[#ff9500]/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
                      ⚡
                    </div>
                  )}

                  <div className={`group ${msg.role === 'user' ? 'max-w-[70%]' : 'flex-1 min-w-0'}`}>
                    {msg.role === 'user' ? (
                      <div className="bg-[#ff9500] text-black rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="text-sm leading-relaxed text-[#d0d0d0]">
                        {msg.content ? (
                          <div className="prose prose-invert prose-sm max-w-none
                            prose-p:text-[#d0d0d0] prose-p:leading-relaxed
                            prose-headings:text-[#e0e0e0] prose-headings:font-display
                            prose-strong:text-[#e8e8e8]
                            prose-a:text-[#ff9500] prose-a:no-underline hover:prose-a:underline
                            prose-blockquote:border-[#ff9500]/40 prose-blockquote:text-[#888]
                            prose-hr:border-[#1f1f1f]
                            prose-li:text-[#d0d0d0]
                          ">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || '')
                                  const inline = !match && !className
                                  if (inline) {
                                    return (
                                      <code className="bg-[#1a1a1a] text-[#ff9500] px-1.5 py-0.5 rounded text-[11px] font-mono" {...props}>
                                        {children}
                                      </code>
                                    )
                                  }
                                  return (
                                    <CodeBlock language={match?.[1] || ''}>
                                      {String(children)}
                                    </CodeBlock>
                                  )
                                },
                                pre({ children }: any) {
                                  return <>{children}</>
                                },
                                table({ children }: any) {
                                  return (
                                    <div className="overflow-x-auto my-3">
                                      <table className="text-xs border-collapse w-full">{children}</table>
                                    </div>
                                  )
                                },
                                th({ children }: any) {
                                  return <th className="border border-[#1f1f1f] bg-[#0f0f0f] px-3 py-2 text-left text-[#888] font-semibold">{children}</th>
                                },
                                td({ children }: any) {
                                  return <td className="border border-[#161616] px-3 py-2 text-[#bbb]">{children}</td>
                                },
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                            {isStreaming && idx === messages.length - 1 && (
                              <span className="inline-block w-2 h-[14px] bg-[#ff9500] rounded-sm cursor-blink ml-0.5 align-middle" />
                            )}
                          </div>
                        ) : (
                          isStreaming && idx === messages.length - 1 && (
                            <span className="inline-block w-2 h-[14px] bg-[#ff9500] rounded-sm cursor-blink align-middle" />
                          )
                        )}
                      </div>
                    )}

                    {/* Meta row */}
                    <div className={`flex items-center gap-2.5 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] text-[#2a2a2a]">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {msg.content && <CopyButton text={msg.content} />}
                    </div>
                  </div>

                  {/* User avatar */}
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-[#1a1a1a] border border-[#222] flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-semibold text-[#555]">
                      V
                    </div>
                  )}
                </div>
              ))}

              {/* Error */}
              {error && (
                <div className="mx-auto max-w-xl p-3.5 bg-red-950/30 border border-red-900/30 rounded-xl text-xs text-red-400 flex items-start gap-2">
                  <span className="flex-shrink-0">⚠</span>
                  <span>{error}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-[#111] p-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            {!apiKey && (
              <p className="text-center text-[11px] text-[#2a2a2a] mb-3">
                ⚡ Enter your Sarvam API key in the sidebar to start chatting
              </p>
            )}

            <div className={`flex gap-3 items-end bg-[#0f0f0f] border rounded-2xl px-4 py-3 transition-colors ${
              !apiKey ? 'border-[#161616]' : 'border-[#1e1e1e] focus-within:border-[#ff9500]/40'
            }`}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
                }}
                onKeyDown={handleKeyDown}
                placeholder={apiKey ? 'Message Sarvam...' : 'Add API key to start...'}
                rows={1}
                disabled={!apiKey || isStreaming}
                className="flex-1 bg-transparent text-[#e0e0e0] placeholder-[#2a2a2a] focus:outline-none resize-none text-sm leading-relaxed disabled:opacity-30"
                style={{ maxHeight: '180px' }}
              />
              <button
                onClick={isStreaming ? stopStreaming : handleSend}
                disabled={!apiKey || (!input.trim() && !isStreaming)}
                className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  isStreaming
                    ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                    : 'bg-[#ff9500] text-black hover:bg-[#ffad33] disabled:opacity-20 disabled:cursor-not-allowed'
                }`}
              >
                {isStreaming ? (
                  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="5" y="5" width="14" height="14" rx="2" />
                  </svg>
                ) : (
                  <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>
            </div>

            <p className="text-center text-[10px] text-[#1e1e1e] mt-2">
              Enter to send · Shift+Enter for new line · Click ■ to stop
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
