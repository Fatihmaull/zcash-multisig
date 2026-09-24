"use client";

import Link from "next/link";
import { 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  EyeOff, 
  ChevronRight
} from "lucide-react";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Button } from "@/components/ui/Button";

export default function AboutPage() {
  const specs = [
    { label: "Target Consensus", value: "Zcash NU6.3 Ironwood Pool", highlight: "Active" },
    { label: "Elliptic Curve", value: "RedPallas (ZIP 224)", highlight: "254-bit" },
    { label: "Threshold Standard", value: "FROST (IETF draft-irtf-cfrg-frost)", highlight: "t-of-n" },
    { label: "ZK Proof Engine", value: "Halo 2 (Zero Trusted Setup)", highlight: "Recursive" },
    { label: "Server Key Custody", value: "Zero (Pure Client-Side DKG)", highlight: "100% Safe" },
    { label: "Misbehavior Catch", value: "F4 Deterministic Identification", highlight: "Built-In" },
  ];

  return (
    <LandingLayout activeTab="about" className="space-y-16 py-6">
      {/* ── Header Section ──────────────────────────────────────────── */}
      <div className="max-w-3xl space-y-3.5 animate-fade-in">
        <span className="text-xs font-bold uppercase tracking-widest text-[#FF4575] font-heading">
          The Privacy Frontier
        </span>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white font-heading leading-[1.08]">
          Sovereign Confidentiality for Multisig
        </h1>

        <p className="text-sm sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
          Transparent blockchains forced treasuries to expose payroll, vendor relations, and treasury balances to public surveillance. Quorum Fi fixes this fundamental flaw by merging FROST threshold cryptography with Zcash’s zero-knowledge shielded pools.
        </p>

        <div className="pt-2 flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            href="/vaults"
            iconRight={<ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          >
            Launch coordinator app
          </Button>
        </div>
      </div>

      {/* ── The 3 Architectural Pillars (Astro Bento Cards) ─────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pillar 1 */}
        <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl space-y-4 hover:border-white/20 transition group">
          <div className="w-12 h-12 rounded-2xl bg-[#2A151D] text-rose-400 border border-rose-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
            <EyeOff className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-heading">The Public Multisig Trap</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Legacy solutions like Bitcoin P2SH and EVM multisig contracts broadcast every signer’s address, balance, and transaction history to public surveillance. This invites targeted phishing, regulatory weaponization, and competitive espionage.
          </p>
          <div className="text-[11px] font-mono text-rose-400/90 pt-1">
            Problem: Zero On-Chain Privacy
          </div>
        </div>

        {/* Pillar 2 */}
        <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl space-y-4 hover:border-white/20 transition group">
          <div className="w-12 h-12 rounded-2xl bg-[#0F241C] text-emerald-400 border border-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-heading">Off-Chain FROST Aggregation</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            With FROST over RedPallas, signing shares are aggregated off-chain into a single, valid Schnorr spend authorization signature. To the Zcash network, a 5-of-7 spend is indistinguishable from a regular single-party shielded transaction.
          </p>
          <div className="text-[11px] font-mono text-emerald-400/90 pt-1">
            Solution: Indistinguishable Spends
          </div>
        </div>

        {/* Pillar 3 */}
        <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl space-y-4 hover:border-white/20 transition group">
          <div className="w-12 h-12 rounded-2xl bg-[#0E1B2A] text-[#38BDF8] border border-[#38BDF8]/20 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-heading">Pure Zero-Custody DKG</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Keys are created via decentralized polynomial secret sharing (Pedersen VSS) across participants’ client hardware. The coordinator coordinates communication but never holds, sees, or reconstructs private spend keys.
          </p>
          <div className="text-[11px] font-mono text-[#38BDF8]/90 pt-1">
            Guarantee: Zero Server Trust
          </div>
        </div>
      </div>

      {/* ── Technical Specifications Grid (Astro Card Style) ────────── */}
      <div className="rounded-3xl bg-[#090D16] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 font-heading">
              Protocol &amp; Cryptographic Specifications
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white font-heading mt-0.5">
              Production Cryptography Benchmark
            </h2>
          </div>
          <span className="text-xs font-mono text-[#F4B728] bg-[#F4B728]/10 px-3 py-1 rounded-full border border-[#F4B728]/25">
            Zcash Testnet Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {specs.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-[#0E131F] border border-white/5 flex items-center justify-between gap-3 hover:border-white/15 transition"
            >
              <div className="space-y-0.5">
                <div className="text-[11px] text-slate-400 font-mono">{item.label}</div>
                <div className="text-xs font-bold text-white font-heading">{item.value}</div>
              </div>
              <span className="px-2 py-1 rounded-md text-[10px] font-mono font-semibold bg-white/5 border border-white/10 text-emerald-400">
                {item.highlight}
              </span>
            </div>
          ))}
        </div>

        {/* Philosophy / Cypherpunk Callout */}
        <div className="p-5 rounded-2xl bg-[#0E1B2A] border border-[#38BDF8]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="space-y-1">
            <span className="font-bold text-white font-heading">Cypherpunk Principles:</span>
            <p className="text-slate-300 max-w-2xl leading-relaxed">
              &quot;Privacy is necessary for an open society in the electronic age. We cannot expect governments, corporations, or other large, faceless organizations to grant us privacy out of their beneficence.&quot;
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            href="/vaults"
            iconRight={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Open Vaults
          </Button>
        </div>
      </div>
    </LandingLayout>
  );
}
