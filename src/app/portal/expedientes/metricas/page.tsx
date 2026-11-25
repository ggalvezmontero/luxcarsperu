/**
 * /portal/expedientes/metricas — números del módulo de expedientes.
 *
 * No lee datos en el servidor a propósito: `MetricasScreen` consulta desde el
 * navegador con la sesión del administrador, para que RLS evalúe cada
 * consulta. Ver el encabezado de `src/app/portal/layout.tsx`.
 */

import type { Metadata } from "next";
import { MetricasScreen } from "./MetricasScreen";

export const metadata: Metadata = {
  title: "Métricas de expedientes",
};

export default function MetricasPage() {
  return <MetricasScreen />;
}
