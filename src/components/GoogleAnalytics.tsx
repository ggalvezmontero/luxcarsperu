"use client";

import {
  ANALYTICS_ENABLED,
  GA_EVENTS,
  GA_MEASUREMENT_ID,
  consentDefault,
  consentGrantAnalytics,
  readCookieConsent,
  subscribeCookieConsent,
  trackEvent,
} from "@/lib/analytics";
import { GoogleAnalytics as NextGoogleAnalytics } from "@next/third-parties/google";
import { useEffect, useSyncExternalStore } from "react";

/* En el servidor y en la hidratación no hay decisión: así el primer render
   coincide con el HTML servido y la etiqueta nunca entra en el HTML inicial. */
const sinDecision = () => null;

/**
 * Carga Google Analytics 4 SOLO cuando se cumplen las dos condiciones:
 *
 *   1. Estamos en producción y hay NEXT_PUBLIC_GA_MEASUREMENT_ID
 *      (ANALYTICS_ENABLED, decidido en build).
 *   2. El visitante aceptó las cookies opcionales en el CookieBanner, ya sea
 *      en una visita anterior (localStorage) o ahora mismo (evento).
 *
 * Mientras no se cumplan, no se inyecta ningún <script>: ni gtag.js ni el
 * inline de inicialización. "Rechazar" deja el sitio sin una sola petición a
 * Google. Por eso no hace falta un banner "decorativo": el consentimiento
 * gobierna de verdad la carga.
 *
 * Consent Mode v2: antes de que la etiqueta encole su `config` se empuja a
 * dataLayer el `consent default` (todo denegado) y el `consent update` que
 * concede analytics_storage. gtag.js procesa la cola en orden, así que la
 * etiqueta arranca ya con el estado correcto. El orden lo garantiza que
 * <ConsentMode> sea el hermano ANTERIOR a la etiqueta: React corre los
 * efectos de los hermanos en orden, y los <Script> de next/script se inyectan
 * en un efecto. (Un efecto en este mismo componente no sirve: los efectos de
 * los hijos corren antes que los del padre y el `config` quedaba primero.)
 *
 * Además registra un único listener de clics para los eventos que nacen en
 * componentes de servidor (enlaces a WhatsApp, CTAs con data-ga-cta, tarjetas
 * del stock). Así esos componentes no tienen que volverse "use client".
 */
export function GoogleAnalytics() {
  const consent = useSyncExternalStore(subscribeCookieConsent, readCookieConsent, sinDecision);

  const active = ANALYTICS_ENABLED && consent === "accepted";

  useEffect(() => {
    if (!active) return;
    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [active]);

  if (!active) return null;
  return (
    <>
      <ConsentMode />
      <NextGoogleAnalytics gaId={GA_MEASUREMENT_ID} />
    </>
  );
}

/** Declara el consentimiento. Tiene que montarse ANTES que la etiqueta (ver arriba). */
function ConsentMode() {
  useEffect(() => {
    consentDefault();
    consentGrantAnalytics();
  }, []);
  return null;
}

/**
 * Deriva el evento a partir del enlace pulsado. Prioridad:
 *   tarjeta del stock → WhatsApp → teléfono → correo → CTA marcado.
 * El texto visible del enlace es la etiqueta de respaldo cuando no hay
 * `data-ga-cta`, para que ningún clic a WhatsApp quede sin contexto.
 */
function onDocumentClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor) return;

  const href = anchor.getAttribute("href") ?? "";
  const cta = anchor.dataset.gaCta || labelFromText(anchor);

  const card = anchor.closest<HTMLElement>("[data-ga-vehicle-id]");
  if (card) {
    trackEvent(GA_EVENTS.stockCardClick, {
      vehicle_id: card.dataset.gaVehicleId,
      vehicle_brand: card.dataset.gaVehicleBrand,
      vehicle_model: card.dataset.gaVehicleModel,
      vehicle_status: card.dataset.gaVehicleStatus,
    });
    return;
  }

  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\//i.test(href)) {
    trackEvent(GA_EVENTS.whatsappClick, { cta });
    return;
  }
  if (/^tel:/i.test(href)) {
    trackEvent(GA_EVENTS.phoneClick, { cta });
    return;
  }
  if (/^mailto:/i.test(href)) {
    trackEvent(GA_EVENTS.emailClick, { cta });
    return;
  }
  if (anchor.dataset.gaCta) {
    trackEvent(GA_EVENTS.ctaClick, { cta: anchor.dataset.gaCta, href });
  }
}

function labelFromText(anchor: HTMLAnchorElement) {
  return (anchor.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || undefined;
}
