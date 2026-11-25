/**
 * /portal/expedientes/nuevo — asistente de alta en cuatro pasos.
 *
 * Marco estático: la pantalla trabaja en el navegador con la sesión del
 * equipo (ver `src/app/portal/layout.tsx`). `Suspense` porque el asistente
 * lee `?solicitud=` con `useSearchParams`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NuevoExpedienteScreen } from "./NuevoExpedienteScreen";

export const metadata: Metadata = {
  title: "Nuevo expediente",
};

export default function NuevoExpedientePage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <nav className="text-xs uppercase tracking-[0.18em] text-ink-4">
        <Link href="/portal/expedientes" className="transition-colors hover:text-ink-2">Expedientes</Link>
        <span className="mx-2" aria-hidden>/</span>
        <span className="text-ink-3">Nuevo</span>
      </nav>
      <Suspense fallback={<p className="mt-8 text-sm text-ink-3">Cargando…</p>}>
        <NuevoExpedienteScreen />
      </Suspense>
    </div>
  );
}
