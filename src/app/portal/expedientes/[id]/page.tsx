/**
 * /portal/expedientes/[id] — detalle de un expediente.
 *
 * Marco estático: el expediente lo pide el navegador con la sesión del
 * equipo (RLS). Una URL con el id de un expediente no revela nada a quien no
 * tenga sesión de administrador.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ExpedienteDetalleScreen } from "./ExpedienteDetalleScreen";

export const metadata: Metadata = {
  title: "Expediente",
};

export default async function ExpedienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-6xl">
      <nav className="text-xs uppercase tracking-[0.18em] text-ink-4">
        <Link href="/portal/expedientes" className="transition-colors hover:text-ink-2">Expedientes</Link>
        <span className="mx-2" aria-hidden>/</span>
        <span className="text-ink-3">Detalle</span>
      </nav>
      <ExpedienteDetalleScreen id={id} />
    </div>
  );
}
