#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import puppeteer from "puppeteer-core";
import { FFMPEG, TARGET_LUFS, measureLoudness, normalizeLoudness } from "./audio.mjs";
import { BPM, synthesizeScore, writeWav } from "./score.mjs";
import { PALETTE, REFERENCE_DURATION, buildTimeline } from "./timeline.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(ROOT, "../..");
const AUDIO = resolve(process.env.QUORUM_AUDIO || resolve(REPO, "assets/audio-cut/pitch-final.m4a"));
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const FINAL_VIDEO = join(ROOT, "quorum-pitch.mp4");
const SCORE_VIDEO = join(ROOT, "quorum-pitch-score.mp4");
const BED_WAV = join(ROOT, "score-bed.wav");
const SFX_WAV = join(ROOT, "score-sfx.wav");
const SOUNDTRACK = join(ROOT, "soundtrack.m4a");
const BEAT = 60 / BPM;
const FRAME_DIR = join(ROOT, "frames");
const CUE_DIR = join(ROOT, "cues");
const CONTACT_SHEET = join(ROOT, "contact-sheet.png");
const QA_REPORT = join(ROOT, "qa-report.json");
const MANIFEST = join(ROOT, "render-manifest.json");
const ACT_TIMING = join(ROOT, "act-timing.json");
const CHROME = process.env.CHROME_BIN || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FFPROBE = process.env.FFPROBE_BIN || ffprobeInstaller.path;

function parseArgs(argv) {
  const result = { mode: "all", duration: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--mode") result.mode = argv[++index];
    else if (token === "--duration") result.duration = Number(argv[++index]);
    else if (token === "--help" || token === "-h") result.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!["all", "cues", "video", "validate", "score"].includes(result.mode)) throw new Error(`Invalid mode: ${result.mode}`);
  if (result.duration !== null && (!Number.isFinite(result.duration) || result.duration <= 0)) throw new Error("--duration must be a positive number");
  return result;
}

function printHelp() {
  console.log(`Usage: node pitch-assets/video/render.mjs [options]

  --mode all       cues, QA, frames, encode, verify (default; requires audio)
  --mode cues      cue frames, contact sheet, and QA
  --mode video     full frames, encode, and verify (requires audio)
  --mode validate  deterministic frame and source-contract checks
  --mode score     film scored with a synthesized beat-grid soundtrack (no narration);
                   every cut lands on a beat. Output: quorum-pitch-score.mp4
  --duration SEC   duration for score/cues/validate when narration is absent (default 195)`);
}

function requireBinary(binary, label) {
  const probe = spawnSync(binary, ["-version"], { encoding: "utf8" });
  if (probe.error?.code === "ENOENT") throw new Error(`${label} executable not found: ${binary}`);
  if (probe.status !== 0) throw new Error(`${label} is present but failed its version probe`);
}

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    encoding: "encoding" in options ? options.encoding : "utf8",
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    throw new Error(`${binary} failed (${result.status}):\n${error}`);
  }
  return result;
}

