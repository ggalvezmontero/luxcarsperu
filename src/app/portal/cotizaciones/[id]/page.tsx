/** /portal/cotizaciones/[id] — detalle: editar en borrador, PDF, enviar, aceptar (abre los expedientes) o rechazar. */

import type { Metadata } from "next";
import Link from "next/link";
import { CotizacionDetalleScreen } from "./CotizacionDetalleScreen";

export const metadata: Metadata = {
  title: "Cotización",
};

export default async function CotizacionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-6xl">
      <nav className="text-xs uppercase tracking-[0.18em] text-ink-4">
        <Link href="/portal/cotizaciones" className="transition-colors hover:text-ink-2">Cotizaciones</Link>
        <span className="mx-2" aria-hidden>/</span>
        <span className="text-ink-3">Detalle</span>
      </nav>
      <CotizacionDetalleScreen id={id} />
    </div>
  );
}
