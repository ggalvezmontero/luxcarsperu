/**
 * /api/cron/expedientes — resumen diario de alertas AL EQUIPO.
 *
 * Lo llama el cron de Vercel (`vercel.json`, una vez al día a las 8:00 de
 * Lima; el plan Hobby no admite más) con `Authorization: Bearer $CRON_SECRET`.
 * Sin ese encabezado exacto responde 401; sin la variable, 503. Nadie más lo
 * dispara.
 *
 * Qué hace: lee con `getSql()` los expedientes abiertos, calcula las alertas
 * con el core (`alertas.ts`: hitos y tareas vencidos, año modelo, LOA,
 * documentos sin firma, saldo negativo, cuenta sin vincular, diferencia H3) y
 * añade dos que solo se ven mirando varios expedientes: depósitos declarados
 * por confirmar y embarques sin fechas o sin forwarder. Manda UN correo al
 * equipo (`AVISOS_EMAIL` o el correo de contacto) y deja una fila en
 * `notificaciones` sin expediente con el resultado.
 *
 * NUNCA escribe a clientes: las notificaciones a clientes salen de una acción
 * del equipo o de un hecho concreto (depósito confirmado, documento visible).
 *
 * Nunca lanza: todo error sale como JSON con `ok: false`.
 */

import { NextResponse } from "next/server";

import { alertas as calcularAlertas } from "@/core/expedientes/alertas";
import { faltantesEmbarque } from "@/core/expedientes/embarques";
import { nombreEtapaEquipo } from "@/core/expedientes/etapas";
import type { Alerta } from "@/core/expedientes/tipos";
import { LUXCARS_CONFIG } from "@/lib/config";
import { correoConfigurado, destinoAvisos, enviarCorreo, escaparHtml } from "@/lib/correo";
import { getSql } from "@/lib/db/client";
import { cargarContextoServidor } from "@/lib/expedientes/servidor/contexto";
import { registrar } from "@/lib/expedientes/servidor/notificar";

export const dynamic = "force-dynamic";

type ResumenExpediente = {
  id: string;
  codigo: string;
  etapa: string;
  auto: string;
  cliente: string;
  alertas: Alerta[];
};

function autorizado(request: Request): boolean {
  const secreto = (process.env.CRON_SECRET ?? "").trim();
  if (!secreto) return false;
  const cabecera = request.headers.get("authorization") ?? "";
  return cabecera === `Bearer ${secreto}`;
}

function armarCorreo(filas: ResumenExpediente[], hoy: string): { asunto: string; texto: string; html: string; total: number } {
  const conAlertas = filas.filter((f) => f.alertas.length > 0);
  const total = conAlertas.reduce((s, f) => s + f.alertas.length, 0);
  const altas = conAlertas.reduce((s, f) => s + f.alertas.filter((a) => a.nivel === "alta").length, 0);
  const asunto = total === 0
    ? `Expedientes al día · ${hoy}`
    : `${total} alerta${total === 1 ? "" : "s"} en ${conAlertas.length} expediente${conAlertas.length === 1 ? "" : "s"} (${altas} alta${altas === 1 ? "" : "s"}) · ${hoy}`;
  const portal = `${LUXCARS_CONFIG.contact.website}/portal/expedientes`;

  const lineas: string[] = [`Resumen diario de expedientes · ${hoy}`, `${filas.length} expediente${filas.length === 1 ? "" : "s"} abierto${filas.length === 1 ? "" : "s"}; ${conAlertas.length} con alertas.`, ""];
  const bloques: string[] = [];
  for (const f of conAlertas) {
    lineas.push(`${f.codigo} · ${f.auto} · ${f.cliente} · ${nombreEtapaEquipo(f.etapa as never)}`);
    for (const a of f.alertas) lineas.push(`  [${a.nivel === "alta" ? "ALTA" : "media"}] ${a.titulo}. ${a.detalle}`);
    lineas.push(`  ${LUXCARS_CONFIG.contact.website}/portal/expedientes/${f.id}`, "");
    bloques.push(
      `<h3 style="margin:18px 0 4px;font-size:15px">${escaparHtml(f.codigo)} · ${escaparHtml(f.auto)} · ${escaparHtml(f.cliente)} <span style="color:#777">· ${escaparHtml(nombreEtapaEquipo(f.etapa as never))}</span></h3>` +
        `<ul style="margin:0;padding-left:18px">${f.alertas.map((a) => `<li><strong style="color:${a.nivel === "alta" ? "#b42318" : "#8a6d00"}">${a.nivel === "alta" ? "Alta" : "Media"}:</strong> ${escaparHtml(a.titulo)}. <span style="color:#555">${escaparHtml(a.detalle)}</span></li>`).join("")}</ul>` +
        `<p style="margin:4px 0 0;font-size:13px"><a href="${LUXCARS_CONFIG.contact.website}/portal/expedientes/${f.id}">Abrir expediente</a></p>`,
    );
  }
  if (conAlertas.length === 0) lineas.push("Sin alertas. Nada vencido ni pendiente de confirmar.");
  lineas.push("", `Tablero: ${portal}`);

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1a1a1f;max-width:640px">` +
    `<h2 style="font-size:18px;margin:0 0 6px">Resumen diario de expedientes · ${escaparHtml(hoy)}</h2>` +
    `<p style="margin:0 0 8px;color:#555">${filas.length} abiertos; ${conAlertas.length} con alertas.</p>` +
    (bloques.length > 0 ? bloques.join("") : `<p>Sin alertas. Nada vencido ni pendiente de confirmar.</p>`) +
    `<p style="margin-top:18px;font-size:13px"><a href="${portal}">Abrir el tablero</a></p></div>`;

  return { asunto, texto: lineas.join("\n"), html, total };
}

