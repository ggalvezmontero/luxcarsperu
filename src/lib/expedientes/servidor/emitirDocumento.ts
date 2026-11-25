/**
 * Emite un documento del expediente DESDE EL SERVIDOR: construye la
 * `Estructura` con el core, renderiza PDF y DOCX, los sube al bucket privado
 * `expedientes` y registra la versión con `registrar_documento`. Lo comparten
 * la ruta de documentos (los ocho del paquete de firma, y los cinco del libro
 * a pedido) y la ruta de movimientos (la constancia que nace al confirmar un
 * depósito).
 *
 * SOLO para rutas que ya verificaron sesión y rol con `verificarSesionPortal()`.
 * Nunca lanza: devuelve `{ ok: false, status, mensaje }`.
 *
 * LOS CAMPOS DE LOS DOCUMENTOS DEL LIBRO LOS ARMA EL CORE (`ledger.ts`), no el
 * formulario: `camposDelLibro` decide, por tipo, qué se suma a los fijos y a lo
 * escrito a mano. La constancia exige el movimiento; el aviso H3 exige el
 * presupuesto guardado y deja `hito = 'H3'`; la liquidación definitiva y la
 * rendición nacen visibles al cliente; la rendición abre la tarea de
 * conformidad del cliente si no existe.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import type { CamposExtra } from "@/core/expedientes/campos";
import { construirDocumento, nombreArchivo, type Plantilla } from "@/core/expedientes/documentos";
import { camposRendicion, datosActa, datosAvisoH3, datosConstancia, datosLiquidacion, presupuestoAvisoH3 } from "@/core/expedientes/ledger";
import type { ContextoExpediente, Movimiento, TipoHito } from "@/core/expedientes/tipos";
import { getSql } from "@/lib/db/client";
import { renderDocx } from "@/lib/expedientes/documentos/renderDocx";
import { renderPdf } from "@/lib/expedientes/documentos/renderPdf";
import { EXPEDIENTES_BUCKET, firmarDescarga, subirObjeto } from "@/lib/portal/objectStorage";

const TIPO_PDF = "application/pdf";
const TIPO_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type Emitido = {
  ok: true;
  documentoId: string;
  version: number;
  manualesVacios: string[];
  bytes: { pdf: number; docx: number };
  urls: { pdf: string | null; docx: string | null };
};

export type FalloEmision = { ok: false; status: number; mensaje: string; faltantes?: string[] };

export type OpcionesEmision = {
  /** Usuario verificado que emite (va como actor del evento y de la fila). */
  actorId: string;
  /** Lo escrito a mano en el formulario, ya filtrado a nombres de campo válidos. */
  extra: CamposExtra;
  visibleCliente: boolean;
  /** Constancia: el depósito confirmado que la origina. */
  movimiento?: Movimiento | null;
};

/**
 * Campos que aporta el libro para cada tipo, y lo que ese tipo exige. Devuelve
 * también `hito` y `visible` forzados por el tipo (la liquidación y la
 * rendición siempre son visibles al cliente; la constancia también).
 */
export function camposDelLibro(
  plantilla: Plantilla,
  ctx: ContextoExpediente,
  opciones: OpcionesEmision,
): { ok: true; campos: CamposExtra; hito: TipoHito | null; visible: boolean } | FalloEmision {
  switch (plantilla.tipo) {
    case "constancia_fondos": {
      const mov = opciones.movimiento;
      if (!mov) return { ok: false, status: 400, mensaje: "La constancia necesita el depósito que la origina (movimiento_id)." };
      if (mov.tipo !== "deposito" || mov.estado !== "confirmado") {
        return { ok: false, status: 409, mensaje: "La constancia solo se emite para un depósito confirmado." };
      }
      return { ok: true, campos: datosConstancia(mov, ctx), hito: mov.hito, visible: true };
    }
    case "aviso_h3": {
      if (!presupuestoAvisoH3(ctx)) {
        return { ok: false, status: 422, mensaje: "El aviso H3 necesita el presupuesto del expediente (Anexo B) para recalcular con los datos reales." };
      }
      return { ok: true, campos: datosAvisoH3(ctx, opciones.extra), hito: "H3", visible: true };
    }
    case "liquidacion_definitiva":
      return { ok: true, campos: datosLiquidacion(ctx), hito: "H3", visible: true };
    case "rendicion":
      return { ok: true, campos: camposRendicion(ctx), hito: null, visible: true };
    case "acta_entrega":
      return { ok: true, campos: datosActa(ctx), hito: null, visible: opciones.visibleCliente };
    default:
      return { ok: true, campos: {}, hito: null, visible: opciones.visibleCliente };
  }
}

