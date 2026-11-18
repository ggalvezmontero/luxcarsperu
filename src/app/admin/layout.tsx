import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { verificarSesionPortal } from "@/lib/portal/authServer";

/**
 * Herramientas internas bajo /admin (hoy: el cotizador de envíos).
 *
 * LA PUERTA ESTÁ EN EL SERVIDOR. Este layout llama a `verificarSesionPortal()`
 * en cada petición: lee la cookie de Neon Auth y comprueba en la base que el
 * perfil sea `admin` y esté activo. Quien no lo sea recibe un 404 idéntico al
 * de cualquier ruta inexistente —no un 403 ni una pantalla de login— para no
 * confirmar siquiera que la herramienta existe. Sin configuración (faltan las
 * variables de Neon) también 404: cerrado por defecto.
 *
 * Esto es distinto de `/portal`, cuyo guard corre en el navegador y confía en
 * RLS. Acá las pantallas pueden leer y escribir con `DATABASE_URL` a través de
 * Route Handlers que vuelven a comprobar la sesión (nunca se confía solo en
 * este layout para una escritura).
 *
 * Fuera de Google: `noindex, nofollow` para todo lo que cuelgue de /admin,
 * `/admin/` en `robots.ts` y ninguna URL de acá en el sitemap (que es una lista
 * cerrada). Ningún enlace desde la navegación pública.
 */
/**
 * Siempre dinámico: la puerta lee la cookie en cada petición, así que no hay
 * nada que prerenderizar. Sin esto, `next build` intenta generar la página
 * estática, Neon Auth atrapa el aviso de "usa cookies" y lo registra como
 * error en el log del build (inofensivo, pero ruidoso).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Administración", template: "%s · Administración Luxcars" },
  description: "Herramientas internas del equipo. Acceso restringido.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  alternates: { canonical: undefined },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) notFound();

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line bg-surface/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
          <Link href="/portal" className="flex items-baseline gap-2 rounded-lux px-1 py-1">
            <span className="text-sm font-semibold tracking-[0.3em] text-ink">LUX</span>
            <span className="text-sm font-light tracking-[0.3em] text-silver">CARS</span>
            <span className="ml-3 text-[11px] font-medium uppercase tracking-[0.28em] text-ink-4">
              Administración
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-ink-3">
            {sesion.email ? <span className="truncate">{sesion.email}</span> : null}
            <Link
              href="/portal"
              className="rounded-lux border border-line px-3 py-1.5 text-ink-2 transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink"
            >
              Volver al portal
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
