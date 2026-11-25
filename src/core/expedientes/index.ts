/**
 * Módulo de expedientes de importación: etapas, compuertas, presupuesto,
 * hitos y alertas. TypeScript puro; lo consumen el portal y la cuenta del
 * cliente, y lo prueban los tests de vitest de esta carpeta.
 */
export {
  ETAPAS,
  accionDeTarea,
  anioDeNumeracion,
  anioModeloCumple,
  clienteCompleto,
  definicionEtapa,
  esEtapaTerminal,
  evaluarCompuerta,
  nombreEtapaCliente,
  nombreEtapaEquipo,
  tareaHecha,
  type Condicion,
  type DefinicionEtapa,
  type TareaPlantilla,
} from "./etapas";
export { evaluarAvance, ordenEtapa, siguienteEtapa, siguienteTarea, tareasParaEtapa } from "./avance";
export {
  IGV_HONORARIOS,
  MOTOR_VERSION,
  PORCENTAJE_H1,
  PORCENTAJE_H4,
  PresupuestoNoCalculableError,
  entradaPorDefecto,
  fleteBasePorDefecto,
  presupuestar,
} from "./presupuesto";
export {
  CUENTA_POR_HITO,
  DESCRIPCION_HITO,
  DIAS_H3_ANTES_DEL_ARRIBO,
  acreditadoPorHito,
  estadoHito,
  hitosDesde,
  redondear,
  restarDias,
} from "./hitos";
export { DIAS_AVISO_LOA, DIAS_DOCUMENTO_SIN_FIRMA, alertas, fechaIsoDe, resumenAlertas } from "./alertas";
export {
  esCodigoExpediente,
  formatoCodigo,
  formatoCodigoEmbarque,
  normalizarCodigo,
  parsearCodigo,
  parsearCodigoEmbarque,
} from "./codigo";
export * from "./tipos";
