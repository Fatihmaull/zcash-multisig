"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Layers, 
  ArrowRight, 
  ShieldCheck, 
  Users, 
  CheckCircle2, 
  Sliders, 
  ExternalLink,
  Coins,
  FileCheck2,
  ChevronRight,
  Zap,
  Activity
} from "lucide-react";
import { LandingLayout } from "@/components/landing/LandingLayout";

export default function ProjectPage() {
  const [totalSigners, setTotalSigners] = useState<number>(5);
  const [threshold, setThreshold] = useState<number>(3);

  // Fault tolerance formula: f = n - t
  const faultTolerance = Math.max(0, totalSigners - threshold);
  // Collusion resistance: needs t keys to forge
  const collusionSafety = threshold - 1;

  return (
    <LandingLayout activeTab="project" className="space-y-16 py-6">
      {/* ── Header Section ──────────────────────────────────────────── */}
      <div className="max-w-3xl space-y-3.5 animate-fade-in">
        <span className="text-xs font-bold uppercase tracking-widest text-[#FF4575] font-heading">
          Ecosystem Deployments
        </span>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white font-heading leading-[1.08]">
          Decentralized Projects &amp; Vaults
        </h1>

        <p className="text-sm sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
          Active multi-signature vaults, cryptographic co-signing ceremonies, and spend governance running live on Quorum Fi’s non-custodial FROST protocol.
        </p>

        <div className="pt-2 flex items-center gap-3">
          <Link
            href="/approvals"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 text-white text-xs sm:text-sm font-semibold transition cursor-pointer backdrop-blur-md font-heading"
          >
            <span>Review spend proposals</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </Link>
        </div>
      </div>

      {/* ── Active Vault Deployments Showcase (Astro Bento Cards) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Project Card 1 */}
        <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between hover:border-white/20 transition space-y-5">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-semibold">
                ACTIVE • 3-OF-5
              </span>
              <span className="text-[11px] font-mono text-slate-500">ID: vault-demo-001</span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white font-heading">Foundation Grant Vault</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Global developer grants treasury with geographically separated keyholders across Americas, Europe, and Asia.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0E131F] border border-white/5 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Shielded Balance:</span>
                <span className="text-[#F4B728] font-bold">0.1000 TAZ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pool Standard:</span>
                <span className="text-white">Ironwood NU6.3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Action:</span>
                <span className="text-emerald-400">Broadcast Confirmed</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <Link
              href="/vaults/vault-demo-001"
              className="text-[#38BDF8] hover:text-[#7DD3FC] font-semibold font-heading flex items-center gap-1.5 transition"
            >
              <span>Inspect Vault</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/vaults/vault-demo-001/ceremony"
              className="text-slate-400 hover:text-white transition flex items-center gap-1 text-[11px]"
            >
              <span>Ceremony Wizard</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Project Card 2 */}
        <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between hover:border-white/20 transition space-y-5">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30 font-mono font-semibold">
                PENDING QUORUM
              </span>
              <span className="text-[11px] font-mono text-slate-500">2-of-3 THRESHOLD</span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white font-heading">DAO Liquidity Reserve</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Autonomous protocol liquidity buffer with automated threshold spend proposals and stealth co-signing.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0E131F] border border-white/5 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Pending Spends:</span>
                <span className="text-[#38BDF8] font-bold">1 In Ceremony</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Spend Authorization:</span>
                <span className="text-white">RedPallas Signature</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timelock Rule:</span>
                <span className="text-[#F4B728]">12h Cooldown</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <Link
              href="/approvals"
              className="text-[#38BDF8] hover:text-[#7DD3FC] font-semibold font-heading flex items-center gap-1.5 transition"
            >
              <span>View Governance Proposals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-[11px] font-mono text-slate-500">Demo Sandbox</span>
          </div>
        </div>

        {/* Project Card 3 */}
        <div className="p-6 rounded-3xl bg-[#090D16] border border-white/10 shadow-xl flex flex-col justify-between hover:border-white/20 transition space-y-5">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-semibold">
                STANDBY • TESTNET
              </span>
              <span className="text-[11px] font-mono text-slate-500">FROST v1.0</span>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white font-heading">NU6.3 Migration Bridge</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Strategic asset migration module transitioning cold transparent pools into Ironwood zero-knowledge actions.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0E131F] border border-white/5 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Compatibility:</span>
                <span className="text-emerald-400 font-bold">Halo 2 / Orchard</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Culprit Shield:</span>
                <span className="text-white">Active (F4 Check)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Storage Footprint:</span>
                <span className="text-slate-300">Zero Server Keys</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <Link
              href="/vaults/new"
              className="text-emerald-400 hover:text-emerald-300 font-semibold font-heading flex items-center gap-1.5 transition"
            >
              <span>Initialize Migration Vault</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-[11px] font-mono text-slate-500">Zcash Testnet</span>
          </div>
        </div>
      </div>

      {/* ── Interactive Treasury Quorum Simulator (Astro Card Style) ─ */}
      <div className="rounded-3xl bg-[#090D16] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#38BDF8] font-heading">
              Interactive Quorum Simulator
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white font-heading mt-0.5">
              Calculate Fault Tolerance &amp; Threshold Economics
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            FROST $(t, n)$ Threshold Security Model
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Controls */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Total Signers ($n$):</span>
                <span className="text-[#38BDF8] font-mono font-bold">{totalSigners} Participants</span>
              </div>
              <div className="flex items-center gap-3">
                {[3, 4, 5, 7].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setTotalSigners(num);
                      if (threshold > num) setThreshold(Math.ceil(num / 2));
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-heading transition cursor-pointer ${
                      totalSigners === num
                        ? "bg-[#38BDF8] text-slate-950 shadow"
                        : "bg-white/[0.04] border border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {num} Signers
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">Required Approval Threshold ($t$):</span>
                <span className="text-emerald-400 font-mono font-bold">{threshold} of {totalSigners} Required</span>
              </div>
              <div className="flex items-center gap-3">
                {Array.from({ length: totalSigners - 1 }, (_, i) => i + 2).map((num) => (
                  <button
                    key={num}
                    onClick={() => setThreshold(num)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-heading transition cursor-pointer ${
                      threshold === num
                        ? "bg-emerald-400 text-slate-950 shadow"
                        : "bg-white/[0.04] border border-white/10 text-slate-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {num} of {totalSigners}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              In a {threshold}-of-{totalSigners} FROST configuration, any {threshold} authorized participants can co-sign a shielded spend, while {faultTolerance} signers can be completely offline without freezing treasury assets.
            </p>
          </div>

          {/* Real-time Math Output Card */}
          <div className="lg:col-span-6 p-5 sm:p-6 rounded-2xl bg-[#06080F] border border-white/10 space-y-4 font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 text-[11px] text-slate-400">
              <span>CRYPTOGRAPHIC METRICS</span>
              <span className="text-emerald-400 font-mono">OPTIMAL SAFETY</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-[10px] text-slate-400">Offline Fault Tolerance</div>
                <div className="text-xl font-bold text-emerald-400 font-heading mt-1">
                  {faultTolerance} Node{faultTolerance === 1 ? "" : "s"}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">$f = n - t$</div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-[10px] text-slate-400">Collusion Resistance</div>
                <div className="text-xl font-bold text-[#F4B728] font-heading mt-1">
                  Up to {collusionSafety} Keys
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">&lt; {threshold} cannot forge</div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-[10px] text-slate-400">Signing Latency</div>
                <div className="text-xl font-bold text-[#38BDF8] font-heading mt-1">2 Rounds</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Commit + Signature</div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-[10px] text-slate-400">On-Chain Footprint</div>
                <div className="text-xl font-bold text-white font-heading mt-1">Single Spend</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Indistinguishable</div>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center text-[11px]">
              <span className="text-slate-400">Ready to configure this quorum?</span>
              <Link
                href="/vaults/new"
                className="text-[#38BDF8] hover:text-[#7DD3FC] font-bold font-heading flex items-center gap-1 transition"
              >
                <span>Deploy {threshold}-of-{totalSigners} Vault</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </LandingLayout>
  );
}
