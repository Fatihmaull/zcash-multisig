"use client";

import { createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";

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
 * Plain navigation. The previous overlay scaled in with an overshoot, spun
 * rings, and showed a 25/85/100 progress figure that nothing had measured.
 */
export function SplashScreenProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const triggerSplashNavigation = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  return (
    <SplashScreenContext.Provider
      value={{
        triggerSplashNavigation,
        isTransitioning: false,
      }}
    >
      {children}
    </SplashScreenContext.Provider>
  );
}
