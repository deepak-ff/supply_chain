import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'

const BASE = import.meta.env.VITE_API_URL ?? ''
const API_KEY = import.meta.env.VITE_API_KEY ?? ''
function authHeaders(): Record<string, string> {
  return API_KEY ? { 'X-Api-Key': API_KEY } : {}
}

interface OutputLine {
  type: 'prompt' | 'output' | 'error' | 'system'
  text: string
}

async function getCompletions() {
  const res = await fetch(`${BASE}/api/v1/terminal/completions`, {
    headers: authHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed')
  return res.json() as Promise<{
    commands: string[]
    examples: { cmd: string; desc: string }[]
  }>
}

const TERM_FONT = "'JetBrains Mono', 'Menlo', 'Monaco', 'Cascadia Code', 'Consolas', monospace"

export function TerminalPage() {
  const [input, setInput] = useState('')
  const [lines, setLines] = useState<OutputLine[]>([
    { type: 'system', text: 'STRIKE CONSOLE v2.0 — secure uplink to the grid' },
    { type: 'system', text: 'Type "help" for available commands.' },
    { type: 'system', text: '' },
  ])
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [running, setRunning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useQuery({
    queryKey: ['terminal-completions'],
    queryFn: getCompletions,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const scroll = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    })
  }, [])

  useEffect(scroll, [lines, scroll])

  const focusInput = () => {
    if (!running) inputRef.current?.focus()
  }

  useEffect(focusInput, [running])

  const exec = useCallback(async (raw: string) => {
    const cmd = raw.trim()
    if (!cmd) return

    setCmdHistory(prev => [...prev.filter(h => h !== cmd), cmd])
    setHistoryIdx(-1)

    setLines(prev => [...prev, { type: 'prompt', text: `$ cwctl ${cmd}` }])
    setRunning(true)

    if (cmd === 'clear') {
      setLines([])
      setRunning(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`${BASE}/api/v1/terminal/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({ command: cmd }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setLines(prev => [...prev, { type: 'error', text: err.error || res.statusText }])
        setRunning(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setLines(prev => [...prev, { type: 'error', text: 'No response stream' }])
        setRunning(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let isDoneEvent = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const segments = buffer.split('\n')
        buffer = segments.pop() || ''

        for (const seg of segments) {
          if (seg.startsWith('event: done')) {
            isDoneEvent = true
            continue
          }
          if (seg.startsWith('data: ')) {
            if (isDoneEvent) {
              isDoneEvent = false
              continue
            }
            const data = seg.slice(6)
            setLines(prev => [...prev, { type: 'output', text: data }])
          }
          if (seg === '') isDoneEvent = false
        }
      }

      setLines(prev => [...prev, { type: 'system', text: '' }])
    } catch (err: unknown) {
      const e = err as Error
      if (e.name === 'AbortError') {
        setLines(prev => [...prev, { type: 'error', text: '^C' }])
      } else {
        setLines(prev => [...prev, { type: 'error', text: e.message || 'Unknown error' }])
      }
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }, [])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !running) {
      exec(input)
      setInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (cmdHistory.length > 0) {
        const ni = historyIdx < cmdHistory.length - 1 ? historyIdx + 1 : historyIdx
        setHistoryIdx(ni)
        setInput(cmdHistory[cmdHistory.length - 1 - ni] || '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIdx > 0) {
        const ni = historyIdx - 1
        setHistoryIdx(ni)
        setInput(cmdHistory[cmdHistory.length - 1 - ni] || '')
      } else {
        setHistoryIdx(-1)
        setInput('')
      }
    } else if (e.key === 'c' && e.ctrlKey && running) {
      abortRef.current?.abort()
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLines([])
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-1">
      <div>
        <p className="m-0 font-mono text-[0.62rem] font-bold uppercase tracking-[0.22em] text-text-muted">
          <span className="text-neon drop-shadow-[0_0_6px_var(--neon)]">R-07</span>
          <span className="mx-2 text-border-color">/</span>
          recon // strike console
        </p>
      </div>

      {/* Terminal window */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-border-color bg-bg-base shadow-card"
        style={{ fontFamily: TERM_FONT }}
      >
        {/* Title bar */}
        <div className="flex h-9 flex-shrink-0 select-none items-center gap-2 border-b border-border-color bg-surface px-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-critical shadow-[0_0_6px_var(--critical)]" />
            <div className="h-3 w-3 rounded-full bg-warning shadow-[0_0_6px_var(--warning)]" />
            <div className="h-3 w-3 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
          </div>
          <div className="flex-1 text-center text-[0.7rem] tracking-wide text-text-muted">
            cwctl <span className="text-neon">—</span> secure uplink
          </div>
          <div className="w-12" />
        </div>

        {/* Terminal body */}
        <div
          ref={scrollRef}
          onClick={focusInput}
          className="min-h-0 flex-1 cursor-text overflow-auto px-3.5 py-3 text-[0.8rem] leading-5"
        >
          {lines.map((line, i) => (
            <div key={i} className="min-h-5 whitespace-pre-wrap break-words">
              {line.type === 'prompt' ? (
                <>
                  <span className="text-neon drop-shadow-[0_0_6px_var(--neon)]">❯</span>
                  <span className="text-text-primary"> {line.text.replace('$ cwctl ', '')}</span>
                </>
              ) : line.type === 'error' ? (
                <span className="text-critical">{line.text}</span>
              ) : line.type === 'system' ? (
                <span className="text-text-muted">{line.text}</span>
              ) : (
                <span className="text-text-secondary">{line.text}</span>
              )}
            </div>
          ))}

          {/* Active prompt */}
          <div className="flex min-h-5 items-center">
            <span className={running ? 'mr-1.5 text-text-muted' : 'mr-1.5 text-neon drop-shadow-[0_0_6px_var(--neon)]'}>
              {running ? '◌' : '❯'}
            </span>
            <div className="relative flex flex-1 items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={running}
                autoFocus
                spellCheck={false}
                autoComplete="off"
                className="m-0 w-full border-none bg-transparent p-0 font-[inherit] text-[inherit] leading-[inherit] text-text-primary outline-none"
                style={{ caretColor: 'var(--neon)' }}
              />
              {running && (
                <span className="ml-2 whitespace-nowrap text-[0.68rem] text-text-muted">
                  running… <span className="text-neon">(ctrl+c to abort)</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex h-6 flex-shrink-0 select-none items-center justify-between border-t border-border-color bg-surface px-3 text-[0.66rem] text-text-muted">
          <div className="flex gap-3.5">
            <span className="flex items-center gap-1.5">
              <span className="sonar h-1.5 w-1.5 rounded-full bg-success text-success" />
              <span className="text-success">uplink live</span>
            </span>
            <span>{cmdHistory.length} commands</span>
          </div>
          <div className="flex gap-3.5">
            <span>↑↓ history</span>
            <span>^L clear</span>
            <span>^C abort</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TerminalPage
