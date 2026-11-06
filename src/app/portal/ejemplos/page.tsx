/**
 * /portal/ejemplos — ejemplos de importación a pedido (home y /importar).
 *
 * No lee datos en el servidor a propósito: `EjemplosScreen` consulta desde el
 * navegador con la sesión del administrador. Ver `src/app/portal/layout.tsx`.
 */

import type { Metadata } from "next";
import { EjemplosScreen } from "./EjemplosScreen";

export const metadata: Metadata = {
  title: "Ejemplos de importación",
};

export default function EjemplosPage() {
  return <EjemplosScreen />;
}
