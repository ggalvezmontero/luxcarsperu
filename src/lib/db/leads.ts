/**
 * Captura de leads.
 *
 * Filosofía: el lead NUNCA se pierde. Si no hay base de datos, si falta
 * `DATABASE_URL` o si Neon está caído, `createLead` devuelve un
 * resultado con `fallback: "whatsapp"` para que la UI empuje al cliente al
 * enlace de WhatsApp con el mensaje ya armado (`src/lib/whatsapp.ts`). Ese es
 * el canal que el negocio ya usa hoy; la base de datos solo lo complementa.
 *
 * SOLO SERVIDOR. La tabla `public.leads` no otorga INSERT al rol anónimo (ver
 * `db/migrations/20260915090500_leads.sql`): el acceso anónimo de la Data API
 * es público y cualquiera podría inyectar leads en masa. La escritura va por
 * la conexión directa (`DATABASE_URL`) desde un Route Handler o Server Action.
 * Nunca importes este módulo desde un componente con "use client".
 *
 * Además hay datos personales de ciudadanos peruanos (Ley 29733): se guarda lo
 * mínimo para poder responder, y a propósito no se registran IP ni huella de
 * navegador.
 *
 * Este módulo NUNCA lanza.
 */

import { getSql, isDatabaseWriteConfigured, warnOnce } from "./client";
import {
  LEAD_ORIGINS,
  LEAD_STATUSES,
  type CreateLeadInput,
  type CreateLeadResult,
  type Lead,
  type LeadOrigin,
  type LeadRow,
  type LeadStatus,
} from "./types";

const WHATSAPP_MESSAGE =
  "No pudimos registrar tu solicitud en línea. Escríbenos por WhatsApp y te respondemos de inmediato.";

/** Recorta y normaliza; devuelve `null` para cadenas vacías. */
function clean(value: string | null | undefined, maxLength = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function toPositiveNumberOrNull(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function pickFrom<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function mapLead(row: LeadRow): Lead {
  return {
    id: row.id,
    origin: pickFrom<LeadOrigin>(row.origen, LEAD_ORIGINS, "contacto"),
    status: pickFrom<LeadStatus>(row.estado, LEAD_STATUSES, "nuevo"),
    name: row.nombre,
    phone: row.telefono,
    email: row.email,
    message: row.mensaje,
    vehicleId: row.vehicle_id,
    interestBrand: row.interes_marca,
    interestModel: row.interes_modelo,
    interestYear: row.interes_anio,
    budgetUsd: toPositiveNumberOrNull(row.presupuesto_usd),
    sourcePath: row.pagina_origen,
    createdAt: row.created_at,
  };
}

/** Validación mínima de correo, espejo del CHECK de la tabla. */
function isPlausibleEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

/**
 * Registra un lead.
 *
 * Resultados posibles:
 *  - `{ ok: true, lead }` — guardado.
 *  - `{ ok: false, reason: "database-not-configured", fallback: "whatsapp" }` —
 *    ruta normal mientras no exista base de datos. NO es un bug.
 *  - `{ ok: false, reason: "invalid-input" }` — faltan nombre o contacto.
 *  - `{ ok: false, reason: "database-error", fallback: "whatsapp" }` — la BD
 *    respondió con error; el cliente sigue por WhatsApp.
 *
 * En los cuatro casos la UI puede mostrar el enlace de WhatsApp: es el plan B
 * del negocio, no un mensaje de error técnico.
 */
export async function createLead(
  input: CreateLeadInput,
): Promise<CreateLeadResult> {
  const name = clean(input.name, 160);
  const phone = clean(input.phone, 40);
  const rawEmail = clean(input.email, 160);
  const email = rawEmail && isPlausibleEmail(rawEmail) ? rawEmail : null;

  if (!name) {
    return {
      ok: false,
      reason: "invalid-input",
      fallback: "whatsapp",
      message: "Necesitamos tu nombre para poder contactarte.",
    };
  }
  if (!phone && !email) {
    return {
      ok: false,
      reason: "invalid-input",
      fallback: "whatsapp",
      message: "Déjanos un teléfono o un correo válido para responderte.",
    };
  }

  // Solo la conexión directa: `anonymous` no tiene INSERT sobre `leads`, a propósito.
  const sql = getSql();

  if (!sql) {
    warnOnce(
      "leads:no-db",
      "Sin DATABASE_URL: createLead() no persiste nada y responde con fallback a WhatsApp (ver .env.example).",
    );
    return {
      ok: false,
      reason: "database-not-configured",
      fallback: "whatsapp",
      message: WHATSAPP_MESSAGE,
    };
  }

  try {
    const interestYear =
      typeof input.interestYear === "number" &&
      input.interestYear >= 1980 &&
      input.interestYear <= 2100
        ? input.interestYear
        : null;

    // El estado siempre nace en 'nuevo': lo decide el servidor, no el
    // formulario. Nadie debe poder entrar al embudo como 'ganado'.
    const rows = await sql`
      insert into public.leads (
        origen, estado, nombre, telefono, email, mensaje, vehicle_id,
        interes_marca, interes_modelo, interes_anio, presupuesto_usd,
        pagina_origen, utm_source, utm_medium, utm_campaign, whatsapp_enviado
      ) values (
        ${pickFrom<LeadOrigin>(input.origin, LEAD_ORIGINS, "contacto")},
        'nuevo',
        ${name},
        ${phone},
        ${email},
        ${clean(input.message, 4000)},
        ${input.vehicleId ?? null},
        ${clean(input.interestBrand, 80)},
        ${clean(input.interestModel, 120)},
        ${interestYear},
        ${toPositiveNumberOrNull(input.budgetUsd)},
        ${clean(input.sourcePath, 300)},
        ${clean(input.utmSource, 120)},
        ${clean(input.utmMedium, 120)},
        ${clean(input.utmCampaign, 120)},
        ${input.whatsappSent === true}
      )
      returning id, origen, estado, nombre, telefono, email, mensaje,
        vehicle_id, interes_marca, interes_modelo, interes_anio,
        presupuesto_usd, pagina_origen, created_at
    `;

    const data = rows[0];
    if (!data) {
      warnOnce(
        "leads:error:sin-datos",
        "createLead() no devolvió la fila insertada. Se responde con fallback a WhatsApp.",
      );
      return {
        ok: false,
        reason: "database-error",
        fallback: "whatsapp",
        message: WHATSAPP_MESSAGE,
      };
    }

    // El driver entrega `timestamptz` como Date; el resto del código espera ISO.
    const createdAt =
      data.created_at instanceof Date
        ? data.created_at.toISOString()
        : String(data.created_at);

    return {
      ok: true,
      lead: mapLead({ ...data, created_at: createdAt } as unknown as LeadRow),
    };
  } catch (error) {
    warnOnce(
      "leads:exception",
      `createLead() lanzó una excepción inesperada: ${
        error instanceof Error ? error.message : String(error)
      }. Se responde con fallback a WhatsApp.`,
    );
    return {
      ok: false,
      reason: "database-error",
      fallback: "whatsapp",
      message: WHATSAPP_MESSAGE,
    };
  }
}

/**
 * ¿Puede el servidor guardar leads, o la UI debe ir directo a WhatsApp?
 * Comprobación síncrona y barata, apta para el render de un Server Component.
 */
export function canCaptureLeads(): boolean {
  return isDatabaseWriteConfigured();
}
