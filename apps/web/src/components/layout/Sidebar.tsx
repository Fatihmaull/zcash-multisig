"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Vault, 
  FileCheck, 
  KeyRound, 
  X,
  Lock,
  Globe
} from "lucide-react";
import { useUI } from "@/context/UIContext";
import { useSplashScreen } from "@/components/ui/SplashScreenProvider";
import { Logo } from "@/components/ui/Logo";

interface SidebarStats {
  activeVaultsCount: number;
  pendingApprovalsCount: number;
  activeVault: {
    id: string;
    label: string;
    threshold: number;
    totalParticipants: number;
    network: string;
  } | null;
}

export function Sidebar() {
  const pathname = usePathname();
  const { isMobileMenuOpen, closeMobileMenu } = useUI();
  const { triggerSplashNavigation } = useSplashScreen();

  const [stats, setStats] = useState<SidebarStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Fetch dynamic stats for active vaults and pending approvals
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadStats() {
      try {
        const res = await fetch("/api/sidebar/stats", {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        if (isMounted && json?.success && json?.data) {
          setStats(json.data);
        }
      } catch (err: unknown) {
        if (!isMounted || (err as Error)?.name === "AbortError") {
          return;
        }
        // Leave stats unset. A failed fetch is not a vault.
      } finally {
        if (isMounted) {
          setIsLoadingStats(false);
        }
      }
    }

    loadStats();

    // Re-poll every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    {
      label: "Landing Page",
      href: "/",
      icon: Globe,
      badge: null,
    },
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      badge: null,
    },
    {
      label: "Vaults",
      href: "/vaults",
      icon: Vault,
      badge: isLoadingStats ? "..." : stats ? `${stats.activeVaultsCount} Active` : "—",
      badgeVariant: "vault" as const,
    },
    {
      label: "Approvals",
      href: "/approvals",
      icon: FileCheck,
      badge: isLoadingStats ? "..." : stats ? `${stats.pendingApprovalsCount} Pending` : "—",
      badgeVariant: "approval" as const,
      hasPendingAlert: (stats?.pendingApprovalsCount ?? 0) > 0,
    },
    {
      label: "Ceremony Wizard",
      href: stats?.activeVault?.id
        ? `/vaults/${stats.activeVault.id}/ceremony`
        : "/vaults",
      icon: KeyRound,
      badge: null,
    },
  ];

  const renderNavContent = () => (
    <div className="flex flex-col h-full bg-[var(--bg-card)] rounded-xl border-0 text-[var(--text-primary)] overflow-hidden" style={{ boxShadow: "var(--card-shadow)" }}>
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <button 
          onClick={() => {
            closeMobileMenu();
            triggerSplashNavigation("/");
          }}
          className="group block text-left cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zcash-gold)]"
        >
          <Logo size={34} showText={true} />
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={closeMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]/60 transition-palette"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Network Indicator */}
      <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex rounded-full h-2 w-2"
              style={{ background: "var(--success)" }}
            />
            <span className="text-[var(--text-secondary)] font-medium">Zcash Testnet</span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">Shielded</span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2.5 pb-2 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase font-mono">
          Main Menu
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          if (item.href === "/") {
            return (
              <button
                key={item.href}
                onClick={() => {
                  closeMobileMenu();
                  triggerSplashNavigation("/");
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-palette cursor-pointer ${
                  isActive
                    ? "bg-[var(--zcash-gold-dim)] text-[var(--zcash-gold)] font-semibold shadow-xs"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4.5 h-4.5 ${isActive ? "text-[var(--zcash-gold)]" : "text-[var(--text-muted)]"}`} />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobileMenu}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-palette ${
                isActive
                  ? "bg-[var(--zcash-gold-dim)] text-[var(--zcash-gold)] font-semibold shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]/50"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4.5 h-4.5 ${isActive ? "text-[var(--zcash-gold)]" : "text-[var(--text-muted)]"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-medium tracking-tight font-mono transition-palette ${
                    item.badgeVariant === "vault"
                      ? "bg-[var(--info-bg)] text-[var(--info)] border border-[var(--info-border)]"
                      : item.badgeVariant === "approval" && item.hasPendingAlert
                        ? "bg-[var(--warning-bg)] text-[var(--warning-text)] border border-[var(--warning-border)]"
                        : "bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-4 px-2.5 pb-2 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase font-mono">
          Active Vault
        </div>
        
        {/* Dynamic Quick Vault Mini Card */}
        <Link
          href={stats?.activeVault?.id ? `/vaults/${stats.activeVault.id}` : "/vaults"}
          onClick={closeMobileMenu}
          className="group block p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50 hover:bg-[var(--bg-secondary)] hover:border-[var(--zcash-gold-border)] transition-palette space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--zcash-gold)] transition-palette truncate max-w-[130px]">
              {isLoadingStats ? (
                <span className="inline-block w-20 h-3.5 bg-[var(--border-subtle)] rounded"></span>
              ) : (
                stats?.activeVault?.label || "No vault recorded"
              )}
            </span>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-md border"
              style={{
                background: "var(--success-bg)",
                color: "var(--success-text)",
                borderColor: "var(--success-border)",
              }}
            >
              {isLoadingStats
                ? "..."
                : stats?.activeVault
                  ? `${stats.activeVault.threshold} of ${stats.activeVault.totalParticipants}`
                  : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>Network</span>
            <span className="text-[var(--text-secondary)] font-medium font-mono">
              {stats?.activeVault?.network ?? "—"}
            </span>
          </div>
        </Link>
      </div>

      {/* Zero Custody Proof Footer */}
      <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)]/40 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--success-text)" }}>
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Keys Held By You</span>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          Private key shares never leave your device.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar with outer padding and floating elevation */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 z-30 p-3">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            onClick={closeMobileMenu}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] p-3 z-10">
            {renderNavContent()}
          </div>
        </div>
      )}
    </>
  );
}

