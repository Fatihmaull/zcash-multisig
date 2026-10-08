// Scene art for the Quorum film: an illustration library plus one renderer per
// scene kind. Free-form composition: no fixed header, no boxed title — each
// scene places its own type and draws real objects from the system (processes,
// sealed shares, Noise envelopes, the signer prompt, the coordinator alert).
//
// Every function is a pure function of the drawing context `g` and the scene
// clock; nothing persists between frames.
import { PALETTE as C, ACT_NAMES } from "./timeline.js";

export const W = 1920;
export const H = 1080;
const TAU = Math.PI * 2;

export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (v) => { const x = clamp(v); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const sans = (size, weight = 700) => `${weight} ${size}px "Plus Jakarta Sans"`;
const mono = (size, weight = 500) => `${weight} ${size}px "JetBrains Mono"`;

const SPRINGS = { snappy: { w: 26, z: 0.72 }, default: { w: 16, z: 0.82 }, heavy: { w: 11, z: 1 }, soft: { w: 7, z: 0.9 } };
export function spring(e, preset = "default") {
  if (e <= 0) return 0;
  const { w, z } = SPRINGS[preset];
  if (z >= 1) return 1 - (1 + w * e) * Math.exp(-w * e);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * e) * (Math.cos(wd * e) + (z * w / wd) * Math.sin(wd * e));
}

function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

/* ───────────────────────── primitives ───────────────────────── */

