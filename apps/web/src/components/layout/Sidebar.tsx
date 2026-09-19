"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Vault, 
  FileCheck, 
  KeyRound, 
  X,
  Lock
} from "lucide-react";
import { useUI } from "@/context/UIContext";
import { Logo } from "@/components/ui/Logo";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    label: "Vaults",
    href: "/vaults",
    icon: Vault,
    badge: "1 Active",
  },
  {
    label: "Approvals",
    href: "/approvals",
    icon: FileCheck,
    badge: "1 Pending",
  },
  {
    label: "Ceremony Wizard",
    href: "/vaults/vault-demo-001/ceremony",
    icon: KeyRound,
    badge: "Demo",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isMobileMenuOpen, closeMobileMenu } = useUI();

  const renderNavContent = () => (
    <div className="flex flex-col h-full bg-[var(--bg-card)] border-r border-[var(--border-subtle)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Brand Header */}
      <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <Link 
          href="/" 
          onClick={closeMobileMenu}
          className="group block"
        >
          <Logo size={36} showText={true} />
        </Link>

        {/* Mobile Close Button */}
        <button
          onClick={closeMobileMenu}
          className="lg:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] transition"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Network Indicator */}
      <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[var(--text-secondary)] font-medium">Zcash Testnet</span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">Shielded</span>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase font-mono">
          Main Menu
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobileMenu}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? "bg-[var(--zcash-gold-dim)] text-[var(--zcash-gold)] border border-[var(--zcash-gold-border)] font-semibold shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)] border border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? "text-[var(--zcash-gold)]" : "text-[var(--text-muted)]"}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isActive
                      ? "bg-[var(--zcash-gold-dim)] text-[var(--zcash-gold)] border border-[var(--zcash-gold-border)]"
                      : "bg-[var(--border-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-4 px-3 pb-2 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase font-mono">
          Active Vault
        </div>
        
        {/* Quick Vault Mini Card */}
        <div className="mx-1 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-primary)] truncate">Dev Treasury</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              2 of 3
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Balance</span>
            <span className="text-[var(--zcash-gold)] font-semibold font-mono">14.50 TAZ</span>
          </div>
          <div className="w-full bg-[var(--border-subtle)] h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full w-2/3 rounded-full" />
          </div>
        </div>
      </div>

      {/* Zero Custody Proof Footer */}
      <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          <span>Keys Held By You</span>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          Private key shares never leave your device. Zero custody, cryptographic proof.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 z-30">
        {renderNavContent()}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            onClick={closeMobileMenu}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {renderNavContent()}
          </div>
        </div>
      )}
    </>
  );
}
