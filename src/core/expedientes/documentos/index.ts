/**
 * Plantillas de documentos del expediente: el catálogo y la operación de
 * "construir": campos → Estructura, con la lista de campos que ESTE documento
 * necesita y le faltan.
 */

import { camposPlantilla, espiarCampos, type Campo, type Campos, type CamposExtra } from "../campos";
import type { ContextoExpediente, TipoDocumento } from "../tipos";
import type { Estructura } from "./estructura";
import { actaRendicion } from "./plantillas/actaRendicion";
import { anexoA } from "./plantillas/anexoA";
import { anexoB } from "./plantillas/anexoB";
import { anexoC } from "./plantillas/anexoC";
import { anexoD } from "./plantillas/anexoD";
import { avisoPago } from "./plantillas/avisoH3";
import { constanciaFondos } from "./plantillas/constanciaFondos";
import { contrato } from "./plantillas/contrato";
import { instruccionesForwarder } from "./plantillas/instruccionesForwarder";
import { instruccionesVendedor } from "./plantillas/instruccionesVendedor";
import { liquidacionDefinitiva } from "./plantillas/liquidacionDefinitiva";
import { loa } from "./plantillas/loa";
import { poderInmatriculacion } from "./plantillas/poderInmatriculacion";
import type { Plantilla } from "./plantillas/tipos";

export type { Plantilla } from "./plantillas/tipos";
export * from "./estructura";
export { renderHtml, inlineHtml } from "./renderHtml";

/**
 * Las plantillas, en el orden del paquete: las del acto de firma en notaría
 * (contrato con sus anexos, LOA y poder), las instrucciones a terceros y las
 * que nacen del libro (constancia, aviso de tributos, liquidación definitiva,
 * acta de entrega y rendición).
 */
export const PLANTILLAS: readonly Plantilla[] = [
  contrato,
  anexoA,
  anexoB,
  anexoC,
  anexoD,
  loa,
  poderInmatriculacion,
  instruccionesVendedor,
  instruccionesForwarder,
  constanciaFondos,
  avisoPago,
  liquidacionDefinitiva,
  actaRendicion,
];

/**
 * Tipos cuyos campos los arma el LIBRO (src/core/expedientes/ledger.ts) y no
 * el formulario. El generador de la pestaña Documentos no los ofrece; se
 * emiten desde la pestaña Dinero.
 */
export const TIPOS_DESDE_LIBRO: readonly TipoDocumento[] = ["constancia_fondos", "aviso_h3", "liquidacion_definitiva", "acta_rendicion"];

export function esPlantillaDelLibro(tipo: TipoDocumento): boolean {
  return TIPOS_DESDE_LIBRO.includes(tipo);
}

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
  /** Usados y vacíos: impiden emitir (regla "sin rayas": ningún campo sale en blanco). */
  faltantes: Campo[];
};

/**
 * Construye un documento a partir del expediente. Nunca lanza por datos
 * vacíos: devuelve `faltantes` para que quien emite decida (la ruta responde
 * 422; la vista previa los muestra en pantalla y manda a Configuración los de
 * la empresa). La estructura se arma con los valores reales, en una sola
 * pasada que a la vez registra qué campos leyó la plantilla.
 *
 *  · `extra`: el formulario y el libro (gana sobre todo).
 *  · `porDefecto`: parámetros de la empresa y tipo de cambio del día (solo
 *    rellenan lo que el expediente dejó vacío).
 */
export function construirDocumento(
  plantilla: Plantilla,
  ctx: ContextoExpediente,
  extra: CamposExtra = {},
  porDefecto: CamposExtra = {},
): DocumentoConstruido {
  const { campos } = camposPlantilla(ctx, extra, porDefecto);
  const espia = espiarCampos(campos);
  const estructura = plantilla.construir(espia.campos, ctx);
  const usados = [...espia.usados];
  const faltantes = usados.filter((k) => !campos[k]);
  return { plantilla, estructura, campos, usados, faltantes };
}

/** Nombre de archivo seguro: "LC-2026-001-contrato-v2.pdf". */
export function nombreArchivo(codigo: string, tipo: TipoDocumento, version: number, extension: "pdf" | "docx"): string {
  const limpio = codigo.replace(/[^A-Za-z0-9-]/g, "");
  return `${limpio}-${tipo}-v${version}.${extension}`;
}
