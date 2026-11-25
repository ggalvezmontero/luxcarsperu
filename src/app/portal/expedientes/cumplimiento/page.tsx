/**
 * /portal/expedientes/cumplimiento — registro de operaciones para la UIF.
 *
 * Marco estático: la pantalla consulta la ruta de servidor con la sesión del
 * equipo. Ver el encabezado de `src/app/portal/layout.tsx`.
 */

import type { Metadata } from "next";
import { CumplimientoScreen } from "./CumplimientoScreen";

export const metadata: Metadata = {
  title: "Cumplimiento",
};

export default function CumplimientoPage() {
  return <CumplimientoScreen />;
}
