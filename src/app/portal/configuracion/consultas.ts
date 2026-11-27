/**
 * Parámetros de la empresa para los documentos (`configuracion_documentos`),
 * DESDE EL NAVEGADOR con la sesión de un administrador (RLS solo admin). El
 * respaldo (variable de entorno) se pide a `/api/portal/configuracion`, que
 * no expone nada más.
 *
 * NINGUNA FUNCIÓN LANZA.
 */

import { CAMPOS_EMPRESA, esCampo, type Campo, type CamposExtra } from "@/core/expedientes/campos";
import type { PortalClient } from "@/lib/portal/portalClient";

export type Resultado = { ok: boolean; message: string };

export type FilaConfiguracion = { clave: Campo; valor: string; updatedAt: string | null };

const MSG_RED = "No se pudo completar. Revisa tu conexión e intenta de nuevo.";

function describir(message: string | undefined | null): string {
  const m = message ?? "";
  if (/schema cache/i.test(m)) return "La tabla configuracion_documentos no está en la caché de la Data API: aplica la migración 20261127090000 y refresca el esquema.";
  if (/[áéíóúñ]|administrador/i.test(m)) return m;
  return `La base de datos rechazó la operación. ${m}`.trim();
}

/** Las filas guardadas (solo las que son campos de la empresa). */
export async function leerConfiguracion(client: PortalClient): Promise<{ filas: FilaConfiguracion[]; error: string | null }> {
  try {
    const { data, error } = await client.from("configuracion_documentos").select("clave, valor, updated_at").order("clave");
    if (error) return { filas: [], error: describir(error.message) };
    const filas: FilaConfiguracion[] = [];
    for (const f of (data ?? []) as unknown as { clave: string; valor: string; updated_at: string | null }[]) {
      if (esCampo(f.clave) && CAMPOS_EMPRESA.includes(f.clave)) filas.push({ clave: f.clave, valor: f.valor, updatedAt: f.updated_at });
    }
    return { filas, error: null };
  } catch {
    return { filas: [], error: MSG_RED };
  }
}

/**
 * Guarda los valores fila por fila (upsert por clave). Un valor vacío borra la
 * fila: el campo vuelve al respaldo o queda faltante. Después avisa al servidor
 * para que olvide su caché.
 */
export async function guardarConfiguracion(
  client: PortalClient,
  valores: CamposExtra,
  actorId: string | null,
): Promise<Resultado> {
  try {
    const aGuardar: { clave: string; valor: string; updated_by: string | null; updated_at: string }[] = [];
    const aBorrar: string[] = [];
    for (const k of CAMPOS_EMPRESA) {
      if (!(k in valores)) continue;
      const v = (valores[k] ?? "").trim().slice(0, 500);
      if (v) aGuardar.push({ clave: k, valor: v, updated_by: actorId, updated_at: new Date().toISOString() });
      else aBorrar.push(k);
    }
    if (aGuardar.length > 0) {
      const { error } = await client.from("configuracion_documentos").upsert(aGuardar, { onConflict: "clave" });
      if (error) return { ok: false, message: describir(error.message) };
    }
    if (aBorrar.length > 0) {
      const { error } = await client.from("configuracion_documentos").delete().in("clave", aBorrar);
      if (error) return { ok: false, message: describir(error.message) };
    }
    // La caché del servidor dura 60 s; se le pide que la olvide (si falla, igual vence sola).
    try {
      await fetch("/api/portal/configuracion", { method: "POST", credentials: "same-origin" });
    } catch {
      // sin consecuencias
    }
    return { ok: true, message: "Guardado. Los documentos que se emitan desde ahora usan estos datos." };
  } catch {
    return { ok: false, message: MSG_RED };
  }
}

/** El respaldo (variable de entorno y valores por defecto públicos), por campo. Vacío si la ruta falla. */
export async function leerRespaldo(): Promise<CamposExtra> {
  try {
    const r = await fetch("/api/portal/configuracion", { credentials: "same-origin", cache: "no-store" });
    const datos = (await r.json().catch(() => ({}))) as { ok?: unknown; respaldo?: unknown };
    if (datos.ok !== true || !datos.respaldo || typeof datos.respaldo !== "object") return {};
    const salida: CamposExtra = {};
    for (const [k, v] of Object.entries(datos.respaldo as Record<string, unknown>)) {
      if (esCampo(k) && typeof v === "string" && v) salida[k] = v;
    }
    return salida;
  } catch {
    return {};
  }
}
