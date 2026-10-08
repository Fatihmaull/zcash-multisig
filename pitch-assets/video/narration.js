// Narration, verbatim from docs/07-demo-script.md beats 1–7 (quoted blocks only).
// Each string is one paragraph; a short pause separates paragraphs.
//
// Deliberately omitted: beat 7's optional "open question" paragraph. CLAUDE.md
// records that the question was answered on 21 Sep (unfavourably) and must not be
// described as open any more.
//
// Edit docs/07 first, then mirror the change here.
export const NARRATION = Object.freeze([
  {
    beat: 1,
    paragraphs: [
      "I come from GRC. I have watched organisations fail controls audits because 'the treasurer holds the seed phrase' is not a control — it's a key-person risk with a human wrapper. Zcash shielded funds currently have no way to express a control at all. There is no multisig opcode in the shielded pools. So an organisation either publishes every transaction on a transparent address, or one person holds everything. 4.89 million ZEC — about $5.8 billion — sits in shielded pools under exactly that constraint.",
    ],
  },
  {
    beat: 2,
    paragraphs: [
      "FROST threshold signatures for Zcash already exist and the Zcash Foundation has done that work. But threshold approval is slow by nature — signer one approves at nine, signer two opens their laptop at four. Under the old transaction format the anchor was fixed when the transaction was built, so it went stale across that gap, the transaction had to be rebuilt, and every signature already collected was thrown away.",
      "In the v6 format the anchor is authorizing data. It's chosen at broadcast, after signatures are collected. That's what makes a shielded multisig that real organisations can actually operate possible now, and not a year ago.",
    ],
  },
  {
    beat: 3,
    paragraphs: [
      "These are three separate processes. Each one generates exactly one share and never sends it anywhere — what crosses the network is encrypted to one named recipient. Nobody in this ceremony, including us, ever holds the full spending key. Not while signing, and not while it was being created.",
    ],
  },
  {
    beat: 4,
    paragraphs: [
      "Alice isn't clicking approve on a web page. Her machine read the transaction, checked it spends from her vault and that the digest she's being asked to sign is that transaction's own, and it's showing her what it can prove alongside what it's merely been told. Bob is scripted here for timing, and Carol is offline — in a real round each of them would see this.",
      "Carol was never needed — two was the threshold, and the round closed without her.",
    ],
  },
  {
    beat: 5,
    paragraphs: [
      "Shared control doesn't usually fail because someone is malicious. It fails because a device is compromised, or a signer is on a plane, or something is quietly broken. If the answer to any of those is a Rust panic in a terminal, a treasurer cannot use this. Knowing what went wrong, what it cost, and what to do next is the product.",
    ],
  },
  {
    beat: 6,
    paragraphs: [
      "The organisation that needs 2-of-3 control also has to prove to a grant funder where the money went. So the audit trail isn't our event log — anyone can forge a database table. It's derived from the vault's viewing key. Hand the funder the viewing key and they can verify this export themselves, against the chain, without trusting us at all.",
      "That's the product: shielded funds with provable disclosure to the people entitled to it.",
    ],
  },
  {
    beat: 7,
    paragraphs: [
      "To be clear about what this is: frost-core is audited, but rerandomized FROST is not covered by that audit and ZIP-312 is still a draft. This is testnet only. We didn't build the cryptography — the Zcash Foundation did. We built the layer that lets an organisation actually use it.",
    ],
  },
]);

// Pronunciation only: the words spoken are the script's words, rewritten where
// the TTS front end would otherwise misread them. Applied in order.
export const PRONUNCIATION = Object.freeze([
  [/\bGRC\b/g, "G R C"],
  [/\$5\.8 billion/g, "5.8 billion dollars"],
  [/\b4\.89 million ZEC\b/g, "4.89 million zec"],
  [/\bfrost-core\b/g, "frost core"],
  [/\bZIP-312\b/g, "zip three twelve"],
  [/\bv6\b/g, "v six"],
  [/\b2-of-3\b/g, "two of three"],
  [/'the treasurer holds the seed phrase'/g, "the treasurer holds the seed phrase"],
  [/ — /g, ", "],
]);
