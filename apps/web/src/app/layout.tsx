import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { UIProvider } from "@/context/UIContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Quorum — Non-Custodial Shielded Multisig for Zcash",
  description:
    "Threshold FROST/RedPallas orchestration layer for Zcash shielded pools. Zero-custody key ceremony, distributed approvals, and F4 misbehaving signer detection.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/logo.png", type: "image/png" },
    ],
    apple: "/logo.png",
  },
  keywords: [
    "Zcash",
    "multisig",
    "threshold signing",
    "FROST",
    "RedPallas",
    "shielded",
    "non-custodial",
    "cryptocurrency",
    "privacy",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans min-h-screen antialiased bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200`}>
        <UIProvider>
          <div className="flex min-h-screen w-full bg-cypher-pattern">
            {/* Responsive Sidebar (Desktop fixed, Mobile sliding drawer) */}
            <Sidebar />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 w-full">
              <Header />
              <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-x-hidden">
                {children}
              </main>
            </div>
          </div>
        </UIProvider>
      </body>
    </html>
  );
}
