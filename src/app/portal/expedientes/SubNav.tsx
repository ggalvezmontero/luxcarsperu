"use client";

/**
 * Subsecciones de Expedientes: tablero, cumplimiento (registro UIF) y
 * métricas. Van acá y no en la barra lateral del portal para no saturarla:
 * son tres vistas del mismo módulo.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SECCIONES = [
  { href: "/portal/expedientes", label: "Tablero" },
  { href: "/portal/expedientes/cumplimiento", label: "Cumplimiento" },
  { href: "/portal/expedientes/metricas", label: "Métricas" },
];

export function SubNavExpedientes() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones de expedientes" className="inline-flex max-w-full flex-wrap gap-1 rounded-full border border-line bg-surface p-1">
      {SECCIONES.map((s) => {
        const activo = s.href === "/portal/expedientes" ? pathname === s.href : pathname.startsWith(s.href);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm",
              activo ? "bg-ink text-void" : "text-ink-3 hover:text-ink",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
