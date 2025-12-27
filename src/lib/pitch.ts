/**
 * Pitch detection using ACF2+ algorithm (Chris Wilson's approach)
 * This is the proven algorithm used in real guitar tuners.
 * Source: https://github.com/cwilso/PitchDetect
 */

import { frequencyToNote, NoteInfo } from './notes';

// Minimum RMS threshold - below this, there's not enough signal
const RMS_THRESHOLD = 0.01;

// Minimum frequency to consider (below E1 on bass guitar ~41Hz)
const MIN_PITCH_HZ = 40;

// Maximum frequency to consider (above highest guitar notes)
const MAX_PITCH_HZ = 1200;

export interface PitchResult {
  frequency: number;
  noteInfo: NoteInfo;
}

/**
 * ACF2+ autocorrelation algorithm for pitch detection.
 * This is the industry-standard approach for guitar tuners.
 *
 * Key steps:
 * 1. Check RMS - if too quiet, return -1
 * 2. Trim silent edges of buffer
 * 3. Compute autocorrelation
 * 4. Find first peak after initial decline
 * 5. Use parabolic interpolation for precision
 */
function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;
  let rms = 0;

  // Calculate RMS (root mean square) to check signal level
  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);

  // Not enough signal
  if (rms < RMS_THRESHOLD) {
    return -1;
  }

  // Trim the buffer to remove silent edges
  // This helps focus on the actual signal
  let r1 = 0;
  let r2 = SIZE - 1;
  const threshold = 0.2;

  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) {
      r1 = i;
      break;
    }
  }

  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) {
      r2 = SIZE - i;
      break;
    }
  }

  const trimmedBuffer = buffer.slice(r1, r2);
  const trimmedSize = trimmedBuffer.length;

  // Not enough data after trimming
  if (trimmedSize < 2) {
    return -1;
  }

  // Compute autocorrelation
  const correlation = new Array(trimmedSize).fill(0);
  for (let i = 0; i < trimmedSize; i++) {
    for (let j = 0; j < trimmedSize - i; j++) {
      correlation[i] += trimmedBuffer[j] * trimmedBuffer[j + i];
    }
  }

  // Find first dip (where correlation starts decreasing)
  let d = 0;
  while (d < trimmedSize - 1 && correlation[d] > correlation[d + 1]) {
    d++;
  }

  // Find the peak after the dip
  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < trimmedSize; i++) {
    if (correlation[i] > maxVal) {
      maxVal = correlation[i];
      maxPos = i;
    }
  }

  if (maxPos < 1 || maxPos >= trimmedSize - 1) {
    return -1;
  }

  // Parabolic interpolation for sub-sample precision
  const x1 = correlation[maxPos - 1];
  const x2 = correlation[maxPos];
  const x3 = correlation[maxPos + 1];

  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;

  let T0 = maxPos;
  if (a !== 0) {
    T0 = maxPos - b / (2 * a);
  }

  if (T0 <= 0) {
    return -1;
  }

  return sampleRate / T0;
}

/**
 * Detects pitch from audio data using ACF2+ algorithm.
 * Returns null if no clear pitch is detected.
 */
export function detectPitch(
  audioData: Float32Array<ArrayBuffer>,
  sampleRate: number,
  referenceA4: number = 440
): PitchResult | null {
  const frequency = autoCorrelate(audioData, sampleRate);

  // No pitch detected or out of range
  if (frequency < MIN_PITCH_HZ || frequency > MAX_PITCH_HZ) {
    return null;
  }

  const noteInfo = frequencyToNote(frequency, referenceA4);
  if (!noteInfo) {
    return null;
  }

  return {
    frequency,
    noteInfo,
  };
}
