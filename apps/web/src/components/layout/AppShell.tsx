"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  if (isLandingPage) {
    return <div className="min-h-screen w-full bg-[#03060a] text-white selection:bg-amber-500 selection:text-black">{children}</div>;
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
