#!/usr/bin/env node
// Builds the narration from narration.js (verbatim docs/07 script) with Kokoro-82M,
// a local neural TTS model — offline, no API key.
//
//   node pitch-assets/video/narrate.mjs [--voice af_heart] [--speed 1.0]
//
// Outputs:
//   assets/audio-cut/pitch-final.m4a   narration, −14 LUFS
//   pitch-assets/video/act-timing.json acts plus caption cues (start/end/text)
//   pitch-assets/video/quorum-pitch.en.srt  English subtitles, same timings
//
// The narration sets the clock: each act lasts as long as its script needs plus
// room to breathe, and timeline.js stretches that act's scenes to fit. A recorded
// human take replaces this — run prepare-audio.mjs on it instead.
import { writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { KokoroTTS } from "kokoro-js";
import { FFMPEG, TARGET_LUFS, normalizeLoudness } from "./audio.mjs";
import { chunkParagraph, toSrt } from "./captions.mjs";
import { NARRATION, PRONUNCIATION } from "./narration.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(ROOT, "../../assets/audio-cut/pitch-final.m4a");
const ACT_TIMING = join(ROOT, "act-timing.json");
const SRT = join(ROOT, "quorum-pitch.en.srt");
const WORK = join(ROOT, "narration-work");

const arg = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : fallback;
};
// af_heart is the only English voice graded A in Kokoro's VOICES.md.
const VOICE = arg("--voice", "af_heart");
const SPEED = Number(arg("--speed", "1"));

const LEAD_IN = 0.6;          // act cut lands, picture establishes, then the voice
const PARAGRAPH_GAP = 0.55;   // breath between paragraphs inside one act
const SENTENCE_GAP = 0.32;    // between cues that end a sentence
const CLAUSE_GAP = 0.14;      // between cues split mid-sentence at a dash/comma
const ACT_TAIL = 1.6;         // resolve hold after the last word before the next act
const MIN_ACT = 12;           // short acts still need room for their scenes
const OUTRO = 2.5;            // final hold after the last act

const speakable = (text) => PRONUNCIATION.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);

function check(result, what) {
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${what} failed:\n${result.stderr}`);
  return result;
}

// Kokoro pads clips with near-silence; measure it so cue times mark audible
// speech, not the padding. Threshold is −45 dBFS on 10 ms windows.
function trimSilence(samples, rate) {
  const win = Math.round(rate * 0.01);
  const threshold = Math.pow(10, -45 / 20);
  const loud = (start) => {
    let sum = 0;
    for (let i = start; i < start + win && i < samples.length; i += 1) sum += samples[i] * samples[i];
    return Math.sqrt(sum / win) > threshold;
  };
  let first = 0;
  while (first < samples.length && !loud(first)) first += win;
  let last = samples.length - win;
  while (last > first && !loud(last)) last -= win;
  return { lead: first / rate, tail: (samples.length - (last + win)) / rate, length: samples.length / rate };
}

await rm(WORK, { recursive: true, force: true });
await mkdir(WORK, { recursive: true });

console.log(`Loading Kokoro-82M (voice ${VOICE}, speed ${SPEED})…`);
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });

// Each caption cue is synthesized as its own clip, so a cue is on screen exactly
// while its words play. Pauses between cues follow the punctuation that ended
// the previous cue: a full stop rests longer than a clause break.
const cuePause = (text) => /[.!?]$/.test(text) ? SENTENCE_GAP : CLAUSE_GAP;

const clips = [];
const acts = [];
const cues = [];
let cursor = 0;
for (const { beat, paragraphs } of NARRATION) {
  const actStart = cursor;
  let at = actStart + LEAD_IN;
  for (let p = 0; p < paragraphs.length; p += 1) {
    const chunks = chunkParagraph(paragraphs[p]);
    for (let c = 0; c < chunks.length; c += 1) {
      const audio = await tts.generate(speakable(chunks[c]), { voice: VOICE, speed: SPEED });
      const path = join(WORK, `beat${beat}-p${p}-c${c}.wav`);
      await audio.save(path);
      const { lead, tail, length } = trimSilence(audio.audio, audio.sampling_rate);
      // Place the clip so its first audible sample lands at `at`.
      clips.push({ path, at: at - lead });
      cues.push({ beat, start: Number(at.toFixed(3)), end: Number((at + length - lead - tail).toFixed(3)), text: chunks[c] });
      at += length - lead - tail;
      if (c < chunks.length - 1) at += cuePause(chunks[c]);
    }
    if (p < paragraphs.length - 1) at += PARAGRAPH_GAP;
  }
  const duration = Math.max(MIN_ACT, at - actStart + ACT_TAIL);
  acts.push({ beat, start: Number(actStart.toFixed(3)), duration: Number(duration.toFixed(3)), speechEnd: Number(at.toFixed(3)) });
  console.log(`Act ${beat}  starts ${actStart.toFixed(2)} s  speech ${(at - actStart - LEAD_IN).toFixed(2)} s  act ${duration.toFixed(2)} s`);
  cursor = actStart + duration;
}
const total = Number((cursor + OUTRO).toFixed(3));

// Place each paragraph at its time, pad to the exact film length.
const mix = join(WORK, "narration.wav");
const inputs = clips.flatMap((clip) => ["-i", clip.path]);
const delays = clips.map((clip, index) => `[${index}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${Math.round(clip.at * 1000)}[a${index}]`).join(";");
const graph = `${delays};${clips.map((_, index) => `[a${index}]`).join("")}amix=inputs=${clips.length}:normalize=0,apad,atrim=0:${total}[out]`;
check(spawnSync(FFMPEG, ["-y", "-v", "error", ...inputs, "-filter_complex", graph, "-map", "[out]", "-ac", "1", mix], { encoding: "utf8" }), "narration mix");

const { output } = await normalizeLoudness(mix, OUTPUT);
await writeFile(ACT_TIMING, `${JSON.stringify({ voice: VOICE, speed: SPEED, duration: total, acts, cues }, null, 2)}\n`);
await writeFile(SRT, toSrt(cues));
await rm(WORK, { recursive: true, force: true });
console.log(`Narration ${total.toFixed(2)} s, ${output.toFixed(1)} LUFS (target ${TARGET_LUFS})  →  ${OUTPUT}`);
console.log(`Act timing  →  ${ACT_TIMING}`);
console.log(`Subtitles   →  ${SRT}  (${cues.length} cues)`);
