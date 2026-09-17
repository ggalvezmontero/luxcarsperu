"use client";

/**
 * Armazón del portal: barra lateral, guard de sesión y cierre de sesión.
 *
 * La pantalla de login vive bajo la misma ruta (/portal/login) y por lo tanto
 * comparte este layout, pero no debe mostrar la navegación ni exigir sesión.
 * Se distingue por `usePathname()`.
 *
 * ADVERTENCIA: este guard es COMODIDAD DE INTERFAZ, no el control de acceso.
 * El control real es RLS en Postgres (`revoke all ... from anon` en `leads`,
 * `consignments` y las columnas de margen de `vehicles`). Si algún día alguien
 * mueve el tablero a renderizado en servidor con `service_role`, este guard
 * dejaría de significar nada y los leads quedarían expuestos. Ver el
 * encabezado de `src/lib/portal/supabaseBrowser.ts`.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  PortalSessionProvider,
  usePortalSession,
} from "@/components/portal/portalSession";

const LOGIN_PATH = "/portal/login";

type NavItem = {
  href: string;
  label: string;
  hint: string;
  /** `false` = la pantalla todavía no existe; se muestra como pendiente. */
  ready: boolean;
  icon: React.ReactNode;
};

/** Trazos simples, heredan `currentColor`. Sin dependencias de iconos. */
function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * `ready: false` pinta la entrada como "pronto" en vez de llevar a un 404.
 * Al crear el `page.tsx` de una sección hay que ponerla en `true`: es el único
 * cambio necesario, la barra lateral no requiere nada más.
 *
 * ESTADO AL 2026-09-15 (integración): las cuatro secciones existen y compilan
 * (`next build` las prerenderiza), así que las cuatro van en `true`. Vehículos
 * se quedó en `false` por descuido — la pantalla ya estaba hecha y la barra
 * lateral seguía diciendo "pronto", así que no había forma de llegar a ella
 * salvo escribiendo la URL a mano. Corregido al integrar.
 */
const NAV_ITEMS: NavItem[] = [
  {
    href: "/portal",
    label: "Tablero",
    hint: "Indicadores del negocio",
    ready: true,
    icon: <Icon path="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" />,
  },
  {
    href: "/portal/vehiculos",
    label: "Vehículos",
    hint: "Stock, alta por VIN y fotos",
    ready: true,
    icon: (
      <Icon path="M3 13l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5v5h-3v-2H6v2H3v-5Zm3 2h2m8 0h2" />
    ),
  },
  {
    href: "/portal/leads",
    label: "Leads",
    hint: "Consultas entrantes",
    ready: true,
    icon: <Icon path="M4 6h16v12H4V6Zm0 1 8 6 8-6" />,
  },
  {
    href: "/portal/consignaciones",
    label: "Consignaciones",
    hint: "Autos de terceros",
    ready: true,
    icon: (
      <Icon path="M12 3l8 4v6c0 4-3.4 7.2-8 8-4.6-.8-8-4-8-8V7l8-4Zm-3 9 2 2 4-4" />
    ),
  },
  {
    href: "/portal/solicitudes",
    label: "Solicitudes",
    hint: "Pedidos de búsqueda y autos por aprobar",
    ready: true,
    icon: <Icon path="M5 4h14v16H5V4Zm3 5h8m-8 4h8m-8 4h5" />,
  },
  {
    href: "/portal/usuarios",
    label: "Usuarios",
    hint: "Cuentas y roles",
    ready: true,
    icon: <Icon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 10v-2a4 4 0 0 0-3-3.9M15 3.1a4 4 0 0 1 0 7.8" />,
  },
];

