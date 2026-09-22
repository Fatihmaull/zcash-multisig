"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileCheck2 } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#030712] text-white flex flex-col justify-between font-sans select-none">
      {/* ── Background Video Container ─────────────────────────────────── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Responsive YouTube Embed Background */}
        <div className="absolute inset-0 w-full h-full scale-125 lg:scale-110 transform origin-center filter brightness-[0.4] contrast-125 opacity-70">
          <iframe
            className="w-full h-full object-cover pointer-events-none"
            src="https://www.youtube.com/embed/8qSA29vWWds?autoplay=1&mute=1&loop=1&playlist=8qSA29vWWds&start=345&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1"
            title="Quorum Cinematic Background"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            style={{ 
              width: "100vw", 
              height: "56.25vw", 
              minHeight: "100vh", 
              minWidth: "177.77vh", 
              position: "absolute", 
              top: "50%", 
              left: "50%", 
              transform: "translate(-50%, -50%)" 
            }}
          />
        </div>

        {/* Ambient Dark Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/40 to-[#030712]/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#030712]/90 via-transparent to-[#030712]/60" />
      </div>

      {/* ── Top Header Navigation (Identical clean layout to reference) ── */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 lg:px-12 pt-6 sm:pt-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-18 h-18 sm:w-11 sm:h-11 rounded-2xl p-1.5 shadow-lg shadow-black/40 group-hover:scale-105 transition-all">
            <Image
              src="/favicon.png"
              alt="Quorum Fi Logo"
              width={160}
              height={160}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white font-sans flex items-center gap-1">
              Quorum <span className="text-[#E2B16B]">Fi</span>
            </span>
            <span className="text-[10px] tracking-wider text-slate-400 uppercase font-mono hidden sm:inline">
              Shielded Multisig
            </span>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <Link href="/vaults" className="hover:text-white transition">
            Services
          </Link>
          <Link href="/approvals" className="hover:text-white transition">
            Projects
          </Link>
          <Link href="/vaults/vault-demo-001/ceremony" className="hover:text-white transition text-slate-300 hover:text-amber-300">
            About
          </Link>
        </nav>

        {/* Right Action Button (Like "Start Your Project") */}
        <Link
          href="/vaults"
          className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 text-xs sm:text-sm font-bold tracking-tight shadow-xl hover:shadow-2xl transition active:scale-95 cursor-pointer"
        >
          <span>Start Your Project</span>
          <ArrowRight className="w-4 h-4 text-slate-950" />
        </Link>
      </header>

      {/* ── Single-Screen Hero (Clean & Focused, NO SCROLL) ─────────── */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 my-auto flex flex-col justify-center">
        <div className="max-w-3xl space-y-4 sm:space-y-6">
          {/* Main Title with under-glow stripe */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08]">
            <span className="relative inline-block">
              Elevating brand value
              {/* Highlight bar accent matching reference image */}
              <span className="absolute left-0 -bottom-1 sm:-bottom-2 w-full h-1.5 sm:h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-cyan-400 rounded-full" />
            </span>
            <br />
            with design strategy
          </h1>

          {/* Subtitle description */}
          <p className="text-sm sm:text-lg text-slate-300 max-w-xl font-normal leading-relaxed pt-1 sm:pt-2">
            Zcash shielded custody and decentralized threshold security. With our strategy-first architecture we amplify privacy into a force.
          </p>

          {/* Action Link like "See how" in reference */}
          <div className="pt-2 sm:pt-3">
            <Link
              href="/vaults"
              className="inline-flex items-center gap-1.5 text-sm sm:text-base font-semibold text-white hover:text-amber-400 underline underline-offset-4 decoration-amber-500 transition cursor-pointer"
            >
              <span>See how</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      {/* ── Minimalist Clean Bottom Bar ─────────────────────────────── */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 pb-6 sm:pb-8 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>Quorum Fi © 2026</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Zcash Shielded Custody</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-mono text-[11px]">
            Testnet Activated
          </span>
        </div>
      </footer>

      {/* Floating Orange Action Button in bottom-right (exact match to reference) */}
      <Link
        href="/approvals"
        aria-label="View Proposals"
        className="fixed bottom-6 right-6 z-30 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 hover:scale-110 active:scale-95 text-slate-950 flex items-center justify-center shadow-2xl shadow-orange-500/50 transition-all cursor-pointer group"
      >
        <FileCheck2 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950 group-hover:rotate-12 transition-transform" />
      </Link>
    </div>
  );
}
