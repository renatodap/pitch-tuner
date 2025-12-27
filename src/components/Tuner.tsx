'use client';

import { usePitchDetection } from '@/hooks/usePitchDetection';

const CENTS_THRESHOLD_IN_TUNE = 5;
const CENTS_THRESHOLD_CLOSE = 10;
const CENTS_LOCKED_THRESHOLD = 2;

function getErrorMessage(error: string): string {
  switch (error) {
    case 'permission-denied':
      return 'Microphone access denied';
    case 'not-found':
      return 'No microphone detected';
    case 'not-supported':
      return 'Browser not supported';
    default:
      return 'Unable to access microphone';
  }
}

function getCentsColor(cents: number): string {
  const absCents = Math.abs(cents);
  if (absCents <= CENTS_THRESHOLD_IN_TUNE) return 'var(--color-in-tune)';
  if (absCents <= CENTS_THRESHOLD_CLOSE) return 'var(--color-close)';
  return 'var(--color-off)';
}

export default function Tuner() {
  const [data, actions] = usePitchDetection();
  const { state, error, pitch, referenceA4, isSupported } = data;
  const { start, setReferenceA4 } = actions;

  const isLocked = pitch && Math.abs(pitch.noteInfo.cents) <= CENTS_LOCKED_THRESHOLD;

  if (!isSupported) {
    return (
      <div className="tuner-container">
        <div className="error-state">
          <p className="error-message">Please use Chrome, Firefox, or Safari</p>
        </div>
      </div>
    );
  }

  if (state === 'idle') {
    return (
      <div className="tuner-container">
        <button onClick={start} className="start-button">
          <span className="start-text">Tap to tune</span>
          <span className="start-subtext">Allow microphone access</span>
        </button>
      </div>
    );
  }

  if (state === 'error' && error) {
    return (
      <div className="tuner-container">
        <div className="error-state">
          <p className="error-message">{getErrorMessage(error)}</p>
          <button onClick={start} className="retry-button">
            Try again
          </button>
        </div>
      </div>
    );
  }

  const noteDisplay = pitch?.noteInfo.note ?? '—';
  const octaveDisplay = pitch?.noteInfo.octave ?? '';
  const frequencyDisplay = pitch ? Math.round(pitch.frequency) : '—';
  const centsDisplay = pitch?.noteInfo.cents ?? 0;
  const centsPosition = pitch ? Math.max(-50, Math.min(50, centsDisplay)) : 0;

  return (
    <div className="tuner-container">
      <div className={`tuner-display ${isLocked ? 'locked' : ''}`}>
        {/* Note Display */}
        <div className="note-section">
          <div
            className="note-letter"
            style={{ color: pitch ? getCentsColor(centsDisplay) : 'var(--color-muted)' }}
          >
            {noteDisplay}
            {octaveDisplay !== '' && (
              <span className="octave">{octaveDisplay}</span>
            )}
          </div>
          <div className="frequency">
            {frequencyDisplay} <span className="frequency-unit">Hz</span>
          </div>
        </div>

        {/* Cents Meter */}
        <div
          className="cents-meter"
          style={{ opacity: pitch ? 1 : 0 }}
        >
          <div className="meter-track">
            <div className="meter-center" />
            <div
              className="meter-indicator"
              style={{
                transform: `translateX(${centsPosition * 2}%)`,
                backgroundColor: getCentsColor(centsDisplay),
              }}
            />
            <div className="meter-labels">
              <span>♭</span>
              <span>♯</span>
            </div>
          </div>
          <div
            className="cents-value"
            style={{ color: getCentsColor(centsDisplay) }}
          >
            {centsDisplay > 0 ? '+' : ''}{centsDisplay} <span className="cents-unit">cents</span>
          </div>
        </div>

        {/* Reference Pitch Control */}
        <div className="reference-control">
          <button
            className="ref-button"
            onClick={() => setReferenceA4(referenceA4 - 1)}
            aria-label="Lower reference pitch"
          >
            −
          </button>
          <span className="ref-display">
            A = {referenceA4}
          </span>
          <button
            className="ref-button"
            onClick={() => setReferenceA4(referenceA4 + 1)}
            aria-label="Raise reference pitch"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
