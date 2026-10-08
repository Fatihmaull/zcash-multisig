# Quorum pitch film — visual contract

## Decision

Evidence-native motion graphics. Motion explains a protocol transition: threshold formation, anchor deferral, signer response, verification, or chain reconciliation. No logo animation, particles, ambient loops, fake terminal chrome, or decorative glow.

### Departure from `docs/18-video-agent-master-prompt.md` — approved

On 8 Oct the user directed a showreel treatment (springs, transitions, synthesized score) following the Movez motion-studio method. It overrides three rules in docs/18: *no spring/overshoot*, *cuts as the default transition*, and *no music bed*. Fatih approved the departure on 8 Oct.

Scope of what changed:

- Large type is critically damped and never overshoots; only small UI chips do.
- The score carries no voice.
- Every factual and claims rule in docs/18 still holds and is enforced by the renderer's claim scan.

To revert to the docs/18 treatment: set `TRANSITION = 0` and render the narrated cut without the score bed.

## System

- Canvas: 1920 × 1080, 30 fps, H.264 `yuv420p`, CRF 16.
- Faces: Plus Jakarta Sans for prose/UI; JetBrains Mono for commands, states, amounts, blocks, and txids.
- Ground: `#080b11`; surfaces: `#0c101a`, `#121826`, `#0e131f`, `#172033`.
- One brand accent: Zcash gold `#f4b728`. Semantic states retain the product’s success/warning/danger/info colours and are never decorative.
- Hairlines: foreground alpha only: `rgba(255,255,255,0.06|0.10|0.18)`.
- Radii: 6, 10, 14, 18, or 24 px only.
- Motion: closed-form springs (`heavy` ζ = 1 for type; `default` ζ = 0.82 for panels; `snappy` ζ = 0.72 for chips).

### Motion system

- Every scene runs establish → explain → resolve; motion scales to the scene's duration.
- Kinetic per-word type; 90 ms element stagger; push cuts sequenced so headlines never overlap; a gold act wipe on each of the seven act changes.
- Protocol hand-offs use a traced signal whose lead point represents an actual package, check, or reconciliation step.
- Cue frames are sampled at 68% of each scene so the contact sheet judges the resolved composition.

## Narrative authority

Scene order follows `docs/07-demo-script.md`: control failure; v6 anchor insight; distributed ceremony; approval and confirmed spend; invalid-share attribution; viewing-key audit; honest close. Product facts and limitation language follow `docs/18-video-agent-master-prompt.md` and `docs/submission-draft.md` §9.

The film uses the historical 25 September transaction only, captioned `25 SEP • DISTRIBUTED-CEREMONY VAULT`. It does not imply that this historical transaction came from a newly filmed ceremony.

## Narration

- Text is verbatim from the quoted narration in `docs/07-demo-script.md` beats 1–7 (`narration.js`). `PRONUNCIATION` rewrites only how terms are spoken (`ZIP-312` → "zip three twelve"), never what is said.
- Beat 7's optional "open question" paragraph is omitted on purpose: CLAUDE.md records that the quantum-recoverability question was answered on 21 Sep and must not be described as open.
- Voice: Kokoro-82M `af_heart`, a local neural TTS model — the only English voice graded A in Kokoro's own voice table.

## Sync

- **Scored cut:** cuts quantize to a 96 BPM grid (0.625 s); the score places a tick on every cut and an impact on every act change.
- **Narrated cut:** the narration sets the clock. Each act runs as long as its script needs plus a breath (`act-timing.json`); scenes stretch within their act and snap to nearby vocal onsets; the music bed ducks under the voice while transition SFX stay at full level.
- Either way, sync is verified by decoding the delivered MP4's audio, isolating the 1760 Hz marker band that every cut tick and act impact carries, and checking each cut against the markers found there.
