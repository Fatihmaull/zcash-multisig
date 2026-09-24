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
    <div className="dark relative min-h-screen w-full overflow-x-clip text-white flex flex-col justify-between font-sans">
      {/* Top Header Navigation */}
      <LandingNavbar activeTab={activeTab} />

      {/* Main Content Area (padded top for fixed navbar) */}
      <main className={`relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex-1 pt-24 sm:pt-28 pb-16 ${className}`}>
        {children}
      </main>

      {/* Clean Bottom Bar & Floating Button */}
      <LandingFooter />
    </div>
  );
}
