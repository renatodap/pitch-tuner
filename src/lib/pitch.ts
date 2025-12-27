/**
 * Pitch detection using the pitchy library (McLeod Pitch Method).
 * Wraps pitchy and converts results to musical note information.
 */

import { PitchDetector } from 'pitchy';
import { frequencyToNote, NoteInfo } from './notes';

// Only accept pitches with clarity above this threshold
// 0.9 filters out most ambient noise while catching clear notes
const CLARITY_THRESHOLD = 0.9;

// Minimum frequency to consider (below E1 on bass guitar)
const MIN_PITCH_HZ = 30;

// Maximum frequency to consider (above highest guitar notes)
const MAX_PITCH_HZ = 2000;

export interface PitchResult {
  frequency: number;
  clarity: number;
  noteInfo: NoteInfo;
}

/**
 * Creates a pitch detector for the given sample rate.
 */
export function createPitchDetector(sampleRate: number): PitchDetector<Float32Array<ArrayBuffer>> {
  // Buffer size should match half the FFT size for optimal detection
  const bufferSize = 2048;
  return PitchDetector.forFloat32Array(bufferSize);
}

/**
 * Detects pitch from audio data.
 * Returns null if no clear pitch is detected.
 */
export function detectPitch(
  detector: PitchDetector<Float32Array<ArrayBuffer>>,
  audioData: Float32Array<ArrayBuffer>,
  sampleRate: number,
  referenceA4: number = 440
): PitchResult | null {
  const [frequency, clarity] = detector.findPitch(audioData, sampleRate);

  // Filter out unclear or out-of-range pitches
  if (
    clarity < CLARITY_THRESHOLD ||
    frequency < MIN_PITCH_HZ ||
    frequency > MAX_PITCH_HZ
  ) {
    return null;
  }

  const noteInfo = frequencyToNote(frequency, referenceA4);
  if (!noteInfo) {
    return null;
  }

  return {
    frequency,
    clarity,
    noteInfo,
  };
}
