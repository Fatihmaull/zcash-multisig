"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Shield, Sparkles } from "lucide-react";

interface SplashScreenContextType {
  triggerSplashNavigation: (href: string) => void;
  isTransitioning: boolean;
}

const SplashScreenContext = createContext<SplashScreenContextType>({
  triggerSplashNavigation: () => {},
  isTransitioning: false,
});

export const useSplashScreen = () => useContext(SplashScreenContext);

export function SplashScreenProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [targetHref, setTargetHref] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "fade-in" | "loading" | "fade-out">("idle");
  const [progress, setProgress] = useState(0);

  const triggerSplashNavigation = (href: string) => {
    if (phase !== "idle") return;
    setTargetHref(href);
    setPhase("fade-in");
    setProgress(15);
  };

  useEffect(() => {
    if (phase === "fade-in") {
      const timer = setTimeout(() => {
        setPhase("loading");
      }, 350);
      return () => clearTimeout(timer);
    }

    if (phase === "loading") {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 92) {
            clearInterval(interval);
            return 92;
          }
          return prev + Math.floor(Math.random() * 15 + 10);
        });
      }, 100);

      const navTimer = setTimeout(() => {
        setProgress(100);
        if (targetHref) {
          router.push(targetHref);
        }
        setTimeout(() => {
          setPhase("fade-out");
        }, 400);
      }, 1200);

      return () => {
        clearInterval(interval);
        clearTimeout(navTimer);
      };
    }

    if (phase === "fade-out") {
      const exitTimer = setTimeout(() => {
        setPhase("idle");
        setTargetHref(null);
        setProgress(0);
      }, 500);
      return () => clearTimeout(exitTimer);
    }
  }, [phase, targetHref, router]);

  return (
    <SplashScreenContext.Provider
      value={{
        triggerSplashNavigation,
        isTransitioning: phase !== "idle",
      }}
    >
      {children}

      {/* Fullscreen Cyberpunk Splash Loading Screen Overlay */}
      {phase !== "idle" && (
        <div
          className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#030712] text-white transition-opacity duration-500 ease-in-out select-none ${
            phase === "fade-in"
              ? "opacity-0 animate-splash-fade-in"
              : phase === "fade-out"
              ? "opacity-0 pointer-events-none"
              : "opacity-100"
          }`}
          style={{
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          {/* Ambient Lighting Orbs */}
          <div className="absolute w-[500px] h-[500px] bg-amber-500/15 rounded-full blur-[140px] pointer-events-none -top-20 -left-20 animate-pulse" />
          <div className="absolute w-[500px] h-[500px] bg-[#38BDF8]/15 rounded-full blur-[140px] pointer-events-none -bottom-20 -right-20 animate-pulse" />

          {/* Center Brand & Animation Container */}
          <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center space-y-6 animate-splash-scale">
            {/* Animated Logo Container with Glow Ring */}
            <div className="relative flex items-center justify-center">
              <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-amber-500/40 via-yellow-400/20 to-cyan-500/40 blur-lg animate-spin-slow opacity-80" />
              <div className="relative w-20 h-20 rounded-2xl bg-[#090D16] border border-amber-500/30 p-3.5 shadow-2xl flex items-center justify-center">
                <Image
                  src="/favicon.png"
                  alt="Quorum Fi"
                  width={160}
                  height={160}
                  priority
                  className="w-full h-full object-contain animate-pulse"
                />
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-extrabold tracking-tight font-heading text-white">
                  Quorum <span className="text-[#E2B16B]">Fi</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>Initializing Shielded Workspace...</span>
              </p>
            </div>

            {/* Progress Bar Container */}
            <div className="w-64 sm:w-72 space-y-2">
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden p-[1px]">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-yellow-300 to-cyan-400 rounded-full transition-all duration-200 ease-out shadow-[0_0_12px_rgba(245,158,11,0.6)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span className="text-slate-400">Verifying ZK State</span>
                <span className="text-amber-400 font-bold">{progress}%</span>
              </div>
            </div>

            {/* Security Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-slate-400 font-mono">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>RedPallas FROST Protocol</span>
            </div>
          </div>
        </div>
      )}
    </SplashScreenContext.Provider>
  );
}