function BrandMark() {
  return (
    <Link
      href="/portal"
      className="flex items-baseline gap-2 rounded-lux px-1 py-1"
    >
      <span className="text-sm font-semibold tracking-[0.3em] text-ink">
        LUX
      </span>
      <span className="text-sm font-light tracking-[0.3em] text-silver">
        CARS
      </span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones del portal" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/portal"
            ? pathname === "/portal"
            : pathname.startsWith(item.href);

        if (!item.ready) {
          // Enlace muerto = confianza rota. Mientras la pantalla no exista se
          // muestra como pendiente, sin navegar a un 404.
          return (
            <div
              key={item.href}
              className="flex items-center gap-3 rounded-lux px-3 py-2.5 text-ink-4"
              title={`${item.hint} · pendiente de construir`}
            >
              {item.icon}
              <span className="flex-1 text-sm">{item.label}</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] text-ink-4">
                pronto
              </span>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={[
              "flex items-center gap-3 rounded-lux px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-surface-2 text-ink ring-1 ring-line-strong/60"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            ].join(" ")}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SessionFooter() {
  const { status, email, signOut } = usePortalSession();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function handleSignOut() {
    setLeaving(true);
    await signOut();
    router.replace(LOGIN_PATH);
  }

  if (status === "sin-configurar") {
    return (
      <div className="rounded-lux border border-warn/30 bg-surface-2 px-3 py-3">
        <p className="text-[0.65rem] uppercase tracking-[0.16em] text-warn">
          Sin base de datos
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-3">
          Modo demostración. No hay sesión que iniciar ni cerrar.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lux border border-line bg-surface-2 px-3 py-3">
      <p className="truncate text-xs text-ink-2" title={email ?? undefined}>
        {email ?? "Sesión sin identificar"}
      </p>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={leaving}
        className="mt-2 text-xs text-ink-3 underline underline-offset-4 transition-colors hover:text-silver disabled:opacity-50"
      >
        {leaving ? "Cerrando…" : "Cerrar sesión"}
      </button>
    </div>
  );
}

/** Redirige según el estado de sesión. No renderiza nada. */
function SessionGuard({ isLogin }: { isLogin: boolean }) {
  const { status } = usePortalSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "verificando" || status === "sin-configurar") return;
    if (status === "anonimo" && !isLogin) {
      router.replace(LOGIN_PATH);
      return;
    }
    if (status === "autenticado" && isLogin) {
      router.replace("/portal");
    }
  }, [status, isLogin, router]);

  return null;
}

/**
 * Sesión válida pero sin rol de administrador: un cliente del sitio que llegó
 * a /portal. No se le muestra el portal (RLS ya le devolvería cero filas);
 * se le explica y se le manda a su cuenta.
 */
function SinPermiso() {
  const { email, signOut } = usePortalSession();
  const router = useRouter();
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-lux-lg border border-line bg-surface px-6 py-7 text-center">
        <p className="text-[0.62rem] uppercase tracking-[0.22em] text-ink-4">Portal interno</p>
        <h1 className="mt-3 text-base font-medium text-ink">Esta cuenta no es del equipo</h1>
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          {email ? <>Entraste como <span className="text-ink-2">{email}</span>. </> : null}
          El portal es solo para administradores de LuxCars. Tus solicitudes están en tu cuenta.
        </p>
        <Link
          href="/cuenta"
          className="mt-5 block w-full rounded-lux bg-ink px-4 py-3 text-sm font-medium text-void transition-colors hover:bg-silver-bright"
        >
          Ir a mi cuenta
        </Link>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.replace(LOGIN_PATH);
          }}
          className="mt-3 text-xs text-ink-3 underline underline-offset-4 hover:text-silver"
        >
          Cerrar sesión y entrar con otra cuenta
        </button>
      </div>
    </main>
  );
}

function PortalChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === LOGIN_PATH;
  const { status } = usePortalSession();
  const [menuOpen, setMenuOpen] = useState(false);

  // El login se muestra solo, centrado y sin navegación.
  if (isLogin) {
    return (
      <>
        <SessionGuard isLogin />
        <main className="flex min-h-screen items-center justify-center px-4 py-12">
          {children}
        </main>
      </>
    );
  }

  if (status === "sin-permiso") {
    return <SinPermiso />;
  }

  // Mientras se lee la sesión guardada no se pinta el tablero: evita el
  // parpadeo de números en cero antes de redirigir al login.
  const blocking = status === "verificando" || status === "anonimo";

  return (
    <>
      <SessionGuard isLogin={false} />

      <div className="min-h-screen lg:flex">
        {/* Barra superior — solo móvil */}
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
          <BrandMark />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="portal-nav-movil"
            className="rounded-lux border border-line px-3 py-1.5 text-xs text-ink-2"
          >
            {menuOpen ? "Cerrar" : "Menú"}
          </button>
        </header>

        {menuOpen ? (
          <div
            id="portal-nav-movil"
            className="border-b border-line bg-surface px-4 py-4 lg:hidden"
          >
            <NavList onNavigate={() => setMenuOpen(false)} />
            <div className="mt-4">
              <SessionFooter />
            </div>
          </div>
        ) : null}

        {/* Barra lateral — escritorio */}
        <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:flex lg:h-screen lg:flex-col lg:sticky lg:top-0">
          <div className="border-b border-line px-5 py-5">
            <BrandMark />
            <p className="mt-2 text-[0.6rem] uppercase tracking-[0.22em] text-ink-4">
              Portal interno
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavList />
          </div>

          <div className="border-t border-line px-3 py-4">
            <SessionFooter />
            <p className="mt-3 px-1 text-[0.6rem] leading-relaxed text-ink-4">
              Uso interno de LUX CARS IMPORT S.A.C. No compartir capturas: esta
              pantalla contiene datos de clientes.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {blocking ? (
            <p className="text-sm text-ink-3" role="status">
              Verificando sesión…
            </p>
          ) : (
            children
          )}
        </main>
      </div>
    </>
  );
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalSessionProvider>
      <PortalChrome>{children}</PortalChrome>
    </PortalSessionProvider>
  );
}