function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function box(g, x, y, w, h, { r = 18, fill = C.card, stroke = C.border, lw = 2, shadow = false } = {}) {
  g.save();
  if (shadow) { g.shadowColor = "rgba(0,0,0,0.55)"; g.shadowBlur = 40; g.shadowOffsetY = 18; }
  rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill();
  g.restore();
  if (stroke) { rr(g, x, y, w, h, r); g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
function ln(g, x1, y1, x2, y2, color = C.borderStrong, w = 2, dash = null) {
  g.save(); if (dash) g.setLineDash(dash);
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.stroke();
  g.restore();
}
function circle(g, x, y, r, fill, stroke = null, lw = 2) {
  g.beginPath(); g.arc(x, y, r, 0, TAU);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
function text(g, s, x, y, { font = sans(40), color = C.text, align = "left", base = "alphabetic", alpha = 1, track = 0 } = {}) {
  g.save(); g.globalAlpha *= alpha; g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
  if (track) {
    const chars = [...s]; const ws = chars.map((c) => g.measureText(c).width);
    const total = ws.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    g.textAlign = "left"; chars.forEach((c, i) => { g.fillText(c, cx, y); cx += ws[i] + track; });
  } else g.fillText(s, x, y);
  g.restore();
}
function measure(g, s, font) { g.save(); g.font = font; const w = g.measureText(s).width; g.restore(); return w; }
function fit(g, s, maxW, size, min, weight = 800) { while (size > min && measure(g, s, sans(size, weight)) > maxW) size -= 2; return size; }
function wrapLines(g, s, maxW, font) {
  g.save(); g.font = font; const out = []; let cur = "";
  for (const word of s.split(/\s+/)) { const t = cur ? `${cur} ${word}` : word; if (cur && g.measureText(t).width > maxW) { out.push(cur); cur = word; } else cur = t; }
  if (cur) out.push(cur); g.restore(); return out;
}
function glow(g, x, y, r, color, a = 0.35) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color.replace(")", `,${a})`).replace("rgb(", "rgba(")); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
}
const rgb = { gold: "rgb(244,183,40)", danger: "rgb(239,68,68)", success: "rgb(16,185,129)", info: "rgb(56,189,248)", violet: "rgb(192,132,252)" };

/* ───────────────────────── motion helpers ───────────────────────── */

// Scene clock wrapper: k(t0) springs in from scene time t0.
function clock(local, dur) {
  return {
    local, dur,
    k: (t0 = 0, preset = "default") => spring(local - t0, preset),
    p: (a = 0.1, b = 0.7) => ease((local / dur - a) / (b - a)),
    at: (frac) => frac * dur,
  };
}
function enter(g, k, draw, { dx = 0, dy = 40, scale = null } = {}) {
  if (k <= 0.001) return;
  g.save(); g.globalAlpha *= clamp(k * 1.5); g.translate(dx * (1 - k), dy * (1 - k));
  if (scale) { const s = lerp(scale[0], 1, k); g.translate(scale[1], scale[2]); g.scale(s, s); g.translate(-scale[1], -scale[2]); }
  draw(); g.restore();
}

// Headline: words rise from a mask. Free placement; optional accent word.
function headline(g, s, x, y, c, { size = 84, min = 48, maxW = 1500, color = C.text, accent = null, delay = 0.05, align = "left", weight = 800 } = {}) {
  size = fit(g, s, maxW, size, min, weight);
  const font = sans(size, weight); g.save(); g.font = font;
  const words = s.split(" "); const sp = g.measureText(" ").width;
  const widths = words.map((w) => g.measureText(w).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  words.forEach((w, i) => {
    const k = c.k(delay + i * 0.05, "heavy");
    g.save(); g.beginPath(); g.rect(cx - 6, y - size * 1.08, widths[i] + 12, size * 1.4); g.clip();
    g.globalAlpha = clamp(k * 1.6); g.fillStyle = accent && accent.includes(w.replace(/[.,!?]/g, "")) ? C.gold : color;
    g.textBaseline = "alphabetic"; g.textAlign = "left"; g.fillText(w, cx, y + (1 - k) * size * 0.95);
    g.restore(); cx += widths[i] + sp;
  });
  g.restore(); return size;
}
function kicker(g, s, x, y, c, color = C.gold, delay = 0) {
  const k = c.k(delay, "snappy");
  g.save(); g.globalAlpha = clamp(k);
  g.fillStyle = color; g.fillRect(x, y - 14, 34 * k, 3);
  text(g, s.toUpperCase(), x + 48, y - 4, { font: mono(19, 700), color, track: 2.4 });
  g.restore();
}

/* ───────────────────────── illustration library ───────────────────────── */

const PEOPLE = {
  Alice: { color: C.gold, role: "TREASURER" },
  Bob: { color: C.info, role: "DIRECTOR" },
  Carol: { color: C.violet, role: "AUDITOR" },
  Treasurer: { color: C.gold, role: "TREASURER" },
  Funder: { color: C.success, role: "GRANT FUNDER" },
};
// Flat-figure person: head + shoulders, tinted.
function person(g, x, y, s, { tint = C.textSecondary, dim = false, name = null, sub = null } = {}) {
  g.save(); g.globalAlpha *= dim ? 0.35 : 1;
  circle(g, x, y - 58 * s, 30 * s, tint);
  g.beginPath(); g.ellipse(x, y + 22 * s, 60 * s, 52 * s, 0, Math.PI, 0); g.closePath(); g.fillStyle = tint; g.fill();
  g.restore();
  if (name) text(g, name, x, y + 64 * s, { font: sans(26 * s, 700), color: dim ? C.textMuted : C.text, align: "center" });
  if (sub) text(g, sub, x, y + 94 * s, { font: mono(15 * s, 700), color: C.textMuted, align: "center", track: 1.5 });
}
function laptop(g, x, y, s, { screen = C.surface, on = true, glowColor = null } = {}) {
  const w = 220 * s, h = 140 * s;
  if (glowColor && on) glow(g, x, y - h / 2, 220 * s, glowColor, 0.18);
  box(g, x - w / 2, y - h, w, h, { r: 12 * s, fill: C.elevated, stroke: C.borderStrong });
  box(g, x - w / 2 + 10 * s, y - h + 10 * s, w - 20 * s, h - 20 * s, { r: 6 * s, fill: on ? screen : "#05070b", stroke: null });
  g.beginPath(); g.moveTo(x - w / 2 - 26 * s, y + 6 * s); g.lineTo(x + w / 2 + 26 * s, y + 6 * s);
  g.lineTo(x + w / 2 + 10 * s, y - 2 * s); g.lineTo(x - w / 2 - 10 * s, y - 2 * s); g.closePath(); g.fillStyle = C.borderStrong; g.fill();
}
// A sealed share: a gold-edged chip with a keyhole.
function shareChip(g, x, y, s, label = null, { color = C.gold, sealed = true } = {}) {
  box(g, x - 46 * s, y - 32 * s, 92 * s, 64 * s, { r: 10 * s, fill: "rgba(244,183,40,0.10)", stroke: color, lw: 2.5 * s });
  if (sealed) {
    circle(g, x, y - 6 * s, 9 * s, color);
    g.beginPath(); g.moveTo(x - 5 * s, y); g.lineTo(x + 5 * s, y); g.lineTo(x + 3 * s, y + 16 * s); g.lineTo(x - 3 * s, y + 16 * s); g.closePath(); g.fillStyle = color; g.fill();
  }
  if (label) text(g, label, x, y + 60 * s, { font: mono(16 * s, 700), color: C.textSecondary, align: "center" });
}
function keyIcon(g, x, y, s, color = C.gold, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  circle(g, -40 * s, 0, 26 * s, null, color, 9 * s); circle(g, -40 * s, 0, 8 * s, color);
  g.fillStyle = color; g.fillRect(-16 * s, -6 * s, 86 * s, 12 * s);
  g.fillRect(44 * s, 4 * s, 10 * s, 20 * s); g.fillRect(60 * s, 4 * s, 10 * s, 14 * s);
  g.restore();
}
function padlock(g, x, y, s, color = C.gold, open = 0) {
  g.save(); g.translate(x, y);
  g.beginPath(); g.arc(0, -24 * s - open * 18 * s, 22 * s, Math.PI, 0); g.strokeStyle = color; g.lineWidth = 8 * s; g.stroke();
  box(g, -34 * s, -26 * s, 68 * s, 54 * s, { r: 8 * s, fill: color, stroke: null });
  circle(g, 0, 0, 6 * s, C.bg);
  g.restore();
}
function envelope(g, x, y, s, { to = null, color = C.gold, sealed = true } = {}) {
  box(g, x - 54 * s, y - 34 * s, 108 * s, 68 * s, { r: 8 * s, fill: C.elevated, stroke: color, lw: 2 * s });
  g.beginPath(); g.moveTo(x - 54 * s, y - 30 * s); g.lineTo(x, y + 6 * s); g.lineTo(x + 54 * s, y - 30 * s);
  g.strokeStyle = color; g.lineWidth = 2 * s; g.stroke();
  if (sealed) circle(g, x, y + 6 * s, 9 * s, color);
  if (to) text(g, `→ ${to}`, x, y + 60 * s, { font: mono(15 * s, 700), color: C.textSecondary, align: "center" });
}
function terminal(g, x, y, w, h, lines, c, { title = null, from = 0.2, per = 0.18, size = 22 } = {}) {
  box(g, x, y, w, h, { r: 14, fill: "rgba(0,0,0,0.55)", stroke: C.border, shadow: true });
  if (title) text(g, title, x + 26, y + 38, { font: mono(15, 700), color: C.textMuted, track: 1.2 });
  const top = y + (title ? 82 : 48);
  lines.forEach((entry, i) => {
    const k = c.k(from + i * per, "snappy");
    if (k <= 0) return;
    const [s, color] = Array.isArray(entry) ? entry : [entry, C.textSecondary];
    text(g, s, x + 26, top + i * (size * 1.6), { font: mono(size, 500), color, alpha: clamp(k * 1.6) });
  });
}
function pill(g, x, y, s, color, { w = null, fill = true, size = 18 } = {}) {
  const width = w ?? measure(g, s, mono(size, 700)) + 64;
  box(g, x, y, width, size * 2.8, { r: size * 1.4, fill: fill ? color.replace("#", "#") + "22" : C.card, stroke: color });
  circle(g, x + 26, y + size * 1.4, 6, color);
  text(g, s, x + 44, y + size * 1.4 + 6, { font: mono(size, 700), color: C.text });
  return width;
}
function block(g, x, y, s, { label = null, color = C.borderStrong, fill = C.elevated } = {}) {
  box(g, x - 48 * s, y - 48 * s, 96 * s, 96 * s, { r: 12 * s, fill, stroke: color, lw: 2 * s });
  for (let i = 0; i < 3; i += 1) g.fillStyle = C.border, g.fillRect(x - 30 * s, y - 24 * s + i * 18 * s, 60 * s, 6 * s);
  if (label) text(g, label, x, y + 80 * s, { font: mono(14 * s, 700), color: C.textMuted, align: "center" });
}
// Flowing dashed link with a travelling packet.
function flow(g, x1, y1, x2, y2, t, { color = C.gold, w = 3, packet = true, speed = 0.6, dash = [10, 12] } = {}) {
  g.save(); g.setLineDash(dash); g.lineDashOffset = -t * 60;
  ln(g, x1, y1, x2, y2, color.length === 7 ? color + "66" : color, w);
  g.restore();
  if (packet) { const f = (t * speed) % 1; circle(g, lerp(x1, x2, f), lerp(y1, y2, f), w * 2.6, color); }
}
// Drifting dust motes for depth — deterministic from frame time.
function dust(g, t, n = 40, color = "rgba(248,250,252,0.06)") {
  for (let i = 0; i < n; i += 1) {
    const x = (hash(i) * W + t * (8 + hash(i + 9) * 14)) % W;
    const y = (hash(i + 3) * H + Math.sin(t * 0.3 + i) * 20 + H) % H;
    circle(g, x, y, 1.5 + hash(i + 5) * 2.5, color);
  }
}
function arc(g, x, y, r, from, to, color, w) { g.beginPath(); g.arc(x, y, r, from, to); g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.stroke(); }
function cross(g, x, y, s, color = C.danger, w = 12) { ln(g, x - s, y - s, x + s, y + s, color, w); ln(g, x + s, y - s, x - s, y + s, color, w); }
function check(g, x, y, s, color = C.success, w = 10, k = 1) {
  g.save(); g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * 0.3, y + s * 0.7); g.lineTo(x + s, y - s * 0.7);
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; g.setLineDash([s * 4, s * 4]); g.lineDashOffset = s * 4 * (1 - k); g.stroke(); g.restore();
}

/* ───────────────────────── backgrounds ───────────────────────── */

// Each act has its own atmosphere: a tinted radial field + slow parallax grid.
const ACT_TINT = { 1: rgb.danger, 2: rgb.info, 3: rgb.gold, 4: rgb.success, 5: rgb.danger, 6: rgb.violet, 7: rgb.gold };
export function backdrop(g, beat, t, local) {
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  const tint = ACT_TINT[beat] ?? rgb.gold;
  const ox = Math.sin(t * 0.07) * 120, oy = Math.cos(t * 0.05) * 60;
  glow(g, W * 0.78 + ox, H * 0.2 + oy, 900, tint, 0.10);
  glow(g, W * 0.12 - ox, H * 0.95, 700, rgb.info, 0.05);
  // Perspective floor grid, drifting.
  g.save(); g.globalAlpha = 0.5;
  const horizon = H * 0.62, drift = (t * 18) % 80;
  for (let i = -14; i <= 14; i += 1) ln(g, W / 2 + i * 40, horizon, W / 2 + i * 260, H + 40, "rgba(255,255,255,0.035)", 1);
  for (let j = 0; j < 9; j += 1) { const y = horizon + Math.pow((j * 80 + drift) / 720, 2) * (H - horizon + 40); ln(g, 0, y, W, y, "rgba(255,255,255,0.035)", 1); }
  g.restore();
  dust(g, t);
  // Vignette.
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.55)"); g.fillStyle = v; g.fillRect(0, 0, W, H);
}

// Persistent corner bug: act number + name, small, not a header rule.
export function actBug(g, beat, k) {
  g.save(); g.globalAlpha = clamp(k) * 0.9;
  text(g, `0${beat}`, 96, 92, { font: mono(18, 700), color: C.gold });
  text(g, ACT_NAMES[beat].toUpperCase(), 136, 92, { font: mono(16, 700), color: C.textMuted, track: 2 });
  g.restore();
}

