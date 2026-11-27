/**
 * Alertas automáticas de un expediente. Se calculan al leer, en el navegador,
 * con el contexto completo; no se guardan.
 */

import { oldestImportableModelYear } from "../pricing/pricingConfig";
import { TAREA_LUXCARS_POR_HITO, anioDeNumeracion, definicionEtapa, esEtapaTerminal } from "./etapas";
import { estadoHito } from "./hitos";
import type { Alerta, ContextoExpediente, TipoDocumento } from "./tipos";

/** Días desde que se generó un documento sin marcarse firmado antes de avisar. */
export const DIAS_DOCUMENTO_SIN_FIRMA = 10;
/** Días antes del vencimiento de la LOA en que empieza el aviso. */
export const DIAS_AVISO_LOA = 30;
/** Los documentos que vuelven firmados; los anexos van dentro del contrato y las instrucciones no se firman. */
const DOCUMENTOS_QUE_SE_FIRMAN = new Set<TipoDocumento>(["contrato", "loa", "poder_inmatriculacion", "acta_rendicion"]);

function ordenEtapaDe(etapa: ContextoExpediente["expediente"]["etapa"]): number {
  return definicionEtapa(etapa).orden;
}

export function fechaIsoDe(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T12:00:00Z`).getTime();
  const b = new Date(`${hasta}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function alertas(ctx: ContextoExpediente, hoy: Date = new Date()): Alerta[] {
  const e = ctx.expediente;
  const salida: Alerta[] = [];
  if (esEtapaTerminal(e.etapa)) return salida;
  const hoyIso = fechaIsoDe(hoy);
  const orden = ordenEtapaDe(e.etapa);

  // Hitos vencidos sin acreditar (los cinco). Sin libro se usan las tareas
  // de confirmación del equipo como evidencia, igual que las compuertas.
  for (const hito of ctx.hitos) {
    if (!hito.fechaLimite || hito.fechaLimite >= hoyIso) continue;
    const acreditado =
      (ctx.movimientos.length > 0 && estadoHito(hito, ctx.movimientos) === "acreditado") ||
      ctx.tareas.some((t) => t.clave === TAREA_LUXCARS_POR_HITO[hito.tipo] && t.estado === "hecha");
    if (acreditado) continue;
    salida.push({
      clave: `hito_vencido_${hito.tipo}`,
      nivel: "alta",
      titulo: `${hito.tipo} vencido sin acreditar`,
      detalle: `La fecha límite era el ${hito.fechaLimite} y el depósito no está acreditado.`,
    });
  }

  // Año modelo que deja de cumplir a la fecha estimada de numeración.
  if (e.vehiculo.condicion === "usado" && orden < ordenEtapaDe("aduana")) {
    const anio = anioDeNumeracion(ctx, hoy);
    const minimo = oldestImportableModelYear(anio);
    if (e.vehiculo.anio < minimo) {
      salida.push({
        clave: "anio_modelo",
        nivel: "alta",
        titulo: "El año modelo no cumple a la fecha estimada de numeración",
        detalle: `Un usado ${e.vehiculo.anio} ya no puede nacionalizarse en ${anio}: el más antiguo que entra ese año es ${minimo}. Hay que numerar la DAM antes del 31 de diciembre de ${anio - 1} o cambiar de unidad.`,
      });
    }
  }

  // Tareas vencidas.
  const vencidas = ctx.tareas.filter((t) => t.estado === "pendiente" && t.venceEl && t.venceEl < hoyIso);
  for (const t of vencidas) {
    salida.push({
      clave: `tarea_vencida_${t.clave}`,
      nivel: t.responsable === "cliente" ? "alta" : "media",
      titulo: `Tarea vencida: ${t.titulo}`,
      detalle: `Vencía el ${t.venceEl}. Responsable: ${t.responsable}.`,
    });
  }

  // Saldo negativo del expediente (solo con libro).
  if (ctx.movimientos.length > 0) {
    let saldo = 0;
    for (const m of ctx.movimientos) {
      if (m.estado !== "confirmado") continue;
      saldo += m.tipo === "deposito" || m.tipo === "ajuste" ? m.montoUsd : -m.montoUsd;
    }
    if (saldo < -0.01) {
      salida.push({
        clave: "saldo_negativo",
        nivel: "alta",
        titulo: "Saldo negativo del expediente",
        detalle: `Se pagó más de lo depositado: USD ${Math.abs(saldo).toFixed(2)} por cobrar al cliente.`,
      });
    }
  }

  // Cliente sin cuenta vinculada desde la etapa de contrato.
  if (orden >= 1 && ctx.cliente && !ctx.cliente.userId) {
    salida.push({
      clave: "cliente_sin_cuenta",
      nivel: "media",
      titulo: "El cliente no tiene cuenta vinculada",
      detalle: "No puede seguir su expediente en luxcars.pe/cuenta. Pídele que se registre con el mismo correo o vincula la cuenta a mano.",
    });
  }

  // LOA por vencer o vencida.
  if (e.loaVence) {
    const dias = diasEntre(hoyIso, e.loaVence);
    if (dias < 0) {
      salida.push({ clave: "loa_vencida", nivel: "alta", titulo: "La LOA está vencida", detalle: `Venció el ${e.loaVence}. Hace falta una nueva carta de autorización.` });
    } else if (dias <= DIAS_AVISO_LOA) {
      salida.push({ clave: "loa_por_vencer", nivel: "media", titulo: "La LOA vence pronto", detalle: `Vence el ${e.loaVence} (en ${dias} días).` });
    }
  }

  // Documento de firma emitido hace más de N días sin archivarse firmado.
  for (const d of ctx.documentos) {
    if (d.estado !== "emitido" || !DOCUMENTOS_QUE_SE_FIRMAN.has(d.tipo)) continue;
    const dias = diasEntre((d.emitidoEn ?? d.createdAt).slice(0, 10), hoyIso);
    if (dias > DIAS_DOCUMENTO_SIN_FIRMA) {
      salida.push({
        clave: `documento_sin_firma_${d.tipo}`,
        nivel: "media",
        titulo: `Documento sin firmar: ${d.titulo}`,
        detalle: `Se generó hace ${dias} días y no está marcado como firmado.`,
      });
    }
  }

  // Pago 4 (tributos directo a SUNAT): avisado y sin pagar a la fecha límite ya lo cubre "hito vencido".
  // Saldo de aduana sin aplicar: en placas o después, con el H6 ya acreditado y Fondos de Clientes ≠ 0.
  if (orden >= ordenEtapaDe("placas")) {
    const h6 = ctx.hitos.find((h) => h.tipo === "H6");
    const fondos = ctx.movimientos.filter((m) => m.estado === "confirmado" && m.cuenta === "fondos_clientes").reduce((s, m) => s + (m.tipo === "pago" || m.tipo === "devolucion" ? -m.montoUsd : m.montoUsd), 0);
    if (h6 && estadoHito(h6, ctx.movimientos) === "acreditado" && Math.abs(fondos) > 0.01) {
      salida.push({
        clave: "saldo_aduana_sin_aplicar",
        nivel: "media",
        titulo: "Saldo de Fondos de Clientes por aplicar o devolver",
        detalle: `El Pago 5 ya está acreditado y quedan USD ${fondos.toFixed(2)} en Fondos de Clientes: registra el sobrante de aduana aplicado al Pago 5 (o el faltante cubierto) y la devolución.`,
      });
    }
  }

  return salida;
}

export function resumenAlertas(lista: readonly Alerta[]): { altas: number; medias: number } {
  return {
    altas: lista.filter((a) => a.nivel === "alta").length,
    medias: lista.filter((a) => a.nivel === "media").length,
  };
}
