/**
 * /portal/contrapartes — vendedores, forwarders, agentes, aseguradoras,
 * inspectores, notarías y depósitos, con la verificación de sus cuentas.
 *
 * No lee datos en el servidor a propósito: `ContrapartesScreen` consulta desde
 * el navegador con la sesión del administrador (RLS). Ver `src/app/portal/layout.tsx`.
 */

import type { Metadata } from "next";
import { ContrapartesScreen } from "./ContrapartesScreen";

export const metadata: Metadata = {
  title: "Contrapartes",
};

export default function ContrapartesPage() {
  return <ContrapartesScreen />;
}