// Act title card (first ~1.4 s of an act): big number, act name, slow push-in.
export function actCard(g, beat, local) {
  const c = clock(local, 1.6);
  const k = c.k(0.05, "heavy"), out = clamp((local - 1.05) / 0.35);
  g.save(); g.globalAlpha = 1 - out;
  g.translate(W / 2, H / 2); g.scale(1 + local * 0.03, 1 + local * 0.03); g.translate(-W / 2, -H / 2);
  text(g, `0${beat}`, W / 2, H / 2 + 60, { font: sans(360, 800), color: "rgba(244,183,40,0.10)", align: "center", alpha: k });
  headline(g, ACT_NAMES[beat], W / 2, H / 2 + 30, c, { size: 110, align: "center", maxW: 1500 });
  g.fillStyle = C.gold; g.fillRect(W / 2 - 60 * k, H / 2 + 80, 120 * k, 4);
  g.restore();
  return out;
}

/* ───────────────────────── scenes ───────────────────────── */
// Each: (g, scene, c, t) where c is the scene clock and t the film time.

const S = {};

// 1.0 — the seed phrase on a sticky note, struck through.
S.seed = (g, sc, c) => {
  const k = c.k(0.1, "default");
  enter(g, k, () => {
    g.save(); g.translate(1340, 470); g.rotate(-0.06);
    box(g, -270, -230, 540, 460, { r: 6, fill: "#e8d48a", stroke: null, shadow: true });
    const words = ["orbit", "lunar", "copper", "glide", "shadow", "ember", "violet", "sketch", "anchor", "pulse", "maple", "forge"];
    words.forEach((w, i) => text(g, `${i + 1}. ${w}`, -220 + (i % 2) * 260, -150 + Math.floor(i / 2) * 58, { font: mono(26, 600), color: "#3b3320" }));
    text(g, "treasury seed — DO NOT LOSE", -220, 200, { font: mono(18, 700), color: "#6b5d33" });
    g.restore();
  }, { dy: 80 });
  const strike = c.p(0.35, 0.6);
  ln(g, 1060, 300, 1060 + 560 * strike, 640, C.danger, 14);
  headline(g, sc.title, 112, 440, c, { size: 76, maxW: 820 });
  if (strike > 0.95) enter(g, c.k(c.at(0.6), "snappy"), () => {
    box(g, 112, 560, 360, 80, { r: 12, fill: "rgba(239,68,68,0.14)", stroke: C.danger });
    text(g, sc.stamp, 292, 612, { font: mono(28, 800), color: C.danger, align: "center", track: 2 });
  }, { dy: 20 });
};

// 1.1 — one person, three ways they disappear.
S.keyperson = (g, sc, c) => {
  headline(g, sc.title, 112, 210, c, { size: 70, maxW: 1700, accent: ["human", "wrapper."] });
  person(g, 960, 640, 1.6, { tint: C.gold, name: "Treasurer", sub: "HOLDS THE SEED" });
  keyIcon(g, 960, 360, 0.9, C.gold, Math.sin(c.local * 1.5) * 0.08);
  const spots = [[420, 560], [1500, 560], [960, 900]];
  sc.items.forEach((s, i) => enter(g, c.k(0.5 + i * 0.25, "snappy"), () => {
    const [x, y] = spots[i];
    ln(g, 960, 640, x, y, "rgba(239,68,68,0.35)", 2, [6, 8]);
    box(g, x - 150, y - 34, 300, 68, { r: 34, fill: "rgba(239,68,68,0.12)", stroke: C.danger });
    text(g, s, x, y + 9, { font: mono(24, 800), color: C.danger, align: "center", track: 2 });
  }, { dy: 30 }));
};

// 1.2 — a shielded vault with an empty policy slot.
S.nocontrol = (g, sc, c) => {
  headline(g, sc.title, 112, 230, c, { size: 74, maxW: 1700 });
  enter(g, c.k(0.25), () => {
    box(g, 160, 360, 780, 520, { r: 24, fill: C.card, stroke: C.border, shadow: true });
    text(g, "SHIELDED POOL", 210, 430, { font: mono(18, 700), color: C.textMuted, track: 2 });
    padlock(g, 550, 640, 2.3, C.gold);
    text(g, "private ✓", 550, 800, { font: mono(24, 700), color: C.success, align: "center" });
  });
  enter(g, c.k(0.5), () => {
    box(g, 1000, 360, 760, 520, { r: 24, fill: C.card, stroke: C.border, shadow: true });
    text(g, "CONTROLS", 1050, 430, { font: mono(18, 700), color: C.textMuted, track: 2 });
    sc.items.forEach((s, i) => {
      const y = 520 + i * 110;
      box(g, 1050, y - 40, 660, 76, { r: 12, fill: "rgba(255,255,255,0.02)", stroke: C.border, lw: 2 });
      text(g, s, 1080, y + 8, { font: sans(30, 600), color: C.textMuted });
      enter(g, c.k(0.8 + i * 0.2, "snappy"), () => text(g, "not expressible", 1680, y + 8, { font: mono(18, 700), color: C.danger, align: "right" }), { dx: 20, dy: 0 });
    });
  }, { dx: 60, dy: 0 });
};

// 1.3 — script opcodes: transparent has CHECKMULTISIG; shielded has a hole.
S.opcode = (g, sc, c) => {
  headline(g, sc.title, 112, 230, c, { size: 74, maxW: 1700, accent: ["multisig"] });
  const ops = [["OP_2", C.textSecondary], ["<pubkey A>", C.textSecondary], ["<pubkey B>", C.textSecondary], ["<pubkey C>", C.textSecondary], ["OP_3", C.textSecondary], ["OP_CHECKMULTISIG", C.success]];
  enter(g, c.k(0.2), () => {
    text(g, "TRANSPARENT SCRIPT", 160, 380, { font: mono(18, 700), color: C.textMuted, track: 2 });
    ops.forEach(([s, col], i) => enter(g, c.k(0.3 + i * 0.08, "snappy"), () => {
      box(g, 160, 410 + i * 82, 600, 64, { r: 10, fill: C.elevated, stroke: C.border });
      text(g, s, 190, 452 + i * 82, { font: mono(26, 600), color: col });
    }, { dx: -30, dy: 0 }));
  });
  enter(g, c.k(0.6), () => {
    text(g, "SHIELDED SPEND", 1060, 380, { font: mono(18, 700), color: C.textMuted, track: 2 });
    box(g, 1060, 410, 700, 470, { r: 18, fill: C.card, stroke: C.border });
    text(g, "spend authorization", 1100, 470, { font: mono(22, 600), color: C.textSecondary });
    text(g, "= one RedPallas signature", 1100, 512, { font: mono(22, 600), color: C.textSecondary });
    g.save(); g.setLineDash([12, 10]); rr(g, 1100, 580, 620, 200, 14); g.strokeStyle = C.danger; g.lineWidth = 3; g.stroke(); g.restore();
    text(g, "no script. no opcode.", 1410, 690, { font: mono(26, 700), color: C.danger, align: "center" });
  }, { dx: 60, dy: 0 });
};

// 1.4 — fork in the road: glass house vs. single key.
S.fork = (g, sc, c) => {
  headline(g, sc.title, W / 2, 200, c, { size: 80, align: "center" });
  const split = c.p(0.1, 0.4);
  ln(g, W / 2, 280, W / 2, 280 + 640 * split, C.border, 2);
  enter(g, c.k(0.3), () => {
    // Glass ledger: every row visible.
    box(g, 200, 330, 620, 480, { r: 20, fill: "rgba(56,189,248,0.06)", stroke: C.info, shadow: true });
    ["salary   → 3.20 ZEC", "vendor   → 1.75 ZEC", "runway   → 410 ZEC", "grant    → 25.0 ZEC"].forEach((s, i) => text(g, s, 250, 420 + i * 70, { font: mono(26, 600), color: C.info }));
    text(g, "👁", 760, 390, { font: sans(36), align: "right" });
    text(g, sc.leftTitle, 510, 880, { font: sans(36, 700), color: C.text, align: "center" });
    text(g, "illustrative rows", 510, 920, { font: mono(15, 600), color: C.textMuted, align: "center" });
  }, { dx: -60, dy: 0 });
  enter(g, c.k(0.5), () => {
    box(g, 1100, 330, 620, 480, { r: 20, fill: "rgba(244,183,40,0.05)", stroke: C.goldBorder, shadow: true });
    person(g, 1410, 640, 1.3, { tint: C.gold });
    keyIcon(g, 1410, 430, 0.9, C.gold);
    text(g, sc.rightTitle, 1410, 880, { font: sans(36, 700), color: C.text, align: "center" });
  }, { dx: 60, dy: 0 });
};

