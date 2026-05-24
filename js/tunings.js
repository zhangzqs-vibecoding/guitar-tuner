// 吉他调弦模式配置
// 每个模式包含 6 根弦（从 6 弦到 1 弦），每根弦包含音符名和标准频率（Hz）

const TUNINGS = {
  standard: {
    name: 'Standard (标准)',
    strings: [
      { note: 'E2', freq: 82.41, name: '6弦 (E)' },
      { note: 'A2', freq: 110.00, name: '5弦 (A)' },
      { note: 'D3', freq: 146.83, name: '4弦 (D)' },
      { note: 'G3', freq: 196.00, name: '3弦 (G)' },
      { note: 'B3', freq: 246.94, name: '2弦 (B)' },
      { note: 'E4', freq: 329.63, name: '1弦 (E)' },
    ]
  },
  dropD: {
    name: 'Drop D',
    strings: [
      { note: 'D2', freq: 73.42, name: '6弦 (D)' },
      { note: 'A2', freq: 110.00, name: '5弦 (A)' },
      { note: 'D3', freq: 146.83, name: '4弦 (D)' },
      { note: 'G3', freq: 196.00, name: '3弦 (G)' },
      { note: 'B3', freq: 246.94, name: '2弦 (B)' },
      { note: 'E4', freq: 329.63, name: '1弦 (E)' },
    ]
  },
  openG: {
    name: 'Open G',
    strings: [
      { note: 'D2', freq: 73.42, name: '6弦 (D)' },
      { note: 'G2', freq: 98.00, name: '5弦 (G)' },
      { note: 'D3', freq: 146.83, name: '4弦 (D)' },
      { note: 'G3', freq: 196.00, name: '3弦 (G)' },
      { note: 'B3', freq: 246.94, name: '2弦 (B)' },
      { note: 'D4', freq: 293.66, name: '1弦 (D)' },
    ]
  },
  openD: {
    name: 'Open D',
    strings: [
      { note: 'D2', freq: 73.42, name: '6弦 (D)' },
      { note: 'A2', freq: 110.00, name: '5弦 (A)' },
      { note: 'D3', freq: 146.83, name: '4弦 (D)' },
      { note: 'F#3', freq: 185.00, name: '3弦 (F#)' },
      { note: 'A3', freq: 220.00, name: '2弦 (A)' },
      { note: 'D4', freq: 293.66, name: '1弦 (D)' },
    ]
  },
  dadgad: {
    name: 'DADGAD',
    strings: [
      { note: 'D2', freq: 73.42, name: '6弦 (D)' },
      { note: 'A2', freq: 110.00, name: '5弦 (A)' },
      { note: 'D3', freq: 146.83, name: '4弦 (D)' },
      { note: 'G3', freq: 196.00, name: '3弦 (G)' },
      { note: 'A3', freq: 220.00, name: '2弦 (A)' },
      { note: 'D4', freq: 293.66, name: '1弦 (D)' },
    ]
  },
  halfStepDown: {
    name: 'Half Step Down (降半音)',
    strings: [
      { note: 'Eb2', freq: 77.78, name: '6弦 (Eb)' },
      { note: 'Ab2', freq: 103.83, name: '5弦 (Ab)' },
      { note: 'Db3', freq: 138.59, name: '4弦 (Db)' },
      { note: 'Gb3', freq: 185.00, name: '3弦 (Gb)' },
      { note: 'Bb3', freq: 233.08, name: '2弦 (Bb)' },
      { note: 'Eb4', freq: 311.13, name: '1弦 (Eb)' },
    ]
  },
  wholeStepDown: {
    name: 'Whole Step Down (降全音)',
    strings: [
      { note: 'D2', freq: 73.42, name: '6弦 (D)' },
      { note: 'G2', freq: 98.00, name: '5弦 (G)' },
      { note: 'C3', freq: 130.81, name: '4弦 (C)' },
      { note: 'F3', freq: 174.61, name: '3弦 (F)' },
      { note: 'A3', freq: 220.00, name: '2弦 (A)' },
      { note: 'D4', freq: 293.66, name: '1弦 (D)' },
    ]
  },
  dropC: {
    name: 'Drop C',
    strings: [
      { note: 'C2', freq: 65.41, name: '6弦 (C)' },
      { note: 'G2', freq: 98.00, name: '5弦 (G)' },
      { note: 'C3', freq: 130.81, name: '4弦 (C)' },
      { note: 'F3', freq: 174.61, name: '3弦 (F)' },
      { note: 'A3', freq: 220.00, name: '2弦 (A)' },
      { note: 'D4', freq: 293.66, name: '1弦 (D)' },
    ]
  },
};

// 所有音符的频率表（用于将检测到的频率匹配到最近音符）
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getNoteFromFrequency(freq) {
  if (freq <= 0) return null;
  const A4 = 440;
  const A4_INDEX = 69; // MIDI note number for A4
  const semitonesFromA4 = 12 * Math.log2(freq / A4);
  const midiNote = Math.round(semitonesFromA4 + A4_INDEX);
  const noteName = NOTE_NAMES[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteFreq = A4 * Math.pow(2, (midiNote - A4_INDEX) / 12);
  return {
    name: `${noteName}${octave}`,
    frequency: noteFreq,
    midi: midiNote,
  };
}

// 计算两个频率之间的偏差（音分）
function getCentsDifference(detectedFreq, targetFreq) {
  if (detectedFreq <= 0 || targetFreq <= 0) return 0;
  return 1200 * Math.log2(detectedFreq / targetFreq);
}
