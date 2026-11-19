import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "AirWise — Smog Companion", template: "%s · AirWise" },
  description:
    "AirWise turns live air-quality data into a personal daily plan that cuts your family's smog exposure and emissions, and explains the impact of every choice.",
  applicationName: "AirWise",
};

export const viewport: Viewport = {
  themeColor: "#f2f5fa",
  width: "device-width",
  initialScale: 1,
};

/** Applies the saved theme before first paint to avoid a flash of the wrong theme. */
const themeScript = `(function(){try{var t=localStorage.getItem('airwise.theme');var d=t==='dark';document.documentElement.classList.toggle('dark',d);function sync(){document.querySelector('meta[name=theme-color]')?.setAttribute('content',document.documentElement.classList.contains('dark')?'#09090b':'#f2f5fa')}sync();document.addEventListener('DOMContentLoaded',sync,{once:true});}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
