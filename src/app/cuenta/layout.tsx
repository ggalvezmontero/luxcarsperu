import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { CuentaSessionProvider } from "@/components/cuenta/cuentaSession";

/**
 * Área del cliente (/cuenta/*): registro, sesión y sus solicitudes.
 *
 * Todo lo que cuelga de acá lee y escribe DESDE EL NAVEGADOR con la sesión
 * del cliente. RLS solo le muestra sus propias filas. Ningún componente de
 * servidor bajo /cuenta consulta la base: no hay nada que un `curl` pueda
 * llevarse.
 *
 * `noindex`: son pantallas personales, no contenido.
 */
export const metadata: Metadata = {
  title: { default: "Mi cuenta", template: "%s · Mi cuenta · LuxCars" },
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: undefined },
};

export default function CuentaLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <CuentaSessionProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main id="contenido" className="w-full flex-1 pt-[var(--lux-nav-h)]">
          {children}
        </main>
        <Footer />
      </div>
    </CuentaSessionProvider>
  );
}
