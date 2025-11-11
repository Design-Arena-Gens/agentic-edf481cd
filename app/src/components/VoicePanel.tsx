import { useEffect, useRef, useState } from 'react'
import { useSerial } from '../context/SerialContext'
import { useAppStore } from '../store/useAppStore'

type RecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

type RecognitionConstructor = new () => RecognitionInstance

declare global {
  interface Window {
    webkitSpeechRecognition?: RecognitionConstructor
    mozSpeechRecognition?: RecognitionConstructor
  }
}

const normalizeCommand = (input: string) => input.trim().toLowerCase()

const voiceToSerial = (phrase: string): string[] => {
  const normalized = normalizeCommand(phrase)

  if (/stop|halt|brake/.test(normalized)) {
    return ['MOTOR 0 STOP', 'MOTOR 1 STOP']
  }
  if (/forward|ahead|straight/.test(normalized)) {
    return ['MOTOR 0 FWD 60', 'MOTOR 1 FWD 60']
  }
  if (/back|reverse/.test(normalized)) {
    return ['MOTOR 0 REV 50', 'MOTOR 1 REV 50']
  }
  if (/left/.test(normalized)) {
    return ['MOTOR 0 REV 40', 'MOTOR 1 FWD 40']
  }
  if (/right/.test(normalized)) {
    return ['MOTOR 0 FWD 40', 'MOTOR 1 REV 40']
  }
  if (/camera/.test(normalized) && /capture|snap|photo/.test(normalized)) {
    return ['CAMERA CAPTURE']
  }
  if (/scan|map/.test(normalized)) {
    return ['LIDAR SCAN']
  }
  if (/lights? on/.test(normalized)) {
    return ['GPIO 15 HIGH']
  }
  if (/lights? off/.test(normalized)) {
    return ['GPIO 15 LOW']
  }

  return [`CMD ${phrase.toUpperCase()}`]
}

const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 1
  window.speechSynthesis.speak(utterance)
}

export const VoicePanel = () => {
  const { sendCommand, status } = useSerial()
  const voiceTranscript = useAppStore((state) => state.voiceTranscript)
  const setVoiceTranscript = useAppStore((state) => state.setVoiceTranscript)
  const isSpeechActive = useAppStore((state) => state.isSpeechActive)
  const setSpeechActive = useAppStore((state) => state.setSpeechActive)

  const recognitionRef = useRef<RecognitionInstance | null>(null)
  const [supported, setSupported] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const SpeechRecognition =
      (window.SpeechRecognition as RecognitionConstructor | undefined) ??
      window.webkitSpeechRecognition ??
      window.mozSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }

    const recognition: RecognitionInstance = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 4

    recognition.onresult = async (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result: SpeechRecognitionResult) => result[0]?.transcript ?? '')
        .join(' ')
      const cleaned = transcript.trim()
      if (!cleaned) return

      setVoiceTranscript(cleaned)
      speak(`Executing ${cleaned}`)

      for (const command of voiceToSerial(cleaned)) {
        try {
          await sendCommand(command)
        } catch (err) {
          console.error(err)
        }
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        return
      }
      setError(event.error)
      setSpeechActive(false)
    }

    recognition.onend = () => {
      if (isSpeechActive) {
        recognition.start()
      }
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [isSpeechActive, sendCommand, setSpeechActive, setVoiceTranscript])

  const handleToggle = async () => {
    const recognition = recognitionRef.current
    if (!recognition) return

    if (isSpeechActive) {
      recognition.stop()
      setSpeechActive(false)
      speak('Voice control stopped')
      return
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      recognition.start()
      setSpeechActive(true)
      setError(null)
      speak('Voice control ready')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">Voice Control</div>
        <button className="btn primary" onClick={() => void handleToggle()} disabled={!supported || status !== 'connected'}>
          {isSpeechActive ? 'Stop Listening' : 'Start Listening'}
        </button>
      </header>
      <div className="card-body column gap-md">
        {!supported ? <p className="error">Web Speech API is not supported in this browser.</p> : null}
        {error ? <p className="error">Speech error: {error}</p> : null}
        <div className="transcript">
          <h4>Last Command</h4>
          <p>{voiceTranscript || '—'}</p>
        </div>
        <p className="helper">
          Try saying “Move forward”, “Rotate right”, “Stop”, “Lights on”, or “Start mapping”.
        </p>
      </div>
    </section>
  )
}
