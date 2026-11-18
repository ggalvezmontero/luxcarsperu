/**
 * Medición del sitio: Google Analytics 4 y el píxel de Meta. Helpers
 * compartidos por el banner de cookies, los componentes que cargan las
 * etiquetas y los componentes que disparan eventos.
 *
 * REGLAS
 * 1. El ID de medición NUNCA va escrito en el código: sale de la variable
 *    NEXT_PUBLIC_GA_MEASUREMENT_ID (Vercel → Production y Preview).
 * 2. La etiqueta solo se carga en producción y solo si el visitante aceptó las
 *    cookies opcionales en el banner (ver GoogleAnalytics.tsx). Hasta entonces
 *    no sale ni una petición a googletagmanager.com.
 * 3. `trackEvent` es seguro de llamar siempre: si GA no está cargado, no hace
 *    nada. Los componentes no tienen que preguntar por el consentimiento.
 * 4. El mismo `trackEvent` alimenta el píxel de Meta (navegador) y la API de
 *    conversiones de Meta (servidor) con un `eventID` común para que Meta
 *    deduplique. Los componentes no saben que Meta existe: ver META_EVENT_MAP.
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
  if (typeof window === "undefined") return;
  const clean: GaEventParams = { page_path: window.location.pathname };
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    clean[key] = typeof value === "string" ? value.slice(0, 100) : value;
  }
  if (typeof window.gtag === "function") window.gtag("event", name, clean);
  trackMetaEvent(name, clean);
}

/* ---------------------------------------------------------------------------
   META: PÍXEL (NAVEGADOR) + API DE CONVERSIONES (SERVIDOR)
   ---------------------------------------------------------------------------
   Es el motor de la pauta "clic a WhatsApp" del plan de marketing: sin el
   píxel Meta no aprende quién convierte y los anuncios no se optimizan.

   Mismas reglas que GA4: el ID sale de NEXT_PUBLIC_META_PIXEL_ID, solo en
   producción y solo tras aceptar el banner (MetaPixel.tsx). El token de la API
   de conversiones (META_CAPI_ACCESS_TOKEN) vive solo en el servidor y lo usa
   /api/meta/eventos.

   Cada evento sale dos veces con el MISMO `event_id`: por `fbq` desde el
   navegador y por la ruta del servidor. Meta descarta el duplicado y se queda
   con el que llegue aunque un bloqueador frene al otro. Los nombres estándar
   (Contact, Lead, ViewContent) son los que Meta entiende como conversión sin
   configurar nada; los demás van como eventos personalizados.
   ------------------------------------------------------------------------- */

export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();

export const META_PIXEL_ENABLED =
  Boolean(META_PIXEL_ID) && process.env.NODE_ENV === "production";

/** Ruta del servidor que reenvía los eventos a la API de conversiones. */
export const META_CAPI_ENDPOINT = "/api/meta/eventos";

export type MetaEvent = {
  /** Nombre que recibe Meta. */
  name: string;
  /** `true` = evento estándar de Meta (`fbq('track')`); `false` = personalizado (`trackCustom`). */
  standard: boolean;
};

/**
 * Qué evento de GA4 se traduce a cuál de Meta. Los que no están acá
 * (`cta_click`, `calculator_model_change`) son navegación y no se mandan:
 * ensuciarían la optimización de la pauta.
 */
export const META_EVENT_MAP: Partial<Record<GaEventName, MetaEvent>> = {
  whatsapp_click: { name: "Contact", standard: true },
  phone_click: { name: "Contact", standard: true },
  email_click: { name: "Contact", standard: true },
  contact_form_submit: { name: "Lead", standard: true },
  valuation_form_submit: { name: "Lead", standard: true },
  stock_card_click: { name: "ViewContent", standard: true },
  calculator_estimate: { name: "CalculatorEstimate", standard: false },
  calculator_pdf_download: { name: "CalculatorPdfDownload", standard: false },
  calculator_share: { name: "CalculatorShare", standard: false },
};

/** Nombres que la ruta del servidor acepta. Cualquier otro se rechaza. */
export const META_EVENT_NAMES: ReadonlySet<string> = new Set(
  Object.values(META_EVENT_MAP).map((e) => e.name),
);

/** Lo que viaja del navegador a /api/meta/eventos. */
export type MetaServerEvent = {
  event_name: string;
  event_id: string;
  event_source_url: string;
  custom_data: Record<string, string | number | boolean>;
};

type FbqFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: FbqFn;
  }
}

function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Traduce los parámetros de GA4 a `custom_data` de Meta. Se pasan tal cual
 * (Meta admite claves propias) y además se rellenan las que Meta usa para
 * optimizar: `value` + `currency` cuando hay un estimado y `content_name`
 * para saber de qué auto o botón se trata.
 */
function metaCustomData(params: GaEventParams): MetaServerEvent["custom_data"] {
  const data: MetaServerEvent["custom_data"] = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    data[key] = value;
  }
  const brand = params.vehicle_brand;
  const model = params.vehicle_model;
  if (typeof brand === "string" && typeof model === "string") {
    data.content_name = `${brand} ${model}`.slice(0, 100);
  } else if (typeof params.cta === "string") {
    data.content_name = params.cta;
  }
  if (typeof params.final_estimate_usd === "number") {
    data.value = params.final_estimate_usd;
    data.currency = "USD";
  }
  return data;
}

/**
 * Manda el evento al píxel y, si el píxel está cargado (o sea, hubo
 * consentimiento), también al servidor. Si `fbq` no existe no sale nada,
 * tampoco al servidor: la decisión del banner gobierna las dos vías.
 */
function trackMetaEvent(gaName: GaEventName, params: GaEventParams) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  const meta = META_EVENT_MAP[gaName];
  if (!meta) return;

  const eventId = newEventId();
  const customData = metaCustomData(params);
  window.fbq(meta.standard ? "track" : "trackCustom", meta.name, customData, {
    eventID: eventId,
  });

  const body: MetaServerEvent = {
    event_name: meta.name,
    event_id: eventId,
    event_source_url: window.location.href,
    custom_data: customData,
  };
  /* keepalive: el clic a WhatsApp abre otra pestaña y esta puede quedar en
     segundo plano; sin keepalive el navegador cancelaría la petición. */
  fetch(META_CAPI_ENDPOINT, {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    /* La medición nunca rompe la navegación. */
  });
}
