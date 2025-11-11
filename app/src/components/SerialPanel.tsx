import { useEffect, useRef, useState } from 'react'
import { useSerial } from '../context/SerialContext'
import { useAppStore } from '../store/useAppStore'

const statusColors: Record<string, string> = {
  connected: '#22c55e',
  connecting: '#f97316',
  idle: '#94a3b8',
  error: '#ef4444',
  unsupported: '#ef4444',
}

export const SerialPanel = () => {
  const { status, connect, disconnect, error, portLabel, sendCommand, baudRate, setBaudRate } = useSerial()
  const logs = useAppStore((state) => state.logs)
  const clearLogs = useAppStore((state) => state.clearLogs)
  const [command, setCommand] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!autoScroll || !logRef.current) return
    logRef.current.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [logs, autoScroll])

  const handleSend = async () => {
    if (!command.trim()) return
    try {
      setIsSending(true)
      await sendCommand(command.trim())
      setCommand('')
    } catch (err) {
      console.error(err)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">
          <span className="dot" style={{ backgroundColor: statusColors[status] ?? '#94a3b8' }} />
          Serial Link
        </div>
        <div className="serial-controls">
          <label className="baud">
            Baud
            <input
              type="number"
              min={9600}
              step={1200}
              value={baudRate}
              onChange={(event) => setBaudRate(Number.parseInt(event.target.value, 10))}
            />
          </label>
          {status !== 'connected' ? (
            <button className="btn primary" onClick={connect} disabled={status === 'connecting' || status === 'unsupported'}>
              {status === 'connecting' ? 'Connecting…' : 'Connect'}
            </button>
          ) : (
            <button className="btn secondary" onClick={disconnect}>
              Disconnect
            </button>
          )}
        </div>
      </header>

      <div className="card-body">
        <div className="status-line">
          <span>Status: {status === 'connected' ? `Connected (${portLabel ?? 'Unknown'})` : status}</span>
          <label className="autoscroll">
            <input type="checkbox" checked={autoScroll} onChange={(event) => setAutoScroll(event.target.checked)} />
            Auto-scroll
          </label>
        </div>
        {error ? <p className="error">Serial error: {error}</p> : null}
        <div className="log-view" ref={logRef}>
          {logs.length === 0 ? (
            <p className="placeholder">No serial messages yet.</p>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className={`log-line ${entry.direction}`}>
                <time>{new Date(entry.timestamp).toLocaleTimeString()}</time>
                <span>{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <footer className="card-footer">
        <div className="command-bar">
          <input
            type="text"
            placeholder="Type command e.g. SERVO 1 90"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleSend()
              }
            }}
            disabled={status !== 'connected'}
          />
          <button className="btn primary" onClick={() => void handleSend()} disabled={status !== 'connected' || isSending}>
            Send
          </button>
        </div>
        <div className="footer-actions">
          <button className="btn ghost" onClick={clearLogs} disabled={logs.length === 0}>
            Clear Log
          </button>
        </div>
      </footer>
    </section>
  )
}