// 1.5 — the big number.
S.stat = (g, sc, c, t) => {
  const k = c.k(0.05, "heavy");
  g.save(); g.translate(W / 2, 520); g.scale(lerp(0.85, 1, k) + c.local * 0.01, lerp(0.85, 1, k) + c.local * 0.01);
  text(g, sc.title, 0, 60, { font: sans(250, 800), color: C.gold, align: "center", alpha: k });
  g.restore();
  // Ring of shielded coins.
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * TAU + t * 0.08, r = 560;
    circle(g, W / 2 + Math.cos(a) * r, 520 + Math.sin(a) * r * 0.35, 9, "rgba(244,183,40,0.25)");
  }
  enter(g, c.k(0.5), () => text(g, sc.body, W / 2, 720, { font: sans(38, 500), color: C.textSecondary, align: "center" }), { dy: 20 });
};

// 2.0 — FROST: three key fragments orbit and lock into one signature.
S.frost = (g, sc, c, t) => {
  headline(g, sc.title, 112, 230, c, { size: 76, maxW: 1100 });
  enter(g, c.k(0.4), () => text(g, sc.body, 112, 310, { font: sans(32, 500), color: C.textSecondary }), { dy: 16 });
  const cx = 1340, cy = 600, merge = c.p(0.45, 0.8);
  circle(g, cx, cy, 230, null, "rgba(56,189,248,0.25)", 2);
  ["A", "B", "C"].forEach((s, i) => {
    const a = (i / 3) * TAU - Math.PI / 2 + t * 0.4 * (1 - merge);
    const r = lerp(230, 70, merge);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    circle(g, x, y, 46, C.elevated, C.info, 3);
    text(g, s, x, y + 12, { font: mono(34, 800), color: C.info, align: "center" });
  });
  if (merge > 0.9) enter(g, c.k(c.at(0.8), "snappy"), () => {
    glow(g, cx, cy, 200, rgb.info, 0.3);
    text(g, "σ", cx, cy + 30, { font: sans(90, 800), color: C.text, align: "center" });
    text(g, "one valid signature", cx, cy + 330, { font: mono(22, 700), color: C.info, align: "center" });
  });
};

// 2.1 — two clocks, two time zones, two laptops.
S.clocks = (g, sc, c) => {
  headline(g, sc.title, 112, 210, c, { size: 76 });
  const drawClock = (x, y, h, name, tint, k) => enter(g, k, () => {
    circle(g, x, y, 130, C.card, C.borderStrong, 4);
    for (let i = 0; i < 12; i += 1) { const a = (i / 12) * TAU; ln(g, x + Math.cos(a) * 112, y + Math.sin(a) * 112, x + Math.cos(a) * 124, y + Math.sin(a) * 124, C.textMuted, 3); }
    const ha = ((h % 12) / 12) * TAU - Math.PI / 2;
    ln(g, x, y, x + Math.cos(ha) * 70, y + Math.sin(ha) * 70, C.text, 9);
    ln(g, x, y, x, y - 100, C.textSecondary, 5);
    circle(g, x, y, 10, tint);
    laptop(g, x, y + 330, 0.9, { glowColor: tint === C.gold ? rgb.gold : rgb.info });
    text(g, name, x, y + 400, { font: sans(32, 700), color: C.text, align: "center" });
    text(g, `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? "PM" : "AM"} · approves`, x, y + 440, { font: mono(18, 700), color: tint, align: "center" });
  }, { dy: 40 });
  drawClock(560, 450, 9, "Signer one", C.gold, c.k(0.25));
  drawClock(1360, 450, 16, "Signer two", C.info, c.k(0.55));
  const gap = c.p(0.4, 0.8);
  flow(g, 720, 450, 720 + 480 * gap, 450, c.local, { color: C.textMuted, packet: false });
  text(g, "+ 7 hours", 960, 420, { font: mono(24, 700), color: C.textMuted, align: "center", alpha: gap });
};

// 2.2 — the anchor ages: a block-height ticker races past it.
S.stale = (g, sc, c, t) => {
  headline(g, sc.title, 112, 210, c, { size: 76, accent: ["stale."] });
  const age = c.p(0.15, 0.85);
  for (let i = 0; i < 10; i += 1) {
    const x = 220 + i * 160 - age * 480;
    if (x < 80 || x > 1840) continue;
    block(g, x, 560, 1, { label: `#${4383000 + i * 12}` });
    if (i < 9) ln(g, x + 48, 560, x + 112, 560, C.border, 3);
  }
  // The pinned anchor stays put while the chain moves on.
  const ax = 380;
  g.save(); g.globalAlpha = 1;
  ln(g, ax, 640, ax, 760, age > 0.5 ? C.danger : C.gold, 4);
  box(g, ax - 160, 760, 320, 90, { r: 12, fill: C.card, stroke: age > 0.5 ? C.danger : C.gold });
  text(g, "anchor (fixed at build)", ax, 815, { font: mono(19, 700), color: age > 0.5 ? C.danger : C.gold, align: "center" });
  g.restore();
  text(g, `${Math.round(age * 340)} blocks behind`, 1500, 820, { font: mono(30, 700), color: C.danger, align: "center", alpha: age });
};

// 2.3 — collected signatures shatter into the bin.
S.discard = (g, sc, c) => {
  headline(g, sc.title, 112, 210, c, { size: 76, accent: ["thrown", "away."] });
  const fall = c.p(0.3, 0.75);
  ["Alice ✓", "Bob ✓"].forEach((s, i) => {
    const x = 640 + i * 360, y = lerp(480, 820, Math.pow(fall, 2)) + i * 20;
    g.save(); g.translate(x, y); g.rotate(fall * (i ? 0.5 : -0.4)); g.globalAlpha = 1 - fall * 0.6;
    box(g, -150, -60, 300, 120, { r: 14, fill: C.elevated, stroke: C.success });
    text(g, s, 0, 12, { font: mono(30, 700), color: C.success, align: "center" });
    g.restore();
  });
  // Bin.
  g.beginPath(); g.moveTo(1380, 700); g.lineTo(1660, 700); g.lineTo(1620, 940); g.lineTo(1420, 940); g.closePath();
  g.fillStyle = C.elevated; g.fill(); g.strokeStyle = C.borderStrong; g.lineWidth = 3; g.stroke();
  ln(g, 1360, 690, 1680, 690, C.borderStrong, 8);
  enter(g, c.k(c.at(0.6), "snappy"), () => text(g, "REBUILD → SIGN AGAIN", 1520, 640, { font: mono(22, 800), color: C.danger, align: "center", track: 1.5 }));
};

// 2.4 — v6 transaction anatomy: anchor moves from "build" to "authorizing data".
S.v6 = (g, sc, c) => {
  headline(g, sc.title, 112, 210, c, { size: 74, accent: ["authorizing", "data."] });
  const move = c.p(0.35, 0.75);
  enter(g, c.k(0.2), () => {
    box(g, 200, 330, 1520, 560, { r: 24, fill: C.card, stroke: C.border, shadow: true });
    text(g, "v6 TRANSACTION", 250, 395, { font: mono(18, 700), color: C.textMuted, track: 2 });
    box(g, 250, 430, 680, 410, { r: 16, fill: C.elevated, stroke: C.border });
    text(g, "EFFECTING DATA", 290, 485, { font: mono(18, 700), color: C.textSecondary, track: 2 });
    ["actions", "rk  (per action)", "value balance"].forEach((s, i) => text(g, s, 290, 560 + i * 60, { font: mono(24, 500), color: C.textSecondary }));
    box(g, 990, 430, 680, 410, { r: 16, fill: "rgba(244,183,40,0.05)", stroke: C.goldBorder });
    text(g, "AUTHORIZING DATA", 1030, 485, { font: mono(18, 700), color: C.gold, track: 2 });
    ["spend auth signatures", "proofs"].forEach((s, i) => text(g, s, 1030, 560 + i * 60, { font: mono(24, 500), color: C.textSecondary }));
  });
  const x = lerp(470, 1210, move), y = lerp(760, 740, move);
  box(g, x - 140, y - 38, 280, 76, { r: 12, fill: C.gold, stroke: null, shadow: true });
  text(g, "anchor", x, y + 10, { font: mono(28, 800), color: C.bg, align: "center" });
};

