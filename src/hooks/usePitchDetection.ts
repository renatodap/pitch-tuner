'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { PitchDetector } from 'pitchy';
import { setupAudio, cleanupAudio, isAudioSupported, AudioSetupResult, AudioError } from '@/lib/audio';
import { createPitchDetector, detectPitch, PitchResult } from '@/lib/pitch';

export type TunerState = 'idle' | 'listening' | 'active' | 'error';

export interface TunerData {
  state: TunerState;
  error: AudioError | null;
  pitch: PitchResult | null;
  referenceA4: number;
  isSupported: boolean;
}

export interface TunerActions {
  start: () => Promise<void>;
  stop: () => void;
  setReferenceA4: (hz: number) => void;
}

const DEFAULT_REFERENCE_A4 = 440;
const MIN_REFERENCE_A4 = 432;
const MAX_REFERENCE_A4 = 446;

// Number of frames to hold the last pitch when no new pitch detected
const PITCH_HOLD_FRAMES = 10;

export function usePitchDetection(): [TunerData, TunerActions] {
  const [state, setState] = useState<TunerState>('idle');
  const [error, setError] = useState<AudioError | null>(null);
  const [pitch, setPitch] = useState<PitchResult | null>(null);
  const [referenceA4, setReferenceA4State] = useState(DEFAULT_REFERENCE_A4);

  const audioRef = useRef<AudioSetupResult | null>(null);
  const detectorRef = useRef<PitchDetector<Float32Array<ArrayBuffer>> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioDataRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const referenceA4Ref = useRef(DEFAULT_REFERENCE_A4);
  const isRunningRef = useRef(false);
  const lastPitchRef = useRef<PitchResult | null>(null);
  const holdCounterRef = useRef(0);

  // Keep ref in sync with state
  useEffect(() => {
    referenceA4Ref.current = referenceA4;
  }, [referenceA4]);

  const isSupported = typeof window !== 'undefined' && isAudioSupported();

  const stopInternal = useCallback(() => {
    isRunningRef.current = false;

    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    cleanupAudio(audioRef.current);
    audioRef.current = null;
    detectorRef.current = null;
    audioDataRef.current = null;
    lastPitchRef.current = null;
    holdCounterRef.current = 0;
  }, []);

  const stop = useCallback(() => {
    stopInternal();
    setPitch(null);
    setState('idle');
    setError(null);
  }, [stopInternal]);

  const updatePitch = useCallback(() => {
    if (!isRunningRef.current) return;

    const audio = audioRef.current;
    const detector = detectorRef.current;
    const audioData = audioDataRef.current;

    if (!audio || !detector || !audioData) {
      animationFrameRef.current = requestAnimationFrame(updatePitch);
      return;
    }

    try {
      // Ensure AudioContext is running
      if (audio.audioContext.state === 'suspended') {
        audio.audioContext.resume();
      }

      audio.analyser.getFloatTimeDomainData(audioData);
      const result = detectPitch(detector, audioData, audio.audioContext.sampleRate, referenceA4Ref.current);

      if (result) {
        // New pitch detected
        lastPitchRef.current = result;
        holdCounterRef.current = PITCH_HOLD_FRAMES;
        setPitch(result);
        setState('active');
      } else if (holdCounterRef.current > 0) {
        // No pitch but still holding
        holdCounterRef.current--;
        // Keep showing the last pitch
        setPitch(lastPitchRef.current);
        setState('active');
      } else {
        // No pitch and hold expired
        lastPitchRef.current = null;
        setPitch(null);
        setState('listening');
      }
    } catch (err) {
      console.error('Pitch detection error:', err);
    }

    animationFrameRef.current = requestAnimationFrame(updatePitch);
  }, []);

  const start = useCallback(async () => {
    // If already running, stop first
    if (isRunningRef.current) {
      stopInternal();
    }

    setError(null);
    setState('listening');
    isRunningRef.current = true;

    try {
      const audio = await setupAudio();

      // Resume AudioContext if suspended (required after user gesture)
      if (audio.audioContext.state === 'suspended') {
        await audio.audioContext.resume();
      }

      audioRef.current = audio;

      // Create detector and audio buffer
      detectorRef.current = createPitchDetector(audio.audioContext.sampleRate);
      audioDataRef.current = new Float32Array(audio.analyser.fftSize);

      // Start the detection loop
      animationFrameRef.current = requestAnimationFrame(updatePitch);
    } catch (err) {
      isRunningRef.current = false;
      const audioError = (err as { type: AudioError }).type || 'unknown';
      setError(audioError);
      setState('error');
      stopInternal();
    }
  }, [stopInternal, updatePitch]);

  const setReferenceA4 = useCallback((hz: number) => {
    const clamped = Math.max(MIN_REFERENCE_A4, Math.min(MAX_REFERENCE_A4, hz));
    setReferenceA4State(clamped);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      cleanupAudio(audioRef.current);
    };
  }, []);

  return [
    { state, error, pitch, referenceA4, isSupported },
    { start, stop, setReferenceA4 },
  ];
}
