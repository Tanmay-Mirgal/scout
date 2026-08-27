import { ResearchSessionStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Clock, PlayCircle, CheckCircle2, XCircle, AlertCircle, FileEdit, Sparkles } from "lucide-react";

interface StatusBadgeProps {
  status: ResearchSessionStatus | string;
  className?: string;
}

export function ResearchStatusBadge({ status, className }: StatusBadgeProps) {
  switch (status) {
    case "DRAFT":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-700/80 shadow-sm",
            className
          )}
        >
          <FileEdit className="h-3.5 w-3.5 text-slate-400" />
          <span>Draft Plan</span>
        </span>
      );

    case "QUEUED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/30 shadow-sm shadow-amber-500/10",
            className
          )}
        >
          <Clock className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          <span>Queued</span>
        </span>
      );

    case "IN_PROGRESS":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/35 shadow-sm shadow-cyan-500/15",
            className
          )}
        >
          <PlayCircle className="h-3.5 w-3.5 text-cyan-400 animate-spin" />
          <span>Executing</span>
        </span>
      );

    case "COMPLETED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10",
            className
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span>Completed</span>
        </span>
      );

    case "FAILED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-400 border border-rose-500/30 shadow-sm shadow-rose-500/10",
            className
          )}
        >
          <XCircle className="h-3.5 w-3.5 text-rose-400" />
          <span>Failed</span>
        </span>
      );

    case "CANCELLED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-400 border border-slate-700/80",
            className
          )}
        >
          <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
          <span>Cancelled</span>
        </span>
      );

    default:
      return (
        <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 border border-slate-800", className)}>
          {status}
        </span>
      );
  }
}