// 2.5 — reordered timeline: anchor last.
S.order = (g, sc, c) => {
  headline(g, sc.title, 112, 210, c, { size: 70, maxW: 1700 });
  const y = 600; ln(g, 200, y, 1720, y, C.border, 4);
  sc.steps.forEach((s, i) => enter(g, c.k(0.3 + i * 0.28, "snappy"), () => {
    const x = 300 + i * 440, col = i === 2 ? C.gold : i === 3 ? C.success : C.info;
    circle(g, x, y, 34, col);
    text(g, String(i + 1), x, y + 11, { font: mono(28, 800), color: C.bg, align: "center" });
    text(g, s, x, y + 90, { font: sans(32, 700), color: i === 2 ? C.gold : C.text, align: "center" });
    text(g, ["09:00", "16:00", "at broadcast", "mined"][i], x, y - 60, { font: mono(20, 700), color: C.textMuted, align: "center" });
  }, { dy: 30 }));
};

// 2.6 — "now": calendar flip 2025 → 2026 with a lit vault.
S.whynow = (g, sc, c, t) => {
  const k = c.k(0.1, "heavy");
  glow(g, W / 2, 520, 600, rgb.gold, 0.2 * k);
  padlock(g, W / 2, 470, 3.2 * k + 0.001, C.gold);
  headline(g, sc.title, W / 2, 780, c, { size: 84, align: "center", accent: ["now."], delay: 0.3 });
  enter(g, c.k(0.8), () => text(g, "and not a year ago", W / 2, 850, { font: mono(24, 700), color: C.textMuted, align: "center", track: 2 }));
};

// 3.0 — three terminals, the real ceremony script output.
S.processes = (g, sc, c) => {
  headline(g, sc.title, 112, 200, c, { size: 72, maxW: 1700, accent: ["One", "share"] });
  const who = [["Alice", "alice", 1, 76968, C.gold], ["Bob", "bob", 2, 76974, C.info], ["Carol", "carol", 3, 76979, C.violet]];
  who.forEach(([name, dir, n, pid, col], i) => enter(g, c.k(0.25 + i * 0.18), () => {
    const x = 112 + i * 580;
    terminal(g, x, 300, 540, 380, [
      [`quorum-dkgd · ${name}`, col],
      `pid ${pid}`,
      "round 1 → commitments",
      "round 2 → sealed packages",
      "confirm → group key ✓",
      [`✓ ceremony complete — ${name}`, C.success],
    ], c, { title: "TERMINAL", from: 0.4 + i * 0.15, per: 0.2, size: 21 });
    shareChip(g, x + 270, 790, 1.15, `${dir}/share-${n}.bin`, { color: col });
  }, { dy: 50 }));
};

// 3.1 — Noise_K envelopes travel the frostd relay, each to one name.
S.network = (g, sc, c, t) => {
  headline(g, sc.title, 112, 200, c, { size: 76, accent: ["one", "named", "recipient."] });
  const relay = [960, 600];
  enter(g, c.k(0.15), () => {
    box(g, relay[0] - 150, relay[1] - 70, 300, 140, { r: 20, fill: C.elevated, stroke: C.borderStrong, shadow: true });
    text(g, "frostd", relay[0], relay[1] - 6, { font: mono(32, 800), color: C.text, align: "center" });
    text(g, "relays sealed bytes,", relay[0], relay[1] + 30, { font: mono(15, 600), color: C.textMuted, align: "center" });
    text(g, "reads none of them", relay[0], relay[1] + 50, { font: mono(15, 600), color: C.textMuted, align: "center" });
  });
  const nodes = [["Alice", 300, 420, C.gold], ["Bob", 1620, 420, C.info], ["Carol", 960, 960, C.violet]];
  nodes.forEach(([n, x, y, col], i) => enter(g, c.k(0.3 + i * 0.12), () => {
    person(g, x, y, 0.9, { tint: col, name: n });
    ln(g, x, y, relay[0], relay[1], C.border, 2, [6, 10]);
  }));
  // Envelopes in flight, each addressed.
  const routes = [[0, 1], [1, 2], [2, 0], [0, 2], [1, 0], [2, 1]];
  routes.forEach(([a, b], i) => {
    const f = ((c.local - 0.6 - i * 0.25) * 0.45) % 1;
    if (c.local < 0.6 + i * 0.25) return;
    const [, ax, ay] = nodes[a], [, bx, by] = nodes[b];
    const [mx, my] = f < 0.5 ? [lerp(ax, relay[0], f * 2), lerp(ay, relay[1], f * 2)] : [lerp(relay[0], bx, (f - 0.5) * 2), lerp(relay[1], by, (f - 0.5) * 2)];
    envelope(g, mx, my, 0.55, { to: nodes[b][0], color: nodes[b][3] });
  });
  enter(g, c.k(1.2), () => text(g, "Noise_K_25519_ChaChaPoly_BLAKE2s", 1820, 1000 - 70, { font: mono(18, 700), color: C.textMuted, align: "right" }));
};

// 3.2 — the full key as a ghost outline nobody ever fills.
S.nobody = (g, sc, c, t) => {
  headline(g, sc.title, 112, 200, c, { size: 76, accent: ["Including", "us."] });
  const cx = W / 2, cy = 590;
  g.save(); g.setLineDash([14, 12]); g.lineDashOffset = -c.local * 30;
  keyIcon(g, cx, cy, 3.4, "rgba(248,250,252,0.16)");
  g.restore();
  text(g, "full spending key — never assembled", cx, cy + 210, { font: mono(22, 700), color: C.textMuted, align: "center" });
  [["Alice", 360, C.gold], ["Bob", 960, C.info], ["Carol", 1560, C.violet]].forEach(([n, x, col], i) => enter(g, c.k(0.4 + i * 0.12), () => {
    shareChip(g, x, 900, 1, `${n} · 1 of 3`, { color: col });
  }, { dy: 30 }));
  enter(g, c.k(0.9), () => {
    box(g, 1460, 300, 330, 100, { r: 14, fill: C.card, stroke: C.border });
    text(g, "quorum-coordinatord", 1625, 342, { font: mono(18, 700), color: C.textSecondary, align: "center" });
    text(g, "holds no key material", 1625, 374, { font: mono(18, 700), color: C.success, align: "center" });
  }, { dx: 30, dy: 0 });
};

// 3.3 — the claim, set big; two time lanes both green.
S.claim = (g, sc, c) => {
  const k = c.k(0.05, "heavy");
  headline(g, "Not while signing.", 112, 430, c, { size: 110, color: C.text });
  headline(g, "Not while it was being created.", 112, 580, c, { size: 110, color: C.gold, delay: 0.35 });
  enter(g, c.k(0.9), () => {
    text(g, "no process ever held more than one share", 112, 700, { font: mono(26, 700), color: C.textSecondary });
  }, { dy: 14 });
};

