/**
 * /admin/cotizador-envios — cotizador interno de envíos.
 *
 * El acceso lo decide el layout de /admin en el servidor (404 a quien no sea
 * administrador). Esta página no lee datos: el cálculo corre en el navegador
 * con el motor de `src/core/envios/` y el guardado y el historial pasan por
 * `/api/admin/cotizaciones-envio`, que vuelve a comprobar la sesión.
 */

import type { Metadata } from "next";

import { CotizadorEnviosScreen } from "./CotizadorEnviosScreen";

export const metadata: Metadata = {
  title: "Cotizador de envíos",
  // Sin `robots` a propósito: se hereda el del layout (noindex, nofollow).
};

export default function CotizadorEnviosPage() {
  return <CotizadorEnviosScreen />;
}
