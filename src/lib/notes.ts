/**
 * Pure functions for musical note calculations.
 * All frequencies based on A4 = 440Hz equal temperament.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export type NoteName = typeof NOTE_NAMES[number];

export interface NoteInfo {
  note: NoteName;
  octave: number;
  frequency: number;
  cents: number;
}

// A4 = 440Hz is MIDI note 69
const A4_MIDI = 69;
const SEMITONES_PER_OCTAVE = 12;
const CENTS_PER_SEMITONE = 100;

/**
 * Converts a frequency to the nearest note with cents deviation.
 * Returns null if frequency is outside reasonable range (20Hz - 5000Hz).
 */
export function frequencyToNote(frequency: number, referenceA4: number = 440): NoteInfo | null {
  const MIN_FREQUENCY = 20;
  const MAX_FREQUENCY = 5000;

  if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY || !isFinite(frequency)) {
    return null;
  }

  // Calculate how many semitones from A4
  const semitonesFromA4 = SEMITONES_PER_OCTAVE * Math.log2(frequency / referenceA4);
  const midiNote = Math.round(A4_MIDI + semitonesFromA4);

  // Calculate the exact frequency of the nearest note
  const nearestNoteFrequency = referenceA4 * Math.pow(2, (midiNote - A4_MIDI) / SEMITONES_PER_OCTAVE);

  // Calculate cents deviation from nearest note
  const cents = Math.round(CENTS_PER_SEMITONE * SEMITONES_PER_OCTAVE * Math.log2(frequency / nearestNoteFrequency));

  // Extract note name and octave from MIDI note number
  const noteIndex = ((midiNote % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
  const octave = Math.floor(midiNote / SEMITONES_PER_OCTAVE) - 1;

  return {
    note: NOTE_NAMES[noteIndex],
    octave,
    frequency: nearestNoteFrequency,
    cents,
  };
}

/**
 * Calculates the frequency of a note given its name and octave.
 */
export function noteToFrequency(note: NoteName, octave: number, referenceA4: number = 440): number {
  const noteIndex = NOTE_NAMES.indexOf(note);
  const midiNote = (octave + 1) * SEMITONES_PER_OCTAVE + noteIndex;
  return referenceA4 * Math.pow(2, (midiNote - A4_MIDI) / SEMITONES_PER_OCTAVE);
}
