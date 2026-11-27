/**
 * /api/portal/expedientes/[id]/movimientos — el libro del expediente (equipo).
 *
 *   POST { accion: "registrar", movimiento: {…} }      → inserta un asiento confirmado
 *   POST { accion: "confirmar", movimientoId, movimiento?: {…} }
 *                                                       → confirma un depósito declarado
 *                                                         por el cliente (admite corregir
 *                                                         monto, fecha, TC, hito)
 *   POST { accion: "anular", movimientoId, motivo }     → lo anula con motivo
 *
 * Todo pasa por `registrar_movimiento` (SQL, una transacción). La ruta existe
 * porque al CONFIRMAR o REGISTRAR UN DEPÓSITO con hito se emite la constancia
 * de recepción de fondos (PDF y DOCX al bucket privado, visible al cliente), y
 * eso no se puede hacer desde el navegador. Comprueba sesión y rol admin
 * (`verificarSesionPortal`) y recién entonces escribe con `DATABASE_URL`,
 * pasando el usuario verificado como `p_actor`.
 *
 * Un pago desde Fondos de Clientes puede traer `comision_bancaria_usd`: la
 * función SQL registra además el cargo del banco y la reposición de Luxcars.
 * Lo que el cliente pagó directo a SUNAT (cuenta `directo`) se confirma sin
 * constancia de fondos.
 *
 * Responde { ok, movimientoId, constancia?: { documentoId, version, urls }, aviso? }.
 * Si la constancia falla, el movimiento ya quedó registrado y se avisa en
 * `constanciaError` para emitirla después desde la pestaña Dinero. Al
 * confirmar un depósito se manda al cliente el correo "depósito confirmado"
 * si tiene correo (fase 4); `aviso` dice si salió. Nunca frena la respuesta.
 *
 * Nunca lanza: todo error sale como JSON con `ok: false` y un mensaje en español.
 */

import { NextResponse } from "next/server";

import { plantillaDe } from "@/core/expedientes/documentos";
import { getSql } from "@/lib/db/client";
import { cargarContextoServidor, esUuid } from "@/lib/expedientes/servidor/contexto";
import { camposFijosLuxcars } from "@/lib/expedientes/servidor/datosFijos";
import { emitirDocumento } from "@/lib/expedientes/servidor/emitirDocumento";
import { avisarPorCorreoSiHayCorreo } from "@/lib/expedientes/servidor/notificar";
import { verificarSesionPortal } from "@/lib/portal/authServer";
import { isStorageWriteConfigured } from "@/lib/portal/objectStorage";

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

type Contexto = { params: Promise<{ id: string }> };

const CAMPOS_MOVIMIENTO = new Set([
  "tipo", "cuenta", "hito", "fecha", "moneda", "monto", "tipo_cambio", "monto_usd",
  "contraparte_id", "concepto", "documento_ref", "comprobante_path", "nota_interna", "estado",
  // Pago al exterior desde Fondos de Clientes: la comisión que debita el banco, que Luxcars repone el mismo día.
  "comision_bancaria_usd",
]);

