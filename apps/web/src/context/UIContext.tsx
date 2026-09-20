"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { MockScenario } from "@/types/coordinator";

type ThemeMode = "dark" | "light";

interface UIContextType {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  activeScenario: MockScenario;
  setActiveScenario: (scenario: MockScenario) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<MockScenario>("happy_path");
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  // Declared before the effect that uses it. Previously defined below,
  // which tripped react-hooks on access-before-declaration.
  const applyThemeClass = (t: ThemeMode) => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(t);
      root.setAttribute("data-theme", t);
    }
  };

  useEffect(() => {
    // Read the persisted theme once on mount. localStorage does not exist
    // during SSR, so the initial state must be the SSR-safe default and the
    // real value can only be applied after hydration. That is precisely the
    // setState-in-effect the rule warns about, and here it is unavoidable
    // without moving theme resolution into a blocking inline script in the
    // document head. Revisit if the theme flash becomes noticeable.
    const stored = localStorage.getItem("quorum-theme") as ThemeMode | null;
    const initial: ThemeMode =
      stored === "light" || stored === "dark" ? stored : "dark";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setThemeState(initial);
    applyThemeClass(initial);
  }, []);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem("quorum-theme", t);
    applyThemeClass(t);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <UIContext.Provider
      value={{
        isMobileMenuOpen,
        setIsMobileMenuOpen,
        toggleMobileMenu,
        closeMobileMenu,
        activeScenario,
        setActiveScenario,
        theme,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}
