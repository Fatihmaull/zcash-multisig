"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

interface SplashScreenContextType {
  triggerSplashNavigation: (href: string) => void;
  isTransitioning: boolean;
}

const SplashScreenContext = createContext<SplashScreenContextType>({
  triggerSplashNavigation: () => {},
  isTransitioning: false,
});

export const useSplashScreen = () => useContext(SplashScreenContext);

/**
 * Simplified provider: no more blocking splash screen.
 * Navigation is instant with a CSS fade-in on the target page.
 * `triggerSplashNavigation` is kept for API compat but just does router.push.
 */
export function SplashScreenProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [targetDestination, setTargetDestination] = useState<string>("");
  const [phase, setPhase] = useState<"entering" | "holding" | "exiting">("entering");

  const triggerSplashNavigation = useCallback(
    (href: string) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setPhase("entering");

      // Set readable destination preview
      if (href.startsWith("/dashboard")) {
        setTargetDestination("Coordinator Dashboard");
      } else if (href.startsWith("/vaults")) {
        setTargetDestination("Shielded Vault Engine");
      } else if (href.startsWith("/approvals")) {
        setTargetDestination("Threshold Approvals");
      } else if (href === "/") {
        setTargetDestination("Quorum Fi Portal");
      } else {
        setTargetDestination("Initializing Secure Environment");
      }

      // Phase 1: Enter & hold cinematic splash
      setTimeout(() => {
        setPhase("holding");
        router.push(href);
      }, 500);

      // Phase 2: Fade out splash gracefully after route load
      setTimeout(() => {
        setPhase("exiting");
      }, 1000);

      // Phase 3: Unmount splash overlay
      setTimeout(() => {
        setIsTransitioning(false);
      }, 1350);
    },
    [router, isTransitioning]
  );

  return (
    <SplashScreenContext.Provider
      value={{
        triggerSplashNavigation,
        isTransitioning,
      }}
    >
      {children}

      {/* Cinematic Quorum Splash Screen Overlay */}
      {isTransitioning && (
        <div
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-auto select-none overflow-hidden transition-all duration-400 ease-out ${
            phase === "entering"
              ? "opacity-0 scale-105"
              : phase === "holding"
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 pointer-events-none"
          }`}
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(14, 19, 31, 0.98) 0%, #030712 100%)",
            backdropFilter: "blur(24px)",
          }}
        >
          {/* Subtle Background Glow Beams */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[500px] h-[500px] bg-amber-500/15 rounded-full blur-[140px] animate-pulse" />
            <div className="w-[300px] h-[300px] bg-[#38BDF8]/10 rounded-full blur-[100px] -translate-y-10" />
          </div>

          {/* Central Holographic Emblem */}
          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            {/* Logo with pulsating rings */}
            <div className="relative flex items-center justify-center">
              {/* Outer rotating ring */}
              <div className="absolute -inset-4 rounded-full border border-amber-500/30 border-t-amber-400 border-r-transparent animate-spin [animation-duration:3s]" />
              
              {/* Middle pulsing ring */}
              <div className="absolute -inset-2 rounded-full border border-cyan-500/20 border-b-cyan-400 border-l-transparent animate-spin [animation-duration:2s] [animation-direction:reverse]" />

              {/* Core Icon Wrapper */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#090D16] border border-amber-500/40 p-3.5 shadow-[0_0_50px_rgba(244,183,40,0.3)] flex items-center justify-center">
                <img
                  src="/favicon.png"
                  alt="Quorum Fi"
                  className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(244,183,40,0.5)]"
                />
              </div>
            </div>

            {/* Brand Title & Typography */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-heading">
                  Quorum <span className="text-[#F4B728]">Fi</span>
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold tracking-wider">
                  NU6.3
                </span>
              </div>
              <p className="text-xs sm:text-sm font-mono text-slate-400 tracking-wider uppercase">
                {targetDestination}
              </p>
            </div>

            {/* Futuristic Progress Bar */}
            <div className="w-56 sm:w-64 space-y-2">
              <div className="relative h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r from-amber-500 via-[#F4B728] to-cyan-400 rounded-full transition-all duration-700 ease-out ${
                    phase === "entering"
                      ? "w-1/4"
                      : phase === "holding"
                      ? "w-4/5"
                      : "w-full"
                  }`}
                />
              </div>

              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                <span>ESTABLISHING FROST CHANNEL</span>
                <span className="text-amber-400 font-semibold animate-pulse">
                  {phase === "entering" ? "25%" : phase === "holding" ? "85%" : "100%"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </SplashScreenContext.Provider>
  );
}
