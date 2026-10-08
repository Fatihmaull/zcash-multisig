export const REFERENCE_DURATION = 195;

export const PALETTE = Object.freeze({
  bg: "#080b11",
  bgSecondary: "#0c101a",
  surface: "#121826",
  card: "#0e131f",
  elevated: "#172033",
  text: "#f8fafc",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  gold: "#f4b728",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#38bdf8",
  violet: "#c084fc",
  borderSubtle: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.18)",
  goldDim: "rgba(244,183,40,0.12)",
  goldBorder: "rgba(244,183,40,0.25)",
});

export const ACT_NAMES = Object.freeze({
  1: "The control that isn't",
  2: "Why now",
  3: "The ceremony",
  4: "The spend",
  5: "When it breaks",
  6: "The audit",
  7: "The honest part",
});

// One scene per narration line (captions.mjs cue), in the same order, so the
// picture always illustrates the sentence being heard. `at` is the reference
// start (seconds) used only when no cue timing is available.
// Every on-screen string and figure here comes from the code or the script:
// PIDs, file paths, prompt text, alert text, txid and block are real outputs.
export const SCENE_BLUEPRINTS = Object.freeze([
  // Act 1 — the control that isn't
  { at: 0, beat: 1, kind: "seed", title: "“The treasurer holds the seed phrase.”", stamp: "NOT A CONTROL" },
  { at: 8.9, beat: 1, kind: "keyperson", title: "A key-person risk with a human wrapper.", items: ["COMPROMISED", "COERCED", "GONE"] },
  { at: 11.4, beat: 1, kind: "nocontrol", title: "Shielded funds can't express a control.", items: ["2-of-3 approval", "Spend policy", "Audit trail"] },
  { at: 15.9, beat: 1, kind: "opcode", title: "No multisig opcode in the shielded pools." },
  { at: 19.0, beat: 1, kind: "fork", title: "Two options. Both bad.", leftTitle: "Publish everything", rightTitle: "One person holds everything" },
  { at: 26.1, beat: 1, kind: "stat", title: "4.89M ZEC", body: "≈ $5.8 billion in shielded pools, under exactly that constraint." },

  // Act 2 — why now
  { at: 35.7, beat: 2, kind: "frost", title: "Threshold signatures already exist.", body: "FROST for Zcash — the Zcash Foundation's work." },
  { at: 42.1, beat: 2, kind: "clocks", title: "Approval is slow by nature." },
  { at: 49.2, beat: 2, kind: "stale", title: "Old format: the anchor went stale." },
  { at: 56.0, beat: 2, kind: "discard", title: "Rebuilt — every signature thrown away." },
  { at: 61.4, beat: 2, kind: "v6", title: "In v6, the anchor is authorizing data." },
  { at: 64.8, beat: 2, kind: "order", title: "Chosen at broadcast. After the signatures.", steps: ["Alice signs", "Bob signs", "Anchor chosen", "Broadcast"] },
  { at: 68.3, beat: 2, kind: "whynow", title: "Usable shielded multisig. Possible now." },

  // Act 3 — the ceremony
  { at: 77.1, beat: 3, kind: "processes", title: "Three separate processes. One share each." },
  { at: 83.6, beat: 3, kind: "network", title: "Encrypted to one named recipient." },
  { at: 87.4, beat: 3, kind: "nobody", title: "Nobody holds the full key. Including us." },
  { at: 91.9, beat: 3, kind: "claim", title: "Not while signing. Not while it was being created." },

  // Act 4 — the spend
  { at: 96.4, beat: 4, kind: "prompt", title: "Not a button on a web page." },
  { at: 101.3, beat: 4, kind: "checks", title: "Her machine read the transaction itself." },
  { at: 106.9, beat: 4, kind: "columns", title: "What it can prove, beside what it's told." },
  { at: 111.0, beat: 4, kind: "cast", title: "Bob is scripted for timing. Carol is offline." },
  { at: 117.2, beat: 4, kind: "quorum", title: "Two was the threshold.", txid: "259242c6d3c518224627e6b7b7488191d4cbbb32dfd84c2e09e144f9410b3a61", block: "4,390,493" },

  // Act 5 — when it breaks
  { at: 123.4, beat: 5, kind: "malice", title: "Shared control rarely fails from malice." },
  { at: 127.7, beat: 5, kind: "failures", title: "It fails like this.", items: ["A compromised device", "A signer on a plane", "Something quietly broken"] },
  { at: 134.3, beat: 5, kind: "panic", title: "A Rust panic is not an answer." },
  { at: 139.4, beat: 5, kind: "alert", title: "What went wrong. What it cost. What to do next." },

  // Act 6 — the audit
  { at: 145.2, beat: 6, kind: "funder", title: "Control also means proving where the money went." },
  { at: 151.9, beat: 6, kind: "forge", title: "Anyone can forge a database table." },
  { at: 156.9, beat: 6, kind: "vkey", title: "Derived from the vault's viewing key." },
  { at: 159.0, beat: 6, kind: "handoff", title: "Hand the funder the viewing key." },
  { at: 163.1, beat: 6, kind: "chain", title: "The event log is ours. The chain is not." },
  { at: 166.0, beat: 6, kind: "product", title: "Shielded funds. Provable disclosure." },

  // Act 7 — the honest part
  { at: 172.7, beat: 7, kind: "review", title: "To be clear about what this is." },
  { at: 176.1, beat: 7, kind: "limits", title: "Not covered. Still draft. Testnet only.", items: ["RERANDOMIZED FROST · OUTSIDE THAT REVIEW", "ZIP-312 · DRAFT", "TESTNET ONLY"] },
  { at: 183.5, beat: 7, kind: "credit", title: "We didn't build the cryptography." },
  { at: 187.1, beat: 7, kind: "layer", title: "We built the layer in between." },
]);

