"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmDialogVariant = "default" | "danger";

export interface ConfirmDialogProps {
  /** Controls visibility. The component renders nothing while closed. */
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  /** Shows a spinner and disables the buttons while an async action runs. */
  isConfirming?: boolean;
  onConfirm: () => void;
  /** Called on Cancel, the close (X) button, backdrop click, or Escape. */
  onCancel: () => void;
  /**
   * Renders a single acknowledgement button instead of confirm/cancel.
   * Use this to replace `window.alert(...)` calls.
   */
  alertOnly?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A lightweight, dependency-free modal dialog used in place of the browser's
 * native `window.confirm` / `window.alert`, which are not screen-reader
 * friendly, cannot be styled, and block the entire page.
 *
 * Accessibility behavior:
 * - Rendered as `role="alertdialog"` with `aria-modal`, `aria-labelledby`,
 *   and `aria-describedby` wired to the title/description.
 * - Moves focus into the dialog on open and restores it to the previously
 *   focused element on close.
 * - Traps Tab/Shift+Tab focus cycling within the dialog while open.
 * - Closes on Escape and on backdrop click (both call `onCancel`).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isConfirming = false,
  onConfirm,
  onCancel,
  alertOnly = false,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  // Portals require the DOM, which isn't available during SSR/hydration.
  useEffect(() => {
    setMounted(true);
  }, []);

  const requestClose = useCallback(() => {
    if (isConfirming) return; // don't let the dialog be dismissed mid-request
    onCancel();
  }, [isConfirming, onCancel]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== "Tab") return;

      const node = dialogRef.current;
      if (!node) return;

      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [requestClose]
  );

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const raf = requestAnimationFrame(() => {
      confirmButtonRef.current?.focus();
    });

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={requestClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="glass-card relative w-full max-w-md rounded-3xl border border-slate-800/80 p-6 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
              variant === "danger"
                ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
            )}
          >
            {variant === "danger" ? (
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Info className="h-5 w-5" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <h2 id={titleId} className="text-base font-black text-white">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1.5 text-xs leading-relaxed text-slate-400">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={requestClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-800/80 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {!alertOnly && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isConfirming}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {cancelLabel}
            </button>
          )}

          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60",
              variant === "danger"
                ? "bg-rose-500 text-white hover:bg-rose-400 focus-visible:ring-rose-400"
                : "bg-cyan-500 text-slate-950 hover:bg-cyan-400 focus-visible:ring-cyan-400"
            )}
          >
            {isConfirming && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            <span>{alertOnly ? confirmLabel || "OK" : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