export async function GET(request: Request) {
  if (!(process.env.CRON_SECRET ?? "").trim()) return NextResponse.json({ ok: false, mensaje: "Falta CRON_SECRET en el servidor." }, { status: 503 });
  if (!autorizado(request)) return NextResponse.json({ ok: false, mensaje: "No autorizado." }, { status: 401 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ ok: false, mensaje: "Falta DATABASE_URL en el servidor." }, { status: 503 });

  const hoy = new Date();
  const hoyTexto = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Lima" }).format(hoy);

  let ids: { id: string }[];
  try {
    ids = (await sql`select id from public.expedientes where etapa not in ('cerrado', 'cancelado') order by created_at`) as unknown as { id: string }[];
  } catch (e) {
    console.error("[cron/expedientes] leer", e);
    return NextResponse.json({ ok: false, mensaje: "No se pudieron leer los expedientes." }, { status: 500 });
  }

  const filas: ResumenExpediente[] = [];
  for (const { id } of ids) {
    try {
      const ctx = await cargarContextoServidor(id);
      if (!ctx) continue;
      const lista = calcularAlertas(ctx, hoy);
      const porConfirmar = ctx.movimientos.filter((m) => m.estado === "por_confirmar");
      if (porConfirmar.length > 0) {
        const suma = porConfirmar.reduce((s, m) => s + m.montoUsd, 0);
        lista.push({
          clave: "depositos_por_confirmar",
          nivel: "alta",
          titulo: `${porConfirmar.length} depósito${porConfirmar.length === 1 ? "" : "s"} declarado${porConfirmar.length === 1 ? "" : "s"} por confirmar`,
          detalle: `El cliente declaró USD ${suma.toFixed(2)} y espera la constancia. Confírmalo o anúlalo en la pestaña Dinero.`,
        });
      }
      if (ctx.embarque && ["compra", "embarque", "transito"].includes(ctx.expediente.etapa)) {
        const faltan = faltantesEmbarque(ctx.embarque);
        if (faltan.length > 0) {
          lista.push({ clave: "embarque_incompleto", nivel: "media", titulo: `Embarque ${ctx.embarque.codigo} sin ${faltan.join(", ")}`, detalle: "Complétalo en /portal/embarques para que el cliente vea fechas." });
        }
      } else if (!ctx.embarque && ["embarque", "transito"].includes(ctx.expediente.etapa)) {
        lista.push({ clave: "sin_embarque", nivel: "media", titulo: "Sin embarque asignado", detalle: "El expediente está en embarque o tránsito y no tiene contenedor asignado." });
      }
      const v = ctx.expediente.vehiculo;
      filas.push({ id, codigo: ctx.expediente.codigo, etapa: ctx.expediente.etapa, auto: `${v.marca} ${v.modelo} ${v.anio}`, cliente: ctx.cliente?.razonSocial ?? "Sin cliente", alertas: lista });
    } catch (e) {
      console.error("[cron/expedientes] expediente", id, e);
    }
  }

  const correo = armarCorreo(filas, hoyTexto);
  const destino = destinoAvisos();
  let estado: "enviada" | "fallida" = "fallida";
  let error: string | null = null;
  if (!correoConfigurado()) error = "Falta RESEND_API_KEY en el servidor: el resumen no se envió.";
  else if (await enviarCorreo({ para: destino, asunto: correo.asunto, html: correo.html, texto: correo.texto })) estado = "enviada";
  else error = "Resend no aceptó el correo.";

  await registrar({ expedienteId: null, canal: "email", plantilla: "resumen_diario", destinatario: destino, asunto: correo.asunto, texto: correo.texto, estado, error, actorId: null });

  return NextResponse.json({
    ok: true,
    fecha: hoyTexto,
    expedientes: filas.length,
    conAlertas: filas.filter((f) => f.alertas.length > 0).length,
    alertas: correo.total,
    correo: { estado, destinatario: destino, error },
  });
}
