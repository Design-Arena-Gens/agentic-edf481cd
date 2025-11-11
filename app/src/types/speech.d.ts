declare global {
  class SpeechRecognitionErrorEvent extends Event {
    readonly error: string
    readonly message: string
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number
    readonly results: SpeechRecognitionResultList
  }

  type SpeechRecognitionResultList = SpeechRecognitionResult[]

  interface SpeechRecognitionResult {
    readonly isFinal: boolean
    readonly length: number
    [index: number]: SpeechRecognitionAlternative
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string
    readonly confidence: number
  }

  interface SpeechRecognition extends EventTarget {
    grammars: SpeechGrammarList
    lang: string
    continuous: boolean
    interimResults: boolean
    maxAlternatives: number
    start(): void
    stop(): void
    abort(): void
    onaudiostart: ((event: Event) => void) | null
    onsoundstart: ((event: Event) => void) | null
    onspeechstart: ((event: Event) => void) | null
    onspeechend: ((event: Event) => void) | null
    onsoundend: ((event: Event) => void) | null
    onaudioend: ((event: Event) => void) | null
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onnomatch: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onstart: ((event: Event) => void) | null
    onend: ((event: Event) => void) | null
  }

  interface SpeechGrammar {
    src: string
    weight: number
  }

  interface SpeechGrammarList {
    readonly length: number
    item(index: number): SpeechGrammar
    addFromURI(src: string, weight?: number): void
    addFromString(string: string, weight?: number): void
  }

  type SpeechRecognitionConstructor = new () => SpeechRecognition

  var SpeechRecognition: {
    prototype: SpeechRecognition
    new (): SpeechRecognition
  }

  var webkitSpeechRecognition: {
    prototype: SpeechRecognition
    new (): SpeechRecognition
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
    mozSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export {}
