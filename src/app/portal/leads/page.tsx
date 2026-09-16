/**
 * /portal/leads — embudo de consultas entrantes.
 *
 * PORTAL = SOLO ADMINISTRACIÓN. El cliente nunca entra acá: cotiza, llena el
 * formulario y sigue por WhatsApp. Esta pantalla es para el dueño y su equipo.
 *
 * ESTE ARCHIVO NO LEE DATOS A PROPÓSITO. Todo el trabajo lo hace `LeadsScreen`
 * en el navegador, con la sesión del equipo, para que RLS evalúe cada consulta
 * como `authenticated`. Si esta página leyera en el servidor con
 * `service_role`, Next mandaría el HTML con los nombres, teléfonos y correos
 * DENTRO —antes de que corra ningún guard de sesión— y bastaría un `curl` para
 * llevárselos (Ley 29733). Ver el encabezado de `src/app/portal/layout.tsx`.
 *
 * `noindex` lo aplica el layout del portal para todas sus rutas; acá solo se
 * define el título.
 */

import type { Metadata } from "next";
import { LeadsScreen } from "./LeadsScreen";

export const metadata: Metadata = {
  title: "Leads",
};

export default function LeadsPage() {
  return <LeadsScreen />;
}
