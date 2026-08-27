"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Plus, LayoutDashboard, Sparkles, Activity, Server } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api/client";

export function Header() {
  const pathname = usePathname();
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/health`, { method: "GET", signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          setApiOnline(data.status === "ok" || data.status === "degraded");
        } else {
          setApiOnline(false);
        }
      } catch {
        setApiOnline(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Live Status */}
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-3 transition">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-400/35 transition-all">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950/90 transition group-hover:bg-slate-950/70">
                <Compass className="h-5 w-5 text-cyan-400 stroke-[2.5] transition group-hover:rotate-45" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-black tracking-wider text-white text-lg leading-none">
                SCOUT
              </span>
              <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase mt-0.5 font-bold">
                Research Intelligence
              </span>
            </div>
          </Link>

          {/* Backend Status Indicator */}
          <div
            className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-[11px] font-mono text-slate-400"
            title={apiOnline ? "Fastify API Backend Connected" : "API Offline (Run npm run dev:api)"}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                apiOnline === true
                  ? "bg-emerald-400 shadow-sm shadow-emerald-400"
                  : apiOnline === false
                  ? "bg-rose-500 shadow-sm shadow-rose-500"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            <span>{apiOnline === true ? "API Online" : apiOnline === false ? "API Offline" : "Checking..."}</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard"
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
              pathname.startsWith("/dashboard")
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10"
                : "text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </Link>

          <Link
            href="/research/new"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-md shadow-cyan-500/25 transition-all hover:brightness-110 hover:shadow-cyan-400/40 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4 stroke-[3]" />
            <span className="hidden sm:inline">Start Research</span>
            <span className="sm:hidden">New</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
export default Header;
