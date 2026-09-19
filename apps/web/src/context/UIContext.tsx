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

  useEffect(() => {
    // Load persisted theme from localStorage or system preference
    const stored = localStorage.getItem("quorum-theme") as ThemeMode | null;
    if (stored === "light" || stored === "dark") {
      setThemeState(stored);
      applyThemeClass(stored);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "dark"; // Default to dark for cypherpunk feel
      setThemeState(initial);
      applyThemeClass(initial);
    }
  }, []);

  const applyThemeClass = (t: ThemeMode) => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(t);
      root.setAttribute("data-theme", t);
    }
  };

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
