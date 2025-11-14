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
        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/5 text-xs text-white/70 transition hover:border-[#f5d072]/60 hover:bg-[#f5d072]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5d072]/60"
        aria-label={label ?? content}
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
            "absolute z-20 w-64 rounded-2xl border border-[#f5d072]/40 bg-black/90 p-4 text-left shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur",
            placement === "top"
              ? "bottom-full mb-3"
              : "top-full mt-3",
          )}
        >
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#fbe5a4]">
            Nota
          </p>
          <p className="mt-2 text-sm text-white/75">{content}</p>
        </div>
      ) : null}
    </span>
  );
}
