/**
 * Piezas de formulario del módulo de expedientes: etiqueta + control con el
 * estilo de la casa (`field-lux`). Solo tokens; ningún hex.
 */

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Campo({
  label,
  hint,
  children,
  className,
  requerido,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  requerido?: boolean;
}) {
  return (
    <label className={cn("block text-[11px] uppercase tracking-[0.12em] text-ink-4", className)}>
      {label}
      {requerido ? <span className="text-warn"> *</span> : null}
      <div className="mt-1">{children}</div>
      {hint ? <span className="mt-1 block text-[11px] normal-case tracking-normal text-ink-4">{hint}</span> : null}
    </label>
  );
}

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("field-lux min-h-10 py-1.5 text-sm", props.className)} />;
}

export function Selector(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("field-lux select-lux min-h-10 py-1.5 text-sm", props.className)} />;
}

export function AreaTexto(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("field-lux min-h-20 py-2 text-sm", props.className)} />;
}

export function Rejilla({ children, columnas = 2 }: { children: ReactNode; columnas?: 2 | 3 | 4 }) {
  const cols = columnas === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : columnas === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return <div className={cn("grid gap-4", cols)}>{children}</div>;
}

/** Fila de dato de solo lectura: etiqueta arriba, valor abajo. */
export function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.12em] text-ink-4">{label}</p>
      <p className="mt-0.5 text-sm text-ink">{children ?? "—"}</p>
    </div>
  );
}

export function Pestanas<T extends string>({
  valor,
  opciones,
  onChange,
  label,
}: {
  valor: T;
  opciones: readonly { id: T; label: string }[];
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={valor === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm",
            valor === o.id ? "bg-ink text-void" : "text-ink-3 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
