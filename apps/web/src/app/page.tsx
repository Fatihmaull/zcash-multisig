"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { 
  ArrowRight, 
  ChevronRight, 
  ShieldCheck, 
  KeyRound, 
  EyeOff, 
  Activity,
  Cpu,
  Lock,
  ChevronDown,
  type LucideIcon
} from "lucide-react";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { useSplashScreen } from "@/components/ui/SplashScreenProvider";
import { Button } from "@/components/ui/Button";

type FrameworkTab = "frost" | "ironwood" | "halo2" | "dkg" | "redpallas";
type ProtocolTab = "dkg" | "shielded" | "culprit" | "compliance";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<FrameworkTab>("frost");
  const [activeProtocolTab, setActiveProtocolTab] = useState<ProtocolTab>("dkg");
  const [totalSigners, setTotalSigners] = useState<number>(5);
  const [threshold, setThreshold] = useState<number>(3);
  const { triggerSplashNavigation } = useSplashScreen();

  // IntersectionObserver for scroll-reveal animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    const elements = document.querySelectorAll(".scroll-reveal, .scroll-reveal-scale");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const frameworkData: Record<
    FrameworkTab,
    {
      label: string;
      sublabel: string;
      codeSnippet: string;
      highlightLines: number[];
      livePreview: {
        badge: string;
        title: string;
        statLabel: string;
        statValue: string;
        description: string;
        details: { label: string; value: string }[];
        ctaText: string;
        ctaHref: string;
      };
    }
  > = {
    frost: {
      label: "FROST Core",
      sublabel: "Threshold Signing",
      codeSnippet: `---
// FROST Round-2 Aggregate Spend Signature
import { frost_redpallas } from "@quorum/crypto";
import { ironwoodVerifier } from "@zcash/nu6";

const round2Signature = await frost_redpallas.aggregateSignatures({
  message: transactionHash,
  signingPackage,
  signatureShares, // collected from t-of-n signers
});

// Single Schnorr spend auth indistinguishable from 1-sig
const isValid = ironwoodVerifier.verifySpendAuth(
  vaultPublicKey,
  round2Signature
);
---`,
      highlightLines: [4, 9],
      livePreview: {
        badge: "Indistinguishable On-Chain",
        title: "Aggregated Spend Auth",
        statLabel: "On-Chain Size",
        statValue: "64 Bytes",
        description:
          "Off-chain signature aggregation produces a single standard RedPallas signature. Observers cannot tell a 5-of-7 vault from a single-key address.",
        details: [
          { label: "Curve", value: "RedPallas" },
          { label: "Rounds", value: "2 Rounds" },
          { label: "Protocol", value: "IETF FROST v15" },
        ],
        ctaText: "Inspect FROST Specs",
        ctaHref: "#services",
      },
    },
    ironwood: {
      label: "Ironwood NU6.3",
      sublabel: "Shielded Pool",
      codeSnippet: `---
// Zcash NU6.3 Ironwood Action Builder
import { OrchardBundle, Action } from "librustzcash";
import { generateHalo2Proof } from "@zcash/halo2";

const orchardAction = new Action({
  nullifier: computeNullifier(secretSpendKey, position),
  outputCommitment: noteCommitment,
  ephemeralKey: generateRedJubjubEphemeral(),
});

// Broadcast zero-knowledge proof to Zcash Testnet node
const txId = await zcashNode.broadcastShieldedBundle({
  actions: [orchardAction],
  proof: generateHalo2Proof(),
});
---`,
      highlightLines: [3, 9],
      livePreview: {
        badge: "Post-NU6.3 Activated",
        title: "Ironwood Zero-Knowledge",
        statLabel: "Balance Privacy",
        statValue: "100% Shielded",
        description:
          "Assets reside entirely in the NU6.3 Ironwood pool. On-chain watchers only verify mathematical proofs, with no trace of source or destination addresses.",
        details: [
          { label: "Proof System", value: "Halo 2 (No Trusted Setup)" },
          { label: "Pool", value: "Orchard / Ironwood" },
          { label: "Consensus", value: "ZIP 224 / 2005" },
        ],
        ctaText: "Explore Shielded Custody",
        ctaHref: "#services",
      },
    },
    halo2: {
      label: "Halo 2 ZK",
      sublabel: "Recursive Proofs",
      codeSnippet: `---
// Halo 2 Recursive Zero-Knowledge Verification
import { PastaCurves, Circuit } from "@zcash/halo2-circuits";

const circuit = new SpendCircuit({
  valueCommitment: vaultValueCommitment,
  rootAnchor: nu6Anchor,
  spendingKeyPackage: frostGroupKey,
});

// Verification executes with zero trusted setup ceremony
const proofValid = circuit.synthesizeAndVerify({
  publicInputs: [nullifier, anchor, valueCommitment],
});
---`,
      highlightLines: [4, 8],
      livePreview: {
        badge: "Recursive Cryptography",
        title: "Zero-Knowledge Circuit",
        statLabel: "Setup Assumption",
        statValue: "0 Trusted Setup",
        description:
          "Halo 2 recursion eliminates toxic waste setups forever. Cryptographic soundness relies solely on standard discrete log assumptions over Pasta curves.",
        details: [
          { label: "Cycles", value: "Pallas / Vesta" },
          { label: "Verification", value: "< 10ms" },
          { label: "Soundness", value: "128-bit Security" },
        ],
        ctaText: "Read Cryptographic Proofs",
        ctaHref: "#about",
      },
    },
    dkg: {
      label: "Non-Custodial DKG",
      sublabel: "Client-Side Keys",
      codeSnippet: `---
// 2-Round Distributed Key Generation (Pedersen VSS)
import { DkgRound1, DkgRound2 } from "frost-redpallas";

// Local device computes secret polynomial coefficients
const participantState = DkgRound1.generateSecretPolynomial({
  maxSigners: 5,
  minThreshold: 3,
  secretKeyShare: clientSecureEntropy(),
});

// Broadcast public commitments; zero master key reconstructed
const { vaultGroupKey } = DkgRound2.finalize(participantState);
---`,
      highlightLines: [3, 9],
      livePreview: {
        badge: "Zero Server Keys",
        title: "Client-Side DKG Ceremony",
        statLabel: "Server Key Exposure",
        statValue: "0.00%",
        description:
          "Private key material is generated in isolation on client devices. Neither Quorum Fi servers nor network eavesdroppers ever reconstruct the spending key.",
        details: [
          { label: "Secret Sharing", value: "Pedersen VSS" },
          { label: "Dealer Trust", value: "None (Dealerless)" },
          { label: "Culprit Check", value: "F4 Misbehavior" },
        ],
        ctaText: "Launch Demo Ceremony",
        ctaHref: "/vaults/vault-demo-001/ceremony",
      },
    },
    redpallas: {
      label: "RedPallas Curve",
      sublabel: "Spend Authorization",
      codeSnippet: `---
// RedPallas Schnorr Spend Verification (ZIP 224)
import { SpendValidatingKey } from "@zcash/primitives";

// Derive unified group key from FROST verification package
const groupVK = SpendValidatingKey.fromGroupBytes(frostPublicKey);

// Matches consensus rules for Orchard shielded pool
const isAuthorized = groupVK.verifySpendAuthorization({
  spendAuthSig: aggregatedSignature,
  sighash: bip143StyleHash,
});
---`,
      highlightLines: [4, 7],
      livePreview: {
        badge: "Native Curve Support",
        title: "RedPallas Spend Key",
        statLabel: "Signature Algorithm",
        statValue: "RedDSA Schnorr",
        description:
          "Engineered directly on RedPallas over the Jubjub twisted Edwards embedding, guaranteeing full compliance with post-NU6.3 Zcash consensus.",
        details: [
          { label: "Curve Order", value: "r ≈ 2^254" },
          { label: "Specification", value: "ZIP 224" },
          { label: "Compatibility", value: "Zcash Orchard" },
        ],
        ctaText: "View Architecture Specs",
        ctaHref: "#about",
      },
    },
  };

  const protocolServices: Record<
    ProtocolTab,
    {
      title: string;
      curve: string;
      roundComplexity: string;
      securityProof: string;
      codeSnippet: string;
      description: string;
      badge: string;
      highlightLines: number[];
    }
  > = {
    dkg: {
      title: "Round-Based FROST DKG Ceremony",
      curve: "RedPallas (Orchard Curve, NU6.3)",
      roundComplexity: "2 Rounds (Pedersen VSS + Proof of Knowledge)",
      securityProof: "Zero dealer key reconstruction. UF-CMA secure under ROM.",
      highlightLines: [2, 8],
      codeSnippet: `// Step 1: Distributed Key Generation Round 1
let (kg_round1, package1) = frost_redpallas::keys::dkg::part1(
    identifier,
    max_signers, // n
    min_signers, // t
    &mut rng
)?;
// Broadcast package1 to all participants over authenticated channels`,
      description:
        "Every participant creates their own secret polynomial in isolation on local hardware. At no moment during generation or thereafter does any single entity or server possess the complete spend authorization key.",
      badge: "Non-Custodial",
    },
    shielded: {
      title: "NU6.3 Ironwood Shielded Pool Operations",
      curve: "Halo 2 Zero-Knowledge Proofs",
      roundComplexity: "Orchard Action Statements (ZIP 224)",
      securityProof: "Indistinguishable commitments over the action tree.",
      highlightLines: [2, 7],
      codeSnippet: `// Orchard Note Commitment & Action Spend
let spend_action = Action::build(
    vault_spend_authorizing_key,
    recipient_shielded_address,
    value_zatoshi,
    orchard_merkle_anchor
)?;`,
      description:
        "Spend proofs are constructed using recursive Halo 2 circuits. Sender identities, receiver destinations, and transaction balances remain 100% mathematically hidden from on-chain scanners.",
      badge: "Zero-Knowledge",
    },
    culprit: {
      title: "Deterministic Culprit Identification (F4)",
      curve: "Discrete Logarithm Verification",
      roundComplexity: "Instant / Zero Round Overhead",
      securityProof: "Strict polynomial consistency validation against commitment matrices.",
      highlightLines: [1, 5],
      codeSnippet: `// Automated Byzantine Culprit Check
let fault_analysis = frost_redpallas::verify_share_integrity(
    culprit_participant_id,
    claimed_share,
    commitment_matrix
);
if fault_analysis.is_corrupt() { abort_with_blame(culprit); }`,
      description:
        "If an adversarial signer submits an invalid or corrupted signature share, the orchestrator mathematically isolates the specific faulty participant immediately, preventing denial of service without exposing other key shares.",
      badge: "Byzantine Fault Tolerant",
    },
    compliance: {
      title: "UFVK Encrypted Audit & Governance Exports",
      curve: "ZIP-316 Unified Full Viewing Keys",
      roundComplexity: "Local Read-Only Extraction",
      securityProof: "Separation of viewing authority from spend authorization.",
      highlightLines: [1, 4],
      codeSnippet: `// Export Non-Spend Auditing Package
let ufvk = vault.export_unified_full_viewing_key();
let audit_report = ufvk.decrypt_incoming_transactions(
    start_block_height,
    end_block_height
);`,
      description:
        "Treasuries can selectively disclose transaction logs to auditors or tax authorities via Unified Full Viewing Keys (UFVK), maintaining institutional regulatory compliance without surrendering spending authority.",
      badge: "Auditable Privacy",
    },
  };

  const frameworkThemes: Record<
    FrameworkTab,
    {
      activeButton: string;
      activeText: string;
      hoverButton: string;
      codeBadge: string;
      codeHighlight: string;
      previewBadge: string;
      previewGlow: string;
    }
  > = {
    frost: {
      activeButton: "ring-2 ring-[#38BDF8] ring-offset-2 ring-offset-[#030712] bg-[#0E1B2A] text-[#38BDF8] shadow-[0_0_20px_rgba(56,189,248,0.35)]",
      activeText: "text-[#38BDF8]",
      hoverButton: "hover:border-[#38BDF8]/40 hover:text-[#38BDF8] hover:bg-[#38BDF8]/5",
      codeBadge: "bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/25",
      codeHighlight: "bg-[#0E1B2A]/90 text-[#BAE6FD] border-l-2 border-[#38BDF8]",
      previewBadge: "bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30",
      previewGlow: "shadow-[0_0_30px_rgba(56,189,248,0.08)]",
    },
    ironwood: {
      activeButton: "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#030712] bg-emerald-950/40 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]",
      activeText: "text-emerald-400",
      hoverButton: "hover:border-emerald-500/40 hover:text-emerald-300 hover:bg-emerald-500/5",
      codeBadge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25",
      codeHighlight: "bg-emerald-950/60 text-emerald-200 border-l-2 border-emerald-400",
      previewBadge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
      previewGlow: "shadow-[0_0_30px_rgba(16,185,129,0.08)]",
    },
    halo2: {
      activeButton: "ring-2 ring-purple-400 ring-offset-2 ring-offset-[#030712] bg-purple-950/40 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.35)]",
      activeText: "text-purple-400",
      hoverButton: "hover:border-purple-500/40 hover:text-purple-300 hover:bg-purple-500/5",
      codeBadge: "bg-purple-500/10 text-purple-400 border border-purple-500/25",
      codeHighlight: "bg-purple-950/60 text-purple-200 border-l-2 border-purple-400",
      previewBadge: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
      previewGlow: "shadow-[0_0_30px_rgba(168,85,247,0.08)]",
    },
    dkg: {
      activeButton: "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#030712] bg-amber-950/40 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.35)]",
      activeText: "text-amber-400",
      hoverButton: "hover:border-amber-500/40 hover:text-amber-300 hover:bg-amber-500/5",
      codeBadge: "bg-amber-500/10 text-amber-400 border border-amber-500/25",
      codeHighlight: "bg-amber-950/60 text-amber-200 border-l-2 border-amber-400",
      previewBadge: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
      previewGlow: "shadow-[0_0_30px_rgba(245,158,11,0.08)]",
    },
    redpallas: {
      activeButton: "ring-2 ring-rose-400 ring-offset-2 ring-offset-[#030712] bg-rose-950/40 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.35)]",
      activeText: "text-rose-400",
      hoverButton: "hover:border-rose-500/40 hover:text-rose-300 hover:bg-rose-500/5",
      codeBadge: "bg-rose-500/10 text-rose-400 border border-rose-500/25",
      codeHighlight: "bg-rose-950/60 text-rose-200 border-l-2 border-rose-400",
      previewBadge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      previewGlow: "shadow-[0_0_30px_rgba(244,63,94,0.08)]",
    },
  };

  const currentData = frameworkData[activeTab];
  const currentProtocol = protocolServices[activeProtocolTab];
  const currentTheme = frameworkThemes[activeTab];

  // Fault tolerance formula: f = n - t
  const faultTolerance = Math.max(0, totalSigners - threshold);
  const collusionSafety = threshold - 1;

  return (
    <LandingLayout activeTab="home" className="space-y-36 sm:space-y-48 py-8">
      {/* ── SECTION 1: HERO SECTION ────────────────────────────────────────── */}
      <section id="hero" className="scroll-mt-28 space-y-10 scroll-reveal revealed">
        {/* Top Header Group */}
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FF4575] font-heading">
              Maximum Privacy • Zero Compromise
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white font-heading leading-[1.05]">
            Zero Key Custody
          </h1>

          <p className="text-sm sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
            Quorum Fi coordinates threshold FROST co-signing natively over Zcash NU6.3 Ironwood. Keep your private key shares on your own hardware while benefiting from recursive zero-knowledge shielding.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="md"
              onClick={() => triggerSplashNavigation("/dashboard")}
              iconRight={<ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            >
              Deploy your shielded vault
            </Button>

            {/* Official Powered by Zcash badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs text-slate-300 shadow-md">
              <span className="text-[11px] text-slate-400">powered by</span>
              <div className="relative w-4 h-4 shrink-0">
                <Image
                  src="/zcash-logo-yellow.png"
                  alt="Zcash Yellow Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-bold text-[#F4B728] font-heading tracking-wide">Zcash NU6.3</span>
            </div>
          </div>
        </div>

        {/* Circular Framework Selector Buttons */}
        <div className="flex items-center gap-4 sm:gap-6 pt-2 pb-3 overflow-x-auto select-none no-scrollbar">
          {(
            [
              { id: "frost", label: "FROST", icon: KeyRound },
              { id: "ironwood", label: "Ironwood", icon: ShieldCheck },
              { id: "halo2", label: "Halo 2", icon: EyeOff },
              { id: "dkg", label: "DKG", icon: Cpu },
              { id: "redpallas", label: "RedPallas", icon: Activity },
            ] as { id: FrameworkTab; label: string; icon: LucideIcon }[]
          ).map((item) => {
            const isSelected = activeTab === item.id;
            const theme = frameworkThemes[item.id];
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="flex flex-col items-center gap-2.5 p-1 group cursor-pointer shrink-0 focus:outline-none"
              >
                <div
                  className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isSelected
                      ? theme.activeButton
                      : `bg-[#10141D] text-slate-400 border border-white/10 ${theme.hoverButton}`
                  }`}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                </div>
                <span
                  className={`text-xs font-heading font-semibold transition-colors ${
                    isSelected ? theme.activeText : "text-slate-400 group-hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Two-Column Interactive Code Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 items-stretch">
          {/* Left Column: Code Window */}
          <div className="lg:col-span-7 rounded-3xl bg-[#090D16] border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col justify-between font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-slate-300">
                  src/multisig/{activeTab}.ts
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${currentTheme.codeBadge}`}>
                {currentData.label}
              </span>
            </div>

            {/* Code Body */}
            <div className="py-4 overflow-x-auto text-[11px] leading-relaxed">
              <pre className="text-slate-300 select-text font-mono">
                {currentData.codeSnippet.split("\n").map((line, idx) => {
                  const isHighlighted = currentData.highlightLines.includes(idx);
                  return (
                    <div
                      key={idx}
                      className={`px-3 py-0.5 rounded ${
                        isHighlighted
                          ? currentTheme.codeHighlight
                          : "text-slate-300"
                      }`}
                    >
                      {line}
                    </div>
                  );
                })}
              </pre>
            </div>

            {/* Code Footer specs */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span>Status: Verified Rust / TypeScript Bridge</span>
              <span className="text-emerald-400 font-semibold font-mono">NU6.3 COMPLIANT</span>
            </div>
          </div>

          {/* Right Column: Interactive Browser App Mockup */}
          <div className={`lg:col-span-5 rounded-3xl bg-[#080B12] border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col justify-between space-y-4 transition-shadow duration-300 ${currentTheme.previewGlow}`}>
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                <span className="w-2 h-2 rounded-full bg-slate-600" />
              </div>
              <span className="text-[10px] font-mono text-slate-500">quorum.fi/live-terminal</span>
            </div>

            <div className="rounded-2xl bg-[#111622] border border-white/10 p-5 space-y-4 shadow-inner">
              <div className="flex items-center justify-between">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${currentTheme.previewBadge}`}>
                  {currentData.livePreview.badge}
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {currentData.livePreview.statValue}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white font-heading">
                  {currentData.livePreview.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {currentData.livePreview.description}
                </p>
              </div>

              <div className="space-y-1.5 pt-2 text-xs font-mono">
                {currentData.livePreview.details.map((d, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center text-[11px]"
                  >
                    <span className="text-slate-400">{d.label}:</span>
                    <span className="text-slate-200 font-semibold">{d.value}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => {
                  if (currentData.livePreview.ctaHref.startsWith("/")) {
                    triggerSplashNavigation(currentData.livePreview.ctaHref);
                  } else {
                    const el = document.querySelector(currentData.livePreview.ctaHref);
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                iconRight={<ArrowRight className="w-3.5 h-3.5" />}
              >
                {currentData.livePreview.ctaText}
              </Button>
            </div>

            <div className="text-center text-[11px] text-slate-500 font-mono">
              FROST Threshold Orchestrator • Zcash NU6.3
            </div>
          </div>
        </div>

        {/* Scroll down indicator */}
        <div className="flex justify-center pt-6">
          <a
            href="#about"
            className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-amber-400 transition-colors py-2 px-4 rounded-full border border-white/10 hover:border-amber-400/30"
          >
            <span>Explore Architecture &amp; Protocol Capabilities</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </a>
        </div>
      </section>

      {/* ── SECTION 5: PRIVACY FOUNDATION & ABOUT (From /about) ────────────── */}
      <section id="about" className="scroll-mt-28 space-y-10 scroll-reveal">
        {/* Distinct Cypherpunk Purple/Rose Header with Radial Glow */}
        <div className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-purple-950/25 via-[#090D16] to-[#040810] border border-purple-500/25 shadow-xl overflow-hidden space-y-3">
          <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FF4575] font-heading flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5" />
              <span>THE PRIVACY FRONTIER • ABOUT QUORUM</span>
            </span>
            <span className="text-[11px] font-mono text-purple-300/80 bg-purple-500/10 px-2.5 py-1 rounded-full border border-purple-500/20">
              Zero-Knowledge Verification
            </span>
          </div>

          <h2 className="relative z-10 text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-heading">
            Sovereign Confidentiality for Multisig
          </h2>

          <p className="relative z-10 text-sm sm:text-base text-slate-300 max-w-2xl font-normal leading-relaxed">
            Transparent blockchains force treasuries to expose payroll, vendor relations, and treasury balances to public surveillance. Quorum Fi fixes this fundamental flaw by merging FROST threshold cryptography with Zcash zero-knowledge pools.
          </p>
        </div>

        {/* 3 Architectural Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl space-y-4 hover:border-white/20 transition group">
            <div className="w-12 h-12 rounded-2xl bg-[#2A151D] text-rose-400 border border-rose-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white font-heading">The Public Multisig Trap</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Standard multisig reveals all signers, transaction amounts, and balance histories on public block explorers, inviting targeted social engineering and extortion.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl space-y-4 hover:border-white/20 transition group">
            <div className="w-12 h-12 rounded-2xl bg-[#0F2233] text-cyan-400 border border-cyan-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white font-heading">Mathematical Invisibility</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              With FROST over Orchard, spend signatures look identical to single-party transactions. External blockchain observers cannot tell how many signers authorized the spend.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl space-y-4 hover:border-white/20 transition group">
            <div className="w-12 h-12 rounded-2xl bg-[#291F0A] text-amber-400 border border-amber-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white font-heading">Zero Server Custody</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              DKG ceremonies execute purely client-side. The coordinator server only routes encrypted round packages and cannot access spend authorization keys.
            </p>
          </div>
        </div>

        {/* Cryptographic Specifications Table */}
        <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white font-heading">
            Consensus &amp; Cryptographic Specifications
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
            {[
              { label: "Consensus", value: "NU6.3 Ironwood" },
              { label: "Curve", value: "RedPallas (ZIP-224)" },
              { label: "Threshold", value: "IETF FROST v15" },
              { label: "ZK Proofs", value: "Halo 2 (No Trusted Setup)" },
              { label: "Custody", value: "Zero Server Keys" },
              { label: "Fault Tracking", value: "F4 Misbehavior Detection" },
            ].map((spec, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[10px] text-slate-400 block">{spec.label}</span>
                <span className="text-slate-200 font-semibold text-[11px] block">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: PROTOCOL SERVICES & CRYPTOGRAPHY (From /services) ──── */}
      <section id="services" className="scroll-mt-28 space-y-10 scroll-reveal">
        {/* Distinct Cyber-Cyan Header Banner Aesthetic */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-cyan-950/30 via-[#090D16] to-[#040810] border border-cyan-500/20 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>MODULE 02 • PROTOCOL SERVICES</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Zero-Knowledge Infrastructure
            </span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-heading">
            Shielded Protocol Engine
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl font-normal leading-relaxed">
            Institutional multisig powered by Zcash NU6.3 Ironwood and IETF FROST standards. Private keys never leave signer hardware.
          </p>
        </div>

        {/* Protocol Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              { id: "dkg", title: "Non-Custodial DKG", tag: "FROST Round 1-2" },
              { id: "shielded", title: "Ironwood Shielded", tag: "Halo 2 ZK" },
              { id: "culprit", title: "Culprit Detection", tag: "F4 Misbehavior" },
              { id: "compliance", title: "UFVK Audit Export", tag: "ZIP-316 Ready" },
            ] as const
          ).map((item) => {
            const isSelected = activeProtocolTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveProtocolTab(item.id)}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-[#111622] border-[#38BDF8] shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                    : "bg-[#090D16] border-white/10 hover:border-white/20 text-slate-400"
                }`}
              >
                <div className="text-xs font-mono text-[#38BDF8]">{item.tag}</div>
                <div className="font-bold text-sm text-white mt-1">{item.title}</div>
              </button>
            );
          })}
        </div>

        {/* Selected Service Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#090D16] border border-white/10 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              <span>{currentProtocol.badge}</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold text-white font-heading">
              {currentProtocol.title}
            </h3>

            <p className="text-sm text-slate-300 leading-relaxed">
              {currentProtocol.description}
            </p>

            <div className="space-y-2 pt-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between">
                <span className="text-slate-400">Underlying Curve:</span>
                <span className="text-white font-medium">{currentProtocol.curve}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between">
                <span className="text-slate-400">Round Complexity:</span>
                <span className="text-amber-400 font-medium">{currentProtocol.roundComplexity}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between">
                <span className="text-slate-400">Soundness Guarantee:</span>
                <span className="text-emerald-400 font-medium">{currentProtocol.securityProof}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl bg-[#060A12] border border-white/10 p-5 font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-[11px] text-slate-400 mb-3">
              <span>librustzcash / frost_redpallas.rs</span>
              <span className="text-emerald-400">Rust Core</span>
            </div>
            <pre className="text-slate-300 leading-relaxed overflow-x-auto">
              <code>{currentProtocol.codeSnippet}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: BENTO GRID "FULLY FEATURED" ─────────────────────────── */}
      <section id="features" className="scroll-mt-28 space-y-10 scroll-reveal">
        <div className="border-l-4 border-rose-500 pl-5 sm:pl-6 space-y-2">
          <div className="text-xs font-bold uppercase tracking-widest text-[#FF4575] font-heading">
            Enterprise Specifications
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-heading">
            Fully Featured Architecture
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl font-normal leading-relaxed">
            Quorum Fi comes with everything needed to coordinate institutional treasury custody. Zero server keys, shielded transactions, and deterministic culprit tracking.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Shielded Action Bundles */}
          <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between space-y-6 hover:border-white/20 transition">
            <div className="h-32 rounded-2xl bg-gradient-to-b from-[#101726] to-transparent p-4 flex items-center justify-center gap-3 relative overflow-hidden">
              <div className="w-16 h-20 rounded-xl bg-[#172033] border border-white/10 p-2 flex flex-col justify-between shadow-lg transform -rotate-6">
                <div className="space-y-1">
                  <div className="w-8 h-1.5 bg-slate-500 rounded" />
                  <div className="w-10 h-1 bg-slate-600 rounded" />
                </div>
                <div className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-[9px] font-bold">
                  ✕
                </div>
              </div>

              <div className="w-16 h-20 rounded-xl bg-[#1E293B] border border-white/15 p-2 flex flex-col justify-between shadow-xl transform rotate-0 z-10 scale-105">
                <div className="space-y-1">
                  <div className="w-8 h-1.5 bg-amber-400 rounded" />
                  <div className="w-11 h-1 bg-slate-400 rounded" />
                </div>
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[9px] font-bold">
                  ✓
                </div>
              </div>

              <div className="w-16 h-20 rounded-xl bg-[#172033] border border-white/10 p-2 flex flex-col justify-between shadow-lg transform rotate-6">
                <div className="space-y-1">
                  <div className="w-8 h-1.5 bg-slate-500 rounded" />
                  <div className="w-10 h-1 bg-slate-600 rounded" />
                </div>
                <div className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[9px] font-bold">
                  ✓
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white font-heading">
                Shielded Action Bundles
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Organize zero-knowledge inputs and output note commitments with native TypeScript types and Rust-backed Orchard bundle validation.
              </p>
            </div>
          </div>

          {/* Card 2: Giant "0" - Zero Server Keys */}
          <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between space-y-6 hover:border-white/20 transition">
            <div className="h-32 rounded-2xl bg-gradient-to-b from-[#101726] to-transparent flex items-center justify-center relative">
              <span className="text-8xl sm:text-9xl font-extrabold font-heading bg-gradient-to-b from-[#38BDF8] via-[#0284C7] to-[#0369A1] bg-clip-text text-transparent select-none leading-none drop-shadow-[0_0_35px_rgba(56,189,248,0.2)]">
                0
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white font-heading">
                Zero Server Keys, By Default
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Quorum Fi coordinates signing round messages and strips away any ability for coordinators or servers to reconstruct your private key.
              </p>
            </div>
          </div>

          {/* Card 3: Signer Pipeline */}
          <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between space-y-6 hover:border-white/20 transition">
            <div className="h-32 rounded-2xl bg-gradient-to-b from-[#101726] to-transparent p-4 flex flex-col justify-center gap-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono text-slate-400">
                  R1 Commit
                </div>
                <div className="h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[10px] font-mono text-amber-400">
                  R2 Shares
                </div>
                <div className="h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-mono text-emerald-400 font-bold">
                  Aggregate
                </div>
              </div>
              <div className="h-10 rounded-xl bg-[#1E293B] border border-white/10 flex items-center justify-between px-3 text-[11px] font-mono text-slate-300">
                <span>Broadcast Status</span>
                <span className="text-emerald-400 font-bold">On-Chain</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white font-heading">
                Seamless Signer Pipeline
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Coordinate asynchronously across timezones with automated round progression and deterministic culprit detection.
              </p>
            </div>
          </div>

          {/* Card 4 (Wide): UFVK Auditing */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-white/20 transition">
            <div className="space-y-2 max-w-md">
              <h3 className="text-base font-bold text-white font-heading">
                Viewing Key Audit Export
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Export verifiable CSV/JSON balance audits with the vault’s Unified Full Viewing Key (UFVK) without compromising spending authority.
              </p>
            </div>

            <div className="w-full sm:w-64 p-3 rounded-2xl bg-[#111622] border border-white/10 space-y-2 text-xs font-mono shrink-0">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>UFVK Export Format</span>
                <span className="text-amber-400">Encrypted AES-256</span>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.04] text-[10px] text-slate-300 truncate">
                uviewtest1q7r...9w2x
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-emerald-400">Audit Proof Ready</span>
                <span className="text-slate-500">CSV • JSON</span>
              </div>
            </div>
          </div>

          {/* Card 5: Protocol Standards */}
          <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between space-y-4 hover:border-white/20 transition">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white font-heading">
                Protocol Standards
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Strict adherence to Zcash Improvement Proposals and IETF RFC drafts:
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-amber-400">
                ZIP-312
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-cyan-400">
                ZIP-224
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-emerald-400">
                ZIP-2005
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-rose-400">
                FROST v15
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: THRESHOLD CALCULATOR & PROJECTS (From /project) ─────── */}
      <section id="project" className="scroll-mt-28 space-y-10 scroll-reveal">
        {/* Distinct Amber Gold Banner Header with Live Vault Metadata */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-500/10 via-[#0E131F] to-[#080C16] border border-amber-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/25">
              <span>MODULE 03 • SIMULATED SANDBOX &amp; PROJECT</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-heading">
              Threshold Governance
            </h2>
            <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
              Experiment with threshold parameters, fault tolerance simulations, and live testnet deployment rules in real-time.
            </p>
          </div>
          <div className="shrink-0 p-4 rounded-2xl bg-[#090D16] border border-white/10 font-mono text-xs text-slate-400 space-y-1">
            <div className="text-[10px] text-amber-400 uppercase">Live Vault ID</div>
            <div className="font-bold text-white text-sm">vault-demo-001</div>
            <div className="text-emerald-400 text-[11px]">● Testnet Deployed</div>
          </div>
        </div>

        {/* Interactive Threshold Calculator Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#090D16] border border-white/10 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div>
              <h3 className="text-xl font-bold text-white font-heading">
                Threshold Quorum Calculator
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Calculate offline tolerance and security parameters for your vault:
              </p>
            </div>

            {/* Sliders */}
            <div className="space-y-4 font-mono text-xs">
              <div>
                <div className="flex justify-between mb-1.5 text-slate-300">
                  <span>Total Participants (n):</span>
                  <span className="text-amber-400 font-bold">{totalSigners} signers</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="11"
                  value={totalSigners}
                  onChange={(e) => {
                    const n = parseInt(e.target.value);
                    setTotalSigners(n);
                    if (threshold > n) setThreshold(n);
                  }}
                  className="w-full accent-amber-500 bg-white/10 rounded-lg cursor-pointer h-2"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1.5 text-slate-300">
                  <span>Signing Threshold (t):</span>
                  <span className="text-cyan-400 font-bold">{threshold} of {totalSigners}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max={totalSigners}
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 bg-white/10 rounded-lg cursor-pointer h-2"
                />
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => triggerSplashNavigation("/vaults/new")}
              icon={<KeyRound className="w-4 h-4" />}
            >
              Configure This Vault ({threshold}-of-{totalSigners})
            </Button>
          </div>

          {/* Calculator Results */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 space-y-2">
              <span className="text-xs font-mono text-slate-400 block">Offline Fault Tolerance</span>
              <div className="text-3xl font-extrabold font-mono text-emerald-400">
                {faultTolerance} signer{faultTolerance !== 1 ? "s" : ""}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Up to {faultTolerance} keyholder(s) can go offline simultaneously without halting treasury transfers.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#111622] border border-white/10 space-y-2">
              <span className="text-xs font-mono text-slate-400 block">Collusion Safety</span>
              <div className="text-3xl font-extrabold font-mono text-[#38BDF8]">
                {collusionSafety} key{collusionSafety !== 1 ? "s" : ""}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                An attacker must compromise at least {threshold} distinct devices to forge a spend signature.
              </p>
            </div>

            <div className="col-span-2 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs font-mono flex items-center justify-between">
              <span className="text-slate-300">Active Testnet Demo Vault:</span>
              <span className="font-bold text-amber-400">vault-demo-001 (3-of-5)</span>
            </div>
          </div>
        </div>
      </section>

      
        {/* Bottom CTA Card */}
        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-cyan-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
          <div className="space-y-2 text-center sm:text-left">
            <h3 className="text-2xl font-extrabold text-white font-heading">
              Ready to secure institutional treasury assets?
            </h3>
            <p className="text-sm text-slate-300 max-w-xl">
              Open the Quorum Fi coordinator dashboard to create your vault or simulate distributed key ceremonies in sandbox mode.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={() => triggerSplashNavigation("/dashboard")}
            iconRight={<ArrowRight className="w-4 h-4" />}
            className="shrink-0"
          >
            Launch Dashboard
          </Button>
        </div>
      </LandingLayout>
  );
}
