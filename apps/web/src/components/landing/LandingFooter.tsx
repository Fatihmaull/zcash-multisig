"use client";

import Link from "next/link";
import { FileCheck2 } from "lucide-react";

export function LandingFooter() {
  return (
    <>
      {/* Clean Minimalist Bottom Bar */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-6 lg:px-12 pb-6 sm:pb-8 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 select-none">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-300">Quorum Fi</span>
          <span>© 2026</span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="hidden sm:inline">Zcash Shielded Custody</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-mono text-[11px]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Testnet Activated (NU6.3)</span>
          </div>
        </div>
      </footer>

      {/* Floating Amber Action Button */}
      <Link
        href="/approvals"
        aria-label="View Proposals & Spend Governance"
        className="fixed bottom-6 right-6 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 hover:scale-110 active:scale-95 text-slate-950 flex items-center justify-center shadow-2xl shadow-orange-500/50 transition-all cursor-pointer group"
        title="View Approvals & Proposals"
      >
        <FileCheck2 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950 group-hover:rotate-12 transition-transform" />
      </Link>
    </>
  );
}
