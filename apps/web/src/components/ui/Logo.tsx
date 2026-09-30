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
      <div
        className="relative shrink-0 rounded-2xl overflow-hidden shadow-xs flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Image
          src="/favicon.png"
          alt="Quorum"
          width={size * 2}
          height={size * 2}
          className="w-full h-full object-contain"
          priority
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-lg tracking-tight text-[var(--text-primary)] font-sans">
              Quorum
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
