import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../store/useAppStore'

interface CameraPanelProps {
  onStreamChange: (stream: MediaStream | null) => void
}

export const CameraPanel = ({ onStreamChange }: CameraPanelProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const facingMode = useAppStore((state) => state.facingMode)
  const setFacingMode = useAppStore((state) => state.setFacingMode)

  useEffect(() => {
    const initCamera = async () => {
      try {
        setError(null)
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        })

        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = mediaStream
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
        onStreamChange(mediaStream)
      } catch (err) {
        setError((err as Error).message)
        onStreamChange(null)
      }
    }

    void initCamera()

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      onStreamChange(null)
    }
    // we explicitly re-run when facing mode toggles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode])

  const handleToggleCamera = () => {
    setFacingMode(facingMode === 'environment' ? 'user' : 'environment')
  }

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return
    const width = videoRef.current.videoWidth
    const height = videoRef.current.videoHeight
    if (!width || !height) return

    canvasRef.current.width = width
    canvasRef.current.height = height
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    ctx.drawImage(videoRef.current, 0, 0, width, height)
    const dataUrl = canvasRef.current.toDataURL('image/png')
    setCapturedImage(dataUrl)
  }

  return (
    <section className="card camera-card">
      <header className="card-header">
        <div className="card-title">Camera</div>
        <div className="card-actions">
          <button className="btn secondary" onClick={handleToggleCamera}>
            Switch Camera
          </button>
          <button className="btn primary" onClick={handleCapture} disabled={!stream}>
            Capture
          </button>
        </div>
      </header>
      <div className="card-body column gap-md">
        {error ? <p className="error">Camera error: {error}</p> : null}
        <video ref={videoRef} id="camera-preview" autoPlay playsInline muted className="camera-preview" />
        <canvas ref={canvasRef} className="hidden-canvas" />
        {capturedImage ? (
          <div className="captured">
            <h4>Last Capture</h4>
            <img src={capturedImage} alt="Captured frame" />
          </div>
        ) : null}
      </div>
    </section>
  )
}
