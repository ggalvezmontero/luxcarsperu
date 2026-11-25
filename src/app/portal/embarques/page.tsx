/**
 * /portal/embarques — contenedores y Ro-Ro con sus expedientes.
 *
 * No lee datos en el servidor a propósito: `EmbarquesScreen` consulta desde el
 * navegador con la sesión del administrador (RLS). Ver `src/app/portal/layout.tsx`.
 */

import type { Metadata } from "next";
import { EmbarquesScreen } from "./EmbarquesScreen";

export const metadata: Metadata = {
  title: "Embarques",
};

export default function EmbarquesPage() {
  return <EmbarquesScreen />;
}
