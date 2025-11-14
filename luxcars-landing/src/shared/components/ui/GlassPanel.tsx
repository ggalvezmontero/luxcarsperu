'use client';

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type GlassPanelProps = {
  children: ReactNode;
  className?: string;
  tone?: "light" | "dark";
};

export function GlassPanel({
  children,
  className,
  tone = "dark",
}: GlassPanelProps) {
  const baseStyles =
    "rounded-[28px] border backdrop-blur-xl transition-shadow duration-500";
  const toneStyles =
    tone === "light"
      ? "border-white/30 bg-[#FCFCFC]/80 shadow-[0_18px_60px_rgba(15,15,15,0.15)] text-[#0F0F0F]"
      : "border-white/10 bg-[#0F0F0F]/70 shadow-[0_28px_120px_rgba(15,15,15,0.45)]";

  return (
    <div className={cn(baseStyles, toneStyles, className)}>{children}</div>
  );
}
