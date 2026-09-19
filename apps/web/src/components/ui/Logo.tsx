"use client";

import Image from "next/image";

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function Logo({ size = 36, className = "", showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* High-res vector emblem */}
      <div 
        className="relative shrink-0 rounded-xl overflow-hidden shadow-xs border border-amber-500/30 bg-[#0c101a] dark:bg-[#070a10]"
        style={{ width: size, height: size }}
      >
        <Image
          src="/favicon.svg"
          alt="Quorum Logo"
          width={size}
          height={size}
          className="w-full h-full p-1"
          priority
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-base tracking-tight text-[var(--text-primary)] font-mono">
              QUORUM
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold">
              v0.2
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-sans">
            Shielded Multisig Vault
          </span>
        </div>
      )}
    </div>
  );
}
