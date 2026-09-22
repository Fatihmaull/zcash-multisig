"use client";

import { LandingNavbar, type LandingNavTab } from "./LandingNavbar";
import { LandingFooter } from "./LandingFooter";

interface LandingLayoutProps {
  children: React.ReactNode;
  activeTab?: LandingNavTab;
  className?: string;
}

export function LandingLayout({
  children,
  activeTab = "home",
  className = "",
}: LandingLayoutProps) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden text-white flex flex-col justify-between font-sans">
      {/* Top Header Navigation */}
      <LandingNavbar activeTab={activeTab} />

      {/* Main Content Area */}
      <main className={`relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex-1 pt-6 sm:pt-10 pb-16 ${className}`}>
        {children}
      </main>

      {/* Clean Bottom Bar & Floating Button */}
      <LandingFooter />
    </div>
  );
}
