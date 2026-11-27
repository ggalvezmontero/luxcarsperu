/** /portal/cotizaciones/nueva — arma una cotización (nace en borrador con el siguiente COT-AAAA-NNN). */

import type { Metadata } from "next";
import Link from "next/link";
import { NuevaCotizacionScreen } from "./NuevaCotizacionScreen";

export const metadata: Metadata = {
  title: "Nueva cotización",
};

export default function NuevaCotizacionPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <nav className="text-xs uppercase tracking-[0.18em] text-ink-4">
        <Link href="/portal/cotizaciones" className="transition-colors hover:text-ink-2">Cotizaciones</Link>
        <span className="mx-2" aria-hidden>/</span>
        <span className="text-ink-3">Nueva</span>
      </nav>
      <NuevaCotizacionScreen />
    </div>
  );
}
