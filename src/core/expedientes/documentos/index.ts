/**
 * Plantillas de documentos del expediente: el catálogo y la operación de
 * "construir": campos → Estructura, con la lista de campos que ESTE documento
 * necesita y le faltan.
 */

import {
  camposParaImprimir,
  camposPlantilla,
  esManual,
  espiarCampos,
  type Campo,
  type Campos,
  type CamposExtra,
} from "../campos";
import type { ContextoExpediente, TipoDocumento } from "../tipos";
import type { Estructura } from "./estructura";
import { anexoA } from "./plantillas/anexoA";
import { anexoB } from "./plantillas/anexoB";
import { anexoC } from "./plantillas/anexoC";
import { anexoD } from "./plantillas/anexoD";
import { contrato } from "./plantillas/contrato";
import { instruccionesForwarder } from "./plantillas/instruccionesForwarder";
import { instruccionesVendedor } from "./plantillas/instruccionesVendedor";
import { loa } from "./plantillas/loa";
import type { Plantilla } from "./plantillas/tipos";

export type { Plantilla } from "./plantillas/tipos";
export * from "./estructura";
export { renderHtml, inlineHtml } from "./renderHtml";

/** Las plantillas de esta fase, en el orden del paquete de firma. */
export const PLANTILLAS: readonly Plantilla[] = [
  contrato,
  anexoA,
  anexoB,
  anexoC,
  anexoD,
  loa,
  instruccionesVendedor,
  instruccionesForwarder,
];

const POR_TIPO = new Map<TipoDocumento, Plantilla>(PLANTILLAS.map((p) => [p.tipo, p]));

/** `null` si ese tipo no se genera desde una plantilla (se sube). */
export function plantillaDe(tipo: TipoDocumento): Plantilla | null {
  return POR_TIPO.get(tipo) ?? null;
}

export type DocumentoConstruido = {
  plantilla: Plantilla;
  estructura: Estructura;
  /** Snapshot completo de campos con que se construyó (lo que se guarda). */
  campos: Campos;
  /** Campos que la plantilla leyó. */
  usados: Campo[];
  /** Usados, vacíos y NO manuales: impiden emitir. */
  faltantes: Campo[];
  /** Usados, vacíos y manuales: salen como línea en blanco. */
  manualesVacios: Campo[];
};

/**
 * Construye un documento a partir del expediente. Nunca lanza por datos
 * vacíos: devuelve `faltantes` para que quien emite decida (la ruta responde
 * 422; la vista previa los muestra en pantalla).
 */
export function construirDocumento(
  plantilla: Plantilla,
  ctx: ContextoExpediente,
  extra: CamposExtra = {},
): DocumentoConstruido {
  const { campos } = camposPlantilla(ctx, extra);
  // Primera pasada con los valores reales, espiando qué campos lee la plantilla.
  const espia = espiarCampos(campos);
  plantilla.construir(espia.campos, ctx);
  const usados = [...espia.usados];
  const faltantes = usados.filter((k) => !campos[k] && !esManual(k));
  const manualesVacios = usados.filter((k) => !campos[k] && esManual(k));
  // Segunda pasada: la estructura que se imprime, con líneas en blanco en los manuales.
  const estructura = plantilla.construir(camposParaImprimir(campos), ctx);
  return { plantilla, estructura, campos, usados, faltantes, manualesVacios };
}

/** Nombre de archivo seguro: "LC-2026-001-contrato-v2.pdf". */
export function nombreArchivo(codigo: string, tipo: TipoDocumento, version: number, extension: "pdf" | "docx"): string {
  const limpio = codigo.replace(/[^A-Za-z0-9-]/g, "");
  return `${limpio}-${tipo}-v${version}.${extension}`;
}
