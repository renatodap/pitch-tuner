/**
 * Web Audio API setup for microphone access.
 * Handles stream acquisition and AnalyserNode configuration.
 */

export type AudioError =
  | 'permission-denied'
  | 'not-found'
  | 'not-supported'
  | 'unknown';

export interface AudioSetupResult {
  audioContext: AudioContext;
  analyser: AnalyserNode;
  stream: MediaStream;
}

// fftSize of 4096 needed for low frequency detection (low E ~82Hz)
// Larger buffer = more cycles of low frequency waves = better detection
// At 48kHz sample rate, this gives ~85ms of audio data
const FFT_SIZE = 4096;

/**
 * Checks if the browser supports the required audio APIs.
 */
export function isAudioSupported(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) &&
    navigator.mediaDevices?.getUserMedia
  );
}

/**
 * Maps MediaStream errors to user-friendly error types.
 */
function mapMediaError(error: unknown): AudioError {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'permission-denied';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'not-found';
      case 'NotSupportedError':
        return 'not-supported';
    }
  }
  return 'unknown';
}

/**
 * Requests microphone access and sets up the audio processing chain.
 * Returns AudioContext, AnalyserNode, and MediaStream for cleanup.
 */
export async function setupAudio(): Promise<AudioSetupResult> {
  if (!isAudioSupported()) {
    throw { type: 'not-supported' } as { type: AudioError };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const AudioContextClass = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    return { audioContext, analyser, stream };
  } catch (error) {
    throw { type: mapMediaError(error) } as { type: AudioError };
  }
}

/**
 * Cleans up audio resources.
 */
export function cleanupAudio(result: AudioSetupResult | null): void {
  if (!result) return;

  try {
    result.stream.getTracks().forEach(track => track.stop());
    result.audioContext.close();
  } catch (error) {
    console.error('Error cleaning up audio:', error);
  }
}
