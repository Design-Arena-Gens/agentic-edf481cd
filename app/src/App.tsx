import { useEffect, useMemo, useRef, useState } from 'react'
import { SerialProvider } from './context/SerialContext'
import { SerialPanel } from './components/SerialPanel'
import { MacroManager } from './components/MacroManager'
import { ControlBoard } from './components/ControlBoard'
import { CameraPanel } from './components/CameraPanel'
import { MappingPanel } from './components/MappingPanel'
import { VoicePanel } from './components/VoicePanel'
import { TelemetryPanel } from './components/TelemetryPanel'
import { dbApi } from './lib/db'
import { useAppStore } from './store/useAppStore'
import './App.css'

const AppShell = () => {
  const setMacros = useAppStore((state) => state.setMacros)
  const setTelemetry = useAppStore((state) => state.setTelemetry)
  const setLogs = useAppStore((state) => state.setLogs)
  const logs = useAppStore((state) => state.logs)
  const upsertTelemetry = useAppStore((state) => state.upsertTelemetry)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const processedLogIds = useRef(new Set<string>())

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [storedMacros, storedTelemetry, storedLogs] = await Promise.all([
          dbApi.getMacros(),
          dbApi.getTelemetry(),
          dbApi.getRecentLogs(),
        ])
        setMacros(storedMacros ?? [])
        setTelemetry(storedTelemetry ?? [])
        setLogs(storedLogs ?? [])
        storedLogs?.forEach((entry) => processedLogIds.current.add(entry.id))
      } catch (err) {
        console.error('Failed to load persisted data', err)
      }
    }

    void hydrate()
  }, [setLogs, setMacros, setTelemetry])

  useEffect(() => {
    if (logs.length === 0) return
    const recent = logs[logs.length - 1]
    if (processedLogIds.current.has(recent.id)) {
      return
    }
    processedLogIds.current.add(recent.id)

    if (recent.direction !== 'in') return

    const parseTelemetry = (line: string) => {
      const telemetryRegex = /^(?:TELEMETRY|TEL)\s+([A-Za-z0-9_/:-]+)\s+([-+]?\d*\.?\d+)\s*([A-Za-z%°]*)/i
      const keyValueRegex = /([A-Za-z0-9_/:-]+)\s*[:=]\s*([-+]?\d*\.?\d+)\s*([A-Za-z%°]*)/

      const match = line.match(telemetryRegex) ?? line.match(keyValueRegex)
      if (!match) return
      const [, labelRaw, valueRaw, unitRaw] = match
      upsertTelemetry({
        id: labelRaw.toLowerCase(),
        label: labelRaw.replace(/[_:-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
        value: valueRaw,
        unit: unitRaw ?? '',
        timestamp: Date.now(),
      })
      dbApi
        .upsertTelemetry({
          id: labelRaw.toLowerCase(),
          label: labelRaw,
          value: valueRaw,
          unit: unitRaw ?? '',
          timestamp: Date.now(),
        })
        .catch(() => {})
    }

    parseTelemetry(recent.message)
  }, [logs, upsertTelemetry])

  const mainGrid = useMemo(
    () => (
      <div className="grid">
        <div className="grid-column">
          <SerialPanel />
          <MacroManager />
          <TelemetryPanel />
        </div>
        <div className="grid-column">
          <CameraPanel onStreamChange={setCameraStream} />
          <VoicePanel />
        </div>
        <div className="grid-column">
          <ControlBoard />
          <MappingPanel stream={cameraStream} />
        </div>
      </div>
    ),
    [cameraStream],
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Pico Navigator Control Suite</h1>
        <p>Progressive Web App for Raspberry Pi Pico via Web Serial, vision, and voice.</p>
      </header>
      {mainGrid}
    </div>
  )
}

function App() {
  return (
    <SerialProvider>
      <AppShell />
    </SerialProvider>
  )
}

export default App
