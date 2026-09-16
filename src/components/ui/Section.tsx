import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type SectionProps = {
  id?: string;
  children: ReactNode;
  className?: string;
  /** `void` = negro puro, `bg` = fondo base, `surface` = banda elevada. */
  tone?: "void" | "bg" | "surface";
  /** Sin contenedor: el hijo decide su ancho (portadas a sangre). */
  bleed?: boolean;
  /** Ritmo vertical. `tight` para bandas de apoyo. */
  padding?: "normal" | "tight" | "none";
  "aria-labelledby"?: string;
};

const TONES = {
  void: "bg-void",
  bg: "bg-bg",
  surface: "bg-surface border-y border-line",
};

const PADDING = {
  normal: "py-16 sm:py-20 lg:py-28",
  tight: "py-10 sm:py-12 lg:py-16",
  none: "",
};

export function Section({
  id,
  children,
  className,
  tone = "bg",
  bleed = false,
  padding = "normal",
  ...rest
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn("relative w-full scroll-mt-20", TONES[tone], PADDING[padding], className)}
      {...rest}
    >
      {bleed ? children : <div className="container-lux">{children}</div>}
    </section>
  );
}

type SectionHeaderProps = {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  /** Acción a la derecha en desktop (p. ej. "Ver todo"). */
  action?: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
};

export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  action,
  className,
  as: Heading = "h2",
}: SectionHeaderProps) {
  const centered = align === "center";
  return (
    <div
      className={cn(
        "flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between",
        centered && "sm:flex-col sm:items-center sm:text-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl", centered && "mx-auto")}>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <Heading
          id={id}
          className={cn(
            "text-balance font-semibold tracking-tight text-ink",
            eyebrow ? "mt-3" : "",
            Heading === "h1"
              ? "text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
              : "text-3xl leading-[1.1] sm:text-4xl",
          )}
        >
          {title}
        </Heading>
        {description ? (
          <p className="mt-4 text-pretty text-base leading-relaxed text-ink-2 sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
