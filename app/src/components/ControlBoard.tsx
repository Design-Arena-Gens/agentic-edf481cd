import { useState } from 'react'
import { useSerial } from '../context/SerialContext'
import { useAppStore } from '../store/useAppStore'

export const ControlBoard = () => {
  const { status, sendCommand } = useSerial()
  const upsertTelemetry = useAppStore((state) => state.upsertTelemetry)

  const [servoChannel, setServoChannel] = useState(0)
  const [servoAngle, setServoAngle] = useState(90)
  const [motorChannel, setMotorChannel] = useState(0)
  const [motorSpeed, setMotorSpeed] = useState(50)
  const [gpioPin, setGpioPin] = useState(0)
  const [gpioState, setGpioState] = useState(false)

  const disabled = status !== 'connected'

  const dispatchCommand = async (command: string) => {
    try {
      await sendCommand(command)
    } catch (err) {
      console.error(err)
    }
  }

  const handleServoMove = async () => {
    const command = `SERVO ${servoChannel} ${servoAngle}`
    await dispatchCommand(command)
    upsertTelemetry({
      id: `servo-${servoChannel}`,
      label: `Servo ${servoChannel}`,
      value: `${servoAngle}`,
      unit: '°',
      timestamp: Date.now(),
    })
  }

  const handleMotorRun = async (direction: 'FWD' | 'REV') => {
    const command = `MOTOR ${motorChannel} ${direction} ${motorSpeed}`
    await dispatchCommand(command)
    upsertTelemetry({
      id: `motor-${motorChannel}`,
      label: `Motor ${motorChannel}`,
      value: `${direction === 'FWD' ? motorSpeed : -motorSpeed}`,
      unit: '%',
      timestamp: Date.now(),
    })
  }

  const handleMotorBrake = async () => {
    const command = `MOTOR ${motorChannel} STOP`
    await dispatchCommand(command)
    upsertTelemetry({
      id: `motor-${motorChannel}`,
      label: `Motor ${motorChannel}`,
      value: '0',
      unit: '%',
      timestamp: Date.now(),
    })
  }

  const handleGpioToggle = async (next: boolean) => {
    const command = `GPIO ${gpioPin} ${next ? 'HIGH' : 'LOW'}`
    await dispatchCommand(command)
    setGpioState(next)
    upsertTelemetry({
      id: `gpio-${gpioPin}`,
      label: `GPIO ${gpioPin}`,
      value: next ? 'HIGH' : 'LOW',
      timestamp: Date.now(),
    })
  }

  const handleRunScript = async (script: string) => {
    const lines = script.split('\n').map((line) => line.trim()).filter(Boolean)
    for (const line of lines) {
      await dispatchCommand(line)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">Motion & GPIO Control</div>
        <p className="card-subtitle">Direct drive actuators, motors, and digital pins.</p>
      </header>
      <div className="card-body column gap-lg">
        <div className="control-group">
          <h4>Servos</h4>
          <div className="control-row">
            <label>
              Channel
              <input
                type="number"
                min={0}
                max={7}
                value={servoChannel}
                onChange={(event) => setServoChannel(Number.parseInt(event.target.value, 10))}
              />
            </label>
            <label>
              Angle ({servoAngle}°)
              <input
                type="range"
                min={0}
                max={180}
                value={servoAngle}
                onChange={(event) => setServoAngle(Number.parseInt(event.target.value, 10))}
              />
            </label>
            <button className="btn primary" onClick={() => void handleServoMove()} disabled={disabled}>
              Move Servo
            </button>
          </div>
        </div>

        <div className="control-group">
          <h4>Motors</h4>
          <div className="control-row">
            <label>
              Channel
              <input
                type="number"
                min={0}
                max={3}
                value={motorChannel}
                onChange={(event) => setMotorChannel(Number.parseInt(event.target.value, 10))}
              />
            </label>
            <label>
              Speed ({motorSpeed}%)
              <input
                type="range"
                min={0}
                max={100}
                value={motorSpeed}
                onChange={(event) => setMotorSpeed(Number.parseInt(event.target.value, 10))}
              />
            </label>
            <div className="button-row">
              <button className="btn primary" onClick={() => void handleMotorRun('FWD')} disabled={disabled}>
                Forward
              </button>
              <button className="btn secondary" onClick={() => void handleMotorRun('REV')} disabled={disabled}>
                Reverse
              </button>
              <button className="btn ghost" onClick={() => void handleMotorBrake()} disabled={disabled}>
                Stop
              </button>
            </div>
          </div>
        </div>

        <div className="control-group">
          <h4>GPIO</h4>
          <div className="control-row">
            <label>
              Pin
              <input
                type="number"
                min={0}
                max={28}
                value={gpioPin}
                onChange={(event) => setGpioPin(Number.parseInt(event.target.value, 10))}
              />
            </label>
            <div className="button-row">
              <button className="btn primary" onClick={() => void handleGpioToggle(true)} disabled={disabled}>
                Set HIGH
              </button>
              <button className="btn ghost" onClick={() => void handleGpioToggle(false)} disabled={disabled}>
                Set LOW
              </button>
              <div className={`indicator ${gpioState ? 'on' : 'off'}`} aria-label="GPIO state indicator" />
            </div>
          </div>
        </div>

        <div className="control-group">
          <h4>Quick Scripts</h4>
          <div className="script-row">
            <button
              className="btn primary"
              disabled={disabled}
              onClick={() =>
                void handleRunScript(`SERVO 0 45\nSERVO 1 135\nDELAY 200\nSERVO 0 90\nSERVO 1 90`)
              }
            >
              Wave
            </button>
            <button
              className="btn primary"
              disabled={disabled}
              onClick={() =>
                void handleRunScript(`MOTOR 0 FWD 60\nMOTOR 1 FWD 60\nDELAY 500\nMOTOR 0 STOP\nMOTOR 1 STOP`)
              }
            >
              Drive Forward
            </button>
            <button
              className="btn secondary"
              disabled={disabled}
              onClick={() =>
                void handleRunScript(`MOTOR 0 REV 40\nMOTOR 1 FWD 40\nDELAY 300\nMOTOR 0 STOP\nMOTOR 1 STOP`)
              }
            >
              Rotate Right
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
