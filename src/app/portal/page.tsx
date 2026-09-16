/**
 * Tablero del portal (/portal).
 *
 * Componente de servidor deliberadamente delgado: solo lee el estado de
 * CONFIGURACIÓN —qué variables de entorno faltan, incluida la llave de
 * servicio, que el navegador no puede ver— y se lo pasa al tablero. Los datos
 * del negocio los pide el componente cliente con la sesión del equipo, para
 * que RLS los filtre. Acá NO se consulta la base con `service_role`: eso le
 * mostraría los leads a cualquiera que abra esta ruta.
 */

import type { Metadata } from "next";
import { PortalDashboard } from "@/components/portal/PortalDashboard";
import { getDatabaseStatus } from "@/lib/db/client";

export const metadata: Metadata = {
  title: "Tablero",
  // Sin `robots` a propósito: se hereda el del layout (noindex, nofollow,
  // nocache y googleBot). Declararlo acá REEMPLAZA el del layout entero, y así
  // fue como esta página perdía `nocache` sin que se notara.
};

export default function PortalHomePage() {
  // `getDatabaseStatus()` solo informa qué falta; no abre conexión ni expone
  // ninguna llave (devuelve nombres de variables, nunca valores).
  const dbStatus = getDatabaseStatus();

  return <PortalDashboard dbStatus={dbStatus} />;
}
