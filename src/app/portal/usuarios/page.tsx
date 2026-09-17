/**
 * /portal/usuarios — cuentas y roles.
 *
 * No lee datos en el servidor a propósito: `UsuariosScreen` consulta desde el
 * navegador con la sesión del administrador. Ver `src/app/portal/layout.tsx`.
 */

import type { Metadata } from "next";
import { UsuariosScreen } from "./UsuariosScreen";

export const metadata: Metadata = {
  title: "Usuarios",
};

export default function UsuariosPage() {
  return <UsuariosScreen />;
}
