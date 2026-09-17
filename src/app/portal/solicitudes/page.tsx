/**
 * /portal/solicitudes — pedidos de búsqueda y autos ofrecidos por clientes.
 *
 * No lee datos en el servidor a propósito: `SolicitudesScreen` consulta desde
 * el navegador con la sesión del administrador, para que RLS evalúe cada
 * consulta. Ver el encabezado de `src/app/portal/layout.tsx`.
 */

import type { Metadata } from "next";
import { SolicitudesScreen } from "./SolicitudesScreen";

export const metadata: Metadata = {
  title: "Solicitudes",
};

export default function SolicitudesPage() {
  return <SolicitudesScreen />;
}