// 4.0 — terminal, not a web button: signerd's prompt.
S.prompt = (g, sc, c) => {
  headline(g, sc.title, 112, 190, c, { size: 70, accent: ["web", "page."] });
  enter(g, c.k(0.2), () => {
    // A web button, crossed out, small and to the side.
    box(g, 1440, 280, 300, 90, { r: 45, fill: C.gold, stroke: null });
    text(g, "Approve", 1590, 338, { font: sans(32, 800), color: C.bg, align: "center" });
  }, { dx: 40, dy: 0 });
  if (c.local > 0.6) cross(g, 1590, 325, 70 * c.k(0.6, "snappy"), C.danger, 10);
  enter(g, c.k(0.35), () => terminal(g, 112, 300, 1240, 600, [
    ["quorum-signerd · Alice", C.gold],
    "",
    ["APPROVAL REQUEST  99b6bf69-…", C.text],
    "  vault    ceremony",
    "  sighash  613a0b41f944e109…",
  ], c, { title: "ALICE'S MACHINE", from: 0.5, per: 0.16, size: 26 }), { dy: 50 });
};

// 4.1 — checks ticking, as signerd runs them.
S.checks = (g, sc, c) => {
  headline(g, sc.title, 112, 190, c, { size: 70, maxW: 1700, accent: ["itself."] });
  const rows = [
    ["rk = ak.randomize(alpha)", "spends from this vault"],
    ["sighash recomputed from PCZT", "digest is this transaction's own"],
    ["alpha read per action", "randomizer from the transaction"],
  ];
  rows.forEach(([a, b], i) => enter(g, c.k(0.3 + i * 0.35, "default"), () => {
    const y = 330 + i * 190;
    box(g, 112, y, 1696, 150, { r: 20, fill: C.card, stroke: C.border, shadow: true });
    circle(g, 200, y + 75, 40, "rgba(16,185,129,0.15)", C.success, 3);
    check(g, 200, y + 77, 18, C.success, 7, c.k(0.55 + i * 0.35, "default"));
    text(g, a, 280, y + 68, { font: mono(30, 600), color: C.text });
    text(g, b, 280, y + 112, { font: sans(24, 500), color: C.textSecondary });
  }, { dx: -40, dy: 0 }));
};

// 4.2 — the two columns, verbatim from signerd.
S.columns = (g, sc, c) => {
  headline(g, sc.title, 112, 190, c, { size: 68, maxW: 1700, accent: ["prove,", "told."] });
  enter(g, c.k(0.25), () => {
    box(g, 112, 290, 830, 560, { r: 20, fill: "rgba(16,185,129,0.06)", stroke: C.success, shadow: true });
    text(g, "FROM THE TRANSACTION", 160, 360, { font: mono(22, 800), color: C.success, track: 1.5 });
    text(g, "verified against your own share", 160, 398, { font: mono(18, 600), color: C.textMuted });
    ["spend   Ironwood action 0", "        — spends from this vault", "output  Ironwood action 0", "        0.08990000 TAZ", "output  Ironwood action 1", "        0.01000000 TAZ"].forEach((s, i) =>
      text(g, s, 160, 470 + i * 56, { font: mono(24, 500), color: C.text }));
  }, { dx: -40, dy: 0 });
  enter(g, c.k(0.55), () => {
    box(g, 978, 290, 830, 560, { r: 20, fill: "rgba(245,158,11,0.05)", stroke: C.warning, shadow: true });
    text(g, "CLAIMED BY THE PROPOSER", 1026, 360, { font: mono(22, 800), color: C.warning, track: 1.5 });
    text(g, "not verified, and not verifiable here", 1026, 398, { font: mono(18, 600), color: C.textMuted });
    ["to       <this vault's address>", "amount   0.01000000 TAZ"].forEach((s, i) => text(g, s, 1026, 470 + i * 56, { font: mono(24, 500), color: C.text }));
    enter(g, c.k(1.0, "snappy"), () => text(g, "Approve and sign? [y/N]  y", 1026, 800, { font: mono(26, 700), color: C.gold }));
  }, { dx: 40, dy: 0 });
};

// 4.3 — cast: Alice (human), Bob (scripted, robot badge), Carol (offline).
S.cast = (g, sc, c) => {
  headline(g, sc.title, 112, 190, c, { size: 66, maxW: 1700 });
  const cast = [
    ["Alice", C.gold, "APPROVED", C.success, "by hand", false],
    ["Bob", C.info, "AUTO-APPROVE", C.warning, "scripted for timing", false],
    ["Carol", C.violet, "OFFLINE", C.textMuted, "laptop closed", true],
  ];
  cast.forEach(([n, tint, st, stc, note, off], i) => enter(g, c.k(0.25 + i * 0.22), () => {
    const x = 380 + i * 580;
    box(g, x - 250, 290, 500, 620, { r: 24, fill: C.card, stroke: off ? C.border : tint, shadow: true });
    person(g, x, 560, 1.4, { tint, dim: off, name: n, sub: PEOPLE[n].role });
    laptop(g, x, 830, 0.7, { on: !off, glowColor: off ? null : rgb.gold });
    pill(g, x - 140, 320, st, stc, { w: 280, size: 17 });
    text(g, note, x, 890, { font: mono(17, 600), color: C.textMuted, align: "center" });
  }, { dy: 50 }));
};

// 4.4 — quorum ring fills 2/2; tx confirms with real txid + block.
S.quorum = (g, sc, c) => {
  headline(g, sc.title, 112, 190, c, { size: 76, accent: ["threshold."] });
  const cx = 440, cy = 580, fill = c.p(0.1, 0.45);
  arc(g, cx, cy, 190, 0, TAU, C.elevated, 26);
  arc(g, cx, cy, 190, -Math.PI / 2, -Math.PI / 2 + TAU * fill, C.success, 26);
  text(g, fill > 0.5 ? "2/2" : "1/2", cx, cy + 30, { font: mono(90, 800), color: C.text, align: "center" });
  text(g, fill > 0.98 ? "QUORUM MET" : "SIGNATURES", cx, cy + 90, { font: mono(22, 800), color: fill > 0.98 ? C.success : C.warning, align: "center", track: 2 });
  text(g, "Carol · never needed", cx, cy + 290, { font: mono(20, 700), color: C.textMuted, align: "center" });
  enter(g, c.k(c.at(0.42)), () => {
    box(g, 820, 330, 990, 520, { r: 24, fill: C.card, stroke: C.success, shadow: true });
    text(g, "ZCASH TESTNET · IRONWOOD", 870, 395, { font: mono(18, 700), color: C.textMuted, track: 2 });
    pill(g, 1500, 360, "MINED", C.success, { w: 250, size: 17 });
    text(g, "txid", 870, 480, { font: mono(18, 700), color: C.gold });
    wrapLines(g, sc.txid, 900, mono(28, 500)).forEach((s, i) => text(g, s, 870, 530 + i * 44, { font: mono(28, 500), color: C.text }));
    text(g, "block", 870, 700, { font: mono(18, 700), color: C.textMuted });
    text(g, sc.block, 870, 760, { font: mono(54, 800), color: C.text });
    text(g, "2-of-3 threshold-signed · 25 Sep 2026", 870, 815, { font: mono(18, 600), color: C.textMuted });
  }, { dx: 60, dy: 0 });
};

// 5.0 — "malicious" villain silhouette fades; mundane icons remain.
S.malice = (g, sc, c) => {
  headline(g, sc.title, 112, 230, c, { size: 76, maxW: 1700, accent: ["malice."] });
  const fade = c.p(0.3, 0.7);
  g.save(); g.globalAlpha = 1 - fade * 0.85;
  person(g, W / 2, 700, 2.2, { tint: "#1f2937" });
  text(g, "the attacker", W / 2, 940, { font: mono(24, 700), color: C.textMuted, align: "center" });
  g.restore();
  cross(g, W / 2, 620, 160 * fade, "rgba(239,68,68,0.6)", 10);
};

