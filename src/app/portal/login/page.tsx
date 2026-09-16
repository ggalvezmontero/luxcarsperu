/**
 * Acceso al portal (/portal/login).
 *
 * Pantalla pública por necesidad (hay que poder llegar a ella sin sesión), pero
 * NO indexable: `noindex, nofollow`, igual que el resto del portal. Tampoco va
 * en el sitemap.
 *
 * La autenticación la resuelve Supabase Auth dentro de `PortalLoginForm`. No
 * hay registro público, no se guardan contraseñas y no se emite ninguna sesión
 * propia.
 */

import type { Metadata } from "next";
import { PortalLoginForm } from "@/components/portal/PortalLoginForm";

export const metadata: Metadata = {
  title: "Acceso",
  // Sin `robots` a propósito: se hereda el del layout (noindex, nofollow,
  // nocache y googleBot). Declararlo acá reemplazaría el del layout entero.
};

export default function PortalLoginPage() {
  return <PortalLoginForm />;
}
