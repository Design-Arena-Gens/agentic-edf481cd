import { useEffect, useRef, useState } from 'react'
import { useSerial } from '../context/SerialContext'
import { useOpenCv } from '../hooks/useOpenCv'
import { useDeviceMotion } from '../hooks/useDeviceMotion'
import { useAppStore } from '../store/useAppStore'

interface MappingPanelProps {
  stream: MediaStream | null
}

interface MapPoint {
  x: number
  y: number
}

interface Keypoint {
  x: number
  y: number
  strength: number
}

const MAX_PATH_POINTS = 512
const MAP_SCALE = 2

export const MappingPanel = ({ stream }: MappingPanelProps) => {
  const { isReady: openCvReady, error: cvError, cv } = useOpenCv()
  const { samples } = useDeviceMotion({ sampleIntervalMs: 120, maxSamples: 256 })
  const lidarEnabled = useAppStore((state) => state.lidarEnabled)
  const setLidarEnabled = useAppStore((state) => state.setLidarEnabled)
  const { sendCommand, status } = useSerial()

  const videoRef = useRef<HTMLVideoElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const mapCanvasRef = useRef<HTMLCanvasElement>(null)
  const [keypoints, setKeypoints] = useState<Keypoint[]>([])
  const [path, setPath] = useState<MapPoint[]>([{ x: 0, y: 0 }])

  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.srcObject = stream ?? null
  }, [stream])

  useEffect(() => {
    if (!openCvReady || !cv || !captureCanvasRef.current || !videoRef.current) return

    let cancelled = false
    const capture = () => {
      if (!videoRef.current || !captureCanvasRef.current || !cv || !openCvReady) return

      const width = videoRef.current.videoWidth
      const height = videoRef.current.videoHeight
      if (!width || !height) {
        if (!cancelled) {
          requestAnimationFrame(capture)
        }
        return
      }

      captureCanvasRef.current.width = width
      captureCanvasRef.current.height = height
      const ctx = captureCanvasRef.current.getContext('2d')
      if (!ctx) return
      ctx.drawImage(videoRef.current, 0, 0, width, height)

      const frame = cv.imread(captureCanvasRef.current)
      const gray = new cv.Mat()
      cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY, 0)

      const corners = new cv.Mat()
      const mask = new cv.Mat()
      cv.goodFeaturesToTrack(
        gray,
        corners,
        100,
        0.01,
        10,
        mask,
        3,
        false,
        0.04,
      )

      const nextKeypoints: Keypoint[] = []
      for (let i = 0; i < corners.rows; i += 1) {
        const [px, py] = [corners.data32F[i * 2], corners.data32F[i * 2 + 1]]
        nextKeypoints.push({ x: px, y: py, strength: 1 })
      }
      setKeypoints(nextKeypoints)

      frame.delete()
      gray.delete()
      corners.delete()
      mask.delete()

      if (!cancelled) {
        requestAnimationFrame(capture)
      }
    }

    requestAnimationFrame(capture)
    return () => {
      cancelled = true
    }
  }, [cv, openCvReady])

  useEffect(() => {
    if (!mapCanvasRef.current) return
    const canvas = mapCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // draw path
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 2
    ctx.beginPath()
    path.forEach((point, index) => {
      const x = canvas.width / 2 + point.x * MAP_SCALE
      const y = canvas.height / 2 + point.y * MAP_SCALE
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // draw keypoints
    ctx.fillStyle = '#f97316'
    keypoints.slice(0, 50).forEach((kp) => {
      const x = (kp.x / (videoRef.current?.videoWidth ?? 1)) * canvas.width
      const y = (kp.y / (videoRef.current?.videoHeight ?? 1)) * canvas.height
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }, [keypoints, path])

  useEffect(() => {
    if (!samples.length) return
    setPath((prev) => {
      const last = prev[prev.length - 1] ?? { x: 0, y: 0 }
      const sample = samples[samples.length - 1]
      const deltaX = sample.acceleration.x * 0.05 + sample.rotationRate.gamma * 0.005
      const deltaY = sample.acceleration.y * 0.05 + sample.rotationRate.beta * 0.005
      const nextPoint = {
        x: last.x + deltaX,
        y: last.y + deltaY,
      }
      const updated = [...prev, nextPoint]
      if (updated.length > MAX_PATH_POINTS) {
        updated.shift()
      }
      return updated
    })
  }, [samples])

  const handleToggleLidar = async () => {
    if (status !== 'connected') return
    const next = !lidarEnabled
    setLidarEnabled(next)
    try {
      await sendCommand(`LIDAR ${next ? 'START' : 'STOP'}`)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <section className="card mapping-card">
      <header className="card-header">
        <div className="card-title">Mapping & Telemetry</div>
        <div className="card-actions">
          <button className="btn secondary" onClick={() => void handleToggleLidar()} disabled={status !== 'connected'}>
            {lidarEnabled ? 'Stop LiDAR' : 'Start LiDAR'}
          </button>
        </div>
      </header>
      <div className="card-body column gap-md">
        {cvError ? <p className="error">OpenCV: {cvError}</p> : null}
        {!openCvReady ? <p className="placeholder">Loading OpenCV.js…</p> : null}
        <canvas ref={mapCanvasRef} className="map-canvas" />
        <video ref={videoRef} className="hidden-video" autoPlay muted playsInline />
        <canvas ref={captureCanvasRef} className="hidden-canvas" />
        <div className="keypoints">
          <h4>Tracked Keypoints</h4>
          <span>{keypoints.length}</span>
        </div>
      </div>
    </section>
  )
}