// 5.1 — three mundane failures, as real coordinator states.
S.failures = (g, sc, c) => {
  headline(g, sc.title, 112, 200, c, { size: 76 });
  const cards = [
    ["A compromised device", "INVALID_SHARE", C.danger, "device"],
    ["A signer on a plane", "TIMEOUT", C.warning, "plane"],
    ["Something quietly broken", "ROUND_ABORTED", C.textSecondary, "gear"],
  ];
  cards.forEach(([s, code, col, icon], i) => enter(g, c.k(0.25 + i * 0.3), () => {
    const x = 112 + i * 580;
    box(g, x, 300, 540, 560, { r: 24, fill: C.card, stroke: col, shadow: true });
    const ix = x + 270, iy = 520;
    if (icon === "device") { laptop(g, ix, iy + 60, 1, { glowColor: rgb.danger }); cross(g, ix, iy - 20, 30, C.danger, 8); }
    if (icon === "plane") {
      g.save(); g.translate(ix, iy); g.rotate(-0.3 + Math.sin(c.local) * 0.05);
      g.beginPath(); g.moveTo(-110, 0); g.lineTo(110, 0); g.lineTo(130, -10); g.lineTo(110, -20); g.lineTo(-60, -20);
      g.closePath(); g.fillStyle = C.warning; g.fill();
      g.beginPath(); g.moveTo(-10, -10); g.lineTo(-60, -90); g.lineTo(-20, -90); g.lineTo(50, -10); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-10, -10); g.lineTo(-60, 70); g.lineTo(-20, 70); g.lineTo(50, -10); g.closePath(); g.fill();
      g.restore();
    }
    if (icon === "gear") {
      g.save(); g.translate(ix, iy); g.rotate(c.local * 0.3);
      for (let k = 0; k < 8; k += 1) { g.rotate(TAU / 8); g.fillStyle = C.textSecondary; g.fillRect(-14, -96, 28, 30); }
      circle(g, 0, 0, 72, null, C.textSecondary, 22); g.restore();
    }
    text(g, s, x + 270, 740, { font: sans(30, 700), color: C.text, align: "center" });
    text(g, code, x + 270, 800, { font: mono(22, 800), color: col, align: "center", track: 1.5 });
  }, { dy: 60 }));
};

// 5.2 — a raw Rust panic, red, unreadable to a treasurer.
S.panic = (g, sc, c) => {
  headline(g, sc.title, 112, 190, c, { size: 70, maxW: 1700, accent: ["panic"] });
  enter(g, c.k(0.2), () => terminal(g, 112, 270, 1100, 600, [
    ["thread 'main' panicked at", C.danger],
    ["  quorum-coordinator/src/round.rs:214:", C.danger],
    ["  called `Result::unwrap()` on an `Err` value:", C.danger],
    ["  InvalidSignatureShare { culprits: [", C.danger],
    ["    Identifier(0x02…) ] }", C.danger],
    "note: run with `RUST_BACKTRACE=1`",
  ], c, { title: "WHAT A TREASURER WOULD SEE · ILLUSTRATIVE", from: 0.35, per: 0.12, size: 23 }), { dy: 40 });
  enter(g, c.k(0.8), () => {
    person(g, 1530, 680, 1.5, { tint: C.gold, name: "Treasurer" });
    text(g, "?", 1530, 470, { font: sans(140, 800), color: C.danger, align: "center" });
  }, { dx: 40, dy: 0 });
};

// 5.3 — the real coordinator alert, as the web UI renders it.
S.alert = (g, sc, c) => {
  headline(g, sc.title, 112, 180, c, { size: 64, maxW: 1700, accent: ["next."] });
  enter(g, c.k(0.2), () => {
    box(g, 112, 260, 1696, 640, { r: 24, fill: "rgba(239,68,68,0.06)", stroke: C.danger, shadow: true });
    pill(g, 160, 300, "SHARE REJECTED", C.danger, { w: 300, size: 17 });
    text(g, "Signature share rejected — Bob.", 160, 450, { font: sans(52, 800), color: C.text });
  });
  const lines = [
    ["What went wrong", "The share does not verify against the commitment made in round 1.", C.danger],
    ["What it cost", "This vault has not been charged and no funds moved.", C.success],
    ["What to do next", "Re-run the round without this signer, or investigate the device.", C.gold],
  ];
  lines.forEach(([h, s, col], i) => enter(g, c.k(0.55 + i * 0.35), () => {
    const y = 540 + i * 110;
    g.fillStyle = col; g.fillRect(160, y - 36, 6, 70);
    text(g, h.toUpperCase(), 190, y - 8, { font: mono(17, 800), color: col, track: 1.5 });
    text(g, s, 190, y + 30, { font: sans(32, 600), color: C.text });
  }, { dx: -30, dy: 0 }));
};

// 6.0 — treasurer → funder: "where did the money go?"
S.funder = (g, sc, c) => {
  headline(g, sc.title, 112, 200, c, { size: 70, maxW: 1700 });
  enter(g, c.k(0.25), () => person(g, 460, 720, 1.7, { tint: C.gold, name: "Organisation", sub: "2-OF-3 CONTROL" }));
  enter(g, c.k(0.45), () => person(g, 1460, 720, 1.7, { tint: C.success, name: "Grant funder", sub: "WANTS PROOF" }));
  enter(g, c.k(0.7, "snappy"), () => {
    box(g, 1100, 300, 520, 140, { r: 28, fill: C.elevated, stroke: C.borderStrong, shadow: true });
    g.beginPath(); g.moveTo(1380, 440); g.lineTo(1420, 500); g.lineTo(1440, 440); g.closePath(); g.fillStyle = C.elevated; g.fill();
    text(g, "Where did the money go?", 1360, 385, { font: sans(36, 700), color: C.text, align: "center" });
  }, { dy: 20 });
};

// 6.1 — a DB row being edited live.
S.forge = (g, sc, c) => {
  headline(g, sc.title, 112, 200, c, { size: 76, accent: ["forge"] });
  enter(g, c.k(0.2), () => {
    box(g, 160, 300, 1600, 560, { r: 20, fill: C.card, stroke: C.border, shadow: true });
    text(g, "SignatureRoundEvent", 210, 360, { font: mono(22, 700), color: C.textMuted });
    ["participant", "roundType", "status"].forEach((h, i) => text(g, h, 210 + i * 500, 430, { font: mono(20, 700), color: C.textMuted }));
    ln(g, 210, 450, 1710, 450, C.border, 2);
    const rows = [["Alice", "SIGNATURE_SHARE", "RECEIVED"], ["Bob", "SIGNATURE_SHARE", "INVALID"], ["Carol", "COMMITMENT", "TIMEOUT"]];
    rows.forEach((r, i) => r.forEach((s, j) => {
      const edited = i === 1 && j === 2;
      const shown = edited && c.local > c.at(0.5) ? "RECEIVED" : s;
      text(g, shown, 210 + j * 500, 520 + i * 90, { font: mono(26, 600), color: edited && c.local > c.at(0.5) ? C.warning : C.text });
    }));
  });
  if (c.local > c.at(0.4)) {
    const k = c.k(c.at(0.4), "snappy");
    box(g, 1150 - 20, 572, 380, 70, { r: 8, fill: "rgba(245,158,11,0.10)", stroke: C.warning });
    text(g, "UPDATE … SET status", 1320, 690, { font: mono(18, 700), color: C.warning, align: "center", alpha: k });
  }
};

// 6.2 — UFVK derivation: ak (FROST) + nk, rivk (VaultSeed).
S.vkey = (g, sc, c) => {
  headline(g, sc.title, 112, 200, c, { size: 74, accent: ["viewing", "key."] });
  const parts = [["ak", "from FROST", C.info, 360], ["nk", "from VaultSeed", C.violet, 760], ["rivk", "from VaultSeed", C.violet, 1160]];
  parts.forEach(([s, from, col, x], i) => enter(g, c.k(0.2 + i * 0.12), () => {
    box(g, x - 160, 330, 320, 170, { r: 20, fill: C.card, stroke: col, shadow: true });
    text(g, s, x, 420, { font: mono(56, 800), color: col, align: "center" });
    text(g, from, x, 470, { font: mono(18, 600), color: C.textMuted, align: "center" });
    ln(g, x, 500, 960, 680, col, 3);
  }, { dy: 30 }));
  enter(g, c.k(0.7), () => {
    box(g, 460, 680, 1000, 160, { r: 20, fill: "rgba(244,183,40,0.07)", stroke: C.gold, shadow: true });
    text(g, "uviewtest1…", 960, 760, { font: mono(48, 700), color: C.gold, align: "center" });
    text(g, "unified full viewing key · reads, never spends", 960, 805, { font: mono(18, 600), color: C.textMuted, align: "center" });
  }, { dy: 30 });
};

