/**
 * /portal/configuracion — datos de la empresa para los documentos.
 *
 * No lee datos en el servidor a propósito: `ConfiguracionScreen` consulta
 * desde el navegador con la sesión del administrador. Ver `src/app/portal/layout.tsx`.
 */

import type { Metadata } from "next";
import { ConfiguracionScreen } from "./ConfiguracionScreen";

export const metadata: Metadata = {
  title: "Configuración",
};

export default function ConfiguracionPage() {
  return <ConfiguracionScreen />;
}
