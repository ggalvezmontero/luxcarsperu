'use client';

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { InfoIcon } from "./Icons";

type TooltipProps = {
  content: string;
  label?: string;
  className?: string;
  placement?: "top" | "bottom";
};

export function Tooltip({
  content,
  label,
  className,
  placement = "top",
}: TooltipProps) {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("keydown", handleEscape);
    }
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-xs text-ink-3 transition-colors hover:border-silver hover:text-silver-bright"
        aria-label={label ?? content}
        aria-expanded={open}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        onClick={() => setOpen((value) => !value)}
      >
        <InfoIcon size={14} />
      </button>
      {open ? (
        <div
          role="tooltip"
          className={cn(
            "absolute z-20 w-56 max-w-[calc(100vw-2rem)] rounded-lux-lg border border-line-strong bg-surface-2 p-4 text-left shadow-2xl backdrop-blur sm:w-64",
            placement === "top" ? "bottom-full mb-3" : "top-full mt-3",
          )}
        >
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-silver-dim">
            Nota
          </p>
          <p className="mt-2 text-sm text-ink-2">{content}</p>
        </div>
      ) : null}
    </span>
  );
}
