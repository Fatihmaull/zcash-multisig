"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { LandingBackground } from "@/components/landing/LandingBackground";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage =
    pathname === "/" ||
    pathname === "/services" ||
    pathname === "/project" ||
    pathname === "/projects" ||
    pathname === "/about";

  if (isLandingPage) {
    return (
      <div className="relative min-h-screen w-full bg-[#030712] text-white selection:bg-amber-500 selection:text-black">
        {/* Persistent YouTube Cinematic Background (kept alive across /services, /project, /about, /) */}
        <LandingBackground />
        <div className="relative z-10 w-full min-h-screen">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-cypher-pattern">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <Header />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
