/**
 * Primitivas visuales del CRM del portal (leads y consignaciones).
 *
 * ALCANCE: solo estas dos pantallas. El inventario del portal lo construye otro
 * equipo; si algún día conviene unificar, se hace en una pasada aparte y a
 * propósito, no fusionando archivos a ciegas.
 *
 * Son componentes de servidor: ningún hook, ningún handler. Las pantallas los
 * envuelven y las tablas interactivas viven en sus propios archivos "use client".
 *
 * SISTEMA DE DISEÑO: solo tokens de `src/app/globals.css`. Ningún hex literal.
 * La plata es el acento dominante; el oro se reserva a UN dato por pantalla.
 */

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ========================================================================== */
/* Encabezado de pantalla                                                     */
/* ========================================================================== */

export function PortalPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-silver">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 gap-3">{actions}</div> : null}
    </header>
  );
}

/* ========================================================================== */
/* Indicadores                                                                */
/* ========================================================================== */

export type StatTone = "default" | "accent" | "ok" | "warn" | "danger";

const statToneClasses: Record<StatTone, string> = {
  default: "text-ink",
  /* Oro: como máximo un StatCard con `accent` por pantalla. */
  accent: "text-gold",
  ok: "text-ok",
  warn: "text-warn",
  danger: "text-danger",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <div className="rounded-lux border border-line bg-surface p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          statToneClasses[tone],
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {children}
    </div>
  );
}

/* ========================================================================== */
/* Etiquetas de estado                                                        */
/* ========================================================================== */

export type BadgeTone =
  | "neutral"
  | "silver"
  | "info"
  | "ok"
  | "warn"
  | "danger";

const badgeToneClasses: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface-2 text-ink-2",
  silver: "border-line-strong bg-surface-3 text-silver-bright",
  info: "border-info/35 bg-info/10 text-info",
  ok: "border-ok/35 bg-ok/10 text-ok",
  warn: "border-warn/35 bg-warn/10 text-warn",
  danger: "border-danger/35 bg-danger/10 text-danger",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none tracking-wide",
        badgeToneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ========================================================================== */
/* Panel y estados vacíos                                                     */
/* ========================================================================== */

export function PortalPanel({
  title,
  description,
  toolbar,
  children,
}: {
  title?: string;
  description?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lux-lg border border-line bg-surface">
      {title || toolbar ? (
        <div className="flex flex-col gap-4 border-b border-line px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            {title ? (
              <h2 className="text-sm font-semibold tracking-wide text-ink">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-xs text-ink-3">{description}</p>
            ) : null}
          </div>
          {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Estado vacío honesto.
 *
 * No dice "algo salió mal": con la base de datos sin configurar, la lista vacía
 * es el comportamiento correcto y esperado. Explica qué falta y qué hacer.
 */
export function EmptyState({
  title,
  description,
  steps,
}: {
  title: string;
  description: string;
  steps?: string[];
}) {
  return (
    <div className="px-5 py-16 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
        {description}
      </p>
      {steps?.length ? (
        <ol className="mx-auto mt-6 max-w-md space-y-2 text-left text-xs text-ink-3">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="font-mono text-silver">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/* ========================================================================== */
/* Avisos                                                                     */
/* ========================================================================== */

export type NoticeTone = "info" | "warn" | "danger";

const noticeToneClasses: Record<NoticeTone, string> = {
  info: "border-line bg-surface-2 text-ink-2",
  warn: "border-warn/30 bg-warn/5 text-ink-2",
  danger: "border-danger/30 bg-danger/5 text-ink-2",
};

const noticeLabelClasses: Record<NoticeTone, string> = {
  info: "text-silver",
  warn: "text-warn",
  danger: "text-danger",
};

export function Notice({
  tone = "info",
  label,
  children,
}: {
  tone?: NoticeTone;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lux border px-4 py-3 text-xs leading-relaxed",
        noticeToneClasses[tone],
      )}
    >
      <p
        className={cn(
          "mb-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
          noticeLabelClasses[tone],
        )}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

/* ========================================================================== */
/* Tabla                                                                      */
/* ========================================================================== */

/** Contenedor con scroll horizontal propio: la página nunca se desborda. */
export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="w-full overflow-x-auto">{children}</div>;
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <td
      className={cn(
        "px-4 py-4 align-top text-sm text-ink-2",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}
