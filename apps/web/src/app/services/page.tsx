"use client";

import { useState } from "react";
import { 
  ShieldCheck, 
  Terminal, 
  Sliders, 
  ArrowRight, 
  KeyRound, 
  FileCode2,
  ChevronRight
} from "lucide-react";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Button } from "@/components/ui/Button";

type ProtocolTab = "dkg" | "shielded" | "culprit" | "compliance";

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<ProtocolTab>("dkg");

  const tabDetails: Record<
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
      codeSnippet: `---
// Step 1: Distributed Key Generation Round 1
let (kg_round1, package1) = frost_redpallas::keys::dkg::part1(
    identifier,
    max_signers, // n
    min_signers, // t
    &mut rng
)?;
// Broadcast package1 to all participants over authenticated channels
---`,
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
      codeSnippet: `---
// Construct shielded Action with zero-knowledge spend proof
let orchard_bundle = Bundle::build(
    &mut rng,
    spend_authorizing_key,
    actions, // Shielded inputs/outputs
    flags
)?;
// Nullifier set verified on Zcash NU6.3 consensus
---`,
      description:
        "Treasury assets are held entirely within the shielded Ironwood pool. On-chain observers only see cryptographic nullifiers and commitments, keeping treasury balance sheets and vendor recipients 100% private.",
      badge: "Zero-Knowledge",
    },
    culprit: {
      title: "F4 Deterministic Culprit Identification",
      curve: "FROST Signature Share Verification",
      roundComplexity: "Instantaneous during Combiner Aggregation",
      securityProof: "Identifies exact faulty node via public commitment check.",
      highlightLines: [3, 5],
      codeSnippet: `---
// Verify partial signature share against participant's public key
for (id, share) in signature_shares.iter() {
    if !frost_redpallas::verify_share(id, share, &signing_package) {
        log::error!("Misbehaving node identified: {}", id);
        return Err(CulpritIdentified(id));
    }
}
---`,
      description:
        "In traditional threshold schemes, an invalid partial signature halts the ceremony without accountability. Quorum Fi automatically identifies the specific signer that produced corrupted data and safely excludes them.",
      badge: "Fault-Tolerant",
    },
    compliance: {
      title: "Selective Disclosure & Viewing Keys",
      curve: "Unified Full Viewing Keys (UFVK)",
      roundComplexity: "Auditor Access Without Spend Authority",
      securityProof: "Read-only decrypting capability; zero spend power.",
      highlightLines: [2, 4],
      codeSnippet: `---
// Generate scoped viewing key for financial auditors
let ufvk = spending_key.to_unified_full_viewing_key();
let incoming_viewing_key = ufvk.to_ivk();
// Allows viewing transaction history without revealing balance graph to public
---`,
      description:
        "Enterprises and DAOs can generate scoped Full Viewing Keys for tax authorities, board members, or external auditors, satisfying regulatory requirements without exposing transactions publicly to the blockchain.",
      badge: "Audit-Ready",
    },
  };

  const currentTab = tabDetails[activeTab];

  return (
    <LandingLayout activeTab="services" className="space-y-16 py-6">
      {/* ── Header Section ──────────────────────────────────────────── */}
      <div className="max-w-3xl space-y-3.5 animate-fade-in">
        <span className="text-xs font-bold uppercase tracking-widest text-[#FF4575] font-heading">
          Core Protocol Services
        </span>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white font-heading leading-[1.08]">
          Private Threshold Orchestration
        </h1>

        <p className="text-sm sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
          Hardware-isolated threshold signing and non-custodial ceremony workflows specifically tailored for the Zcash NU6.3 Ironwood pool. No shared secrets. Zero coordinator custody.
        </p>

        <div className="pt-2 flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            href="/vaults/new"
            iconRight={<ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          >
            Create new vault
          </Button>
        </div>
      </div>

      {/* ── 4 Core Services Bento Cards (Astro Styled) ──────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between space-y-4 hover:border-white/20 transition group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0E1B2A] text-[#38BDF8] border border-[#38BDF8]/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white font-heading">FROST DKG Ceremony</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Decentralized key generation over RedPallas. Each signer generates ephemeral polynomial commitments client-side.
            </p>
          </div>
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-[#38BDF8]">
            <span>2-of-3 or t-of-n</span>
            <span className="text-slate-500">Client-Side</span>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between space-y-4 hover:border-white/20 transition group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0F241C] text-emerald-400 border border-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white font-heading">Shielded Pool Custody</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Native zero-knowledge custody on Zcash Ironwood NU6.3. Balances and transaction recipients remain completely hidden.
            </p>
          </div>
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-emerald-400">
            <span>Ironwood NU6.3</span>
            <span className="text-slate-500">Zero-Knowledge</span>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between space-y-4 hover:border-white/20 transition group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1E192B] text-rose-400 border border-rose-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white font-heading">Culprit Identification</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Deterministic detection of corrupt or malicious signature shares in Round 2. Halts bad actors without halting the treasury.
            </p>
          </div>
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-rose-400">
            <span>F4 Misbehavior</span>
            <span className="text-slate-500">Zero Trust</span>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between space-y-4 hover:border-white/20 transition group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#261E14] text-[#F4B728] border border-[#F4B728]/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-white font-heading">Governance Policies</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Custom threshold rules, spending caps, and multi-device approval queues with asynchronous co-signing for distributed teams.
            </p>
          </div>
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-[#F4B728]">
            <span>Asynchronous</span>
            <span className="text-slate-500">Configurable</span>
          </div>
        </div>
      </div>

      {/* ── Interactive Protocol Feature Explorer (Astro Code/Spec Split) ── */}
      <div className="rounded-3xl bg-[#090D16] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#38BDF8] font-heading">
              Interactive Protocol Inspector
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white font-heading mt-0.5">
              Verify the Cryptographic Guarantees
            </h2>
          </div>

          {/* Tab Selector - Boxy Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#10141D] border border-white/10">
            {(["dkg", "shielded", "culprit", "compliance"] as ProtocolTab[]).map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? "primary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab)}
              >
                {tab === "dkg" && "Key Ceremony"}
                {tab === "shielded" && "Ironwood Pool"}
                {tab === "culprit" && "Culprit Detection"}
                {tab === "compliance" && "Viewing Keys"}
              </Button>
            ))}
          </div>
        </div>

        {/* Tab Content Display */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Spec Breakdown */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30">
                {currentTab.badge}
              </span>
              <h3 className="text-base font-bold text-white font-heading">{currentTab.title}</h3>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {currentTab.description}
            </p>

            <div className="space-y-2 pt-2 text-xs font-mono">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
                <span className="text-slate-400">Underlying Curve:</span>
                <span className="text-[#38BDF8] font-semibold">{currentTab.curve}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
                <span className="text-slate-400">Round Complexity:</span>
                <span className="text-emerald-400 font-semibold">{currentTab.roundComplexity}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
                <span className="text-slate-400">Formal Guarantee:</span>
                <span className="text-cyan-400 font-semibold text-[11px]">{currentTab.securityProof}</span>
              </div>
            </div>
          </div>

          {/* Right: Code / CLI Spec */}
          <div className="lg:col-span-6 rounded-2xl bg-[#06080F] border border-white/10 p-4 space-y-3 font-mono text-xs overflow-x-auto shadow-inner">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-slate-400 text-[11px]">
              <div className="flex items-center gap-1.5">
                <FileCode2 className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>rust / zcash_primitives</span>
              </div>
              <span className="text-emerald-400 text-[10px] font-mono">VERIFIED ARCHITECTURE</span>
            </div>
            <pre className="text-slate-300 text-[11px] leading-relaxed select-text font-mono">
              {currentTab.codeSnippet.split("\n").map((line, idx) => {
                const isHighlighted = currentTab.highlightLines.includes(idx);
                return (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 rounded ${
                      isHighlighted ? "bg-[#1E293B]/80 text-[#7DD3FC] border-l-2 border-[#38BDF8]" : ""
                    }`}
                  >
                    {line}
                  </div>
                );
              })}
            </pre>
          </div>
        </div>

        {/* Bottom CTA Row */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-slate-400">
            Want to test the key generation ceremony with simulated signers?
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              href="/vaults/vault-demo-001/ceremony"
              iconRight={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Launch Ceremony Sandbox
            </Button>
            <Button
              variant="outline"
              size="sm"
              href="/vaults/new"
            >
              Create New Vault
            </Button>
          </div>
        </div>
      </div>
    </LandingLayout>
  );
}
