"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  ArrowRight, 
  ChevronRight, 
  ShieldCheck, 
  Lock, 
  Terminal, 
  Zap, 
  Check, 
  Layers, 
  KeyRound, 
  EyeOff, 
  Activity,
  Cpu
} from "lucide-react";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { useSplashScreen } from "@/components/ui/SplashScreenProvider";

type FrameworkTab = "frost" | "ironwood" | "halo2" | "dkg" | "redpallas";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<FrameworkTab>("frost");
  const { triggerSplashNavigation } = useSplashScreen();

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
        ctaHref: "/services",
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
        ctaHref: "/services",
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
        ctaHref: "/about",
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
        ctaHref: "/about",
      },
    },
  };

  const currentData = frameworkData[activeTab];

  return (
    <LandingLayout activeTab="home" className="space-y-24 py-6">
      {/* ── SECTION 1: ASTRO-STYLE ZERO LOCK-IN HERO ─────────────────────── */}
      <section className="space-y-8">
        {/* Top Header Group */}
        <div className="max-w-3xl space-y-3.5 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#FF4575] font-heading">
              Maximum Privacy • Zero Compromise
            </span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white font-heading leading-[1.05]">
            Zero Key Custody
          </h1>

          <p className="text-sm sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
            Quorum Fi supports threshold FROST co-signing over Zcash NU6.3 Ironwood. Bring your own signer devices and take advantage of mathematical zero-knowledge privacy.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => triggerSplashNavigation("/dashboard")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 text-white text-xs sm:text-sm font-semibold transition cursor-pointer backdrop-blur-md"
            >
              <span>Deploy your shielded vault</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Official Powered by Zcash badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#181D2A]/90 border border-amber-500/30 text-xs text-slate-300 shadow-md">
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

        {/* Circular Framework Selector Buttons (Exact Astro Style) */}
        <div className="flex items-center gap-4 sm:gap-6 pt-2 pb-3 overflow-x-auto select-none no-scrollbar">
          {(
            [
              { id: "frost", label: "FROST", icon: KeyRound },
              { id: "ironwood", label: "Ironwood", icon: ShieldCheck },
              { id: "halo2", label: "Halo 2", icon: EyeOff },
              { id: "dkg", label: "DKG", icon: Cpu },
              { id: "redpallas", label: "RedPallas", icon: Activity },
            ] as { id: FrameworkTab; label: string; icon: any }[]
          ).map((item) => {
            const isSelected = activeTab === item.id;
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
                      ? "ring-2 ring-[#38BDF8] ring-offset-2 ring-offset-[#030712] bg-[#0E1B2A] text-[#38BDF8] shadow-[0_0_20px_rgba(56,189,248,0.35)]"
                      : "bg-[#10141D] text-slate-400 border border-white/10 hover:border-white/20 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                </div>
                <span
                  className={`text-xs font-heading font-semibold transition-colors ${
                    isSelected ? "text-[#38BDF8]" : "text-slate-400 group-hover:text-slate-200"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Two-Column Showcase: Left Code Window + Right Browser App Mockup */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 items-stretch">
          {/* Left Column: Code Window (Astro Syntax Styled) */}
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
              <span className="px-2 py-0.5 rounded bg-white/5 text-[#38BDF8] font-mono text-[10px]">
                {currentData.label}
              </span>
            </div>

            {/* Code Body with highlighted lines */}
            <div className="py-4 overflow-x-auto text-[11px] leading-relaxed">
              <pre className="text-slate-300 select-text font-mono">
                {currentData.codeSnippet.split("\n").map((line, idx) => {
                  const isHighlighted = currentData.highlightLines.includes(idx);
                  return (
                    <div
                      key={idx}
                      className={`px-3 py-0.5 rounded ${
                        isHighlighted
                          ? "bg-[#1E293B]/80 text-[#7DD3FC] border-l-2 border-[#38BDF8]"
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

          {/* Right Column: Browser Window Mockup (Like Astro's cap/store mockup) */}
          <div className="lg:col-span-5 rounded-3xl bg-[#080B12] border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col justify-between space-y-4">
            {/* Window header dots */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                <span className="w-2 h-2 rounded-full bg-slate-600" />
                <span className="w-2 h-2 rounded-full bg-slate-600" />
              </div>
              <span className="text-[10px] font-mono text-slate-500">quorum.fi/live-terminal</span>
            </div>

            {/* Mockup Card Container */}
            <div className="rounded-2xl bg-[#111622] border border-white/10 p-5 space-y-4 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
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

              {/* Specs pill list */}
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

              {/* Cyan Action Button (Astro button style) */}
              <Link
                href={currentData.livePreview.ctaHref}
                className="w-full py-2.5 rounded-xl bg-[#38BDF8] hover:bg-[#7DD3FC] text-slate-950 font-bold text-xs font-heading flex items-center justify-center gap-1.5 shadow-lg shadow-[#38BDF8]/20 transition active:scale-95 cursor-pointer"
              >
                <span>{currentData.livePreview.ctaText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="text-center text-[11px] text-slate-500 font-mono">
              FROST Threshold Orchestrator • Zcash NU6.3
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: ASTRO-STYLE BENTO GRID "FULLY FEATURED" ──────────── */}
      <section className="space-y-8 pt-6">
        <div className="max-w-3xl space-y-2 animate-fade-in">
          <div className="text-xs font-bold uppercase tracking-widest text-[#FF4575] font-heading">
            Everything you need
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-heading">
            Fully Featured
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl font-normal leading-relaxed">
            Quorum Fi comes with everything you need to coordinate institutional treasury custody. Need more? Extend with automated threshold governance policies.
          </p>
        </div>

        {/* Bento Grid: 3 top cards + 2 bottom cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Content Collections Style (Graphic with shielded note commitments) */}
          <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between space-y-6 hover:border-white/20 transition">
            {/* Graphic Illustration */}
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

            {/* Text details */}
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
            {/* Big Gradient "0" Illustration (Exactly like Astro's Zero JS) */}
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
                Quorum Fi only coordinates signing messages and automatically strips away any ability for coordinators or servers to reconstruct your private key.
              </p>
            </div>
          </div>

          {/* Card 3: View Transitions / Round Pipeline Visual */}
          <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between space-y-6 hover:border-white/20 transition">
            {/* Visual Blocks Mockup */}
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
                Seamlessly coordinate across asynchronous timezones with automated round progression and deterministic culprit detection.
              </p>
            </div>
          </div>

          {/* Card 4 (Wide): Optimized Viewing Key Audit Reports */}
          <div className="lg:col-span-2 p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 hover:border-white/20 transition">
            <div className="space-y-2 max-w-md">
              <h3 className="text-base font-bold text-white font-heading">
                Viewing Key Audit Export
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Eliminate compliance blindspots and export verifiable CSV/JSON audits with the vault’s Unified Full Viewing Key (UFVK) without compromising spend authority.
              </p>
            </div>

            {/* Visual preview card */}
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

          {/* Card 5: Framework Ecosystem Row */}
          <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between space-y-4 hover:border-white/20 transition">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-white font-heading">
                Protocol Standards
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Built strictly on Zcash Improvement Proposals and IETF RFC drafts:
              </p>
            </div>

            {/* Protocol Standard Pills (Exact Astro style bottom row) */}
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
    </LandingLayout>
  );
}
