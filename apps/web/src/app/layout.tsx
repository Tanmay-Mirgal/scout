import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";

export const metadata: Metadata = {
  title: "SCOUT — Multi-Agent Research Intelligence Platform",
  description: "Evidence-aware multi-agent research platform breaking queries into tasks, discovering sources, verifying claims, and synthesizing structured reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col bg-slate-950 text-slate-100 antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-800/60 bg-slate-950 py-6 text-center text-xs text-slate-500">
          <div className="mx-auto max-w-7xl px-4">
            SCOUT Open-Source Research Platform &bull; Powered by Multi-Agent Groq Pipeline
          </div>
        </footer>
      </body>
    </html>
  );
}
