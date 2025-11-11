import { useEffect, useRef, useState } from 'react'

export interface MotionSample {
  timestamp: number
  acceleration: { x: number; y: number; z: number }
  rotationRate: { alpha: number; beta: number; gamma: number }
  orientation: { alpha: number; beta: number; gamma: number }
}

interface Options {
  sampleIntervalMs?: number
  maxSamples?: number
}

export const useDeviceMotion = ({ sampleIntervalMs = 100, maxSamples = 256 }: Options = {}) => {
  const [granted, setGranted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [samples, setSamples] = useState<MotionSample[]>([])
  const latestTimestamp = useRef(0)
  const orientationRef = useRef<MotionSample['orientation']>({
    alpha: 0,
    beta: 0,
    gamma: 0,
  })

  useEffect(() => {
    const requestPermission = async () => {
      let motionGranted = true
      let orientationGranted = true

      if (typeof DeviceMotionEvent !== 'undefined' && 'requestPermission' in DeviceMotionEvent) {
        try {
          const permission = await (DeviceMotionEvent as any).requestPermission()
          motionGranted = permission === 'granted'
        } catch (err) {
          motionGranted = false
          setError((err as Error).message)
        }
      }

      if (typeof DeviceOrientationEvent !== 'undefined' && 'requestPermission' in DeviceOrientationEvent) {
        try {
          const permission = await (DeviceOrientationEvent as any).requestPermission()
          orientationGranted = permission === 'granted'
        } catch (err) {
          orientationGranted = false
          setError((err as Error).message)
        }
      }

      setGranted(motionGranted || orientationGranted)
    }

    requestPermission().catch((err) => setError((err as Error).message))
  }, [])

  useEffect(() => {
    if (!granted) {
      return
    }

    const handleMotion = (event: DeviceMotionEvent) => {
      const now = performance.now()
      if (now - latestTimestamp.current < sampleIntervalMs) {
        return
      }

      latestTimestamp.current = now
      setSamples((prev) => {
        const next: MotionSample = {
          timestamp: now,
          acceleration: {
            x: event.accelerationIncludingGravity?.x ?? 0,
            y: event.accelerationIncludingGravity?.y ?? 0,
            z: event.accelerationIncludingGravity?.z ?? 0,
          },
          rotationRate: {
            alpha: event.rotationRate?.alpha ?? 0,
            beta: event.rotationRate?.beta ?? 0,
            gamma: event.rotationRate?.gamma ?? 0,
          },
          orientation: orientationRef.current,
        }

        const clipped = [...prev, next]
        if (clipped.length > maxSamples) {
          clipped.shift()
        }
        return clipped
      })
    }

    window.addEventListener('devicemotion', handleMotion)
    return () => {
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [granted, sampleIntervalMs, maxSamples])

  useEffect(() => {
    if (!granted) {
      return
    }
    const handleOrientation = (event: DeviceOrientationEvent) => {
      orientationRef.current = {
        alpha: event.alpha ?? 0,
        beta: event.beta ?? 0,
        gamma: event.gamma ?? 0,
      }
    }

    window.addEventListener('deviceorientation', handleOrientation)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [granted])

  return { granted, error, samples }
}
