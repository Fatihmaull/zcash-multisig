"use client";

import Image from "next/image";

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function Logo({ size = 38, className = "", showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Quorum Fi Logo Mark */}
      <div 
        className="relative shrink-0 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 group flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Image
          src="/favicon.png"
          alt="Quorum Fi Logo"
          width={size * 2}
          height={size * 2}
          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
          priority
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-lg tracking-tight text-[var(--text-primary)] font-sans">
              Quorum <span className="text-[#B8860B] dark:text-[#E2B16B] font-semibold">Fi</span>
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold tracking-tight">
              v0.2
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-sans flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Shielded Multisig Vault
          </span>
        </div>
      )}
    </div>
  );
}
