/**
 * Parámetros de la EMPRESA para los documentos (RUC, domicilio, partida,
 * representante, DNI, cuentas bancarias, porcentaje de detracción, ciudad de
 * firma, días de espera en consolidado). SOLO SERVIDOR.
 *
 * De dónde salen, en orden (lo de abajo pisa a lo de arriba):
 *   1. valores por defecto que no son secretos: correo y teléfono de
 *      `LUXCARS_CONFIG.contact` (salen en la web), la ciudad de la sede y los
 *      15 días de espera del paquete original;
 *   2. la variable `LUXCARS_DOCUMENTOS_JSON` (RESPALDO: un objeto JSON con
 *      nombres de campo del paquete como llaves);
 *   3. la tabla `configuracion_documentos`, que el equipo llena desde
 *      /portal/configuracion. MANDA.
 *
 * Nada de esto vive en el repositorio: es público y estos son datos de la
 * empresa y de sus cuentas. Lo que falte bloquea la emisión del documento que
 * lo use y la pestaña Documentos manda a Configuración.
 *
 * Se cachea 60 s por instancia: la configuración cambia pocas veces y cada
 * emisión la pide.
 */
import "server-only";

import { esCampo, type CamposExtra } from "@/core/expedientes/campos";
import { LUXCARS_CONFIG } from "@/lib/config";
import { getSql } from "@/lib/db/client";

const CACHE_MS = 60_000;

let cache: { en: number; valores: CamposExtra } | null = null;

/** Lo que vale aunque la tabla y la variable estén vacías. */
function porDefectoPublico(): CamposExtra {
  return {
    LUXCARS_CORREO: LUXCARS_CONFIG.contact.email,
    LUXCARS_TELEFONO: LUXCARS_CONFIG.contact.phone,
    CIUDAD_FIRMA: LUXCARS_CONFIG.contact.city,
    DIAS_ESPERA_MAX: "15",
  };
}

/** `LUXCARS_DOCUMENTOS_JSON` leída y filtrada a nombres de campo válidos. Vacío si no está o está malformada. */
export function respaldoDesdeEntorno(): CamposExtra {
  const salida: CamposExtra = {};
  const crudo = (process.env.LUXCARS_DOCUMENTOS_JSON ?? "").trim();
  if (!crudo) return salida;
  try {
    const json: unknown = JSON.parse(crudo);
    if (json && typeof json === "object") {
      for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
        if (esCampo(k) && typeof v === "string" && v.trim()) salida[k] = v.trim();
      }
    }
  } catch {
    // JSON malformado: se sigue sin respaldo; la tabla y el portal piden lo que falte.
  }
  return salida;
}

async function desdeTabla(): Promise<CamposExtra> {
  const sql = getSql();
  const salida: CamposExtra = {};
  if (!sql) return salida;
  try {
    const filas = (await sql`select clave, valor from public.configuracion_documentos`) as unknown as { clave: string; valor: string }[];
    for (const f of filas) {
      if (esCampo(f.clave) && typeof f.valor === "string" && f.valor.trim()) salida[f.clave] = f.valor.trim();
    }
  } catch (error) {
    console.error("[expedientes/datosFijos] configuracion_documentos", error);
  }
  return salida;
}

/** Parámetros de la empresa listos para `porDefecto` de `camposPlantilla`. Nunca lanza. */
export async function camposFijosLuxcars(): Promise<CamposExtra> {
  const ahora = Date.now();
  if (cache && ahora - cache.en < CACHE_MS) return cache.valores;
  const valores: CamposExtra = { ...porDefectoPublico(), ...respaldoDesdeEntorno(), ...(await desdeTabla()) };
  cache = { en: ahora, valores };
  return valores;
}

/** Tras guardar en /portal/configuracion la caché queda vieja hasta 60 s; las rutas que escriben la invalidan. */
export function olvidarCamposFijos(): void {
  cache = null;
}