export async function emitirDocumento(plantilla: Plantilla, ctx: ContextoExpediente, opciones: OpcionesEmision): Promise<Emitido | FalloEmision> {
  const sql = getSql();
  if (!sql) return { ok: false, status: 503, mensaje: "Falta DATABASE_URL en el servidor." };

  const libro = camposDelLibro(plantilla, ctx, opciones);
  if (!libro.ok) return libro;

  // Lo del libro manda sobre lo fijo; lo escrito a mano manda sobre todo (para corregir una fecha).
  const doc = construirDocumento(plantilla, ctx, { ...libro.campos, ...opciones.extra });
  if (doc.faltantes.length > 0) {
    return { ok: false, status: 422, mensaje: `Faltan datos para emitir este documento: ${doc.faltantes.join(", ")}.`, faltantes: doc.faltantes };
  }

  const id = ctx.expediente.id;
  const tipo = plantilla.tipo;
  const [{ siguiente }] = (await sql`
    select coalesce(max(version), 0) + 1 as siguiente
    from public.expediente_documentos
    where expediente_id = ${id}::uuid and tipo = ${tipo}::public.documento_tipo
  `) as unknown as { siguiente: number }[];
  const version = Number(siguiente) || 1;
  const documentoId = randomUUID();
  const carpeta = `expedientes/${id}/documentos`;
  const rutaPdf = `${carpeta}/${documentoId}-v${version}.pdf`;
  const rutaDocx = `${carpeta}/${documentoId}-v${version}.docx`;

  let pdf: Uint8Array;
  let docx: Uint8Array;
  try {
    [pdf, docx] = await Promise.all([renderPdf(doc.estructura), renderDocx(doc.estructura)]);
  } catch (error) {
    console.error("[expedientes/emitir] render", error);
    return { ok: false, status: 500, mensaje: "No se pudo construir el archivo del documento." };
  }

  const [subioPdf, subioDocx] = await Promise.all([
    subirObjeto(EXPEDIENTES_BUCKET, rutaPdf, pdf, TIPO_PDF),
    subirObjeto(EXPEDIENTES_BUCKET, rutaDocx, docx, TIPO_DOCX),
  ]);
  if (!subioPdf || !subioDocx) return { ok: false, status: 502, mensaje: "El almacenamiento no aceptó el archivo. Vuelve a intentarlo." };

  const titulo = tipo === "constancia_fondos" && opciones.movimiento
    ? `${plantilla.nombre} ${libro.campos.CONSTANCIA_NUMERO ?? ""} · ${ctx.expediente.codigo}`.replace(/\s+·/, " ·")
    : `${plantilla.nombre} · ${ctx.expediente.codigo}`;

  let registrado: { id: string; version: number };
  try {
    const [fila] = (await sql`
      select public.registrar_documento(
        ${id}::uuid,
        ${tipo}::public.documento_tipo,
        ${titulo},
        ${plantilla.version},
        ${JSON.stringify(doc.campos)}::jsonb,
        ${rutaPdf},
        ${rutaDocx},
        ${plantilla.tarea ?? null},
        ${opciones.actorId}::uuid,
        ${libro.visible},
        ${opciones.movimiento?.id ?? null}::uuid,
        ${libro.hito}::public.tipo_hito
      ) as r
    `) as unknown as { r: { id: string; version: number } }[];
    registrado = fila.r;
  } catch (error) {
    console.error("[expedientes/emitir] registrar", error);
    const m = error instanceof Error ? error.message : "";
    return { ok: false, status: 500, mensaje: /[áéíóúñ]|administrador|expediente/i.test(m) ? m : "El archivo se generó pero no se pudo registrar." };
  }

  // La fila guarda la ruta con el id que ya se usó en el nombre del objeto; si
  // la función asignó otra versión (carrera), el objeto queda huérfano pero la
  // fila es la verdad: se usa la ruta registrada.
  if (registrado.version !== version) {
    await sql`update public.expediente_documentos set ruta_pdf = ${rutaPdf}, ruta_docx = ${rutaDocx} where id = ${registrado.id}::uuid`;
  }

  try {
    await efectosDelTipo(plantilla, ctx, opciones.actorId);
  } catch (error) {
    console.error("[expedientes/emitir] efectos", error);
  }

  const nombrePdf = nombreArchivo(ctx.expediente.codigo, tipo, registrado.version, "pdf");
  const nombreDocx = nombreArchivo(ctx.expediente.codigo, tipo, registrado.version, "docx");
  const [urlPdf, urlDocx] = await Promise.all([
    firmarDescarga(EXPEDIENTES_BUCKET, rutaPdf, 300, nombrePdf),
    firmarDescarga(EXPEDIENTES_BUCKET, rutaDocx, 300, nombreDocx),
  ]);

  return {
    ok: true,
    documentoId: registrado.id,
    version: registrado.version,
    manualesVacios: doc.manualesVacios,
    bytes: { pdf: pdf.byteLength, docx: docx.byteLength },
    urls: { pdf: urlPdf, docx: urlDocx },
  };
}

/**
 * Lo que cada tipo deja además del documento:
 *  · aviso H3: el monto estimado del hito H3 pasa a ser el del aviso (es lo
 *    que el cliente debe depositar).
 *  · rendición: la tarea de conformidad del cliente queda abierta si no existía.
 */
async function efectosDelTipo(plantilla: Plantilla, ctx: ContextoExpediente, actorId: string): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  const id = ctx.expediente.id;
  if (plantilla.tipo === "aviso_h3") {
    const p = presupuestoAvisoH3(ctx);
    const h3 = p?.hitos.find((h) => h.tipo === "H3");
    if (h3) {
      await sql`
        insert into public.expediente_hitos (expediente_id, tipo, monto_estimado_usd, cuenta, fecha_limite)
        values (${id}::uuid, 'H3', ${h3.montoUsd}, 'fondos_clientes', ${ctx.hitos.find((h) => h.tipo === "H3")?.fechaLimite ?? null}::date)
        on conflict (expediente_id, tipo) do update set monto_estimado_usd = excluded.monto_estimado_usd
      `;
    }
  }
  if (plantilla.tipo === "rendicion") {
    await sql`
      insert into public.expediente_tareas (expediente_id, etapa, clave, titulo, descripcion, responsable, estado, visible_cliente, orden)
      values (
        ${id}::uuid, ${ctx.expediente.etapa}::public.etapa_expediente, 'cliente.conformidad_rendicion',
        'Dar conformidad a la rendición de cuentas',
        'Revisa la rendición: todo lo depositado, todo lo pagado por tu cuenta y el saldo. Con tu conformidad cerramos el expediente.',
        'cliente', 'pendiente', true, 90
      )
      on conflict (expediente_id, clave) do nothing
    `;
    void actorId;
  }
}
