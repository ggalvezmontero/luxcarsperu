/**
 * /portal/embarques/[id] — detalle de un embarque.
 *
 * Marco estático: el embarque lo pide el navegador con la sesión del equipo
 * (RLS). Una URL con el id no revela nada a quien no tenga sesión de
 * administrador.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { EmbarqueDetalleScreen } from "./EmbarqueDetalleScreen";

export const metadata: Metadata = {
  title: "Embarque",
};

export default async function EmbarqueDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-6xl">
      <nav className="text-xs uppercase tracking-[0.18em] text-ink-4">
        <Link href="/portal/embarques" className="transition-colors hover:text-ink-2">Embarques</Link>
        <span className="mx-2" aria-hidden>/</span>
        <span className="text-ink-3">Detalle</span>
      </nav>
      <EmbarqueDetalleScreen id={id} />
    </div>
  );
}