// Snap sources, in priority order:
//   cues        — caption cues from narrate.mjs: each scene starts just before its
//                 own sentence is spoken; the first scene of each act starts on
//                 the act boundary.
//   vocalOnsets — measured from a recorded narration; cuts land on spoken emphasis.
//   beatPeriod  — synthesized score; every cut lands exactly on a beat.
export function buildTimeline(duration, { vocalOnsets = [], beatPeriod = null, acts = null, cues = null } = {}) {
  const scale = duration / REFERENCE_DURATION;
  const byCue = Boolean(acts && cues && cues.length === SCENE_BLUEPRINTS.length
    && cues.every((cue, index) => cue.beat === SCENE_BLUEPRINTS[index].beat));
  const starts = SCENE_BLUEPRINTS.map((scene, index) => {
    if (index === 0) return 0;
    if (byCue) {
      if (SCENE_BLUEPRINTS[index - 1].beat !== scene.beat) return acts.find((act) => act.beat === scene.beat).start;
      return cues[index].start - 0.25;
    }
    const target = scene.at * scale;
    if (beatPeriod) return Math.round(target / beatPeriod) * beatPeriod;
    const radius = Math.min(0.6, 0.45 * scale);
    const nearby = vocalOnsets.filter((onset) => Math.abs(onset - target) <= radius);
    if (!nearby.length) return target;
    return nearby.reduce((best, onset) => Math.abs(onset - target) < Math.abs(best - target) ? onset : best);
  });

  const minGap = beatPeriod ? Math.ceil(1.75 / beatPeriod) * beatPeriod : 1.75;
  for (let index = 1; index < starts.length; index += 1) {
    const minimum = starts[index - 1] + minGap;
    starts[index] = Math.min(duration - 0.5, Math.max(minimum, starts[index]));
  }

  return SCENE_BLUEPRINTS.map((blueprint, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : duration;
    return {
      ...blueprint,
      id: `b${blueprint.beat}-s${String(index + 1).padStart(2, "0")}`,
      start: starts[index],
      end,
      cue: Math.min(duration - 0.05, starts[index] + (end - starts[index]) * 0.72),
    };
  });
}
