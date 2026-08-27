"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ResearchSessionsApi } from "@/lib/api/research-sessions";
import { ReportContent, ReportData } from "@/lib/api/types";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Award,
  BookOpen,
  ShieldCheck,
  Printer,
  Sparkles,
} from "lucide-react";

export default function ResearchReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [report, setReport] = useState<ReportData | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>("COMPLETED");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ResearchSessionsApi.getReport(id);
      setSessionStatus(res.status);
      setReport(res.report);
    } catch (err: any) {
      setError(err.message || "Failed to load research report.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-400">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p className="text-sm font-medium">Fetching synthesized intelligence report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <div className="glass-card rounded-3xl p-10 border-rose-500/30 bg-rose-500/10">
          <AlertTriangle className="mx-auto h-12 w-12 text-rose-400 mb-3" />
          <h2 className="text-xl font-bold text-white">Error Loading Report</h2>
          <p className="mt-2 text-xs text-rose-200/80 max-w-md mx-auto">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={fetchReport}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Request</span>
            </button>
            <Link
              href={`/research/${id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-cyan-400"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Session</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <div className="glass-card rounded-3xl p-12">
          <FileText className="mx-auto h-14 w-14 text-slate-600 mb-4" />
          <h2 className="text-xl font-black text-white">Report Not Generated Yet</h2>
          <p className="mt-2 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {sessionStatus === "IN_PROGRESS" || sessionStatus === "QUEUED"
              ? "Research tasks are currently executing in the background worker queue. Synthesis will run automatically once tasks finish."
              : "No report has been synthesized for this session."}
          </p>
          <div className="mt-6">
            <Link
              href={`/research/${id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-cyan-400"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Research Session</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const content: ReportContent = report.content;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/research/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Session Workspace</span>
        </Link>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 transition"
        >
          <Printer className="h-3.5 w-3.5 text-cyan-400" />
          <span>Print / Export PDF</span>
        </button>
      </div>

      {/* Main Report Container */}
      <div className="glass-card rounded-3xl p-6 sm:p-10 space-y-8 border-cyan-500/20">
        {/* Title & Banner */}
        <div className="border-b border-slate-800/80 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-extrabold text-emerald-400 border border-emerald-500/20 mb-3 shadow-sm shadow-emerald-500/10">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>SCOUT Verified Research Report</span>
          </div>

          <h1 className="text-3xl font-black text-white sm:text-4xl leading-tight">
            {content.title || report.title}
          </h1>

          <p className="mt-3 text-xs font-semibold text-slate-400 leading-relaxed">
            Research Question: <span className="text-slate-200 font-bold">{content.researchQuestion}</span>
          </p>
        </div>

        {/* Executive Summary */}
        {content.executiveSummary && (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-6 sm:p-8">
            <h2 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span>Executive Summary</span>
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed font-normal">
              {content.executiveSummary}
            </p>
          </div>
        )}

        {/* Methodology Stats Grid */}
        {content.methodology && (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest mb-3">
              Methodology Overview
            </h3>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">{content.methodology.overview}</p>

            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="rounded-xl bg-slate-900 p-3 border border-slate-800">
                <span className="block text-[10px] font-mono text-slate-500 uppercase">Tasks Completed</span>
                <span className="font-black text-emerald-400 text-base">{content.methodology.tasksCompleted}</span>
              </div>
              <div className="rounded-xl bg-slate-900 p-3 border border-slate-800">
                <span className="block text-[10px] font-mono text-slate-500 uppercase">Tasks Failed</span>
                <span className="font-black text-slate-300 text-base">{content.methodology.tasksFailed}</span>
              </div>
              <div className="rounded-xl bg-slate-900 p-3 border border-slate-800">
                <span className="block text-[10px] font-mono text-slate-500 uppercase">Sources Analyzed</span>
                <span className="font-black text-cyan-400 text-base">{content.methodology.sourcesAnalyzed}</span>
              </div>
            </div>
          </div>
        )}

        {/* Key Findings */}
        {content.keyFindings && content.keyFindings.length > 0 && (
          <div>
            <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-400" />
              <span>Key Verified Findings</span>
            </h2>

            <div className="space-y-4">
              {content.keyFindings.map((kf, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-800/80 bg-slate-900/80 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-bold text-slate-100 leading-relaxed">
                      {kf.finding}
                    </p>
                    <span className="shrink-0 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-mono font-bold text-cyan-400 border border-cyan-500/20">
                      {Math.round(kf.confidence * 100)}% Confidence
                    </span>
                  </div>

                  {kf.citations && kf.citations.length > 0 && (
                    <div className="mt-4 flex items-center gap-2 flex-wrap text-xs text-slate-400">
                      <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Citations:</span>
                      {kf.citations.map((citeId) => (
                        <span key={citeId} className="rounded-lg bg-slate-950 px-2.5 py-1 font-mono text-[11px] text-cyan-300 border border-slate-800">
                          {citeId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Analysis */}
        {content.detailedAnalysis && content.detailedAnalysis.length > 0 && (
          <div>
            <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-cyan-400" />
              <span>Detailed Analysis</span>
            </h2>

            <div className="space-y-6">
              {content.detailedAnalysis.map((section, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 sm:p-8">
                  <h3 className="text-lg font-bold text-cyan-400 mb-3">
                    {section.sectionTitle}
                  </h3>
                  <div className="text-sm text-slate-300 leading-relaxed space-y-3 whitespace-pre-wrap font-normal">
                    {section.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contradictions & Conflicts */}
        {content.contradictions && content.contradictions.length > 0 && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 sm:p-8">
            <h2 className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Contradictions &amp; Conflicting Evidence</span>
            </h2>

            <div className="space-y-3">
              {content.contradictions.map((c, idx) => (
                <div key={idx} className="rounded-xl bg-slate-950 p-4 border border-amber-500/20">
                  <h4 className="font-bold text-xs text-amber-300 mb-1">{c.topic}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{c.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Methodology Limitations */}
        {content.limitations && content.limitations.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
            <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest mb-3">
              Methodology Limitations
            </h3>
            <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-400">
              {content.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Conclusion */}
        {content.conclusion && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 border-t-4 border-t-cyan-400">
            <h2 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest mb-3">
              Conclusion
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed font-normal">
              {content.conclusion}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
