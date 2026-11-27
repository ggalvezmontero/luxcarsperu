/**
 * /portal/cotizaciones — cotizaciones de importación a pedido.
 *
 * No lee datos en el servidor a propósito: `CotizacionesScreen` consulta desde
 * el navegador con la sesión del administrador, para que RLS evalúe cada
 * consulta. Ver el encabezado de `src/app/portal/layout.tsx`.
 */

import type { Metadata } from "next";
import { CotizacionesScreen } from "./CotizacionesScreen";

export const metadata: Metadata = {
  title: "Cotizaciones",
};

export default function CotizacionesPage() {
  return <CotizacionesScreen />;
}
