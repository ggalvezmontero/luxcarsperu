import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "info" | "silver" | "danger";
  /** Punto de estado a la izquierda. */
  dot?: boolean;
  className?: string;
};

const TONES = {
  neutral: "border-line bg-surface-2 text-ink-2",
  ok: "border-ok/30 bg-ok/10 text-ok",
  warn: "border-warn/30 bg-warn/10 text-warn",
  info: "border-info/30 bg-info/10 text-info",
  silver: "border-silver/50 bg-silver/10 text-silver-bright",
  danger: "border-danger/30 bg-danger/10 text-danger",
};

const DOTS = {
  neutral: "bg-ink-3",
  ok: "bg-ok",
  warn: "bg-warn",
  info: "bg-info",
  silver: "bg-silver",
  danger: "bg-danger",
};

export function Badge({ children, tone = "neutral", dot, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} /> : null}
      {children}
    </span>
  );
}
