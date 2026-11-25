/**
 * /portal/expedientes — tablero de importaciones a pedido por etapa.
 *
 * No lee datos en el servidor a propósito: `ExpedientesScreen` consulta desde
 * el navegador con la sesión del administrador, para que RLS evalúe cada
 * consulta. Ver el encabezado de `src/app/portal/layout.tsx`.
 */

import type { Metadata } from "next";
import { ExpedientesScreen } from "./ExpedientesScreen";

export const metadata: Metadata = {
  title: "Expedientes",
};

export default function ExpedientesPage() {
  return <ExpedientesScreen />;
}