/** Solo las llaves conocidas, con los tipos que la función SQL espera (texto o número). */
function limpiarMovimiento(entrada: unknown): Record<string, string | number | null> {
  const salida: Record<string, string | number | null> = {};
  if (!entrada || typeof entrada !== "object") return salida;
  for (const [k, v] of Object.entries(entrada as Record<string, unknown>)) {
    if (!CAMPOS_MOVIMIENTO.has(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "number" && Number.isFinite(v)) salida[k] = v;
    else if (typeof v === "string") salida[k] = v.trim().slice(0, 300);
  }
  return salida;
}

export async function POST(request: Request, { params }: Contexto) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);
  const sql = getSql();
  if (!sql) return fallo(503, "Falta DATABASE_URL en el servidor.");

  const { id } = await params;
  if (!esUuid(id)) return fallo(400, "Expediente inválido.");

  let cuerpo: Record<string, unknown> = {};
  try {
    const json: unknown = await request.json();
    if (json && typeof json === "object") cuerpo = json as Record<string, unknown>;
  } catch {
    return fallo(400, "El cuerpo de la petición no es JSON.");
  }

  const accion = cuerpo.accion;
  const movimientoId = typeof cuerpo.movimientoId === "string" && esUuid(cuerpo.movimientoId) ? cuerpo.movimientoId : null;
  const datos = limpiarMovimiento(cuerpo.movimiento);
  let payload: Record<string, string | number | null>;

  if (accion === "registrar") {
    payload = { ...datos, expediente_id: id };
    delete payload.estado;
  } else if (accion === "confirmar") {
    if (!movimientoId) return fallo(400, "Falta el movimiento a confirmar.");
    payload = { ...datos, id: movimientoId, estado: "confirmado" };
  } else if (accion === "anular") {
    if (!movimientoId) return fallo(400, "Falta el movimiento a anular.");
    const motivo = typeof cuerpo.motivo === "string" ? cuerpo.motivo.trim() : "";
    if (motivo.length < 5) return fallo(400, "Anular exige un motivo (mínimo cinco caracteres).");
    payload = { id: movimientoId, estado: "anulado", motivo: motivo.slice(0, 2000) };
  } else {
    return fallo(400, "Acción desconocida: registrar, confirmar o anular.");
  }

  // El movimiento a resolver tiene que ser de ESTE expediente.
  if (movimientoId) {
    const filas = (await sql`select expediente_id from public.expediente_movimientos where id = ${movimientoId}::uuid limit 1`) as unknown as { expediente_id: string }[];
    if (!filas[0] || filas[0].expediente_id !== id) return fallo(404, "Ese movimiento no pertenece al expediente.");
  }

  let resultadoId: string;
  try {
    const [fila] = (await sql`select public.registrar_movimiento(${JSON.stringify(payload)}::jsonb, ${sesion.userId}::uuid) as id`) as unknown as { id: string }[];
    resultadoId = fila.id;
  } catch (error) {
    const m = error instanceof Error ? error.message : "";
    return fallo(409, /[áéíóúñ]|movimiento|expediente|monto|motivo|administrador/i.test(m) ? m : "La base de datos rechazó el movimiento.");
  }

  // Constancia: al confirmar o registrar un DEPÓSITO con hito, si hay almacenamiento.
  // Y el aviso al cliente por correo (fase 4), si tiene correo: nunca frena la respuesta.
  const esDeposito = accion === "confirmar" || (accion === "registrar" && datos.tipo === "deposito");
  if (!esDeposito) return NextResponse.json({ ok: true, movimientoId: resultadoId });
  const quiereConstancia = cuerpo.constancia !== false && isStorageWriteConfigured();
  const constanciaError = cuerpo.constancia !== false && !isStorageWriteConfigured() ? "El almacenamiento no está configurado: la constancia no se emitió." : undefined;

  try {
    const ctx = await cargarContextoServidor(id);
    const movimiento = ctx?.movimientos.find((m) => m.id === resultadoId) ?? null;
    if (!ctx || !movimiento || movimiento.tipo !== "deposito" || movimiento.estado !== "confirmado") {
      return NextResponse.json({ ok: true, movimientoId: resultadoId, constanciaError });
    }
    let constancia: { documentoId: string; version: number; urls: { pdf: string | null; docx: string | null } } | undefined;
    let errorConstancia = constanciaError;
    // Lo pagado directo a SUNAT (cuenta `directo`) no pasó por Luxcars: no lleva constancia de fondos.
    if (quiereConstancia && movimiento.cuenta !== "directo") {
      const r = await emitirDocumento(plantillaDe("constancia_fondos")!, ctx, {
        actorId: sesion.userId,
        extra: {},
        porDefecto: await camposFijosLuxcars(),
        visibleCliente: true,
        movimiento,
      });
      if (r.ok) constancia = { documentoId: r.documentoId, version: r.version, urls: r.urls };
      else errorConstancia = r.mensaje;
    } else if (movimiento.cuenta === "directo") {
      errorConstancia = undefined;
    }
    const aviso = await avisarPorCorreoSiHayCorreo(
      ctx,
      "deposito_confirmado",
      { montoUsd: movimiento.montoUsd, hito: movimiento.hito, fecha: movimiento.fecha, conConstancia: Boolean(constancia) },
      sesion.userId,
    );
    return NextResponse.json({
      ok: true,
      movimientoId: resultadoId,
      constancia,
      constanciaError: errorConstancia,
      aviso: aviso ? { estado: aviso.estado, destinatario: aviso.destinatario, error: aviso.error } : null,
    });
  } catch (error) {
    console.error("[expedientes/movimientos] constancia", error);
    return NextResponse.json({ ok: true, movimientoId: resultadoId, constanciaError: "El depósito quedó registrado pero la constancia no se pudo emitir." });
  }
}
