# Quorum deterministic pitch film

Code-rendered motion film: every frame is `window.seek(t)` painting a canvas, Chrome screenshots each frame, ffmpeg encodes. Pipeline follows the seek(t) / closed-form springs / beat grid / synthesized score / critique-loop method.

## Setup

```bash
npm install --prefix pitch-assets/video
```

Portable `ffmpeg` and `ffprobe` are pinned in the package; Homebrew is not required. `FFMPEG_BIN`, `FFPROBE_BIN`, and `CHROME_BIN` override the defaults.

## Two cuts

### 1. Scored cut — renders now, no narration needed

```bash
node pitch-assets/video/render.mjs --mode score
```

Output: `pitch-assets/video/quorum-pitch-score.mp4`

### 2. Narrated cut — the submission film

Generate the narration — the verbatim `docs/07-demo-script.md` script in `narration.js` — with Kokoro-82M, a local neural TTS model (offline, no API key; the ~80 MB model downloads once):

```bash
node pitch-assets/video/narrate.mjs                    # voice af_heart, speed 1.0
node pitch-assets/video/narrate.mjs --voice bf_emma    # any Kokoro voice
node pitch-assets/video/render.mjs
```

Output: `pitch-assets/video/quorum-pitch.mp4`

The narration sets the clock. `narrate.mjs` speaks each beat, gives each act exactly the time its script needs plus a breath, and writes both `assets/audio-cut/pitch-final.m4a` and `act-timing.json`. `render.mjs` stretches each act's scenes into that act's window, so a long-spoken beat never runs over its pictures. If `docs/07` changes, mirror the change in `narration.js`; `PRONUNCIATION` there rewrites only how terms like `ZIP-312` are spoken. To use a recorded human take instead (`act-timing.json` is ignored when its duration does not match the narration):

```bash
node pitch-assets/video/prepare-audio.mjs ~/Desktop/my-take.m4a
node pitch-assets/video/render.mjs
```

`prepare-audio.mjs` applies two-pass EBU R128 normalization with linear gain to −14 LUFS. Either way, the renderer takes the duration from the narration, snaps cuts to detected vocal onsets, lays the score underneath with sidechain ducking keyed by the voice, and normalizes the mix to −14 LUFS. `QUORUM_AUDIO=/path/file.m4a` overrides the narration path.

## Subtitles (English)

`narrate.mjs` splits the script into caption-sized cues (`captions.mjs`: sentences, long ones split at a dash or comma, short ones merged) and synthesizes **each cue as its own clip**. A cue's start and end are therefore the first and last audible sample of its words, measured from the clip itself, not estimated from text length.

- **Burned in:** drawn on every frame of `quorum-pitch.mp4`, centred above the progress rule, max two balanced lines.
- **Sidecar:** `pitch-assets/video/quorum-pitch.en.srt`, the same cues, for upload to YouTube or other players.

Captions exist only for TTS narration built by `narrate.mjs`. A recorded human take has no cue timings; the film renders without captions until an SRT is supplied for it.

## Motion system

- **Closed-form springs** (`spring(elapsed, preset)` in `index.html`) — a pure function of time, so any frame renders without simulating earlier ones. Large type is critically damped (no overshoot); UI chips overshoot slightly.
- **Kinetic type** — each title word rises out of a mask, staggered 55 ms.
- **Element stagger** — panels, pills, and nodes enter 90 ms apart.
- **Push cut** — outgoing scene exits before the incoming arrives, so two headlines never share a frame.
- **Act wipe** — a gold edge sweeps the screen on each of the seven act changes.
- **Causal signals** — protocol hand-offs trace a moving lead point.

## Verification (runs automatically)

Every render checks, from the delivered MP4:

| Check | Requirement |
|---|---|
| Duration | equals the timeline to the millisecond |
| Video | H.264, `yuv420p`, 1920×1080, 30 fps, CRF 16 |
| Audio | AAC, −14 ±0.5 LUFS |
| Sync | ≥ 90% of cuts within one frame (33 ms) of a 1760 Hz cut marker detected in the final file's audio |
| Determinism | the same time renders byte-identical frames; motion samples differ |
| Claims | no forbidden on-screen claims (mainnet, audited, trustless, …) |

Results go to `render-manifest.json` → `finalVerification`. A critique pass renders one cue frame per scene into `contact-sheet.png`.

## Other modes

```bash
node pitch-assets/video/render.mjs --mode cues --duration 195      # contact sheet only
node pitch-assets/video/render.mjs --mode validate --duration 195  # contracts, no frames
```

## Equivalent ffmpeg assembly

```bash
ffmpeg -framerate 30 -i pitch-assets/video/frames/%06d.png \
  -i pitch-assets/video/soundtrack.m4a \
  -map 0:v:0 -map 1:a:0 -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -t <duration> -movflags +faststart <output>.mp4
```

## Determinism

- No CSS transitions, timers, `requestAnimationFrame`, or `Math.random()`; only seeded `mulberry32`.
- Cuts are a deterministic function of the blueprint plus either the beat grid or the narration samples.
- The score is a deterministic function of the cut list.
