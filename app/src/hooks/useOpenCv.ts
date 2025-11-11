import { useEffect, useState } from 'react'

declare global {
  interface Window {
    cv?: unknown
  }
}

const OPENCV_URL = 'https://docs.opencv.org/4.x/opencv.js'

export const useOpenCv = () => {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (window.cv) {
      setIsReady(true)
      return
    }

    let scriptEl = document.querySelector<HTMLScriptElement>(`script[src="${OPENCV_URL}"]`)
    if (!scriptEl) {
      scriptEl = document.createElement('script')
      scriptEl.src = OPENCV_URL
      scriptEl.async = true
      scriptEl.defer = true
      scriptEl.dataset.injected = 'true'
      document.body.appendChild(scriptEl)
    }

    const handleLoad = () => {
      const cvInstance = window.cv as Record<string, unknown> | undefined
      if (cvInstance) {
        cvInstance['onRuntimeInitialized'] = () => {
          setIsReady(true)
        }
      } else {
        setError('OpenCV failed to load.')
      }
    }

    const handleError = () => {
      setError('Unable to load OpenCV library.')
    }

    scriptEl.addEventListener('load', handleLoad)
    scriptEl.addEventListener('error', handleError)

    return () => {
      scriptEl?.removeEventListener('load', handleLoad)
      scriptEl?.removeEventListener('error', handleError)
    }
  }, [])

  return { isReady, error, cv: window.cv as any }
}
