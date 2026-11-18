/**
 * /api/meta/eventos — reenvío a la API de conversiones de Meta.
 *
 *   POST { event_name, event_id, event_source_url, custom_data } → 202
 *
 * POR QUÉ EXISTE
 * El píxel del navegador lo frenan los bloqueadores y Safari recorta sus
 * cookies. Meta recomienda mandar cada evento también desde el servidor con el
 * mismo `event_id`: si llegan los dos, deduplica; si uno se pierde, cuenta el
 * otro. Sin esto, la pauta "clic a WhatsApp" aprende con la mitad de los datos.
 *
 * QUÉ MANDA DE LA PERSONA
 * Solo lo que Meta usa para emparejar y que ya tiene el navegador: IP, user
 * agent y sus propias cookies `_fbp` / `_fbc` (o el `fbclid` de la URL). Nada
 * de nombre, teléfono ni correo: el sitio no los pide antes de WhatsApp.
 *
 * CONSENTIMIENTO
 * El navegador solo llama a esta ruta si `window.fbq` existe, y eso solo pasa
 * tras aceptar el banner (MetaPixel.tsx). La ruta no puede saber eso por sí
 * sola, así que además exige que la petición sea del propio sitio.
 *
 * Sin META_CAPI_ACCESS_TOKEN o sin píxel responde 204 y no hace nada: el
 * sitio funciona igual, solo mide el píxel del navegador. Nunca lanza.
 */

import { NextResponse } from "next/server";

import { META_EVENT_NAMES, META_PIXEL_ID, type MetaServerEvent } from "@/lib/analytics";

const GRAPH_VERSION = "v22.0";

/** Un `event_id` razonable: UUID o el respaldo de `newEventId`. */
const RE_EVENT_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Tope de claves y largo de `custom_data` para que nadie use la ruta de buzón. */
const CUSTOM_DATA_MAX_KEYS = 24;
const CUSTOM_DATA_MAX_STRING = 200;

export async function POST(request: Request) {
  const token = (process.env.META_CAPI_ACCESS_TOKEN ?? "").trim();
  if (!token || !META_PIXEL_ID) return new Response(null, { status: 204 });

  /* Solo desde el propio sitio. `sec-fetch-site` lo ponen todos los
     navegadores modernos; si falta, se acepta (clientes viejos) pero el
     allowlist de eventos y los topes siguen aplicando. */
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return NextResponse.json({ ok: false, error: "Origen no permitido." }, { status: 403 });
  }

  const evento = await leerEvento(request);
  if (!evento) {
    return NextResponse.json({ ok: false, error: "Evento inválido." }, { status: 400 });
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  const fbp = cookies["_fbp"];
  const fbc = cookies["_fbc"] ?? fbcDesdeUrl(evento.event_source_url);

  const userData: Record<string, string> = {
    client_ip_address: clientIp(request),
    client_user_agent: request.headers.get("user-agent") ?? "",
  };
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const testEventCode = (process.env.META_CAPI_TEST_EVENT_CODE ?? "").trim();

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: evento.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: evento.event_id,
        event_source_url: evento.event_source_url,
        action_source: "website",
        user_data: userData,
        custom_data: evento.custom_data,
      },
    ],
    access_token: token,
  };
  if (testEventCode) payload.test_event_code = testEventCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${META_PIXEL_ID}/events`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        /* Si Meta tarda, no se bloquea la función de Vercel. */
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.warn("[meta-capi] Meta respondió", res.status, detalle.slice(0, 300));
      return NextResponse.json({ ok: false, error: "Meta rechazó el evento." }, { status: 502 });
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    console.warn("[meta-capi] No se pudo contactar a Meta", error);
    return NextResponse.json({ ok: false, error: "Meta no respondió." }, { status: 502 });
  }
}

/* ── Lectura y validación del cuerpo ─────────────────────────────────────── */

async function leerEvento(request: Request): Promise<MetaServerEvent | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const eventName = typeof b.event_name === "string" ? b.event_name : "";
  if (!META_EVENT_NAMES.has(eventName)) return null;

  const eventId = typeof b.event_id === "string" ? b.event_id : "";
  if (!RE_EVENT_ID.test(eventId)) return null;

  const url = typeof b.event_source_url === "string" ? b.event_source_url : "";
  if (!esUrlDelSitio(url, request)) return null;

  const customData: MetaServerEvent["custom_data"] = {};
  if (b.custom_data && typeof b.custom_data === "object") {
    let claves = 0;
    for (const [key, value] of Object.entries(b.custom_data as Record<string, unknown>)) {
      if (claves >= CUSTOM_DATA_MAX_KEYS) break;
      if (!/^[a-z_]{1,40}$/.test(key)) continue;
      if (typeof value === "string") {
        customData[key] = value.slice(0, CUSTOM_DATA_MAX_STRING);
      } else if (typeof value === "number" && Number.isFinite(value)) {
        customData[key] = value;
      } else if (typeof value === "boolean") {
        customData[key] = value;
      } else {
        continue;
      }
      claves += 1;
    }
  }

  return { event_name: eventName, event_id: eventId, event_source_url: url, custom_data: customData };
}

/** La URL del evento tiene que ser una página de este mismo host. */
function esUrlDelSitio(url: string, request: Request): boolean {
  try {
    const u = new URL(url);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    return u.protocol === "https:" || u.protocol === "http:"
      ? host === "" || u.host === host
      : false;
  } catch {
    return false;
  }
}

/* ── Datos de emparejamiento ─────────────────────────────────────────────── */

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const primera = forwarded.split(",")[0]?.trim();
  return primera || request.headers.get("x-real-ip") || "";
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const parte of header.split(";")) {
    const idx = parte.indexOf("=");
    if (idx <= 0) continue;
    const nombre = parte.slice(0, idx).trim();
    const valor = parte.slice(idx + 1).trim();
    if (nombre) out[nombre] = valor;
  }
  return out;
}

/**
 * Si no hay cookie `_fbc` pero la URL trae `fbclid` (clic en un anuncio de
 * Meta), se construye con el formato que Meta documenta: fb.1.<ms>.<fbclid>.
 */
function fbcDesdeUrl(url: string): string | undefined {
  try {
    const fbclid = new URL(url).searchParams.get("fbclid");
    if (!fbclid || fbclid.length > 500) return undefined;
    return `fb.1.${Date.now()}.${fbclid}`;
  } catch {
    return undefined;
  }
}
