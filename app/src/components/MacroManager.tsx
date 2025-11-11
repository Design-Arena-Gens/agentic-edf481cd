import { useState } from 'react'
import { dbApi } from '../lib/db'
import { useSerial } from '../context/SerialContext'
import { useAppStore, type Macro } from '../store/useAppStore'

const createMacro = (name: string, command: string): Macro => ({
  id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `macro-${Date.now()}-${Math.random().toString(16).slice(2)}`),
  name,
  command,
  createdAt: Date.now(),
})

export const MacroManager = () => {
  const { status, sendCommand } = useSerial()
  const macros = useAppStore((state) => state.macros)
  const addMacro = useAppStore((state) => state.addMacro)
  const updateMacro = useAppStore((state) => state.updateMacro)
  const removeMacro = useAppStore((state) => state.removeMacro)

  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim() || !command.trim()) return

    if (editingId) {
      const next: Macro = { id: editingId, name: name.trim(), command: command.trim(), createdAt: Date.now() }
      updateMacro(next)
      await dbApi.saveMacro(next)
    } else {
      const macro = createMacro(name.trim(), command.trim())
      addMacro(macro)
      await dbApi.saveMacro(macro)
    }

    setName('')
    setCommand('')
    setEditingId(null)
  }

  const handleEdit = (macro: Macro) => {
    setEditingId(macro.id)
    setName(macro.name)
    setCommand(macro.command)
  }

  const handleDelete = async (id: string) => {
    removeMacro(id)
    await dbApi.removeMacro(id)
  }

  const handleRun = async (macro: Macro) => {
    try {
      for (const line of macro.command.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        await sendCommand(trimmed)
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">Macros & Scripts</div>
        <p className="card-subtitle">Bundle multi-step actions and deploy instantly.</p>
      </header>
      <div className="card-body column gap-md">
        <div className="macro-form">
          <input placeholder="Macro name" value={name} onChange={(event) => setName(event.target.value)} />
          <textarea
            placeholder="Command(s) to send (line separated)"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            rows={3}
          />
          <div className="macro-actions">
            <button className="btn primary" onClick={() => void handleSave()} disabled={!name.trim() || !command.trim()}>
              {editingId ? 'Update Macro' : 'Save Macro'}
            </button>
            {editingId ? (
              <button
                className="btn ghost"
                onClick={() => {
                  setEditingId(null)
                  setName('')
                  setCommand('')
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        <div className="macro-list">
          {macros.length === 0 ? (
            <p className="placeholder">No macros yet. Create one to automate Pico behaviors.</p>
          ) : (
            macros.map((macro) => (
              <div key={macro.id} className="macro-item">
                <div>
                  <h4>{macro.name}</h4>
                  <pre>{macro.command}</pre>
                </div>
                <div className="macro-buttons">
                  <button className="btn primary" onClick={() => void handleRun(macro)} disabled={status !== 'connected'}>
                    Run
                  </button>
                  <button className="btn ghost" onClick={() => handleEdit(macro)}>
                    Edit
                  </button>
                  <button className="btn danger" onClick={() => void handleDelete(macro.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
