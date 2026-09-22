import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { UIProvider } from "@/context/UIContext";
import { SplashScreenProvider } from "@/components/ui/SplashScreenProvider";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quorum — Non-Custodial Shielded Multisig for Zcash",
  description:
    "Threshold FROST/RedPallas orchestration layer for Zcash shielded pools. Zero-custody key ceremony, distributed approvals, and F4 misbehaving signer detection.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
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
      <body className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} font-sans min-h-screen antialiased bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200`}>
        <UIProvider>
          <SplashScreenProvider>
            <AppShell>
              {children}
            </AppShell>
          </SplashScreenProvider>
        </UIProvider>
      </body>
    </html>
  );
}
