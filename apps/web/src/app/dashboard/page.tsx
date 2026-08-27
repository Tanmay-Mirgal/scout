"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResearchSessionsApi } from "@/lib/api/research-sessions";
import { ResearchSession, ResearchSessionStatus } from "@/lib/api/types";
import { ResearchStatusBadge } from "@/components/research/ResearchStatusBadge";
import { formatDate, truncate } from "@/lib/utils";
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  Trash2,
  AlertTriangle,
  FolderSearch,
  ChevronLeft,
  ChevronRight,
  Layers,
  BarChart2,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

const STATUS_FILTERS: Array<{ label: string; value: string }> = [
  { label: "All Sessions", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Queued", value: "QUEUED" },
  { label: "Executing", value: "IN_PROGRESS" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Failed", value: "FAILED" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ResearchSessionsApi.list({
        page,
        limit: 9,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      });
      setSessions(res.items);
      setTotalPages(res.pagination.totalPages);
      setTotalItems(res.pagination.total);
    } catch (err: any) {
      setError(err.message || "Failed to load research sessions");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this research session?")) return;

    setDeletingId(id);
    try {
      await ResearchSessionsApi.delete(id);
      await fetchSessions();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Client-side search filtering across title & query
  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.title.toLowerCase().includes(q) || s.query.toLowerCase().includes(q);
  });

  const completedCount = sessions.filter((s) => s.status === "COMPLETED").length;
  const activeCount = sessions.filter((s) => s.status === "IN_PROGRESS" || s.status === "QUEUED").length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-widest mb-1.5">
            <BarChart2 className="h-4 w-4" />
            <span>Intelligence Control Center</span>
          </div>
          <h1 className="text-3xl font-black text-white sm:text-4xl">Research Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage, monitor, and inspect your multi-agent research sessions.
          </p>
        </div>

        <Link
          href="/research/new"
          className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-5 py-3 text-xs font-black text-slate-950 shadow-lg shadow-cyan-500/25 transition-all hover:brightness-110 hover:shadow-cyan-400/40 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          <span>Start New Research</span>
        </Link>
      </div>

      {/* Summary Metrics Bar */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 font-bold">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Sessions</span>
            <span className="text-lg font-black text-white">{totalItems}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-amber-400 font-bold">
            <Clock className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Runs</span>
            <span className="text-lg font-black text-amber-400">{activeCount}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-emerald-400 font-bold">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">Completed Reports</span>
            <span className="text-lg font-black text-emerald-400">{completedCount}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-purple-400 font-bold">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">API Status</span>
            <span className="text-xs font-mono font-bold text-emerald-400">REST v1 OK</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search & Status Filters */}
      <div className="mt-8 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search sessions by title or research question..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/80 pl-10 pr-4 py-2.5 text-xs font-medium text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <Filter className="h-3.5 w-3.5 text-slate-500 mr-1 hidden sm:block" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === f.value
                  ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10"
                  : "bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions Grid / States */}
      <div className="mt-8">
        {/* Loading Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass-card animate-pulse rounded-3xl p-6 h-52 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-5 w-24 bg-slate-800 rounded-full" />
                  <div className="h-5 w-3/4 bg-slate-800 rounded" />
                  <div className="h-3 w-full bg-slate-800/60 rounded" />
                </div>
                <div className="h-4 w-32 bg-slate-800/40 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Error Banner */}
        {!loading && error && (
          <div className="glass-card rounded-3xl border-rose-500/30 bg-rose-500/10 p-10 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-rose-400 mb-3" />
            <h3 className="text-xl font-bold text-white">Unable to Load Sessions</h3>
            <p className="mt-1 text-xs text-rose-200/80 max-w-md mx-auto">{error}</p>
            <button
              onClick={fetchSessions}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Request</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredSessions.length === 0 && (
          <div className="glass-card rounded-3xl p-12 text-center">
            <FolderSearch className="mx-auto h-14 w-14 text-slate-600 mb-4" />
            <h3 className="text-xl font-black text-white">No Research Sessions Found</h3>
            <p className="mt-2 text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              {searchQuery || statusFilter !== "ALL"
                ? "No research sessions match your search terms or active status filter."
                : "You haven't created any research sessions yet. Submit your first question to trigger autonomous agents."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              {(searchQuery || statusFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                  }}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Clear Filters
                </button>
              )}
              <Link
                href="/research/new"
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-xs font-black text-slate-950 hover:bg-cyan-400"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
                <span>Start Your First Research</span>
              </Link>
            </div>
          </div>
        )}

        {/* Sessions Grid */}
        {!loading && !error && filteredSessions.length > 0 && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => router.push(`/research/${session.id}`)}
                className="glass-card-hover group relative flex flex-col justify-between rounded-3xl p-6 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <ResearchStatusBadge status={session.status} />
                    <button
                      onClick={(e) => handleDelete(session.id, e)}
                      disabled={deletingId === session.id}
                      className="text-slate-500 hover:text-rose-400 transition p-1.5 rounded-lg hover:bg-rose-500/10"
                      title="Delete Session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <h3 className="font-extrabold text-white text-base group-hover:text-cyan-400 transition-colors line-clamp-1">
                    {session.title || truncate(session.query, 40)}
                  </h3>

                  <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed font-normal">
                    {session.query}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span>Created {formatDate(session.createdAt)}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-cyan-400 group-hover:translate-x-1 transition-transform">
                    <span>Open</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && !error && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-slate-800/80 pt-6 text-xs text-slate-400">
            <div>
              Page <span className="font-bold text-slate-200">{page}</span> of{" "}
              <span className="font-bold text-slate-200">{totalPages}</span> ({totalItems} total sessions)
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
