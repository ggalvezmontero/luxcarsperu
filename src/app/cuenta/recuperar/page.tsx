/**
 * Recuperar la contraseña de la cuenta (/cuenta/recuperar).
 *
 * Pública por necesidad: se llega sin sesión, desde el login o desde el enlace
 * que Neon Auth manda por correo. NO indexable: hereda el `noindex` del layout
 * de /cuenta.
 *
 * El enlace del correo vuelve acá con `?token=…` si sigue vigente, o con
 * `?error=INVALID_TOKEN` si venció o ya se usó.
 */

import type { Metadata } from "next";
import { CuentaRecoveryForm } from "@/components/cuenta/CuentaRecoveryForm";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
};

export default async function CuentaRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
  const { token, error } = await searchParams;

  return (
    <Section tone="bg" padding="tight">
      <CuentaRecoveryForm
        token={typeof token === "string" && token ? token : null}
        enlaceInvalido={typeof error === "string" && error.length > 0}
      />
    </Section>
  );
}