// 6.3 — the key slides across the table to the funder.
S.handoff = (g, sc, c) => {
  headline(g, sc.title, 112, 200, c, { size: 76, accent: ["viewing", "key."] });
  person(g, 360, 780, 1.4, { tint: C.gold, name: "Organisation" });
  person(g, 1560, 780, 1.4, { tint: C.success, name: "Grant funder" });
  const slide = c.p(0.2, 0.65);
  const x = lerp(520, 1380, slide);
  keyIcon(g, x, 600, 1.1, C.gold, slide * 0.4);
  text(g, "UFVK", x, 680, { font: mono(22, 800), color: C.gold, align: "center" });
  enter(g, c.k(c.at(0.65)), () => {
    box(g, 1260, 340, 520, 130, { r: 20, fill: C.card, stroke: C.success });
    text(g, "can read history", 1300, 395, { font: mono(22, 700), color: C.success });
    text(g, "cannot spend", 1300, 440, { font: mono(22, 700), color: C.textSecondary });
  }, { dy: 20 });
};

// 6.4 — export ↔ chain reconciliation.
S.chain = (g, sc, c, t) => {
  headline(g, sc.title, 112, 200, c, { size: 76, accent: ["chain"] });
  enter(g, c.k(0.2), () => {
    box(g, 112, 300, 700, 560, { r: 20, fill: C.card, stroke: C.border, shadow: true });
    text(g, "EVENT LOG · OURS", 160, 365, { font: mono(18, 800), color: C.textMuted, track: 2 });
    ["approval  APPROVED", "Alice  SIGNATURE_SHARE", "Bob    SIGNATURE_SHARE", "BROADCASTED"].forEach((s, i) => text(g, s, 160, 450 + i * 70, { font: mono(24, 500), color: C.text }));
  }, { dx: -40, dy: 0 });
  for (let i = 0; i < 5; i += 1) enter(g, c.k(0.35 + i * 0.08), () => {
    const x = 1070 + i * 170;
    block(g, x, 580, 1, { label: i === 2 ? "4,390,493" : null, color: i === 2 ? C.success : C.borderStrong });
    if (i < 4) ln(g, x + 48, 580, x + 122, 580, C.border, 3);
  });
  text(g, "ZCASH TESTNET · THEIRS", 1410, 365, { font: mono(18, 800), color: C.textMuted, track: 2, align: "center" });
  const k = c.p(0.5, 0.85);
  flow(g, 812, 580, 1022, 580, c.local, { color: C.success, packet: k > 0 });
  if (k > 0.95) text(g, "reconciled with the viewing key", 960, 920, { font: mono(24, 700), color: C.success, align: "center" });
};

// 6.5 — two views of one vault: public (blank) vs. funder (readable).
S.product = (g, sc, c) => {
  headline(g, sc.title, W / 2, 210, c, { size: 84, align: "center", accent: ["Provable"] });
  const view = (x, title, readable, col, k) => enter(g, k, () => {
    box(g, x, 320, 760, 560, { r: 24, fill: C.card, stroke: col, shadow: true });
    text(g, title, x + 50, 390, { font: mono(20, 800), color: col, track: 2 });
    for (let i = 0; i < 4; i += 1) {
      const y = 470 + i * 90;
      if (readable) text(g, ["spend  0.01000000 TAZ", "change 0.08990000 TAZ", "block  4,390,493", "2-of-3 approved"][i], x + 50, y, { font: mono(26, 500), color: C.text });
      else { g.fillStyle = "rgba(255,255,255,0.06)"; rr(g, x + 50, y - 26, 560 - i * 60, 32, 8); g.fill(); }
    }
  }, { dy: 40 });
  view(160, "THE PUBLIC", false, C.border, c.k(0.25));
  view(1000, "THE FUNDER · WITH VIEWING KEY", true, C.success, c.k(0.5));
};

// 7.0 — a candid beat: just type.
S.review = (g, sc, c) => {
  headline(g, sc.title, 112, 520, c, { size: 110, maxW: 1700 });
  enter(g, c.k(0.4), () => { g.fillStyle = C.gold; g.fillRect(112, 580, 220, 6); });
};

// 7.1 — status board.
S.limits = (g, sc, c) => {
  headline(g, sc.title, 112, 200, c, { size: 70, maxW: 1700 });
  const rows = [
    ["frost-core", "audited", C.success],
    ["rerandomized FROST", "not covered by that audit", C.warning],
    ["ZIP-312", "still a draft", C.warning],
    ["network", "testnet only", C.info],
  ];
  rows.forEach(([a, b, col], i) => enter(g, c.k(0.25 + i * 0.25, "default"), () => {
    const y = 300 + i * 150;
    box(g, 112, y, 1696, 120, { r: 18, fill: C.card, stroke: C.border });
    circle(g, 180, y + 60, 12, col);
    text(g, a, 220, y + 72, { font: mono(32, 700), color: C.text });
    text(g, b, 1760, y + 72, { font: sans(32, 600), color: col, align: "right" });
  }, { dx: -40, dy: 0 }));
};

// 7.2 — credit: the Zcash Foundation's stack, Quorum on top.
S.credit = (g, sc, c) => {
  headline(g, sc.title, 112, 200, c, { size: 76 });
  const stack = [["Zcash protocol · Ironwood", C.textSecondary], ["FROST · frost-core · reddsa", C.info], ["frostd relay", C.info]];
  stack.forEach(([s, col], i) => enter(g, c.k(0.25 + i * 0.18), () => {
    const y = 860 - i * 150;
    box(g, 360, y - 110, 1200, 120, { r: 18, fill: C.card, stroke: col });
    text(g, s, 960, y - 38, { font: mono(32, 700), color: C.text, align: "center" });
  }, { dy: 40 }));
  enter(g, c.k(0.9), () => text(g, "built by the Zcash Foundation and the Zcash community", 960, 920, { font: mono(20, 600), color: C.textMuted, align: "center" }));
};

// 7.3 — Quorum lands on top of that stack; lockup.
S.layer = (g, sc, c, t) => {
  const stack = [["Zcash protocol · Ironwood", C.textSecondary], ["FROST · frost-core · reddsa", C.info], ["frostd relay", C.info]];
  stack.forEach(([s, col], i) => {
    const y = 960 - i * 110;
    box(g, 460, y - 84, 1000, 90, { r: 16, fill: C.card, stroke: col });
    text(g, s, 960, y - 28, { font: mono(26, 700), color: C.textSecondary, align: "center" });
  });
  const drop = c.k(0.15, "default");
  const y = lerp(200, 600, drop);
  glow(g, 960, y, 500, rgb.gold, 0.18 * drop);
  box(g, 360, y - 70, 1200, 130, { r: 22, fill: "rgba(244,183,40,0.10)", stroke: C.gold, lw: 3, shadow: true });
  text(g, "Quorum", 960, y + 18, { font: sans(70, 800), color: C.gold, align: "center" });
  headline(g, sc.title, W / 2, 300, c, { size: 84, align: "center", delay: 0.5 });
  enter(g, c.k(1.0), () => text(g, "shared custody for Zcash shielded funds · testnet", W / 2, 370, { font: mono(22, 700), color: C.textMuted, align: "center", track: 1.5 }));
};

/* ───────────────────────── entry ───────────────────────── */

// Paint one scene at its local time. Camera: slow push-in + lateral drift.
export function paintScene(g, scene, local, t) {
  const dur = Math.max(0.001, scene.end - scene.start);
  const c = clock(local, dur);
  const draw = S[scene.kind];
  g.save();
  backdrop(g, scene.beat, t, local);
  const zoom = 1 + clamp(local / Math.max(dur, 3)) * 0.035;
  const drift = (hash(scene.at) - 0.5) * 40 * clamp(local / Math.max(dur, 3));
  g.translate(W / 2 + drift, H / 2); g.scale(zoom, zoom); g.translate(-W / 2, -H / 2);
  if (draw) draw(g, scene, c, t);
  else headline(g, scene.title, 112, 520, c, { size: 90 });
  g.restore();
}

export const KINDS = Object.keys(S);
