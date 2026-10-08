// Deterministic soundtrack synthesized on the same timeline as the picture.
//
// Everything is a pure function of (duration, bpm, cuts, acts): no randomness
// except a seeded mulberry32, so the same timeline always produces the same
// samples and every cut lands on a beat the listener can hear.
import { writeFile } from "node:fs/promises";

export const SAMPLE_RATE = 48000;
export const BPM = 96;

function mulberry32(seed) {
  return function next() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

const midiToHz = (note) => 440 * Math.pow(2, (note - 69) / 12);

// One harmonic colour per act, minor and unresolved until the close.
// Act index matches the beat number in timeline.js (1..7).
const ACT_CHORDS = {
  1: [[57, 60, 64], [53, 57, 60]],          // Am  F    — the control that isn't
  2: [[53, 57, 60], [48, 52, 55]],          // F   C    — why now
  3: [[57, 60, 64], [55, 59, 62]],          // Am  G    — the ceremony
  4: [[48, 52, 55], [55, 59, 62]],          // C   G    — the proof
  5: [[50, 53, 57], [52, 56, 59]],          // Dm  E    — failure path (tension)
  6: [[53, 57, 60], [48, 52, 55]],          // F   C    — the audit
  7: [[53, 57, 60], [48, 52, 55, 60]],      // F   C    — honest close (resolves)
};

function actAt(time, acts) {
  let current = acts[0];
  for (const act of acts) if (time >= act.start) current = act;
  return current;
}

/**
 * @param {object} options
 * @param {number} options.duration seconds
 * @param {number[]} options.cuts scene start times (s)
 * @param {{beat:number,start:number}[]} options.acts first scene of each beat
 * @returns {{bed: {left: Float32Array, right: Float32Array}, sfx: {left: Float32Array, right: Float32Array}}}
 *   bed: pad, bass, drums — ducks under narration.
 *   sfx: cut ticks, risers, act impacts — never ducked, so every cut stays audible.
 */
export function synthesizeScore({ duration, cuts, acts, bpm = BPM }) {
  const length = Math.ceil(duration * SAMPLE_RATE);
  let left = new Float32Array(length);
  let right = new Float32Array(length);
  const beat = 60 / bpm;
  const bar = beat * 4;
  const rand = mulberry32(0x5eed);

  // Pad: detuned additive voices; chord changes every two bars within an act.
  const fadeOut = Math.max(0, duration - 3.5);
  for (let i = 0; i < length; i += 1) {
    const t = i / SAMPLE_RATE;
    const act = actAt(t, acts);
    const chords = ACT_CHORDS[act.beat] ?? ACT_CHORDS[1];
    const sinceAct = t - act.start;
    const chord = chords[Math.floor(sinceAct / (bar * 2)) % chords.length];
    // 0.6 s swell after every act change so harmony moves with the picture.
    const swell = Math.min(1, sinceAct / 0.6);
    const master = (t < 1.2 ? t / 1.2 : 1) * (t > fadeOut ? Math.max(0, (duration - t) / 3.5) : 1);
    let l = 0;
    let r = 0;
    for (let n = 0; n < chord.length; n += 1) {
      const f = midiToHz(chord[n]);
      const phase = 2 * Math.PI * t;
      const v = Math.sin(phase * f) + 0.35 * Math.sin(phase * f * 2) + 0.12 * Math.sin(phase * f * 3);
      l += v * 0.9 + Math.sin(phase * f * 1.003) * 0.25;
      r += v * 0.9 + Math.sin(phase * f * 0.997) * 0.25;
    }
    // Slow breathing on the pad so long holds do not feel static.
    const breath = 0.85 + 0.15 * Math.sin(2 * Math.PI * t / (bar * 2));
    const pad = 0.045 * master * swell * breath;
    left[i] += l * pad;
    right[i] += r * pad;

    // Bass: root an octave down, pulsing every beat with a soft decay.
    const root = midiToHz(chord[0] - 24);
    const beatPhase = (t % beat) / beat;
    const bassEnv = Math.exp(-beatPhase * 4.5) * 0.6 + 0.25;
    const bass = Math.sin(2 * Math.PI * root * t) * 0.11 * bassEnv * master * swell;
    left[i] += bass;
    right[i] += bass;
  }

  const addAt = (start, render) => {
    const from = Math.max(0, Math.floor(start * SAMPLE_RATE));
    render(from);
  };

  // Rhythm enters with act 2 so the hook is carried by type, not drums.
  const rhythmStart = acts.find((a) => a.beat === 2)?.start ?? duration;
  const lastBeat = Math.max(0, duration - 3.5);
  for (let b = 0; b * beat < lastBeat; b += 1) {
    const t = b * beat;
    if (t < rhythmStart) continue;
    const act = actAt(t, acts).beat;
    // Kick on beats 1 and 3: pitch sweep 110 → 42 Hz.
    if (b % 2 === 0) {
      addAt(t, (from) => {
        const n = Math.floor(0.32 * SAMPLE_RATE);
        let phase = 0;
        for (let k = 0; k < n && from + k < length; k += 1) {
          const s = k / SAMPLE_RATE;
          const f = 42 + 68 * Math.exp(-s * 28);
          phase += 2 * Math.PI * f / SAMPLE_RATE;
          const v = Math.sin(phase) * Math.exp(-s * 9) * (b % 4 === 0 ? 0.32 : 0.22);
          left[from + k] += v;
          right[from + k] += v;
        }
      });
    }
    // Off-beat hats from act 3 on: seeded noise, crude high-pass.
    if (act >= 3) {
      addAt(t + beat / 2, (from) => {
        const n = Math.floor(0.05 * SAMPLE_RATE);
        let prev = 0;
        for (let k = 0; k < n && from + k < length; k += 1) {
          const white = rand() * 2 - 1;
          const hp = white - prev;
          prev = white;
          const v = hp * Math.exp(-(k / SAMPLE_RATE) * 70) * 0.035;
          left[from + k] += v * 0.8;
          right[from + k] += v;
        }
      });
    }
  }

  const bed = { left, right };
  left = new Float32Array(length);
  right = new Float32Array(length);

  // Cut tick: a short pitched blip on every scene start — the audible sync mark.
  const actStarts = new Set(acts.map((a) => a.start.toFixed(3)));
  for (const cut of cuts) {
    if (cut <= 0 || actStarts.has(cut.toFixed(3))) continue;
    addAt(cut, (from) => {
      const n = Math.floor(0.09 * SAMPLE_RATE);
      for (let k = 0; k < n && from + k < length; k += 1) {
        const s = k / SAMPLE_RATE;
        const v = Math.sin(2 * Math.PI * 1760 * s) * Math.exp(-s * 55) * 0.13
          + Math.sin(2 * Math.PI * 880 * s) * Math.exp(-s * 40) * 0.07;
        left[from + k] += v;
        right[from + k] += v;
      }
    });
  }

  // Act boundary: noise riser that chokes 60 ms before the downbeat (the
  // "suck-in" gap), then a low impact with a bright attack on the cut itself.
  for (const act of acts) {
    if (act.start <= 0) continue;
    const riser = 0.9;
    const gap = 0.06;
    addAt(act.start - riser, (from) => {
      const n = Math.floor((riser - gap) * SAMPLE_RATE);
      let lp = 0;
      for (let k = 0; k < n && from + k < length; k += 1) {
        const x = k / n;
        const white = rand() * 2 - 1;
        lp += (white - lp) * (0.02 + 0.5 * x * x);
        // 8 ms release so the choke itself does not click.
        const release = Math.min(1, (n - k) / (0.008 * SAMPLE_RATE));
        const v = lp * x * x * 0.22 * release;
        left[from + k] += v;
        right[from + k] += v * 0.9;
      }
    });
    addAt(act.start, (from) => {
      const n = Math.floor(1.6 * SAMPLE_RATE);
      let phase = 0;
      for (let k = 0; k < n && from + k < length; k += 1) {
        const s = k / SAMPLE_RATE;
        const f = 38 + 50 * Math.exp(-s * 10);
        phase += 2 * Math.PI * f / SAMPLE_RATE;
        const v = Math.sin(phase) * Math.exp(-s * 2.4) * 0.45
          + Math.sin(2 * Math.PI * 1320 * s) * Math.exp(-s * 30) * 0.12
          + Math.sin(2 * Math.PI * 1760 * s) * Math.exp(-s * 45) * 0.12
          + Math.sin(2 * Math.PI * 2640 * s) * Math.exp(-s * 60) * 0.08;
        left[from + k] += v;
        right[from + k] += v;
      }
    });
  }

  // Soft clip each stem so stacked hits never distort.
  const sfx = { left, right };
  for (const stem of [bed, sfx]) {
    for (let i = 0; i < length; i += 1) {
      stem.left[i] = Math.tanh(stem.left[i] * 1.4) / 1.4;
      stem.right[i] = Math.tanh(stem.right[i] * 1.4) / 1.4;
    }
  }
  return { bed, sfx };
}

export async function writeWav(path, { left, right }) {
  const frames = left.length;
  const data = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i += 1) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), i * 4);
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  await writeFile(path, Buffer.concat([header, data]));
}
