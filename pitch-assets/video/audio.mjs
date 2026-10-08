// Shared audio helpers for prepare-audio.mjs and render.mjs.
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export const FFMPEG = process.env.FFMPEG_BIN || ffmpegPath;
export const TARGET_LUFS = -14;
const TARGET_TP = -1.5;
const TARGET_LRA = 11;

function ffmpeg(args) {
  const result = spawnSync(FFMPEG, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw result.error;
  return result;
}

export function measureLoudness(path) {
  const result = ffmpeg(["-hide_banner", "-nostats", "-i", path, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"]);
  const values = [...`${result.stdout}\n${result.stderr}`.matchAll(/\bI:\s*(-?\d+(?:\.\d+)?)\s+LUFS/g)].map((match) => Number(match[1]));
  if (!values.length) throw new Error(`Unable to measure integrated loudness of ${path}`);
  return values.at(-1);
}

/**
 * Two-pass EBU R128 loudnorm with linear gain, so speech is not pumped.
 * @param {string} source any format ffmpeg reads
 * @param {string} output .m4a (AAC 256k, 48 kHz)
 * @param {{prefilter?: string, extraInputs?: string[]}} [options]
 *   prefilter: filtergraph ending in [pre] that builds the signal to normalize
 * @returns {{input: number, output: number}}
 */
export async function normalizeLoudness(source, output, { prefilter, extraInputs = [] } = {}) {
  const loudnorm = `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=${TARGET_LRA}`;
  const inputs = ["-i", source, ...extraInputs.flatMap((path) => ["-i", path])];
  const graph = (tail) => prefilter ? ["-filter_complex", `${prefilter};[pre]${tail}[out]`, "-map", "[out]"] : ["-map", "0:a:0", "-af", tail];

  const measure = ffmpeg(["-hide_banner", "-nostats", ...inputs, ...graph(`${loudnorm}:print_format=json`), "-f", "null", "-"]);
  const json = measure.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/s);
  if (measure.status !== 0 || !json) throw new Error(`Could not measure loudness:\n${measure.stderr}`);
  const m = JSON.parse(json[0]);
  if (!Number.isFinite(Number(m.input_i)) || Number(m.input_i) < -70) throw new Error(`Audio is silent or unreadable (measured ${m.input_i} LUFS).`);

  await mkdir(dirname(output), { recursive: true });
  const apply = ffmpeg([
    "-y", "-hide_banner", "-nostats", ...inputs,
    ...graph(`${loudnorm}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`),
    "-ar", "48000", "-c:a", "aac", "-b:a", "256k", output,
  ]);
  if (apply.status !== 0) throw new Error(`Normalization failed:\n${apply.stderr}`);
  return { input: Number(m.input_i), output: measureLoudness(output) };
}
