/**
 * /api/portal/expedientes/[id]/documentos — generar documentos del expediente.
 *
 *   GET                         → { fijos }: datos fijos de Luxcars para la vista previa
 *   POST { tipo, extra?, visibleCliente?, movimientoId? }
 *                               → construye el documento desde su plantilla,
 *                                 renderiza PDF y DOCX, los sube al bucket PRIVADO
 *                                 `expedientes`, registra la versión y responde
 *                                 { documentoId, version, urls } (URLs firmadas de 5 min).
 *
 * POR QUÉ ES UNA RUTA DE SERVIDOR. Generar un PDF no se puede hacer desde el
 * navegador, y escribir en el bucket exige la credencial `storage:write`, que
 * nunca viaja al cliente. La ruta comprueba sesión Y rol admin
 * (`verificarSesionPortal`) y recién entonces lee el expediente con
 * `DATABASE_URL`: mismo patrón que `/api/portal/fotos`.
 *
 * LA REGLA (texto, campos, qué falta) ES DEL CORE. Acá solo se orquesta:
 * cargar → `emitirDocumento` (construir → 422 si faltan campos → renderizar →
 * subir → `registrar_documento`). Los cinco tipos del libro (constancia,
 * aviso H3, liquidación definitiva, acta, rendición) arman sus campos desde
 * `ledger.ts`, no desde el formulario; la constancia exige `movimientoId`.
 *
 * Nunca lanza: todo error sale como JSON con `ok: false` y un mensaje en español.
 */

import { NextResponse } from "next/server";

import type { CamposExtra } from "@/core/expedientes/campos";
import { esCampo } from "@/core/expedientes/campos";
import { plantillaDe } from "@/core/expedientes/documentos";
import { TIPOS_DOCUMENTO, type TipoDocumento } from "@/core/expedientes/tipos";
import { getSql } from "@/lib/db/client";
import { cargarContextoServidor, esUuid } from "@/lib/expedientes/servidor/contexto";
import { camposFijosLuxcars } from "@/lib/expedientes/servidor/datosFijos";
import { emitirDocumento } from "@/lib/expedientes/servidor/emitirDocumento";
import { verificarSesionPortal } from "@/lib/portal/authServer";
import { getStorageWriteMissingEnv, isStorageWriteConfigured } from "@/lib/portal/objectStorage";

function fallo(status: number, mensaje: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, mensaje, ...extra }, { status });
}

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Contexto) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);
  const { id } = await params;
  if (!esUuid(id)) return fallo(400, "Expediente inválido.");
  return NextResponse.json({ ok: true, fijos: camposFijosLuxcars() });
}

export async function POST(request: Request, { params }: Contexto) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);

  if (!isStorageWriteConfigured()) {
    return fallo(503, `El almacenamiento de documentos no está configurado: falta ${getStorageWriteMissingEnv().join(", ")}.`);
  }
  if (!getSql()) return fallo(503, "Falta DATABASE_URL en el servidor.");

  const { id } = await params;
  if (!esUuid(id)) return fallo(400, "Expediente inválido.");

  let cuerpo: Record<string, unknown> = {};
  try {
    const json: unknown = await request.json();
    if (json && typeof json === "object") cuerpo = json as Record<string, unknown>;
  } catch {
    return fallo(400, "El cuerpo de la petición no es JSON.");
  }

  const tipo = typeof cuerpo.tipo === "string" && (TIPOS_DOCUMENTO as readonly string[]).includes(cuerpo.tipo) ? (cuerpo.tipo as TipoDocumento) : null;
  const plantilla = tipo ? plantillaDe(tipo) : null;
  if (!tipo || !plantilla) return fallo(400, "Ese tipo de documento no se genera desde una plantilla.");

  // Lo escrito a mano en el formulario, solo nombres de campo válidos y texto.
  const extra: CamposExtra = { ...camposFijosLuxcars() };
  if (cuerpo.extra && typeof cuerpo.extra === "object") {
    for (const [k, v] of Object.entries(cuerpo.extra as Record<string, unknown>)) {
      if (esCampo(k) && typeof v === "string" && v.trim()) extra[k] = v.trim().slice(0, 500);
    }
  }
  const visibleCliente = cuerpo.visibleCliente === true;
  const movimientoId = typeof cuerpo.movimientoId === "string" && esUuid(cuerpo.movimientoId) ? cuerpo.movimientoId : null;

  let ctx;
  try {
    ctx = await cargarContextoServidor(id);
  } catch {
    return fallo(500, "No se pudo leer el expediente. Vuelve a intentarlo.");
  }
  if (!ctx) return fallo(404, "El expediente no existe.");

  const movimiento = movimientoId ? ctx.movimientos.find((m) => m.id === movimientoId) ?? null : null;
  if (movimientoId && !movimiento) return fallo(404, "Ese movimiento no pertenece al expediente.");

  const r = await emitirDocumento(plantilla, ctx, { actorId: sesion.userId, extra, visibleCliente, movimiento });
  if (!r.ok) return fallo(r.status, r.mensaje, r.faltantes ? { faltantes: r.faltantes } : {});

  return NextResponse.json({
    ok: true,
    documentoId: r.documentoId,
    version: r.version,
    manualesVacios: r.manualesVacios,
    bytes: r.bytes,
    urls: r.urls,
  });
}
