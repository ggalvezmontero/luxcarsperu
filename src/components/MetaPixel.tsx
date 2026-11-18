"use client";

import {
  META_PIXEL_ENABLED,
  META_PIXEL_ID,
  readCookieConsent,
  subscribeCookieConsent,
} from "@/lib/analytics";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef, useSyncExternalStore } from "react";

/* Igual que en GoogleAnalytics.tsx: sin decisión en el servidor ni en la
   hidratación, para que el HTML inicial nunca lleve la etiqueta. */
const sinDecision = () => null;

/**
 * Carga el píxel de Meta SOLO cuando se cumplen las dos condiciones:
 *
 *   1. Estamos en producción y hay NEXT_PUBLIC_META_PIXEL_ID
 *      (META_PIXEL_ENABLED, decidido en build).
 *   2. El visitante aceptó las cookies opcionales en el CookieBanner.
 *
 * Mientras no se cumplan no sale ni una petición a connect.facebook.net.
 * "Rechazar" deja el sitio sin píxel, y como `trackMetaEvent` solo actúa si
 * `window.fbq` existe, tampoco sale nada hacia /api/meta/eventos.
 *
 * El script de arranque de Meta manda un `PageView` al iniciar. Las
 * navegaciones internas (App Router no recarga la página) se cubren con el
 * efecto sobre `pathname`, saltando la primera ejecución para no duplicar
 * el PageView inicial.
 *
 * No hay <noscript><img>: no puede respetar el consentimiento.
 */
export function MetaPixel() {
  const consent = useSyncExternalStore(subscribeCookieConsent, readCookieConsent, sinDecision);
  const active = META_PIXEL_ENABLED && consent === "accepted";

  const pathname = usePathname();
  const primeraRuta = useRef(true);

  useEffect(() => {
    if (!active) return;
    if (primeraRuta.current) {
      primeraRuta.current = false;
      return;
    }
    if (typeof window.fbq === "function") window.fbq("track", "PageView");
  }, [active, pathname]);

  if (!active) return null;

  /* Snippet oficial de Meta. El ID viene de la variable de entorno; solo
     dígitos, así que puede ir dentro del script sin escapar. */
  const bootstrap = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID.replace(/\D/g, "")}');fbq('track','PageView');`;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {bootstrap}
    </Script>
  );
}
