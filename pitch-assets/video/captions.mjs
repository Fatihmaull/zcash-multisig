// Caption chunking and SRT output.
//
// A caption cue is the unit of speech synthesis: narrate.mjs speaks each cue as
// its own clip, so a cue's on-screen time is exactly when its words are heard.

// Kokoro degrades on utterances under ~10–20 tokens (VOICES.md), and a caption
// should be readable at a glance: merge short sentences, split long ones.
const MIN_WORDS = 7;
const MAX_CHARS = 120;

const words = (text) => text.split(/\s+/).filter(Boolean).length;

function splitLong(sentence) {
  if (sentence.length <= MAX_CHARS) return [sentence];
  // Break at the clause boundary nearest the middle: em dash, semicolon, comma.
  const middle = sentence.length / 2;
  let best = -1;
  for (const match of sentence.matchAll(/ — |; |, /g)) {
    if (best < 0 || Math.abs(match.index - middle) < Math.abs(best - middle)) best = match.index;
  }
  if (best < 0) return [sentence];
  const cut = sentence[best + 1] === "—" ? best + 2 : best + 1;
  return [...splitLong(sentence.slice(0, cut).trim()), ...splitLong(sentence.slice(cut).trim())];
}

/** Paragraph → caption-sized chunks, in reading order, text unchanged. */
export function chunkParagraph(paragraph) {
  // A sentence ends at . ! ? followed by whitespace and a new sentence — never
  // inside a number like 4.89 or $5.8.
  const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9'"‘“])/).map((s) => s.trim()).filter(Boolean);
  const pieces = sentences.flatMap(splitLong);
  const chunks = [];
  for (const piece of pieces) {
    const last = chunks.at(-1);
    if (last && (words(last) < MIN_WORDS || words(piece) < MIN_WORDS) && `${last} ${piece}`.length <= MAX_CHARS) {
      chunks[chunks.length - 1] = `${last} ${piece}`;
    } else chunks.push(piece);
  }
  // A short opener that could not merge backward goes forward if the result
  // stays near caption length: one caption, spoken in one breath.
  if (chunks.length > 1 && words(chunks[0]) < MIN_WORDS && `${chunks[0]} ${chunks[1]}`.length <= MAX_CHARS * 1.15) {
    chunks.splice(0, 2, `${chunks[0]} ${chunks[1]}`);
  }
  return chunks;
}

const srtTime = (seconds) => {
  const ms = Math.round(seconds * 1000);
  const pad = (value, size) => String(value).padStart(size, "0");
  return `${pad(Math.floor(ms / 3600000), 2)}:${pad(Math.floor(ms / 60000) % 60, 2)}:${pad(Math.floor(ms / 1000) % 60, 2)},${pad(ms % 1000, 3)}`;
};

/** cues: [{start, end, text}] → SRT text. */
export function toSrt(cues) {
  return cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text}\n`).join("\n");
}
