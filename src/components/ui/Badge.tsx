import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "info" | "silver" | "danger";
  /** Punto de estado a la izquierda. */
  dot?: boolean;
  /**
   * Sobre una foto: fondo oscuro translúcido en vez del tinte del tono. Sin
   * esto, "Disponible" en verde al 10 % desaparecía sobre una foto clara.
   * (`cn` no resuelve clases en conflicto, por eso es una prop y no una
   * clase extra.)
   */
  onPhoto?: boolean;
  className?: string;
};

const TONES = {
  neutral: "border-line text-ink-2",
  ok: "border-ok/30 text-ok",
  warn: "border-warn/30 text-warn",
  info: "border-info/30 text-info",
  silver: "border-silver/50 text-silver-bright",
  danger: "border-danger/30 text-danger",
};

const FONDOS = {
  neutral: "bg-surface-2",
  ok: "bg-ok/10",
  warn: "bg-warn/10",
  info: "bg-info/10",
  silver: "bg-silver/10",
  danger: "bg-danger/10",
};

const DOTS = {
  neutral: "bg-ink-3",
  ok: "bg-ok",
  warn: "bg-warn",
  info: "bg-info",
  silver: "bg-silver",
  danger: "bg-danger",
};

export function Badge({ children, tone = "neutral", dot, onPhoto, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
        TONES[tone],
        onPhoto ? "bg-void/70 backdrop-blur" : FONDOS[tone],
        className,
      )}
    >
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} /> : null}
      {children}
    </span>
  );
}
