import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pulse4663 — Robinhood Chain (4663) On-Chain Intelligence & v4 Guard",
  description:
    "Real-time contract bytecode X-ray, 14-bit Uniswap v4 permission decoder, CREATE2 salt synthesizer, and private Venice AI security auditor for Robinhood Chain Mainnet (Chain ID: 4663).",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#FAFAFA] text-[#111315] dark:bg-[#0B0D0E] dark:text-[#F3F4F6] font-sans selection:bg-emerald-500/20">
        {children}
      </body>
    </html>
  );
}
