/**
 * Google Analytics 4: helpers compartidos por el banner de cookies, el
 * componente que carga la etiqueta y los componentes que disparan eventos.
 *
 * REGLAS
 * 1. El ID de medición NUNCA va escrito en el código: sale de la variable
 *    NEXT_PUBLIC_GA_MEASUREMENT_ID (Vercel → Production y Preview).
 * 2. La etiqueta solo se carga en producción y solo si el visitante aceptó las
 *    cookies opcionales en el banner (ver GoogleAnalytics.tsx). Hasta entonces
 *    no sale ni una petición a googletagmanager.com.
 * 3. `trackEvent` es seguro de llamar siempre: si GA no está cargado, no hace
 *    nada. Los componentes no tienen que preguntar por el consentimiento.
 *
 * La lista completa de eventos y qué marcar como conversión está en
 * docs/analytics.md. Mantener ese archivo al día cuando se añada un evento.
 */

export const GA_MEASUREMENT_ID = (
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? ""
).trim();

/** Clave en localStorage con la decisión del banner de cookies. */
export const COOKIE_CONSENT_KEY = "luxcars-cookie-consent";

/** Evento del `window` con el que el banner avisa que cambió la decisión. */
export const COOKIE_CONSENT_EVENT = "luxcars:cookie-consent";

export type CookieConsent = "accepted" | "rejected";

/**
 * ¿Se debe cargar GA en este entorno? Solo con ID y solo en el build de
 * producción (Vercel Production y Preview). En `next dev` nunca, para no
 * mezclar las pruebas locales con las visitas reales.
 */
export const ANALYTICS_ENABLED =
  Boolean(GA_MEASUREMENT_ID) && process.env.NODE_ENV === "production";

export function readCookieConsent(): CookieConsent | null {
  try {
    const value = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

/** Guarda la decisión y avisa al componente de GA en la misma pestaña. */
export function writeCookieConsent(consent: CookieConsent) {
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, consent);
  } catch {
    /* Sin almacenamiento (modo privado estricto): la decisión vale solo en esta vista. */
  }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: consent }));
}

/* ---------------------------------------------------------------------------
   EVENTOS
   ---------------------------------------------------------------------------
   Nombres en snake_case, en inglés como los eventos recomendados de GA4, y
   parámetros con prefijo por entidad (`vehicle_*`, `cta`, `page_path`).
   Añadir uno nuevo = añadirlo aquí Y en docs/analytics.md.
   ------------------------------------------------------------------------- */
export const GA_EVENTS = {
  /** Clic en cualquier enlace a wa.me. */
  whatsappClick: "whatsapp_click",
  /** Clic en un enlace tel:. Hoy no hay ninguno en el sitio, pero queda cubierto. */
  phoneClick: "phone_click",
  /** Clic en un enlace mailto:. */
  emailClick: "email_click",
  /** Clic en un botón marcado con data-ga-cta (CTAs de /importar, /vender, /escaneo, portada…). */
  ctaClick: "cta_click",
  /** Clic en una tarjeta del stock (portada y /comprar). */
  stockCardClick: "stock_card_click",
  /** Formulario de contacto de la portada enviado (se abre WhatsApp con el mensaje). */
  contactFormSubmit: "contact_form_submit",
  /** Formulario de tasación de /vender enviado. */
  valuationFormSubmit: "valuation_form_submit",
  /** La calculadora produjo un estimado completo. */
  calculatorEstimate: "calculator_estimate",
  /** El visitante eligió un modelo en la calculadora. */
  calculatorModelChange: "calculator_model_change",
  /** Descargó el PDF del estimado. */
  calculatorPdfDownload: "calculator_pdf_download",
  /** Compartió el estimado (enlace /c/<código>). */
  calculatorShare: "calculator_share",
} as const;

export type GaEventName = (typeof GA_EVENTS)[keyof typeof GA_EVENTS];

export type GaEventParams = Record<string, string | number | boolean | undefined>;

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

/**
 * Empuja un comando a `dataLayer` con la misma forma que la función `gtag`
 * oficial. gtag.js solo procesa entradas que son un objeto `arguments`: un
 * array normal lo ignora. Por eso no se usa `push([...])` ni parámetros rest.
 */
export const gtag: GtagFn = function () {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
};

/**
 * Suscripción al consentimiento para `useSyncExternalStore`: cambia cuando el
 * banner decide (evento propio, misma pestaña) o cuando otra pestaña del
 * mismo sitio lo cambia (evento `storage`).
 */
export function subscribeCookieConsent(onChange: () => void) {
  window.addEventListener(COOKIE_CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COOKIE_CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Consent Mode v2. Se declara ANTES de que cargue gtag.js: todo denegado.
 * Solo se concede `analytics_storage`; el sitio no hace publicidad, así que
 * los tres permisos de anuncios quedan denegados aunque se acepte.
 */
export function consentDefault() {
  gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });
}

export function consentGrantAnalytics() {
  gtag("consent", "update", { analytics_storage: "granted" });
}

/**
 * Dispara un evento. Si GA no está cargado (sin consentimiento, en desarrollo,
 * sin ID) no hace nada: los componentes lo llaman sin condiciones.
 *
 * `page_path` se añade solo: en una SPA es lo que permite saber en qué página
 * se hizo clic sin depender del título.
 */
export function trackEvent(name: GaEventName, params: GaEventParams = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const clean: GaEventParams = { page_path: window.location.pathname };
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    clean[key] = typeof value === "string" ? value.slice(0, 100) : value;
  }
  window.gtag("event", name, clean);
}
