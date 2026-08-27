"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Compass,
  ArrowRight,
  Sparkles,
  Search,
  Database,
  ShieldCheck,
  FileText,
  Layers,
  Cpu,
  CheckCircle2,
  Zap,
  Globe,
  GitBranch,
  BarChart3,
} from "lucide-react";

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState<number>(0);

  const PIPELINE_STEPS = [
    {
      title: "1. Research Question",
      icon: Compass,
      agent: "User Query Input",
      desc: "User submits a high-level research question requiring multi-source analysis and fact validation.",
      output: "Raw Query Context",
    },
    {
      title: "2. Task Planning",
      icon: Layers,
      agent: "Orchestrator Agent",
      desc: "Decomposes the objective into modular, prioritized research tasks with distinct expected outputs.",
      output: "Research Plan JSON",
    },
    {
      title: "3. Parallel Execution",
      icon: Cpu,
      agent: "BullMQ Queue Workers",
      desc: "Distributes planned tasks across concurrent worker loops using Redis job queues.",
      output: "Concurrent Jobs",
    },
    {
      title: "4. Web Discovery",
      icon: Search,
      agent: "Research Agent & Web Crawler",
      desc: "Searches the live web, extracts raw webpage contents, and evaluates publisher credibility scores.",
      output: "Indexed Sources",
    },
    {
      title: "5. Evidence Extraction",
      icon: Database,
      agent: "Evidence Agent",
      desc: "Extracts factual assertions, quantitative data, and location context from scraped webpage contents.",
      output: "Evidence Records",
    },
    {
      title: "6. Claim Verification",
      icon: ShieldCheck,
      agent: "Critic Agent",
      desc: "Synthesizes candidate claims and maps evidence relationships (SUPPORTED, CONTRADICTED, INSUFFICIENT).",
      output: "Verified Claim Map",
    },
    {
      title: "7. Intelligent Synthesis",
      icon: FileText,
      agent: "Synthesis Agent",
      desc: "Consolidates verified findings into a structured report with source citation validation.",
      output: "Structured Report JSON",
    },
  ];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-grid-pattern pb-20">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 -translate-x-1/2 h-[600px] w-[1000px] rounded-full bg-gradient-to-tr from-cyan-500/15 via-blue-600/10 to-indigo-500/0 blur-[140px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 -z-10 h-[400px] w-[500px] rounded-full bg-emerald-500/10 blur-[130px]" />

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 text-center sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-bold text-cyan-400 mb-8 backdrop-blur-md shadow-sm shadow-cyan-500/10">
          <Sparkles className="h-3.5 w-3.5 animate-spin" />
          <span>Multi-Agent Research &amp; Evidence Engine</span>
        </div>

        <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl leading-[1.1]">
          Research with <span className="gradient-text-cyan">evidence</span>, not assumptions.
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-base sm:text-lg text-slate-400 leading-relaxed font-normal">
          SCOUT breaks complex research questions into tasks, discovers live web sources, extracts location evidence, verifies claim relationships, and synthesizes findings into a structured report.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/research/new"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-8 py-4 text-sm font-black text-slate-950 shadow-xl shadow-cyan-500/25 transition-all hover:brightness-110 hover:shadow-cyan-400/40 active:scale-[0.98]"
          >
            <span>Start Research Session</span>
            <ArrowRight className="h-4 w-4 stroke-[3]" />
          </Link>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/80 px-8 py-4 text-sm font-bold text-slate-200 transition-all hover:border-slate-700 hover:bg-slate-850 hover:text-white backdrop-blur-md"
          >
            <span>Explore Dashboard</span>
          </Link>
        </div>
      </section>

      {/* Interactive Pipeline Architecture Visualizer */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-black text-white sm:text-4xl">
            Autonomous Pipeline Loop
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Click any step to inspect the agent execution flow and outputs.
          </p>
        </div>

        {/* Step Selector Pills */}
        <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 mb-8">
          {PIPELINE_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25"
                    : "glass-card text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>0{idx + 1}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Step Display Card */}
        <div className="glass-card rounded-3xl p-8 sm:p-10 border-cyan-500/30">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-lg bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-400 border border-cyan-500/20">
                <Zap className="h-3.5 w-3.5" />
                <span>Agent Role: {PIPELINE_STEPS[activeStep].agent}</span>
              </div>

              <h3 className="text-2xl font-black text-white">
                {PIPELINE_STEPS[activeStep].title}
              </h3>

              <p className="text-sm text-slate-300 leading-relaxed font-normal">
                {PIPELINE_STEPS[activeStep].desc}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
              <span className="text-[11px] font-mono uppercase text-slate-500 font-bold block">
                Artifact Output Format
              </span>
              <div className="rounded-xl bg-slate-900 p-3 font-mono text-xs text-cyan-400 border border-slate-800 flex items-center justify-between">
                <span>{PIPELINE_STEPS[activeStep].output}</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <span className="text-[11px] text-slate-500 block">
                State committed to Neon PostgreSQL &amp; Redis cache
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-2xl font-black text-white sm:text-4xl">
            Core Platform Capabilities
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl mx-auto">
            Built for enterprise-grade research with domain scoring, evidence extraction, and claim verification.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Orchestrated Planning",
              desc: "Breaks high-level questions into discrete tasks with assigned priorities and output specs.",
              icon: Layers,
              color: "text-cyan-400",
              border: "border-cyan-500/20",
            },
            {
              title: "Live Web Crawling",
              desc: "Discovers current web articles, scrapes webpage contents, and evaluates publisher credibility.",
              icon: Globe,
              color: "text-emerald-400",
              border: "border-emerald-500/20",
            },
            {
              title: "Fact & Claim Verification",
              desc: "Extracts evidence locations and maps support, contradiction, or insufficiency against claims.",
              icon: ShieldCheck,
              color: "text-indigo-400",
              border: "border-indigo-500/20",
            },
            {
              title: "Intelligent Synthesis",
              desc: "Consolidates verified findings into a structured report with source citation validation.",
              icon: FileText,
              color: "text-purple-400",
              border: "border-purple-500/20",
            },
          ].map((cap, idx) => {
            const Icon = cap.icon;
            return (
              <div key={idx} className={`glass-card-hover rounded-3xl p-6 ${cap.border}`}>
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 ${cap.color} border border-slate-800`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{cap.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{cap.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Backend Tech Stack Showcase */}
      <section className="mx-auto max-w-5xl px-4 py-12 text-center sm:px-6 lg:px-8 border-t border-slate-800/80 mt-12">
        <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 mb-6">
          Powered By High-Performance Open Infrastructure
        </h3>

        <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-slate-300">
          <span className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2">Groq Llama 3.3 70B</span>
          <span className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2">Node.js + Fastify</span>
          <span className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2">Neon PostgreSQL</span>
          <span className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2">Upstash Redis</span>
          <span className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2">BullMQ Queues</span>
          <span className="rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2">Next.js 15</span>
        </div>
      </section>
    </div>
  );
}
