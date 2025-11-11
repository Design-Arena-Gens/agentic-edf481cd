import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { dbApi } from '../lib/db'
import { useAppStore, type SerialLogEntry } from '../store/useAppStore'

type SerialStatus = 'unsupported' | 'idle' | 'connecting' | 'connected' | 'error'

interface SerialContextValue {
  status: SerialStatus
  isSupported: boolean
  portLabel: string | null
  error: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendCommand: (command: string, options?: { silent?: boolean }) => Promise<void>
  baudRate: number
  setBaudRate: (value: number) => void
}

const SerialContext = createContext<SerialContextValue | undefined>(undefined)

const DEFAULT_BAUD_RATE = 115200

const getSerialApi = () => {
  if (typeof navigator === 'undefined') return null
  return 'serial' in navigator ? ((navigator as Navigator & { serial: Serial }).serial ?? null) : null
}

const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`)

const createLogEntry = (direction: 'in' | 'out', message: string): SerialLogEntry => ({
  id: uid(),
  timestamp: Date.now(),
  direction,
  message,
})

export const SerialProvider = ({ children }: PropsWithChildren) => {
  const addLog = useAppStore((state) => state.addLog)
  const setVoiceTranscript = useAppStore((state) => state.setVoiceTranscript)
  const [status, setStatus] = useState<SerialStatus>(getSerialApi() ? 'idle' : 'unsupported')
  const [error, setError] = useState<string | null>(null)
  const [baudRate, setBaudRate] = useState<number>(DEFAULT_BAUD_RATE)
  const [portLabel, setPortLabel] = useState<string | null>(null)

  const portRef = useRef<SerialPort | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const writerRef = useRef<WritableStreamDefaultWriter<Uint8Array> | null>(null)
  const readingTask = useRef<Promise<void> | null>(null)
  const encoderRef = useRef<TextEncoder | null>(null)
  const decoderRef = useRef<TextDecoder | null>(null)
  const remainderRef = useRef('')
  const autoConnectAttempted = useRef(false)

  const appendLog = useCallback(
    (entry: SerialLogEntry) => {
      addLog(entry)
      dbApi.appendLog(entry).catch(() => {
        // ignore persistence errors
      })
    },
    [addLog],
  )

  const cleanupResources = useCallback(async () => {
    remainderRef.current = ''
    if (readerRef.current) {
      try {
        await readerRef.current.cancel()
      } catch {
        // ignore
      }
      try {
        readerRef.current.releaseLock()
      } catch {
        // ignore
      }
      readerRef.current = null
    }

    if (writerRef.current) {
      try {
        await writerRef.current.close()
      } catch {
        // ignore
      }
      try {
        writerRef.current.releaseLock()
      } catch {
        // ignore
      }
      writerRef.current = null
    }

    decoderRef.current = null
    encoderRef.current = null

    await readingTask.current?.catch(() => {})
    readingTask.current = null
  }, [])

  const closePortIfOpen = useCallback(async () => {
    const port = portRef.current
    if (port) {
      try {
        await cleanupResources()
        await port.close()
      } catch {
        // ignore
      } finally {
        portRef.current = null
      }
    }
  }, [cleanupResources])

  const readLoop = useCallback(async () => {
    const reader = readerRef.current
    if (!reader) return

    if (!decoderRef.current) {
      decoderRef.current = new TextDecoder()
    }

    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done || !portRef.current) {
          break
        }
        if (value) {
          const text = decoderRef.current.decode(value, { stream: true })
          const combined = remainderRef.current + text
          const segments = combined.split(/\r?\n/)
          remainderRef.current = segments.pop() ?? ''
          segments
            .map((line) => line.trim())
            .filter(Boolean)
            .forEach((line) => appendLog(createLogEntry('in', line)))
        }
      }

      const tail = remainderRef.current.trim()
      if (tail) {
        appendLog(createLogEntry('in', tail))
        remainderRef.current = ''
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      setError((err as Error).message)
      setStatus('error')
    }
  }, [appendLog])

  const openPort = useCallback(
    async (port: SerialPort) => {
      if (!port.readable || !port.writable) {
        await port.open({ baudRate })
      } else {
        // ensure correct baud rate if already open
        await port.close()
        await port.open({ baudRate })
      }

      const info = port.getInfo()
      const label = info.usbProductId
        ? `VID_${info.usbVendorId?.toString(16).toUpperCase() ?? '0000'} PID_${info.usbProductId
            ?.toString(16)
            .toUpperCase()}`
        : 'Raspberry Pi Pico'
      setPortLabel(label)
      portRef.current = port

      decoderRef.current = new TextDecoder()
      encoderRef.current = new TextEncoder()
      remainderRef.current = ''

      if (port.readable) {
        readerRef.current = port.readable.getReader()
        readingTask.current = readLoop()
      }

      if (port.writable) {
        writerRef.current = port.writable.getWriter()
      }

      appendLog(createLogEntry('out', `Connected @ ${baudRate} baud (${label})`))
      setStatus('connected')
      setError(null)

      dbApi
        .setSetting('lastPortInfo', {
          usbVendorId: info.usbVendorId,
          usbProductId: info.usbProductId,
        })
        .catch(() => {})
    },
    [appendLog, baudRate, readLoop],
  )

  const connect = useCallback(async () => {
    if (status === 'connecting') return
    if (!getSerialApi()) {
      setStatus('unsupported')
      setError('Web Serial API is not available in this browser.')
      return
    }

    try {
      setStatus('connecting')
      const serial = getSerialApi()
      if (!serial) {
        throw new Error('Serial API not available.')
      }
      const port = await serial.requestPort()
      await openPort(port)
    } catch (err) {
      setError((err as Error).message)
      setStatus('idle')
    }
  }, [openPort, status])

  const disconnect = useCallback(async () => {
    setStatus('idle')
    setVoiceTranscript('')
    appendLog(createLogEntry('out', 'Disconnected'))
    await closePortIfOpen()
  }, [appendLog, closePortIfOpen, setVoiceTranscript])

  const sendCommand = useCallback(
    async (command: string, options?: { silent?: boolean }) => {
      const writer = writerRef.current
      if (!writer) {
        throw new Error('Serial connection is not ready.')
      }

      if (!encoderRef.current) {
        encoderRef.current = new TextEncoder()
      }

      const payload = command.endsWith('\n') ? command : `${command}\n`
      await writer.write(encoderRef.current.encode(payload))
      if (!options?.silent) {
        appendLog(createLogEntry('out', command))
      }
    },
    [appendLog],
  )

  useEffect(() => {
    if (!getSerialApi() || autoConnectAttempted.current) {
      return
    }

    autoConnectAttempted.current = true

    const attemptReconnect = async () => {
      try {
        const serial = getSerialApi()
        const lastPort = await dbApi.getSetting<{ usbVendorId?: number; usbProductId?: number }>('lastPortInfo')
        if (!lastPort) return
        if (!serial) return
        const ports = await serial.getPorts()
        const match = ports.find((port) => {
          const info = port.getInfo()
          return info.usbVendorId === lastPort.usbVendorId && info.usbProductId === lastPort.usbProductId
        })
        if (match) {
          setStatus('connecting')
          await openPort(match)
        }
      } catch (err) {
        setError((err as Error).message)
        setStatus('idle')
      }
    }

    attemptReconnect()
  }, [openPort])

  useEffect(() => {
    const handleDisconnect = (event: Event) => {
      const port = (event.target as SerialPort | null) ?? null
      if (!portRef.current || (port && port !== portRef.current)) {
        return
      }
      appendLog(createLogEntry('out', 'Device disconnected'))
      void closePortIfOpen()
      setStatus('idle')
    }

    getSerialApi()?.addEventListener('disconnect', handleDisconnect)

    return () => {
      getSerialApi()?.removeEventListener('disconnect', handleDisconnect)
    }
  }, [appendLog, closePortIfOpen])

  const value = useMemo<SerialContextValue>(
    () => ({
      status,
      isSupported: status !== 'unsupported',
      portLabel,
      error,
      connect,
      disconnect,
      sendCommand,
      baudRate,
      setBaudRate,
    }),
    [status, portLabel, error, connect, disconnect, sendCommand, baudRate],
  )

  return <SerialContext.Provider value={value}>{children}</SerialContext.Provider>
}

export const useSerial = () => {
  const context = useContext(SerialContext)
  if (!context) {
    throw new Error('useSerial must be used within a SerialProvider')
  }
  return context
}
