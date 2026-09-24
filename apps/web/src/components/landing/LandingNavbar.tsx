"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Menu, X } from "lucide-react";
import { useSplashScreen } from "@/components/ui/SplashScreenProvider";
import { Button } from "@/components/ui/Button";

export type LandingNavTab = "home" | "about" | "services" | "project";

interface LandingNavbarProps {
  activeTab?: LandingNavTab;
  onSelectTab?: (tab: LandingNavTab) => void;
}

export function LandingNavbar({ activeTab: initialActiveTab = "home", onSelectTab }: LandingNavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentTab, setCurrentTab] = useState<LandingNavTab>(initialActiveTab);
  const isClickScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { triggerSplashNavigation } = useSplashScreen();

  const navLinks: { id: LandingNavTab; label: string; href: string }[] = [
    { id: "home", label: "Home", href: "/#hero" },
    { id: "about", label: "About", href: "/#about" },
    { id: "services", label: "Services", href: "/#services" },
    { id: "project", label: "Project", href: "/#project" },
  ];

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 20);

          // If currently smooth scrolling from a user click, do not override with intermediate sections
          if (!isClickScrollingRef.current) {
            // Check if user is at bottom of page
            const atBottom =
              window.innerHeight + window.scrollY >=
              document.documentElement.scrollHeight - 80;

            if (atBottom) {
              setCurrentTab("project");
            } else {
              const sections: { id: LandingNavTab; el: HTMLElement | null }[] = [
                { id: "home", el: document.getElementById("hero") },
                { id: "about", el: document.getElementById("about") },
                { id: "services", el: document.getElementById("services") },
                { id: "project", el: document.getElementById("project") },
              ];

              const targetZone = 180; // Focus line below top navbar
              let activeId: LandingNavTab = "home";

              for (const sec of sections) {
                if (sec.el) {
                  const rect = sec.el.getBoundingClientRect();
                  // If top of section has scrolled past or is near our target line
                  if (rect.top <= targetZone) {
                    activeId = sec.id;
                  }
                }
              }

              setCurrentTab((prev) => (prev !== activeId ? activeId : prev));
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    link: { id: LandingNavTab; label: string; href: string }
  ) => {
    setIsMobileMenuOpen(false);
    setCurrentTab(link.id);
    if (onSelectTab) {
      onSelectTab(link.id);
    }

    // Set lock so scroll event won't overwrite the active tab mid-scroll
    isClickScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isClickScrollingRef.current = false;
    }, 850);

    // If on home page, smoothly scroll to section taking fixed navbar height into account
    if (typeof window !== "undefined" && window.location.pathname === "/") {
      const hash = link.href.split("#")[1];
      if (hash) {
        e.preventDefault();
        const target = document.getElementById(hash);
        if (target) {
          const navbarHeight = 85;
          const targetPosition =
            target.getBoundingClientRect().top + window.scrollY - navbarHeight;
          window.scrollTo({ top: targetPosition, behavior: "smooth" });
          window.history.pushState(null, "", `#${hash}`);
        }
      }
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300">
      <div
        className={`w-full transition-all duration-300 ${
          isScrolled
            ? "bg-[#080c16]/85 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] py-3 sm:py-3.5"
            : "bg-transparent py-5 sm:py-7"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between">
          {/* Brand Logo - Pure & Clean */}
          <Link
            href="/"
            onClick={(e) => handleNavClick(e, navLinks[0])}
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
              const isActive = currentTab === link.id;
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link)}
                  className={`relative py-1 text-sm tracking-wide font-medium transition-colors duration-200 cursor-pointer ${
                    isActive
                      ? "text-amber-400 font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>{link.label}</span>
                  <span
                    className={`absolute -bottom-1 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-400 to-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.8)] transition-all duration-300 ${
                      isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0 pointer-events-none"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Right Action Button */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Open Vault Button — Boxy Primary Gold Button */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => triggerSplashNavigation("/vaults")}
            >
              Open vault
            </Button>

            {/* Mobile Hamburger Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
            </Button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden max-w-7xl mx-auto px-6 mt-3 animate-fade-in">
            <div className="p-4 bg-[#080c16]/95 border border-white/10 backdrop-blur-2xl shadow-2xl rounded-xl space-y-2">
              {navLinks.map((link) => {
                const isActive = currentTab === link.id;
                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link)}
                    className={`flex items-center justify-between px-3.5 py-2.5 text-sm transition cursor-pointer border rounded-lg ${
                      isActive
                        ? "border-[var(--zcash-gold-border)] bg-[var(--zcash-gold-dim)] text-[var(--zcash-gold)] font-bold"
                        : "border-transparent text-slate-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span>{link.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
