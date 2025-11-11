import { useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'

export const TelemetryPanel = () => {
  const telemetry = useAppStore((state) => state.telemetry)

  const sorted = useMemo(
    () => [...telemetry].sort((a, b) => b.timestamp - a.timestamp).slice(0, 12),
    [telemetry],
  )

  return (
    <section className="card">
      <header className="card-header">
        <div className="card-title">Telemetry</div>
        <p className="card-subtitle">Live readings from Pico and derived sensors.</p>
      </header>
      <div className="card-body column gap-md">
        {sorted.length === 0 ? (
          <p className="placeholder">Awaiting telemetry…</p>
        ) : (
          <ul className="telemetry-list">
            {sorted.map((datum) => (
              <li key={datum.id}>
                <span className="label">{datum.label}</span>
                <span className="value">
                  {datum.value}
                  {datum.unit ? ` ${datum.unit}` : ''}
                </span>
                <span className="time">{new Date(datum.timestamp).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
