import type { Metadata } from "next";
import { Suspense } from "react";
import { CuentaAuthForm } from "@/components/cuenta/CuentaAuthForm";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Ingresar",
};

export default function CuentaLoginPage() {
  return (
    <Section tone="bg" padding="tight">
      {/* `useSearchParams` exige Suspense en el prerender. */}
      <Suspense fallback={<div className="mx-auto max-w-md py-16 text-center text-sm text-ink-3">Cargando…</div>}>
        <CuentaAuthForm />
      </Suspense>
    </Section>
  );
}
