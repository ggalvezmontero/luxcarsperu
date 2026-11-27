/**
 * Contrato de una plantilla de documento. Cada archivo de esta carpeta
 * transcribe UN documento del paquete "Paquete de documentos: importación por
 * mandato" (Claude Docs), con sus campos `{{CAMPO}}` convertidos en lecturas
 * del mapa `Campos`. El texto legal no se inventa ni se resume acá: se copia.
 */

import type { Campos } from "../../campos";
import type { ContextoExpediente, TipoDocumento } from "../../tipos";
import type { Estructura } from "../estructura";

export type Plantilla = {
  tipo: TipoDocumento;
  /** Se guarda en cada emisión (`plantilla_version`). Cambia cuando cambia el texto. */
  version: string;
  /** Nombre corto para listas, eventos y el nombre del archivo. */
  nombre: string;
  idioma: "es" | "en";
  /** Tarea del expediente que queda hecha al emitir, si corresponde. */
  tarea?: string;
  /** Si el documento se emite para que lo firmen (y vuelva como `firmado`). */
  seFirma: boolean;
  construir: (c: Campos, ctx: ContextoExpediente) => Estructura;
};

/**
 * Cargo dentro del texto corrido: en minúsculas ("su gerente general"), salvo
 * las siglas, que se respetan ("CEO", "director de TI").
 */
export function cargoEnTexto(cargo: string): string {
  return cargo
    .split(/(\s+)/)
    .map((palabra) => (/^[A-ZÁÉÍÓÚÑ]{2,}$/.test(palabra) ? palabra : palabra.toLowerCase()))
    .join("");
}

const MESES_EN: Record<string, string> = {
  enero: "January", febrero: "February", marzo: "March", abril: "April", mayo: "May", junio: "June",
  julio: "July", agosto: "August", septiembre: "September", setiembre: "September", octubre: "October", noviembre: "November", diciembre: "December",
};

/** "28 de noviembre de 2026" → "November 28, 2026" para los documentos en inglés; si no la reconoce, la deja igual. */
export function fechaEnIngles(fecha: string): string {
  const m = /^(\d{1,2}) de ([a-záéíóú]+) de (\d{4})$/i.exec(fecha.trim());
  const mes = m ? MESES_EN[m[2].toLowerCase()] : undefined;
  return m && mes ? `${mes} ${Number(m[1])}, ${m[3]}` : fecha;
}

/** Firma estándar Luxcars · Mandante, con DNI en la segunda línea. */
export function firmasLuxcarsYMandante(c: Campos, conCargo = false) {
  return [
    ["LUX CARS IMPORT S.A.C.", c.LUXCARS_REPRESENTANTE, conCargo ? `Gerente general, DNI ${c.LUXCARS_REP_DNI}` : `DNI ${c.LUXCARS_REP_DNI}`],
    [c.CLIENTE_RAZON_SOCIAL, c.CLIENTE_REPRESENTANTE, conCargo ? `${c.CLIENTE_REP_CARGO}, DNI ${c.CLIENTE_REP_DNI}` : `DNI ${c.CLIENTE_REP_DNI}`],
  ];
}
