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

export function usePitchDetection(): [TunerData, TunerActions] {
  const [state, setState] = useState<TunerState>('idle');
  const [error, setError] = useState<AudioError | null>(null);
  const [pitch, setPitch] = useState<PitchResult | null>(null);
  const [referenceA4, setReferenceA4State] = useState(DEFAULT_REFERENCE_A4);

  const audioRef = useRef<AudioSetupResult | null>(null);
  const detectorRef = useRef<PitchDetector<Float32Array<ArrayBuffer>> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioDataRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  const isSupported = typeof window !== 'undefined' && isAudioSupported();

  const stop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    cleanupAudio(audioRef.current);
    audioRef.current = null;
    detectorRef.current = null;
    audioDataRef.current = null;

    setPitch(null);
    setState('idle');
    setError(null);
  }, []);

  const updatePitch = useCallback(() => {
    const audio = audioRef.current;
    const detector = detectorRef.current;
    const audioData = audioDataRef.current;

    if (!audio || !detector || !audioData) {
      return;
    }

    try {
      audio.analyser.getFloatTimeDomainData(audioData);
      const result = detectPitch(detector, audioData, audio.audioContext.sampleRate, referenceA4);

      if (result) {
        setPitch(result);
        setState('active');
      } else {
        setPitch(null);
        setState('listening');
      }
    } catch (err) {
      console.error('Pitch detection error:', err);
      // Don't stop on detection errors, just skip this frame
    }

    animationFrameRef.current = requestAnimationFrame(updatePitch);
  }, [referenceA4]);

  const start = useCallback(async () => {
    if (audioRef.current) {
      return; // Already running
    }

    setError(null);
    setState('listening');

    try {
      const audio = await setupAudio();
      audioRef.current = audio;

      // Create detector and audio buffer
      detectorRef.current = createPitchDetector(audio.audioContext.sampleRate);
      audioDataRef.current = new Float32Array(audio.analyser.fftSize);

      // Start the detection loop
      animationFrameRef.current = requestAnimationFrame(updatePitch);
    } catch (err) {
      const audioError = (err as { type: AudioError }).type || 'unknown';
      setError(audioError);
      setState('error');
      cleanupAudio(audioRef.current);
      audioRef.current = null;
    }
  }, [updatePitch]);

  const setReferenceA4 = useCallback((hz: number) => {
    const clamped = Math.max(MIN_REFERENCE_A4, Math.min(MAX_REFERENCE_A4, hz));
    setReferenceA4State(clamped);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      cleanupAudio(audioRef.current);
    };
  }, []);

  // Restart detection loop when reference changes (to use new reference)
  useEffect(() => {
    if (audioRef.current && animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(updatePitch);
    }
  }, [updatePitch]);

  return [
    { state, error, pitch, referenceA4, isSupported },
    { start, stop, setReferenceA4 },
  ];
}
