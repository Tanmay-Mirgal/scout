"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ResearchSessionsApi } from "@/lib/api/research-sessions";
import { ScoutApiError } from "@/lib/api/client";
import {
  Compass,
  ArrowLeft,
  Sparkles,
  Send,
  AlertCircle,
  Lightbulb,
  Cpu,
  Zap,
  Globe,
} from "lucide-react";

const EXAMPLE_PROMPTS = [
  {
    title: "EV Grid Adoption Impact",
    query: "What are the long-term economic and environmental impacts of electric vehicle adoption across North America?",
    description: "Analyze grid infrastructure requirements, raw battery material supply chains, and lifecycle emissions.",
    tag: "Energy & Infrastructure",
  },
  {
    title: "Grid Energy Storage Efficiency",
    query: "Compare round-trip energy efficiency and levelized cost of storage between vanadium redox flow batteries and lithium-ion systems.",
    description: "Focus on utility-scale long-duration grid storage projects and degradation over 10,000 cycles.",
    tag: "Cleantech Storage",
  },
  {
    title: "Algorithmic Market Volatility",
    query: "How do high-frequency algorithmic trading strategies impact liquidity and market volatility during systemic financial shocks?",
    description: "Examine order book dynamics, flash crashes, and cross-market arbitrage latency.",
    tag: "Quant Finance",
  },
];

export default function CreateResearchPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [description, setDescription] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const applyExample = (ex: typeof EXAMPLE_PROMPTS[0]) => {
    setTitle(ex.title);
    setQuery(ex.query);
    setDescription(ex.description);
    setFormErrors({});
    setApiError(null);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = "Research title is required.";
    } else if (title.trim().length < 3) {
      errors.title = "Title must be at least 3 characters.";
    } else if (title.trim().length > 200) {
      errors.title = "Title cannot exceed 200 characters.";
    }

    if (!query.trim()) {
      errors.query = "Research question/query is required.";
    } else if (query.trim().length < 10) {
      errors.query = "Research query must be at least 10 characters.";
    } else if (query.trim().length > 5000) {
      errors.query = "Query cannot exceed 5000 characters.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    setApiError(null);

    try {
      const session = await ResearchSessionsApi.create({
        title: title.trim(),
        query: query.trim(),
        description: description.trim() || undefined,
      });

      router.push(`/research/${session.id}`);
    } catch (err: any) {
      if (err instanceof ScoutApiError && err.details) {
        const errorsMap: Record<string, string> = {};
        err.details.forEach((d) => {
          errorsMap[d.field] = d.message;
        });
        setFormErrors(errorsMap);
      }
      setApiError(err.message || "Failed to create research session.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Navigation Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="glass-card rounded-3xl p-6 sm:p-10 border-cyan-500/30">
        <div className="mb-8 border-b border-slate-800/80 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-extrabold text-cyan-400 mb-3 shadow-sm shadow-cyan-500/10">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            <span>Launch Autonomous Research Pipeline</span>
          </div>

          <h1 className="text-3xl font-black text-white sm:text-4xl">
            What would you like to research?
          </h1>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed font-normal">
            Submit your research objective. SCOUT will break it down into tasks, crawl web sources, extract facts, map claims, and synthesize a structured report.
          </p>
        </div>

        {/* Preset Prompt Presets */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            <span>Click to pre-fill an example research prompt:</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {EXAMPLE_PROMPTS.map((ex, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyExample(ex)}
                className="glass-card-hover text-left rounded-2xl p-4 transition-all"
              >
                <span className="inline-block rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-cyan-400 border border-slate-800 mb-2">
                  {ex.tag}
                </span>
                <div className="font-bold text-white text-xs line-clamp-1">{ex.title}</div>
                <div className="mt-1 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{ex.query}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Global Error Banner */}
        {apiError && (
          <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Error creating session:</span> {apiError}
            </div>
          </div>
        )}

        {/* Research Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title Input */}
          <div>
            <label htmlFor="title" className="block text-xs font-extrabold text-slate-200 mb-2">
              Research Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="title"
              type="text"
              placeholder="e.g. Electric Vehicle Grid Adoption Impact"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: "" }));
              }}
              className={`w-full rounded-2xl border bg-slate-950/80 px-4 py-3 text-sm font-medium text-slate-100 placeholder-slate-500 focus:outline-none transition-all ${
                formErrors.title
                  ? "border-rose-500/60 focus:border-rose-500"
                  : "border-slate-800/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              }`}
            />
            {formErrors.title && (
              <p className="mt-1.5 text-xs text-rose-400 font-bold">{formErrors.title}</p>
            )}
          </div>

          {/* Query Textarea */}
          <div>
            <label htmlFor="query" className="block text-xs font-extrabold text-slate-200 mb-2">
              Research Question / Detailed Query <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="query"
              rows={4}
              placeholder="What are the long-term economic and environmental impacts of electric vehicle adoption across North America?"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (formErrors.query) setFormErrors((prev) => ({ ...prev, query: "" }));
              }}
              className={`w-full rounded-2xl border bg-slate-950/80 p-4 text-sm font-medium text-slate-100 placeholder-slate-500 focus:outline-none transition-all ${
                formErrors.query
                  ? "border-rose-500/60 focus:border-rose-500"
                  : "border-slate-800/80 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              }`}
            />
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>Be specific for optimal agent web crawling &amp; fact extractions.</span>
              <span>{query.length}/5000</span>
            </div>
            {formErrors.query && (
              <p className="mt-1.5 text-xs text-rose-400 font-bold">{formErrors.query}</p>
            )}
          </div>

          {/* Optional Context Description */}
          <div>
            <label htmlFor="description" className="block text-xs font-extrabold text-slate-200 mb-2">
              Additional Context / Constraints <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <textarea
              id="description"
              rows={3}
              placeholder="Focus on grid infrastructure requirements, raw material supply chains, and lifecycle emissions."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-slate-800/80 bg-slate-950/80 p-4 text-sm font-medium text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-800/80">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-6 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-cyan-500/25 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <>
                  <div className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Connecting Backend...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Create Research Session</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
