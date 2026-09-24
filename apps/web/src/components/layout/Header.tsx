"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useUI } from "@/context/UIContext";
import { 
  Menu, 
  ShieldCheck, 
  Sparkles, 
  Sun, 
  Moon,
  ChevronLeft,
  ChevronRight,
  Home,
  Wallet,
  ArrowUpRight,
  Shield
} from "lucide-react";
import type { MockScenario } from "@/types/coordinator";
import { SearchableSelect, type SelectOption } from "@/components/ui/SearchableSelect";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useSplashScreen } from "@/components/ui/SplashScreenProvider";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleMobileMenu, activeScenario, setActiveScenario, theme, toggleTheme } = useUI();
  const { triggerSplashNavigation } = useSplashScreen();
  const [balance, setBalance] = useState<string | null>("0.2000");
  const [scenarioNotification, setScenarioNotification] = useState<{
    scenario: MockScenario;
    title: string;
    desc: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/wallet/balance")
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success && json.data?.ironwood) {
          const formatted = parseFloat(json.data.ironwood).toFixed(4);
          setBalance(formatted);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const scenarioOptions: SelectOption<MockScenario>[] = [
    { 
      value: "happy_path", 
      label: "Normal (2-of-3)",
      sublabel: "Standard threshold signing flow" 
    },
    { 
      value: "non_responding", 
      label: "1 Signer Offline",
      sublabel: "Automatic fallback to standby signer (Timeout)" 
    },
    { 
      value: "malicious_share", 
      label: "Corrupt Key",
      sublabel: "F4 culprit identification & safety abort" 
    },
  ];

  const handleScenarioChange = (val: MockScenario) => {
    setActiveScenario(val);
    const selected = scenarioOptions.find((opt) => opt.value === val);
    if (selected) {
      setScenarioNotification({
        scenario: val,
        title: `Skenario Aktif: ${selected.label}`,
        desc: selected.sublabel || "",
      });
      setTimeout(() => {
        setScenarioNotification((prev) => (prev?.scenario === val ? null : prev));
      }, 5000);
    }
  };

  // Dynamic breadcrumb computation
  const breadcrumb = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      return { section: "Dashboard", sectionHref: "/dashboard", page: null };
    }

    if (segments[0] === "dashboard") {
      return { section: "Dashboard", sectionHref: "/dashboard", page: null };
    }

    if (segments[0] === "vaults") {
      if (segments.length === 1) {
        return { section: "Vaults", sectionHref: "/vaults", page: null, badge: "Shielded" };
      }
      if (segments[1] === "new") {
        return { section: "Vaults", sectionHref: "/vaults", page: "Create Vault" };
      }
      if (segments[2] === "ceremony") {
        return { section: "Vaults", sectionHref: `/vaults/${segments[1]}`, page: "DKG Ceremony" };
      }
      return { section: "Vaults", sectionHref: "/vaults", page: "Vault Details" };
    }

    if (segments[0] === "approvals") {
      if (segments.length === 1) {
        return { section: "Approvals", sectionHref: "/approvals", page: null, badge: "MPC Proposals" };
      }
      if (segments[1] === "new") {
        return { section: "Approvals", sectionHref: "/approvals", page: "New Proposal" };
      }
      return { section: "Approvals", sectionHref: "/approvals", page: "Proposal Details" };
    }

    const sectionTitle = segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
    const pageTitle = segments[1] ? segments[1].charAt(0).toUpperCase() + segments[1].slice(1) : null;
    return { section: sectionTitle, sectionHref: `/${segments[0]}`, page: pageTitle };
  }, [pathname]);

  const showBackButton = pathname !== "/dashboard" && pathname !== "/vaults";

  return (
    <>
      <header className="sticky top-0 z-20 pt-3 px-3 sm:px-4 lg:pl-0 lg:pr-3 transition-colors duration-200">
        <div className="h-14 sm:h-15 bg-[var(--bg-card)]/95 backdrop-blur-xl rounded-xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.08),0_4px_14px_-2px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_45px_-10px_rgba(0,0,0,0.65),0_0_15px_rgba(0,0,0,0.3)] border border-[var(--border-subtle)]/60 px-3.5 sm:px-4 flex items-center justify-between gap-3 transition-all">
          {/* Left: Mobile Toggle + Breadcrumb Navigation */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Drawer Button */}
            <button
              type="button"
              onClick={toggleMobileMenu}
              className="lg:hidden h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)]/60 hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Back Button (shown on subpages or if history is available) */}
            {showBackButton ? (
              <button
                type="button"
                onClick={() => {
                  if (window.history.length > 1) {
                    router.back();
                  } else {
                    router.push(breadcrumb.sectionHref);
                  }
                }}
                className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)]/60 hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer shrink-0"
                title="Kembali"
                aria-label="Kembali"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : null}

            {/* Home Jump Link */}
            <button
              type="button"
              onClick={() => triggerSplashNavigation("/")}
              title="Ke Landing Page"
              aria-label="Ke Landing Page"
              className="h-9 w-9 hidden sm:flex items-center justify-center rounded-lg bg-[var(--bg-secondary)]/40 hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)]/70 hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--zcash-gold)] transition cursor-pointer shrink-0"
            >
              <Home className="w-4 h-4" />
            </button>

            {/* Subtle Divider */}
            <div className="h-4 w-px bg-[var(--border-subtle)]/70 hidden sm:block shrink-0" />

            {/* Mobile Logo Fallback */}
            <div className="sm:hidden shrink-0">
              <Logo size={26} showText={false} />
            </div>

            {/* Breadcrumb Path */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 sm:gap-2 text-xs truncate">
              {breadcrumb.page ? (
                <>
                  <Link
                    href={breadcrumb.sectionHref}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition shrink-0"
                  >
                    {breadcrumb.section}
                  </Link>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]/60 shrink-0" />
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {breadcrumb.page}
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-2 truncate">
                  <span className="font-bold text-sm text-[var(--text-primary)] tracking-tight truncate">
                    {breadcrumb.section}
                  </span>
                  {breadcrumb.badge && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-[var(--zcash-gold)] bg-[var(--zcash-gold-dim)]/40 border border-[var(--zcash-gold-border)]/40">
                      <Shield className="w-2.5 h-2.5" />
                      {breadcrumb.badge}
                    </span>
                  )}
                </div>
              )}
            </nav>
          </div>

          {/* Right: Scenario Switcher, Balance, Theme & Status */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Scenario Switcher */}
            <div className="w-36 sm:w-48 md:w-56">
              <SearchableSelect<MockScenario>
                options={scenarioOptions}
                value={activeScenario}
                onChange={handleScenarioChange}
                searchPlaceholder="Search scenario..."
                align="right"
                icon={<Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />}
                dropdownClassName="w-72 sm:w-80"
              />
            </div>

            {/* Live On-Chain Balance Badge */}
            <Link
              href="/vaults/vault-demo-001"
              className="hidden sm:inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-[var(--bg-secondary)]/70 hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--zcash-gold-border)] transition text-xs shadow-xs group"
              title="Live On-Chain Balance (Ironwood)"
            >
              <Wallet className="w-3.5 h-3.5 text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
              <span className="font-mono font-bold text-[var(--text-primary)]">{balance ?? "0.2000"}</span>
              <span className="text-[10px] text-[var(--zcash-gold)] font-bold font-mono">TAZ</span>
            </Link>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--bg-secondary)]/70 hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition shadow-xs cursor-pointer shrink-0"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* Status Pills */}
            <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-[var(--border-subtle)]/70">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Non-Custodial</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-secondary)]/80 border border-[var(--border-subtle)]/70">
                Demo
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Scenario Activation Toast */}
      {scenarioNotification && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md p-4 rounded-xl bg-[var(--bg-card)] border border-amber-500/30 text-[var(--text-primary)] shadow-2xl backdrop-blur-xl animate-fade-in flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <h4 className="text-xs font-bold text-[var(--text-primary)]">
              {scenarioNotification.title}
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {scenarioNotification.desc}
            </p>
            {!pathname.includes("/approvals") && (
              <div className="pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  href="/approvals/demo-proposal-001"
                  className="text-[11px] py-1 px-3 rounded-lg"
                  iconRight={<ArrowUpRight className="w-3 h-3" />}
                >
                  Uji Skenario di Proposal
                </Button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setScenarioNotification(null)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 text-xs cursor-pointer rounded-md"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
