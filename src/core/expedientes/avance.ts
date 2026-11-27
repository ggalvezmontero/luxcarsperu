/**
 * Avance entre etapas: qué sigue, qué falta para entrar y qué tareas nacen.
 */

import { anioModeloCumple, definicionEtapa, evaluarCompuerta, esEtapaTerminal, type TareaPlantilla } from "./etapas";
import type {
  ContextoExpediente,
  EtapaExpediente,
  ResultadoAvance,
  TareaNueva,
} from "./tipos";
import { ETAPAS_ORDEN } from "./tipos";

export function siguienteEtapa(actual: EtapaExpediente): EtapaExpediente | null {
  const i = ETAPAS_ORDEN.indexOf(actual);
  if (i < 0 || i + 1 >= ETAPAS_ORDEN.length) return null;
  return ETAPAS_ORDEN[i + 1];
}

export function ordenEtapa(etapa: EtapaExpediente): number {
  return definicionEtapa(etapa).orden;
}

/**
 * ¿Se puede pasar a `destino`? Devuelve lo que falta, en el orden de la
 * compuerta. Cancelar siempre está permitido (la base exige el motivo);
 * desde una etapa terminal no se va a ningún lado.
 */
export function evaluarAvance(
  ctx: ContextoExpediente,
  destino: EtapaExpediente,
  hoy: Date = new Date(),
): ResultadoAvance {
  const actual = ctx.expediente.etapa;
  if (esEtapaTerminal(actual)) {
    return { permitido: false, salto: true, faltantes: [{ clave: "terminal", descripcion: `El expediente ya está ${actual}.` }] };
  }
  if (destino === "cancelado") {
    return { permitido: true, salto: false, faltantes: [] };
  }
  const salto = siguienteEtapa(actual) !== destino;
  const faltantes = evaluarCompuerta(destino, ctx, hoy);
  if (salto) {
    faltantes.unshift({
      clave: "salto",
      descripcion: `De ${definicionEtapa(actual).nombreEquipo} solo se pasa a ${definicionEtapa(siguienteEtapa(actual) ?? actual).nombreEquipo}.`,
    });
  }
  return { permitido: faltantes.length === 0, salto, faltantes };
}

/**
 * Tareas que nacen al entrar a una etapa, con su fecha límite tomada del
 * expediente, el embarque o los hitos. Las que no aplican (p. ej. "elegir
 * consolidado" en un contenedor exclusivo, "historial" en un auto nuevo) no se
 * crean.
 */
export function tareasParaEtapa(etapa: EtapaExpediente, ctx: ContextoExpediente): TareaNueva[] {
  const def = definicionEtapa(etapa);
  const usado = ctx.expediente.vehiculo.condicion === "usado";
  return def.tareas
    .filter((t) => !t.aplica || t.aplica(ctx))
    .map((t, i) => ({
      etapa,
      clave: t.clave,
      titulo: (usado && t.usado?.titulo) || t.titulo,
      descripcion: (usado && t.usado?.descripcion) || t.descripcion || null,
      responsable: t.responsable,
      estado: t.automatica ? "hecha" : "pendiente",
      venceEl: t.vence ? fechaDe(t.vence, ctx) : null,
      visibleCliente: t.visibleCliente ?? false,
      orden: i + 1,
    }));
}

function fechaDe(campo: NonNullable<TareaPlantilla["vence"]>, ctx: ContextoExpediente): string | null {
  const e = ctx.expediente;
  const hito = (tipo: "H5" | "H6") => ctx.hitos.find((h) => h.tipo === tipo)?.fechaLimite ?? null;
  switch (campo) {
    case "fecha_firma":
      return e.fechaFirma;
    case "fecha_limite_pago2":
      return e.fechaLimiteH2 ?? e.fechaRelease ?? ctx.embarque?.fechaReleaseEst ?? null;
    case "fecha_est_arribo":
      return e.fechaEstArribo ?? ctx.embarque?.fechaArriboEst ?? null;
    case "fecha_est_entrega":
      return e.fechaEstEntrega;
    case "fecha_limite_compra":
      return e.fechaLimiteCompra;
    case "fecha_limite_h5":
      // Sin fecha hasta el aviso con la liquidación de SUNAT (lo fija el aviso: dos días hábiles).
      return hito("H5");
    case "fecha_limite_h6":
      return hito("H6") ?? e.levanteEn;
    default:
      return null;
  }
}

/** Primera tarea pendiente de Luxcars (o de quien sea), para "siguiente paso". */
export function siguienteTarea(ctx: ContextoExpediente): ContextoExpediente["tareas"][number] | null {
  const pendientes = ctx.tareas
    .filter((t) => t.estado === "pendiente" && t.etapa === ctx.expediente.etapa)
    .sort((a, b) => a.orden - b.orden);
  return pendientes.find((t) => t.responsable === "luxcars") ?? pendientes[0] ?? null;
}

export { anioModeloCumple };
