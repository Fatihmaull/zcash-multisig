"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUI } from "@/context/UIContext";
import { 
  Menu, 
  ShieldCheck, 
  Sparkles, 
  Sun, 
  Moon,
  ArrowLeft,
  Wallet
} from "lucide-react";
import type { MockScenario } from "@/types/coordinator";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { Logo } from "@/components/ui/Logo";

export function Header() {
  const { toggleMobileMenu, activeScenario, setActiveScenario, theme, toggleTheme } = useUI();
  const [balance, setBalance] = useState<string | null>("0.1000");

  useEffect(() => {
    fetch("/api/wallet/balance")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.ironwood) {
          const formatted = parseFloat(json.data.ironwood).toFixed(4);
          setBalance(formatted);
        }
      })
      .catch(() => {});
  }, []);

  const scenarioOptions: SelectOption<MockScenario>[] = [
    { 
      value: "happy_path", 
      label: "Normal (2-of-3 Approved)",
      sublabel: "Standard threshold signing flow" 
    },
    { 
      value: "non_responding", 
      label: "1 Signer Offline (Timeout)",
      sublabel: "Automatic fallback to standby signer" 
    },
    { 
      value: "malicious_share", 
      label: "Corrupt Key (Auto-Detection)",
      sublabel: "F4 culprit identification & safety stop" 
    },
  ];

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-[var(--border-subtle)] bg-[var(--bg-glass)] backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-3 transition-colors duration-200">
      {/* Left: Mobile Toggle + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-amber-500 text-xs font-medium text-[var(--text-secondary)] transition shadow-xs cursor-pointer group"
            title="Back to Landing Page"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <div className="sm:hidden">
            <Logo size={28} showText={false} />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span className="font-bold text-[var(--text-primary)] font-mono hidden sm:inline tracking-wide">QUORUM</span>
            <span className="text-[var(--text-muted)] hidden sm:inline">•</span>
            <span className="text-[var(--text-secondary)] font-sans">Shielded Multisig</span>
          </div>
        </div>
      </div>

      {/* Right: Friendly Scenario Switcher, Theme Switcher & Badges */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Scenario Switcher with SearchableSelect */}
        <div className="w-48 sm:w-64">
          <SearchableSelect<MockScenario>
            options={scenarioOptions}
            value={activeScenario}
            onChange={(val) => setActiveScenario(val)}
            searchPlaceholder="Search scenario..."
            align="right"
            icon={<Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
            dropdownClassName="w-72 sm:w-80"
          />
        </div>

        {/* Live On-Chain Balance Badge */}
        <Link
          href="/vaults/vault-demo-001"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/50 text-xs font-medium transition cursor-pointer"
          title="Live On-Chain Balance (Ironwood)"
        >
          <Wallet className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-mono font-bold text-[var(--text-primary)]">{balance ?? "0.1000"}</span>
          <span className="text-[10px] text-[var(--zcash-gold)] font-bold">TAZ</span>
        </Link>

        {/* Theme Toggle Button (Light / Dark) */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--zcash-gold-border)] transition shadow-xs flex items-center justify-center group cursor-pointer"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700 group-hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* Non-Custodial Badge */}
        <div className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Non-Custodial</span>
        </div>

        {/* Demo Mode Badge */}
        <span className="hidden sm:inline px-2.5 py-1 rounded-xl text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-secondary)] border border-[var(--border-default)]">
          Demo Sandbox
        </span>
      </div>
    </header>
  );
}
