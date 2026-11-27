/**
 * Cotizaciones de importación a pedido: cálculo (reutiliza `src/core/pricing`
 * sin tocarlo), documento con el formato legal de Luxcars y presupuesto del
 * expediente con las mismas cifras. TypeScript puro.
 */
export {
  CotizacionNoCalculableError,
  calcularCotizacion,
  honorariosPropuestos,
  nombreAuto,
  nombreCortoAuto,
  proporciones,
  r2,
  repartir,
  seguroPropuesto,
  validarDatos,
} from "./calculo";
export {
  PLAZO_POR_DEFECTO,
  construirDocumentoCotizacion,
  fechaLarga,
  importadorDe,
  importadoresDistintos,
  nombreArchivoCotizacion,
  pct,
  usd,
  type EntradaDocumento,
} from "./documento";
export { honorariosReglaAuto, motorVersionCotizacion, presupuestoDesdeCotizacion, type OpcionesPresupuesto } from "./presupuesto";
export { estadoEfectivo, formatoCodigoCotizacion, venceEl } from "./estado";
export * from "./tipos";
