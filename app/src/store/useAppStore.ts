import { create } from 'zustand'

export type FacingMode = 'user' | 'environment' | 'left' | 'right'

export type SerialDirection = 'in' | 'out'

export interface SerialLogEntry {
  id: string
  timestamp: number
  direction: SerialDirection
  message: string
}

export interface Macro {
  id: string
  name: string
  command: string
  description?: string
  createdAt: number
}

export interface TelemetryDatum {
  id: string
  label: string
  value: string
  unit?: string
  timestamp: number
}

export interface ScriptRun {
  id: string
  label: string
  content: string
  lastRunAt?: number
}

interface AppState {
  logs: SerialLogEntry[]
  macros: Macro[]
  telemetry: TelemetryDatum[]
  scripts: ScriptRun[]
  voiceTranscript: string
  facingMode: FacingMode
  lidarEnabled: boolean
  isSpeechActive: boolean
  addLog: (entry: SerialLogEntry) => void
  setLogs: (entries: SerialLogEntry[]) => void
  clearLogs: () => void
  setMacros: (macros: Macro[]) => void
  addMacro: (macro: Macro) => void
  updateMacro: (macro: Macro) => void
  removeMacro: (id: string) => void
  setTelemetry: (data: TelemetryDatum[]) => void
  upsertTelemetry: (datum: TelemetryDatum) => void
  setScripts: (scripts: ScriptRun[]) => void
  updateScript: (script: ScriptRun) => void
  setVoiceTranscript: (value: string) => void
  setFacingMode: (mode: FacingMode) => void
  setLidarEnabled: (value: boolean) => void
  setSpeechActive: (value: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  logs: [],
  macros: [],
  telemetry: [],
  scripts: [],
  voiceTranscript: '',
  facingMode: 'environment',
  lidarEnabled: false,
  isSpeechActive: false,
  addLog: (entry) =>
    set((state) => ({
      logs: [...state.logs.slice(-199), entry], // keep last 200 entries
    })),
  setLogs: (entries) => set({ logs: entries.slice(-200) }),
  clearLogs: () => set({ logs: [] }),
  setMacros: (macros) => set({ macros }),
  addMacro: (macro) =>
    set((state) => ({
      macros: [...state.macros, macro],
    })),
  updateMacro: (macro) =>
    set((state) => ({
      macros: state.macros.map((item) => (item.id === macro.id ? { ...item, ...macro } : item)),
    })),
  removeMacro: (id) =>
    set((state) => ({
      macros: state.macros.filter((macro) => macro.id !== id),
    })),
  setTelemetry: (telemetry) => set({ telemetry }),
  upsertTelemetry: (datum) =>
    set((state) => {
      const index = state.telemetry.findIndex((item) => item.id === datum.id)
      if (index === -1) {
        return { telemetry: [...state.telemetry, datum] }
      }
      const next = [...state.telemetry]
      next[index] = { ...next[index], ...datum }
      return { telemetry: next }
    }),
  setScripts: (scripts) => set({ scripts }),
  updateScript: (script) =>
    set((state) => {
      const exists = state.scripts.some((item) => item.id === script.id)
      if (exists) {
        return {
          scripts: state.scripts.map((item) => (item.id === script.id ? { ...item, ...script } : item)),
        }
      }
      return { scripts: [...state.scripts, script] }
    }),
  setVoiceTranscript: (value) => set({ voiceTranscript: value }),
  setFacingMode: (mode) => set({ facingMode: mode }),
  setLidarEnabled: (value) => set({ lidarEnabled: value }),
  setSpeechActive: (value) => set({ isSpeechActive: value }),
}))
