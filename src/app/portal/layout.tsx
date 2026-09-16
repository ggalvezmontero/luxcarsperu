import type { Metadata } from "next";

import { PortalShell } from "@/components/portal/PortalShell";

/**
 * Layout del portal de administración.
 *
 * Monta `PortalShell`, que a su vez provee `PortalSessionProvider` (la sesión
 * de Supabase Auth que consumen todas las pantallas con `usePortalSession()`) y
 * la barra lateral. Cualquier pantalla nueva bajo `/portal` la hereda sin hacer
 * nada.
 *
 * `noindex, nofollow` cubre TODO lo que cuelgue de `/portal`, incluidas las
 * rutas que se agreguen después. Es la única forma de que una pantalla nueva no
 * se filtre a Google por olvido.
 *
 * ESTO NO ES CONTROL DE ACCESO: `noindex` le pide a un buscador que no indexe,
 * no impide que alguien abra la URL. El control real es RLS en Postgres, como
 * explica el encabezado de `src/lib/portal/supabaseBrowser.ts`.
 *
 * ⚠ ESTE ARCHIVO LO TOCAN DOS EQUIPOS EN PARALELO. Si lo cambias, FUSIONA en
 * lugar de reemplazar: ya se perdió una versión completa una vez. `PortalShell`
 * no es decorativo — sin él, `usePortalSession()` lanza y el tablero deja de
 * renderizar.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * LÉEME ANTES DE AGREGAR UNA PANTALLA AL PORTAL
 * ══════════════════════════════════════════════════════════════════════════
 * El guard de sesión que monta `PortalShell` corre EN EL NAVEGADOR. Sirve para
 * pantallas que leen con la sesión del equipo, porque ahí el candado de verdad
 * es RLS: sin sesión, Postgres devuelve cero filas.
 *
 * NO sirve para un componente de SERVIDOR que lea con `service_role`. Esa
 * llave salta todas las políticas: Next renderiza el HTML con los datos
 * dentro y lo envía ANTES de que ningún guard de cliente llegue a correr.
 * Quien pida la ruta con `curl` —sin ejecutar JavaScript— se lleva los datos.
 * Con leads eso significa nombres, teléfonos y correos: Ley 29733.
 *
 * Es decir: una pantalla de servidor con `service_role` queda EXPUESTA aunque
 * el portal tenga login. Hoy leen con `service_role`
 * `src/app/portal/leads/data.ts` y `src/app/portal/vehiculos/data.ts`. Antes de
 * publicar sus `page.tsx` hay que cerrar la puerta en el servidor. Tres
 * caminos, en orden de solidez:
 *
 *   A) Instalar `@supabase/ssr` (hoy NO está en package.json: es decisión del
 *      dueño) y agregar un `middleware.ts` que valide la sesión y redirija a
 *      /portal/login antes de responder cualquier /portal/*. Es la vía oficial.
 *   B) Que esas pantallas lean con la sesión del equipo desde el cliente (como
 *      hace el tablero) y dejar `service_role` únicamente en Route Handlers
 *      protegidos por `verificarAccesoPortal()` de `src/lib/portal/auth.ts`.
 *   C) Mientras tanto, activar Deployment Protection en Vercel sobre /portal:
 *      corta el acceso al HTML en el borde, antes de que Next renderice.
 *
 * Lo que NO es una solución: confiar en que la ruta "no está enlazada".
 * ══════════════════════════════════════════════════════════════════════════
 */
export const metadata: Metadata = {
  title: { default: "Portal", template: "%s · Portal LuxCars" },
  description: "Portal interno de administración. Acceso restringido al equipo.",
  // Dos capas a propósito: `robots` para los rastreadores serios y el
  // `googleBot` explícito para anular la herencia del layout raíz, que sí pide
  // indexación. `noimageindex` evita que las fotos del stock se indexen sueltas.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  alternates: { canonical: undefined },
};

export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PortalShell>{children}</PortalShell>;
}