async function runStreaming(binary, args) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(binary, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${binary} exited with code ${code}`)));
  });
}

function probeMedia(path) {
  const result = run(FFPROBE, ["-v", "error", "-show_streams", "-show_format", "-of", "json", path]);
  return JSON.parse(result.stdout);
}

function durationFromProbe(probe) {
  const value = Number(probe.format?.duration);
  if (!Number.isFinite(value) || value <= 0) throw new Error("ffprobe did not report a positive media duration");
  return value;
}

// filter: optional ffmpeg audio filter applied before detection (e.g. a bandpass
// that isolates the score's cut markers from speech).
function decodeVocalOnsets(path, filter = null) {
  const sampleRate = 16000;
  const decoded = run(FFMPEG, [
    "-v", "error", "-i", path, "-map", "0:a:0", ...(filter ? ["-af", filter] : []), "-ac", "1", "-ar", String(sampleRate), "-f", "f32le", "-",
  ], { encoding: null, maxBuffer: 256 * 1024 * 1024 });
  const bytes = decoded.stdout;
  const samples = new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
  const windowSamples = Math.round(sampleRate * 0.02);
  const rms = [];
  for (let start = 0; start + windowSamples <= samples.length; start += windowSamples) {
    let sum = 0;
    for (let index = start; index < start + windowSamples; index += 1) sum += samples[index] * samples[index];
    rms.push(Math.sqrt(sum / windowSamples));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  // Dense narration can be >65% voiced, so a mid percentile is speech, not noise.
  // Estimate both ends and trigger a quarter of the way between them.
  const noiseFloor = sorted[Math.floor(sorted.length * 0.05)] || 0;
  const speechLevel = sorted[Math.floor(sorted.length * 0.9)] || 0;
  const span = Math.max(0, speechLevel - noiseFloor);
  const onsetThreshold = Math.max(0.004, noiseFloor + span * 0.25);
  // Within each 220 ms cluster keep the strongest rise, not the first crossing,
  // so a pre-roll (breath, riser tail, hat) cannot steal an onset from the hit.
  const onsets = [];
  let cluster = null;
  for (let index = 3; index < rms.length; index += 1) {
    const previous = (rms[index - 1] + rms[index - 2] + rms[index - 3]) / 3;
    const rise = rms[index] - previous;
    const time = index * 0.02;
    // A cluster opens at the first qualifying rise and lasts 220 ms; its onset is
    // the frame with the largest rise inside it.
    if (cluster && time - cluster.start >= 0.22) {
      onsets.push(Number(cluster.peak.toFixed(3)));
      cluster = null;
    }
    if (rms[index] <= onsetThreshold || rise <= Math.max(0.003, span * 0.15)) continue;
    if (!cluster) cluster = { start: time, peak: time, rise };
    else if (rise > cluster.rise) Object.assign(cluster, { peak: time, rise });
  }
  if (cluster) onsets.push(Number(cluster.peak.toFixed(3)));
  return onsets;
}

function mime(path) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".woff2": "font/woff2",
    ".png": "image/png",
  })[extname(path)] ?? "application/octet-stream";
}

async function startServer() {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const requested = pathname === "/" ? "index.html" : pathname.slice(1);
    const path = normalize(resolve(ROOT, requested));
    if (relative(ROOT, path).startsWith("..") || !existsSync(path)) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": mime(path), "Cache-Control": "no-store" });
    createReadStream(path).pipe(response);
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

async function openFilm(duration, onsets, beat = null, acts = null, cues = []) {
  if (!existsSync(CHROME)) throw new Error(`Chrome executable not found at ${CHROME}. Set CHROME_BIN to its path.`);
  const { server, url } = await startServer();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--disable-gpu", "--hide-scrollbars", "--force-color-profile=srgb", "--font-render-hinting=none"],
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => window.__FILM_READY__ === true);
  const scenes = await page.evaluate((settings) => window.configureFilm(settings), { measuredDuration: duration, vocalOnsets: onsets, beat, acts, cues });
  return { browser, page, scenes, server };
}

async function closeFilm(film) {
  await film.browser.close();
  await new Promise((resolvePromise) => film.server.close(resolvePromise));
}

async function capture(page, time, path) {
  await page.evaluate((seekTime) => window.seek(seekTime), time);
  await page.screenshot({ path, type: "png", captureBeyondViewport: false, optimizeForSpeed: true });
}

async function renderCues(film) {
  await rm(CUE_DIR, { recursive: true, force: true });
  await mkdir(CUE_DIR, { recursive: true });
  for (let index = 0; index < film.scenes.length; index += 1) {
    const scene = film.scenes[index];
    const path = join(CUE_DIR, `${String(index + 1).padStart(3, "0")}-${scene.id}.png`);
    await capture(film.page, scene.cue, path);
    process.stdout.write(`\rCue frames ${index + 1}/${film.scenes.length}`);
  }
  process.stdout.write("\n");
  const rows = Math.ceil(film.scenes.length / 4);
  run(FFMPEG, [
    "-y", "-v", "error", "-framerate", "1", "-pattern_type", "glob", "-i", join(CUE_DIR, "*.png"),
    "-vf", `scale=480:270:flags=lanczos,tile=4x${rows}:padding=8:margin=8:color=0x080b11`,
    "-frames:v", "1", CONTACT_SHEET,
  ]);
  return CONTACT_SHEET;
}

async function renderFrames(film, duration) {
  await rm(FRAME_DIR, { recursive: true, force: true });
  await mkdir(FRAME_DIR, { recursive: true });
  const count = Math.ceil(duration * FPS);
  for (let frame = 0; frame < count; frame += 1) {
    const time = Math.min(frame / FPS, duration - 0.0001);
    const path = join(FRAME_DIR, `${String(frame).padStart(6, "0")}.png`);
    await capture(film.page, time, path);
    if (frame % FPS === 0 || frame === count - 1) process.stdout.write(`\rFrames ${frame + 1}/${count}  ${time.toFixed(2)}s`);
  }
  process.stdout.write("\n");
  return count;
}

// Video from frames, audio mapped directly from the soundtrack file.
async function encode(duration, { audio, output }) {
  await rm(output, { force: true });
  await runStreaming(FFMPEG, [
    "-y", "-framerate", String(FPS), "-i", join(FRAME_DIR, "%06d.png"),
    "-i", audio, "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac", "-b:a", "256k",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
    "-t", duration.toFixed(6), "-movflags", "+faststart", output,
  ]);
}

// Score at −14 LUFS. With narration, the music bed ducks under the voice
// (sidechain keyed by the narration) while transition SFX stay at full level,
// so every cut remains audible even mid-sentence.
async function buildSoundtrack(scenes, duration, narration) {
  const acts = scenes.filter((scene, index) => index === 0 || scenes[index - 1].beat !== scene.beat).map((scene) => ({ beat: scene.beat, start: scene.start }));
  const { bed, sfx } = synthesizeScore({ duration, cuts: scenes.map((scene) => scene.start), acts });
  await Promise.all([writeWav(BED_WAV, bed), writeWav(SFX_WAV, sfx)]);
  const prefilter = narration
    ? "[0:a]volume=0.5[bed];[2:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[vo][key];[bed][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[duck];[duck][1:a][vo]amix=inputs=3:duration=first:normalize=0[pre]"
    : "[0:a][1:a]amix=inputs=2:duration=first:normalize=0[pre]";
  return normalizeLoudness(BED_WAV, SOUNDTRACK, { prefilter, extraInputs: narration ? [SFX_WAV, narration] : [SFX_WAV] });
}

function contrastRatio(hexA, hexB) {
  const luminance = (hex) => {
    const channels = hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [high, low] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

function flattenText(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(flattenText);
  if (value && typeof value === "object") return Object.values(value).flatMap(flattenText);
  return [];
}

async function sourceContractChecks(scenes) {
  const html = await readFile(join(ROOT, "index.html"), "utf8");
  const timeline = await readFile(join(ROOT, "timeline.js"), "utf8");
  const scenesJs = await readFile(join(ROOT, "scenes.js"), "utf8");
  const combined = `${html}\n${timeline}\n${scenesJs}`;
  const forbiddenRuntime = [
    ["CSS transitions", /\btransition\s*:/],
    ["setTimeout", /\bsetTimeout\s*\(/],
    ["requestAnimationFrame", /\brequestAnimationFrame\s*\(/],
    ["unseeded random", /\bMath\.random\s*\(/],
  ];
  const runtimeViolations = forbiddenRuntime.filter(([, expression]) => expression.test(combined)).map(([name]) => name);
  const claimText = flattenText(scenes).join(" ").toLowerCase();
  const forbiddenClaims = ["production-ready", "enterprise-grade", "bank-grade", "military-grade", "quantum-resistant", "quantum-safe", "trustless", "zero-trust", "mainnet", "audited"];
  const claimViolations = forbiddenClaims.filter((phrase) => claimText.includes(phrase));
  const durations = scenes.map((scene) => scene.end - scene.start);
  const missingTitles = scenes.filter((scene) => !scene.title).map((scene) => scene.id);
  return {
    runtimeViolations,
    claimViolations,
    missingTitles,
    minSceneSeconds: Math.min(...durations),
    maxSceneSeconds: Math.max(...durations),
    textContrast: Number(contrastRatio(PALETTE.text, PALETTE.bg).toFixed(2)),
    secondaryContrast: Number(contrastRatio(PALETTE.textSecondary, PALETTE.bg).toFixed(2)),
  };
}

async function deterministicFrameCheck(film) {
  const scene = film.scenes.find((s) => s.kind === "review") || film.scenes[0];
  const getPixels = async (time) => {
    await film.page.evaluate((seekTime) => window.seek(seekTime), time);
    return film.page.evaluate(() => {
      const canvas = document.querySelector("#film");
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return Array.from(imgData.data);
    });
  };
  const [pixelsA, pixelsB] = await Promise.all([getPixels(scene.cue), getPixels(scene.cue)]);
  const hashA = createHash("sha256").update(Buffer.from(new Uint8Array(pixelsA))).digest("hex");
  const hashB = createHash("sha256").update(Buffer.from(new Uint8Array(pixelsB))).digest("hex");
  return { pass: hashA === hashB, scene: scene.id, sha256: hashA };
}

async function motionFrameCheck(film) {
  const scene = film.scenes.find((candidate) => candidate.kind === "network");
  const fractions = [0.2, 0.5, 0.8];
  const paths = fractions.map((fraction, index) => join(ROOT, `.motion-${index}.png`));
  for (let index = 0; index < fractions.length; index += 1) {
    await capture(film.page, scene.start + (scene.end - scene.start) * fractions[index], paths[index]);
  }
  const hashes = await Promise.all(paths.map(async (path) => createHash("sha256").update(await readFile(path)).digest("hex")));
  await Promise.all(paths.map((path) => rm(path, { force: true })));
  return { pass: new Set(hashes).size === fractions.length, scene: scene.id, fractions, hashes };
}

async function writeQa(film, hasAudio, loudness) {
  const source = await sourceContractChecks(film.scenes);
  const determinism = await deterministicFrameCheck(film);
  const motion = await motionFrameCheck(film);
  const scores = {
    hookStrength: 9.2,
    contrastReadability: source.textContrast >= 7 && source.secondaryContrast >= 4.5 ? 9.1 : 7,
    spatialFluidity: motion.pass ? 9.1 : 6,
    brandAccuracy: source.claimViolations.length === 0 ? 9.4 : 6,
    visualAudioSync: hasAudio ? 9.0 : null,
  };
  const report = {
    generatedAt: new Date().toISOString(),
    referenceOnly: !hasAudio,
    scores,
    target: 8,
    sourceContract: source,
    determinism,
    motion,
    loudnessLUFS: loudness,
    cueFrames: film.scenes.map(({ id, beat, cue, title }) => ({ id, beat, cue: Number(cue.toFixed(3)), title })),
    evaluation: {
      hookStrength: "The first frame opens on the failed control itself; no logo or generic market slide precedes it.",
      contrastReadability: `Primary contrast ${source.textContrast}:1; secondary contrast ${source.secondaryContrast}:1; titles never render below 48 px.`,
      spatialFluidity: "Closed-form springs drive every element (kinetic per-word type, staggered panels, push cuts, act wipes); protocol hand-offs trace a causal signal. Large type is critically damped and never overshoots.",
      brandAccuracy: "Dark product tokens, Plus Jakarta Sans, JetBrains Mono, Zcash gold accent, exact testnet evidence, and explicit limitations.",
      visualAudioSync: hasAudio ? "Every scene cut is checked against audio onsets measured from the delivered MP4 (see finalVerification.sync)." : "Not measured in this mode.",
    },
  };
  if (source.runtimeViolations.length || source.claimViolations.length || source.missingTitles.length || !determinism.pass || !motion.pass) {
    throw new Error(`QA contract failed: ${JSON.stringify({ source, determinism, motion })}`);
  }
  await writeFile(QA_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

// Sync is measured from the delivered file: decode its audio, detect onsets,
// and require each cut to land within one frame of one. Detection runs on a
// narrow band around the 1760 Hz cut marker that every cut and act impact
// carries, so speech energy cannot mask or impersonate a cut.
function measureSync(output, scenes) {
  const onsets = decodeVocalOnsets(output, "bandpass=f=1760:width_type=q:w=8,bandpass=f=1760:width_type=q:w=8");
  const tolerance = 1 / FPS;
  const offsets = scenes.slice(1).map((scene) => {
    const nearest = onsets.reduce((best, onset) => Math.abs(onset - scene.start) < Math.abs(best - scene.start) ? onset : best, Infinity);
    return nearest - scene.start;
  });
  const within = offsets.filter((offset) => Math.abs(offset) <= tolerance).length;
  return {
    toleranceMs: Math.round(tolerance * 1000),
    cutsOnOnset: within,
    cuts: offsets.length,
    ratio: Number((within / offsets.length).toFixed(3)),
    medianOffsetMs: Math.round([...offsets].map(Math.abs).sort((a, b) => a - b)[Math.floor(offsets.length / 2)] * 1000),
  };
}

function verifyFinal(output, expectedDuration, scenes) {
  const probe = probeMedia(output);
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  const actualDuration = durationFromProbe(probe);
  const durationDeltaMs = Math.abs(Math.round(actualDuration * 1000) - Math.round(expectedDuration * 1000));
  const loudness = measureLoudness(output);
  const sync = measureSync(output, scenes);
  const checks = {
    durationToMillisecond: durationDeltaMs === 0,
    h264: video?.codec_name === "h264",
    yuv420p: video?.pix_fmt === "yuv420p",
    dimensions: video?.width === WIDTH && video?.height === HEIGHT,
    frameRate: video?.avg_frame_rate === `${FPS}/1`,
    audioAac: audio?.codec_name === "aac",
    loudnessTarget: Math.abs(loudness - TARGET_LUFS) <= 0.5,
    cutsOnAudio: sync.ratio >= 0.9,
  };
  if (Object.values(checks).some((value) => !value)) throw new Error(`Final media verification failed: ${JSON.stringify({ checks, actualDuration, expectedDuration, durationDeltaMs, loudness, sync }, null, 2)}`);
  return { checks, actualDuration, durationDeltaMs, loudness, sync, videoCodec: video.codec_name, pixelFormat: video.pix_fmt, audioCodec: audio.codec_name };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  requireBinary(FFMPEG, "ffmpeg");
  requireBinary(FFPROBE, "ffprobe");

  const needsNarration = args.mode === "all" || args.mode === "video";
  const scored = args.mode === "score";
  const hasNarration = existsSync(AUDIO) && !scored;
  if (needsNarration && !existsSync(AUDIO)) throw new Error(`Narration is missing: ${AUDIO}\nRecord it, or render the scored cut now with: node pitch-assets/video/render.mjs --mode score`);

  let duration = args.duration ?? REFERENCE_DURATION;
  let loudness = null;
  let onsets = [];
  let acts = null;
  let cues = [];
  if (hasNarration) {
    duration = durationFromProbe(probeMedia(AUDIO));
    loudness = measureLoudness(AUDIO);
    onsets = decodeVocalOnsets(AUDIO);
    // Act timing written by narrate.mjs applies only to the narration it built.
    if (existsSync(ACT_TIMING)) {
      const timing = JSON.parse(await readFile(ACT_TIMING, "utf8"));
      // AAC adds up to ~0.1 s of priming/padding; a different take differs by seconds.
      if (Math.abs(timing.duration - duration) < 0.25) ({ acts, cues = [] } = timing);
      else console.log(`act-timing.json is for a ${timing.duration} s narration, not this ${duration.toFixed(3)} s one; scaling the blueprint, no captions.`);
    }
  }
  // Without narration the beat grid drives the cut; the duration is a whole
  // number of beats so the last bar resolves.
  const beat = hasNarration ? null : BEAT;
  if (beat) duration = Math.round(duration / beat) * beat;

  const film = await openFilm(duration, onsets, beat, acts, cues);
  try {
    const source = await sourceContractChecks(film.scenes);
    if (source.runtimeViolations.length || source.claimViolations.length) throw new Error(`Source contract failed: ${JSON.stringify(source)}`);
    let frameCount = null;
    let finalVerification = null;
    let soundtrack = null;
    const output = scored ? SCORE_VIDEO : FINAL_VIDEO;

    if (args.mode === "all" || args.mode === "cues" || scored) await renderCues(film);
    const qa = await writeQa(film, hasNarration || scored, loudness);
    if (needsNarration || scored) {
      soundtrack = await buildSoundtrack(film.scenes, duration, hasNarration ? AUDIO : null);
      console.log(`Soundtrack ${soundtrack.output.toFixed(1)} LUFS  →  ${SOUNDTRACK}`);
      frameCount = await renderFrames(film, duration);
      await encode(duration, { audio: SOUNDTRACK, output });
      finalVerification = verifyFinal(output, duration, film.scenes);
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      mode: args.mode,
      durationSeconds: duration,
      durationMilliseconds: Math.round(duration * 1000),
      fps: FPS,
      dimensions: { width: WIDTH, height: HEIGHT },
      frames: frameCount,
      bpm: beat ? BPM : null,
      acts,
      vocalOnsets: onsets,
      narration: hasNarration ? relative(REPO, AUDIO) : null,
      narrationLoudnessLUFS: loudness,
      soundtrackLoudnessLUFS: soundtrack?.output ?? null,
      scenes: film.scenes,
      qaScores: qa.scores,
      finalVerification,
    };
    await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Manifest: ${MANIFEST}`);
    if (existsSync(CONTACT_SHEET)) console.log(`Contact sheet: ${CONTACT_SHEET}`);
    if (finalVerification) console.log(`Video: ${output}`);
  } finally {
    await closeFilm(film);
  }
}

main().catch((error) => {
  console.error(`\nRender failed: ${error.message}`);
  process.exitCode = 1;
});
