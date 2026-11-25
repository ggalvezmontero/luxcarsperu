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
 * expediente. Las que no aplican (p. ej. "elegir consolidado" en un
 * contenedor exclusivo) no se crean.
 */
export function tareasParaEtapa(etapa: EtapaExpediente, ctx: ContextoExpediente): TareaNueva[] {
  const def = definicionEtapa(etapa);
  const e = ctx.expediente;
  return def.tareas
    .filter((t) => !t.aplica || t.aplica(ctx))
    .map((t, i) => ({
      etapa,
      clave: t.clave,
      titulo: t.titulo,
      descripcion: t.descripcion ?? null,
      responsable: t.responsable,
      estado: t.automatica ? "hecha" : "pendiente",
      venceEl: t.vence ? fechaDe(t.vence, e) : null,
      visibleCliente: t.visibleCliente ?? false,
      orden: i + 1,
    }));
}

function fechaDe(
  campo: NonNullable<TareaPlantilla["vence"]>,
  e: ContextoExpediente["expediente"],
): string | null {
  switch (campo) {
    case "fecha_limite_h2":
      return e.fechaLimiteH2;
    case "fecha_est_arribo":
      return e.fechaEstArribo;
    case "fecha_est_entrega":
      return e.fechaEstEntrega;
    case "fecha_limite_compra":
      return e.fechaLimiteCompra;
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
