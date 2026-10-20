import type { Metadata, Viewport } from "next";
import { Orbitron, Space_Grotesk } from "next/font/google";
import "./globals.css";

const body = Space_Grotesk({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Orbitron({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "XAI Leader — Simulasi Performance Marketing",
  description: "Simulasi pengambilan keputusan tim performance marketing bersama XAI Leader (Acting General Manager).",
  robots: { index: false, follow: false },
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#07080b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
