'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "luxcars-cookie-consent";

/**
 * Aviso de cookies.
 *
 * NOTAS DE ACCESIBILIDAD (auditoría 2026-09-15)
 *
 * 1. EL FOCO NO SE ROBA AL APARECER. El banner se monta un segundo después de
 *    la carga. Llevar el foco ahí por sorpresa interrumpiría a quien ya está
 *    leyendo o escribiendo (WCAG 3.2.5). En su lugar el banner se anuncia solo
 *    con `role="region"` + nombre, y queda al final del orden de tabulación,
 *    que es donde también está visualmente (abajo del todo).
 *
 * 2. EL FOCO SÍ SE DEVUELVE AL CERRAR. Éste era el fallo real: al pulsar
 *    "Aceptar" o "Rechazar" el componente se desmonta, el botón enfocado
 *    desaparece y el navegador manda el foco a `<body>`. La siguiente
 *    tabulación arranca desde el principio de la página, no desde donde
 *    estabas (WCAG 2.4.3). Ahora el foco se devuelve al elemento que lo tenía
 *    antes de que el banner apareciera, y si ese elemento ya no existe, al
 *    `<main>`.
 *
 * 3. NO SE CIERRA CON ESCAPE, A PROPÓSITO. Escape tendría que significar
 *    "aceptar" o "rechazar", y ninguna de las dos es una lectura honesta de
 *    una tecla de descarte. Un consentimiento tiene que ser un acto explícito;
 *    dejarlo abierto hasta que se elija es lo correcto, no un descuido.
 *
 * 4. NO ES UN DIÁLOGO MODAL. No atrapa el foco ni bloquea el resto de la
 *    página: se puede seguir navegando el sitio con el banner abierto.
 */
export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  /* Quién tenía el foco justo antes de que esto apareciera. */
  const focoPrevio = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (consent) return;

    const temporizador = setTimeout(() => {
      focoPrevio.current =
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body
          ? document.activeElement
          : null;
      setShowBanner(true);
    }, 1000);

    return () => clearTimeout(temporizador);
  }, []);

  /**
   * Devuelve el foco a un sitio con sentido en vez de dejarlo en `<body>`.
   * `isConnected` descarta el caso de que el elemento previo ya se haya
   * desmontado (por ejemplo, tras navegar a otra ruta).
   */
  const devolverFoco = useCallback(() => {
    const previo = focoPrevio.current;
    if (previo?.isConnected) {
      previo.focus();
      return;
    }

    const main = document.querySelector("main");
    if (!main) return;
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    main.focus();
  }, []);

  /* PENDIENTE (no es accesibilidad, pero se ve desde aquí): ni "aceptar" ni
     "rechazar" activan o bloquean nada todavía. El día que se añada analítica,
     tiene que leer esta clave ANTES de cargarse, o el banner es decorativo. */
  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setShowBanner(false);
    devolverFoco();
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
    setShowBanner(false);
    devolverFoco();
  };

  if (!showBanner) return null;

  return (
    <div
      role="region"
      aria-labelledby="cookie-banner-titulo"
      aria-describedby="cookie-banner-texto"
      className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-md"
    >
      <div className="rounded-2xl border border-line bg-surface/95 p-4 shadow-[var(--lux-shadow-lg)] backdrop-blur-xl sm:p-5">
        <h2 id="cookie-banner-titulo" className="text-sm font-semibold text-ink">
          Usamos cookies
        </h2>
        <p id="cookie-banner-texto" className="mt-1 text-xs leading-relaxed text-ink-3">
          Esenciales para que el sitio funcione y opcionales para mejorar tu experiencia.{" "}
          <Link href="/cookies" className="text-ink-2 underline underline-offset-2 hover:text-ink">
            Más información<span className="sr-only"> sobre nuestro uso de cookies</span>
          </Link>
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleReject}
            className="min-h-10 flex-1 rounded-full border border-line-strong px-4 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Rechazar<span className="sr-only"> las cookies opcionales</span>
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="min-h-10 flex-1 rounded-full bg-ink px-4 text-sm font-semibold text-void transition-colors hover:bg-silver-bright"
          >
            Aceptar<span className="sr-only"> las cookies opcionales</span>
          </button>
        </div>
      </div>
    </div>
  );
}
