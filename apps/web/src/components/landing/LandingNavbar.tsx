"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Menu, X } from "lucide-react";
import { useSplashScreen } from "@/components/ui/SplashScreenProvider";

export type LandingNavTab = "home" | "services" | "project" | "about";

interface LandingNavbarProps {
  activeTab?: LandingNavTab;
  onSelectTab?: (tab: LandingNavTab) => void;
}

export function LandingNavbar({ activeTab = "home", onSelectTab }: LandingNavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { triggerSplashNavigation } = useSplashScreen();

  const navLinks: { id: LandingNavTab; label: string; href: string }[] = [
    { id: "home", label: "Home", href: "/" },
    { id: "services", label: "Services", href: "/services" },
    { id: "project", label: "Project", href: "/project" },
    { id: "about", label: "About", href: "/about" },
  ];

  const handleNavClick = (link: { id: LandingNavTab; label: string; href: string }) => {
    setIsMobileMenuOpen(false);
    if (onSelectTab) {
      onSelectTab(link.id);
    }
  };

  return (
    <header className="relative z-30 w-full max-w-7xl mx-auto px-6 lg:px-12 pt-6 sm:pt-8 flex items-center justify-between">
      {/* Brand Logo - Pure & Clean */}
      <Link
        href="/"
        onClick={() => handleNavClick(navLinks[0])}
        className="flex items-center gap-3 group select-none"
      >
        <div className="relative w-8 h-8 sm:w-9 sm:h-9 shrink-0 group-hover:scale-105 transition-transform">
          <Image
            src="/favicon.png"
            alt="Quorum Fi Logo"
            width={160}
            height={160}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white font-heading flex items-center gap-1">
              Quorum <span className="text-[#E2B16B]">Fi</span>
            </span>
            <span className="text-[10px] tracking-wider text-slate-400 uppercase font-mono hidden sm:inline">
              Shielded Multisig
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 ml-1">
            <span className="text-[11px] text-slate-500 font-sans">powered by</span>
            <div className="relative w-4 h-4 shrink-0">
              <Image
                src="/zcash-logo-yellow.png"
                alt="Zcash Official Yellow Logo"
                width={32}
                height={32}
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-bold text-[#F4B728] font-heading tracking-wide">Zcash</span>
          </div>
        </div>
      </Link>

      {/* Center Nav Links - Desktop: Clean transparent text-only navbar */}
      <nav className="hidden md:flex items-center gap-6 lg:gap-8">
        {navLinks.map((link) => {
          const isActive = activeTab === link.id;
          return (
            <Link
              key={link.id}
              href={link.href}
              onClick={() => handleNavClick(link)}
              className={`relative py-1 text-sm tracking-wide font-medium transition-colors duration-200 cursor-pointer ${
                isActive
                  ? "text-amber-400 font-semibold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>{link.label}</span>
              {isActive && (
                <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 to-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Right Action Button & Mobile Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => triggerSplashNavigation("/vaults")}
          className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 text-xs sm:text-sm font-bold tracking-tight shadow-xl hover:shadow-2xl transition active:scale-95 cursor-pointer select-none"
        >
          <span>Start Your Project</span>
          <ArrowRight className="w-4 h-4 text-slate-950" />
        </button>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white transition cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-6 right-6 mt-3 p-4 rounded-3xl bg-[#080c16]/95 border border-white/10 backdrop-blur-2xl shadow-2xl z-40 animate-fade-in space-y-1">
          {navLinks.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <Link
                key={link.id}
                href={link.href}
                onClick={() => handleNavClick(link)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm transition cursor-pointer ${
                  isActive
                    ? "text-amber-400 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>{link.label}</span>
                {isActive && <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
