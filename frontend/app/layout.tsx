import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Brain } from "lucide-react";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Deal Intelligence Agent",
  description: "AI-powered sales memory that gets smarter after every meeting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} min-h-screen`}>
        {/* Premium sticky navigation bar */}
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg shadow-sm shadow-indigo-500/20">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <span className="text-slate-900 font-semibold text-sm tracking-tight">
                Deal Intelligence
              </span>
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-xs">Powered by Hindsight</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-600 text-xs font-medium">Live</span>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
