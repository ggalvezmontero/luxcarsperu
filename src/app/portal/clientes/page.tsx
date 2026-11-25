/**
 * /portal/clientes — clientes del mandato de importación.
 *
 * No lee datos en el servidor a propósito: `ClientesScreen` consulta desde el
 * navegador con la sesión del administrador (RLS). Ver `src/app/portal/layout.tsx`.
 */

import type { Metadata } from "next";
import { ClientesScreen } from "./ClientesScreen";

export const metadata: Metadata = {
  title: "Clientes",
};

export default function ClientesPage() {
  return <ClientesScreen />;
}
