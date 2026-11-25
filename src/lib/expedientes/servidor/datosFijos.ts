/**
 * Datos fijos de Luxcars para los documentos (RUC, domicilio, partida,
 * representante, DNI, cuentas bancarias). SOLO SERVIDOR.
 *
 * No viven en el repositorio: el repo es público y estos son datos de la
 * empresa y de sus cuentas. Se leen de la variable `LUXCARS_DOCUMENTOS_JSON`,
 * un objeto JSON cuyas llaves son nombres de campo del paquete
 * (`LUXCARS_RUC`, `CTA_FONDOS_NUMERO`, …). Lo que falte lo escribe el equipo
 * en el formulario al generar; la vista previa lo marca como faltante.
 *
 * El correo y el teléfono tienen respaldo en `LUXCARS_CONFIG.contact` porque
 * son públicos (salen en la web).
 */
import "server-only";

import { esCampo, type CamposExtra } from "@/core/expedientes/campos";
import { LUXCARS_CONFIG } from "@/lib/config";

let cache: CamposExtra | null = null;

export function camposFijosLuxcars(): CamposExtra {
  if (cache) return cache;
  const salida: CamposExtra = {
    LUXCARS_CORREO: LUXCARS_CONFIG.contact.email,
    LUXCARS_TELEFONO: LUXCARS_CONFIG.contact.phone,
  };
  const crudo = (process.env.LUXCARS_DOCUMENTOS_JSON ?? "").trim();
  if (crudo) {
    try {
      const json: unknown = JSON.parse(crudo);
      if (json && typeof json === "object") {
        for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
          if (esCampo(k) && typeof v === "string" && v.trim()) salida[k] = v.trim();
        }
      }
    } catch {
      // JSON malformado: se sigue con el respaldo y el formulario pide lo que falte.
    }
  }
  cache = salida;
  return salida;
}
