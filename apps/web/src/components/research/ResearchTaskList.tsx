import { ResearchTask } from "@/lib/api/types";
import { ListTodo, Layers, Clock, CheckCircle2, XCircle, AlertCircle, ArrowUpRight } from "lucide-react";

interface ResearchTaskListProps {
  tasks: ResearchTask[] | Array<{ title: string; description: string; priority: string; status: string }>;
  loading?: boolean;
}

export function ResearchTaskList({ tasks, loading }: ResearchTaskListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card animate-pulse rounded-2xl p-5 h-20 flex items-center justify-between">
            <div className="space-y-2 w-2/3">
              <div className="h-4 w-1/3 bg-slate-800 rounded" />
              <div className="h-3 w-3/4 bg-slate-800/60 rounded" />
            </div>
            <div className="h-6 w-20 bg-slate-800/40 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center text-xs text-slate-400">
        <ListTodo className="mx-auto h-10 w-10 text-slate-600 mb-3" />
        <p className="font-medium">No research tasks generated yet.</p>
        <p className="mt-1 text-[11px] text-slate-500">Click "Generate Research Plan" to break down your objective with Orchestrator Agent.</p>
      </div>
    );
  }

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "HIGH":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "MEDIUM":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      default:
        return "bg-slate-800/80 text-slate-400 border-slate-700";
    }
  };

  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Completed</span>
          </span>
        );
      case "IN_PROGRESS":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-400 border border-cyan-500/30">
            <Clock className="h-3.5 w-3.5 animate-spin" />
            <span>Running</span>
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-400 border border-rose-500/20">
            <XCircle className="h-3.5 w-3.5" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-400 border border-slate-800">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {tasks.map((task, idx) => (
        <div
          key={(task as any).id || idx}
          className="glass-card-hover relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl p-5"
        >
          <div className="flex items-start gap-3.5">
            <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-cyan-400">
              0{idx + 1}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h4 className="font-bold text-white text-sm">
                  {task.title}
                </h4>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${getPriorityStyle(
                    task.priority
                  )}`}
                >
                  {task.priority}
                </span>
              </div>
              {task.description && (
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed max-w-2xl">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-end">
            {getTaskStatusBadge(task.status)}
          </div>
        </div>
      ))}
    </div>
  );
}
