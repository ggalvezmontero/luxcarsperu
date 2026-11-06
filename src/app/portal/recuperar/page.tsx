/**
 * Crear o recuperar contraseña (/portal/recuperar).
 *
 * Pública por necesidad, igual que el login: se llega sin sesión, desde el
 * enlace que Neon Auth manda por correo. NO indexable: hereda el `noindex` del
 * layout del portal.
 *
 * El enlace del correo vuelve acá con `?token=…` si sigue vigente, o con
 * `?error=INVALID_TOKEN` si venció o ya se usó.
 */

import type { Metadata } from "next";

import { PortalRecoveryForm } from "@/components/portal/PortalRecoveryForm";

export const metadata: Metadata = {
  title: "Contraseña",
  // Sin `robots` a propósito: se hereda el del layout (ver /portal/login).
};

export default async function PortalRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
  const { token, error } = await searchParams;

  return (
    <PortalRecoveryForm
      token={typeof token === "string" && token ? token : null}
      enlaceInvalido={typeof error === "string" && error.length > 0}
    />
  );
}
