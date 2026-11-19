/**
 * POST /api/reclamaciones — recibe una hoja del Libro de Reclamaciones.
 *
 * Público, sin sesión: cualquiera puede reclamar, es la ley. El servidor
 * valida y recorta cada campo y rechaza lo que no cumple la hoja oficial.
 * Nunca lanza: responde JSON en español en todos los casos.
 */

import { NextResponse, after } from "next/server";

import { avisarNuevaReclamacion } from "@/lib/db/avisoReclamacion";
import {
  TIPOS_BIEN,
  TIPOS_RECLAMACION,
  crearReclamacion,
  type EntradaReclamacion,
  type TipoBien,
  type TipoReclamacion,
} from "@/lib/db/reclamaciones";

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

const texto = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: Request) {
  let c: Record<string, unknown> = {};
  try {
    c = (await request.json()) as Record<string, unknown>;
  } catch {
    return fallo(400, "El cuerpo debe ser JSON.");
  }

  // Trampa para bots: el campo no existe en el formulario visible.
  if (texto(c.empresa, 10)) return NextResponse.json({ ok: true, numero: "LR-0000-0000", fecha: new Date().toISOString() });

  const tipo = texto(c.tipo, 10) as TipoReclamacion;
  const bienTipo = texto(c.bienTipo, 10) as TipoBien;
  const nombre = texto(c.nombre, 160);
  const documento = texto(c.documento, 20).replace(/[^0-9A-Za-z-]/g, "");
  const domicilio = texto(c.domicilio, 240);
  const telefono = texto(c.telefono, 40) || null;
  const emailRaw = texto(c.email, 160);
  const email = emailRaw && EMAIL.test(emailRaw) ? emailRaw.toLowerCase() : null;
  const menor = c.menorDeEdad === true;
  const apoderado = texto(c.apoderado, 160) || null;
  const bienDescripcion = texto(c.bienDescripcion, 500);
  const montoRaw = Number(String(c.montoUsd ?? "").replace(/[^0-9.]/g, ""));
  const montoUsd = Number.isFinite(montoRaw) && montoRaw > 0 ? Math.round(montoRaw * 100) / 100 : null;
  const detalle = typeof c.detalle === "string" ? c.detalle.trim().slice(0, 4000) : "";
  const pedido = typeof c.pedido === "string" ? c.pedido.trim().slice(0, 2000) : "";

  if (!(TIPOS_RECLAMACION as readonly string[]).includes(tipo)) return fallo(400, "Indica si es un reclamo o una queja.");
  if (!(TIPOS_BIEN as readonly string[]).includes(bienTipo)) return fallo(400, "Indica si se trata de un producto o de un servicio.");
  if (nombre.length < 2) return fallo(400, "Escribe tu nombre completo.");
  if (documento.length < 6) return fallo(400, "Escribe tu DNI o carné de extranjería.");
  if (domicilio.length < 3) return fallo(400, "Escribe tu domicilio.");
  if (!telefono && !email) return fallo(400, "Déjanos un teléfono o un correo para responderte.");
  if (emailRaw && !email) return fallo(400, "El correo no parece válido.");
  if (menor && !apoderado) return fallo(400, "Si eres menor de edad, indica el nombre de tu padre, madre o apoderado.");
  if (bienDescripcion.length < 3) return fallo(400, "Describe el producto o servicio.");
  if (detalle.length < 10) return fallo(400, "Cuéntanos el detalle con un poco más de información.");
  if (pedido.length < 3) return fallo(400, "Indica qué pides.");
  if (c.acepta !== true) return fallo(400, "Debes declarar que la información es verdadera.");

  const entrada: EntradaReclamacion = {
    tipo,
    consumidor: { nombre, documento, domicilio, telefono, email, apoderado: menor ? apoderado : null },
    bien: { tipo: bienTipo, descripcion: bienDescripcion, montoUsd },
    detalle,
    pedido,
  };

  const hoja = await crearReclamacion(entrada);
  if (!hoja) {
    return fallo(503, "No pudimos registrar la hoja en este momento. Escríbenos a info@luxcars.pe con el mismo contenido y la registramos por ti.");
  }
  // El aviso interno sale después de responder: el consumidor no espera al
  // correo, y si Resend falla la hoja ya está registrada.
  after(() => avisarNuevaReclamacion(hoja, entrada));
  return NextResponse.json({ ok: true, numero: hoja.numero, fecha: hoja.createdAt }, { status: 201 });
}
