"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResearchSessionsApi } from "@/lib/api/research-sessions";
import {
  ResearchSession,
  ResearchTask,
  ProgressMetrics,
} from "@/lib/api/types";
import { ResearchStatusBadge } from "@/components/research/ResearchStatusBadge";
import { ResearchTaskList } from "@/components/research/ResearchTaskList";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Sparkles,
  PlayCircle,
  FileText,
  RefreshCw,
  AlertTriangle,
  Layers,
  CheckCircle2,
  Clock,
  Cpu,
  Copy,
  Check,
} from "lucide-react";

export default function ResearchSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<ResearchSession | null>(null);
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [progress, setProgress] = useState<ProgressMetrics | null>(null);

  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial session & task details
  const loadSessionData = useCallback(async () => {
    setError(null);
    try {
      const sessionData = await ResearchSessionsApi.get(id);
      setSession(sessionData);

      const tasksData = await ResearchSessionsApi.getTasks(id);
      setTasks(tasksData.items);

      if (
        sessionData.status === "IN_PROGRESS" ||
        sessionData.status === "QUEUED"
      ) {
        const progData = await ResearchSessionsApi.getProgress(id);
        setProgress(progData.progress);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load research session.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]);

  // Live polling for IN_PROGRESS or QUEUED state
  useEffect(() => {
    if (!session) return;

    const shouldPoll =
      session.status === "IN_PROGRESS" || session.status === "QUEUED";

    if (shouldPoll) {
      pollingTimerRef.current = setInterval(async () => {
        try {
          const progData = await ResearchSessionsApi.getProgress(id);
          setProgress(progData.progress);

          // Refresh tasks list
          const tasksData = await ResearchSessionsApi.getTasks(id);
          setTasks(tasksData.items);

          // Update session status if changed
          if (progData.status !== session.status) {
            setSession((prev) => (prev ? { ...prev, status: progData.status } : prev));
          }
        } catch (err) {
          console.error("Polling progress error:", err);
        }
      }, 5000);
    } else {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [id, session?.status]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Action: Generate Plan via Orchestrator Agent
  const handleGeneratePlan = async () => {
    setPlanning(true);
    setError(null);
    try {
      const planRes = await ResearchSessionsApi.plan(id);
      setSession((prev) => (prev ? { ...prev, status: planRes.status } : prev));

      const tasksData = await ResearchSessionsApi.getTasks(id);
      setTasks(tasksData.items);
    } catch (err: any) {
      setError(err.message || "Failed to generate research plan.");
    } finally {
      setPlanning(false);
    }
  };

  // Action: Start Async Execution Loop via BullMQ Queues
  const handleStartResearch = async () => {
    setExecuting(true);
    setError(null);
    try {
      const execRes = await ResearchSessionsApi.execute(id);
      setSession((prev) => (prev ? { ...prev, status: execRes.status } : prev));

      const progData = await ResearchSessionsApi.getProgress(id);
      setProgress(progData.progress);
    } catch (err: any) {
      setError(err.message || "Failed to start research execution.");
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-slate-400">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p className="text-sm font-medium">Connecting to session workspace...</p>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <div className="glass-card rounded-3xl p-10 border-rose-500/30 bg-rose-500/10">
          <AlertTriangle className="mx-auto h-12 w-12 text-rose-400 mb-3" />
          <h2 className="text-xl font-bold text-white">Session Workspace Error</h2>
          <p className="mt-2 text-sm text-rose-200/80 max-w-md mx-auto">{error}</p>
          <div className="mt-6">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Navigation Header */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-cyan-400 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>

        <button
          onClick={loadSessionData}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Workspace Header Card */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 mb-8 border-cyan-500/20">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-800/80 pb-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <ResearchStatusBadge status={session.status} />

              <button
                onClick={handleCopyId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition"
                title="Copy Session ID"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-slate-500" />}
                <span>ID: {session.id.substring(0, 8)}...</span>
              </button>
            </div>

            <h1 className="text-2xl font-black text-white sm:text-3xl">
              {session.title}
            </h1>

            <p className="text-xs text-slate-400">
              Created {formatDate(session.createdAt)}
              {session.completedAt && ` &bull; Completed ${formatDate(session.completedAt)}`}
            </p>
          </div>

          {/* Dynamic Action CTAs */}
          <div className="flex items-center gap-3 shrink-0">
            {session.status === "DRAFT" && (
              <button
                onClick={handleGeneratePlan}
                disabled={planning}
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-xs font-black text-slate-950 shadow-lg shadow-cyan-500/20 hover:brightness-110 disabled:opacity-50 transition"
              >
                {planning ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    <span>Orchestrating Plan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate AI Research Plan</span>
                  </>
                )}
              </button>
            )}

            {(session.status === "QUEUED" || session.status === "DRAFT") && tasks.length > 0 && (
              <button
                onClick={handleStartResearch}
                disabled={executing}
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-5 py-3 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 disabled:opacity-50 transition"
              >
                {executing ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    <span>Queuing Execution...</span>
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4" />
                    <span>Launch Research Queue</span>
                  </>
                )}
              </button>
            )}

            {session.status === "COMPLETED" && (
              <Link
                href={`/research/${session.id}/report`}
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-6 py-3 text-xs font-black text-slate-950 shadow-lg shadow-cyan-500/20 hover:brightness-110 transition"
              >
                <FileText className="h-4 w-4" />
                <span>View Synthesized Report</span>
              </Link>
            )}
          </div>
        </div>

        {/* Question Details Box */}
        <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-5">
          <h3 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest mb-1.5">
            Research Question
          </h3>
          <p className="text-sm font-semibold text-slate-200 leading-relaxed">
            {session.query}
          </p>
          {session.description && (
            <p className="mt-3 text-xs text-slate-400 border-t border-slate-800/80 pt-2.5 leading-relaxed">
              <span className="font-bold text-slate-300">Additional Constraints:</span> {session.description}
            </p>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-center gap-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Execution Progress Bar (Active when QUEUED / IN_PROGRESS) */}
      {(session.status === "IN_PROGRESS" || session.status === "QUEUED" || progress) && (
        <div className="glass-card rounded-3xl p-6 sm:p-8 mb-8 border-cyan-500/30 bg-cyan-500/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 text-sm font-black text-white">
              <Cpu className="h-5 w-5 text-cyan-400 animate-spin" />
              <span>Parallel Research Execution Queue</span>
            </div>
            <span className="text-xs font-mono font-extrabold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full">
              {progress?.percentage ?? 0}% Completed
            </span>
          </div>

          {/* Animated Progress Bar */}
          <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden mb-6 p-0.5 border border-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 transition-all duration-500"
              style={{ width: `${progress?.percentage ?? 0}%` }}
            />
          </div>

          {/* Task Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 text-center text-xs">
            <div className="rounded-2xl bg-slate-950 p-3 border border-slate-800">
              <span className="block text-[10px] font-mono font-bold text-slate-500 uppercase">Total Tasks</span>
              <span className="text-base font-black text-slate-200">{progress?.totalTasks ?? tasks.length}</span>
            </div>
            <div className="rounded-2xl bg-slate-950 p-3 border border-slate-800">
              <span className="block text-[10px] font-mono font-bold text-amber-400 uppercase">Pending</span>
              <span className="text-base font-black text-amber-400">{progress?.pending ?? 0}</span>
            </div>
            <div className="rounded-2xl bg-slate-950 p-3 border border-slate-800">
              <span className="block text-[10px] font-mono font-bold text-cyan-400 uppercase">Running</span>
              <span className="text-base font-black text-cyan-400">{progress?.inProgress ?? 0}</span>
            </div>
            <div className="rounded-2xl bg-slate-950 p-3 border border-slate-800">
              <span className="block text-[10px] font-mono font-bold text-emerald-400 uppercase">Completed</span>
              <span className="text-base font-black text-emerald-400">{progress?.completed ?? 0}</span>
            </div>
            <div className="rounded-2xl bg-slate-950 p-3 border border-slate-800">
              <span className="block text-[10px] font-mono font-bold text-rose-400 uppercase">Failed</span>
              <span className="text-base font-black text-rose-400">{progress?.failed ?? 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Task Execution Board */}
      <div className="glass-card rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-black text-white">Planned Research Tasks</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono font-bold">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </span>
        </div>

        <ResearchTaskList tasks={tasks} />
      </div>
    </div>
  );
}
