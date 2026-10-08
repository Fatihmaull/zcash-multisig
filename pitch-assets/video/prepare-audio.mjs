#!/usr/bin/env node
// Normalizes a human narration recording (any format ffmpeg reads) to −14 LUFS
// and writes it where render.mjs expects it.
//
//   node pitch-assets/video/prepare-audio.mjs ~/Desktop/my-take.m4a
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TARGET_LUFS, normalizeLoudness } from "./audio.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [input, outputArg] = process.argv.slice(2);
if (!input) {
  console.error("Usage: node pitch-assets/video/prepare-audio.mjs <recording> [output]");
  process.exit(1);
}
const source = resolve(input);
const output = resolve(outputArg ?? resolve(REPO, "assets/audio-cut/pitch-final.m4a"));
if (!existsSync(source)) {
  console.error(`Recording not found: ${source}`);
  process.exit(1);
}
if (source === output) {
  console.error("Input and output are the same file; pass the raw take, not pitch-final.m4a.");
  process.exit(1);
}

try {
  const { input: before, output: after } = await normalizeLoudness(source, output);
  console.log(`Input   ${before.toFixed(1)} LUFS`);
  console.log(`Output  ${after.toFixed(1)} LUFS  →  ${output}`);
  if (Math.abs(after - TARGET_LUFS) > 0.5) {
    console.error("Output is outside -14 ±0.5 LUFS. The take is likely too quiet or too peaky for a linear gain; re-record closer to the microphone.");
    process.exit(1);
  }
  console.log("Ready. Next: node pitch-assets/video/render.mjs");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
