/**
 * /portal/consignaciones — autos de terceros en venta, SIN exclusividad.
 *
 * PORTAL = SOLO ADMINISTRACIÓN. Acá hay datos personales del dueño y el precio
 * mínimo que autorizó para negociar: nada de esto se publica.
 *
 * ESTE ARCHIVO NO LEE DATOS A PROPÓSITO. Todo el trabajo lo hace
 * `ConsignmentsScreen` en el navegador, con la sesión del equipo, para que RLS
 * evalúe cada consulta como `authenticated`. Si esta página leyera en el
 * servidor con `service_role`, el HTML saldría con el teléfono del dueño y su
 * piso de negociación DENTRO, antes de que corra ningún guard de sesión.
 * Ver el encabezado de `src/app/portal/layout.tsx`.
 *
 * `noindex` lo aplica el layout del portal para todas sus rutas.
 */

import type { Metadata } from "next";
import { ConsignmentsScreen } from "./ConsignmentsScreen";

export const metadata: Metadata = {
  title: "Consignaciones",
};

export default function ConsignacionesPage() {
  return <ConsignmentsScreen />;
}
