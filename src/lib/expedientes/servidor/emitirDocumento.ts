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
 * formulario: `camposDelLibro` decide, por tipo, qué se suma a lo escrito a
 * mano; los parámetros de la empresa van aparte como `porDefecto`. Ningún
 * documento sale con campos en blanco: si falta uno, 422 con la lista. La
 * constancia exige el movimiento; el aviso de tributos (tipo `aviso_h3`, hito
 * H4) exige el presupuesto guardado y deja `hito = 'H4'`; la liquidación
 * definitiva y el acta de entrega y rendición nacen visibles al cliente; el
 * acta abre la tarea de conformidad del cliente si no existe.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import type { CamposExtra } from "@/core/expedientes/campos";
import { construirDocumento, nombreArchivo, type Plantilla } from "@/core/expedientes/documentos";
import { TAREA_AVISO_POR_HITO } from "@/core/expedientes/etapas";
import { sumarDiasHabiles, DIAS_HABILES_PAGO_TRIBUTOS } from "@/core/expedientes/hitos";
import { HITOS_CON_AVISO, camposActaRendicion, datosAvisoPago, datosConstancia, datosLiquidacion, montoDelAviso, type HitoConAviso } from "@/core/expedientes/ledger";
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
  bytes: { pdf: number; docx: number };
  urls: { pdf: string | null; docx: string | null };
};

export type FalloEmision = { ok: false; status: number; mensaje: string; faltantes?: string[] };

export type OpcionesEmision = {
  /** Usuario verificado que emite (va como actor del evento y de la fila). */
  actorId: string;
  /** Lo escrito a mano en el formulario, ya filtrado a nombres de campo válidos. Gana sobre todo. */
  extra: CamposExtra;
  /**
   * Parámetros de la empresa (`camposFijosLuxcars()`) y el tipo de cambio del
   * día: solo rellenan lo que el expediente dejó vacío.
   */
  porDefecto?: CamposExtra;
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
      // Aviso de pago de un hito que se fija durante la operación: H4, H5 o H6 (campo HITO del formulario).
      const hito = (opciones.extra.HITO ?? "").trim() as HitoConAviso;
      if (!HITOS_CON_AVISO.includes(hito)) {
        return { ok: false, status: 400, mensaje: "Indica de qué pago es el aviso: H4 (Pago 3, gastos de aduana), H5 (Pago 4, tributos) o H6 (Pago 5, honorarios)." };
      }
      return { ok: true, campos: datosAvisoPago(ctx, hito, { ...opciones.porDefecto, ...opciones.extra }, hoyLima()), hito, visible: true };
    }
    case "liquidacion_definitiva":
      return { ok: true, campos: datosLiquidacion(ctx), hito: null, visible: true };
    case "acta_rendicion":
      return { ok: true, campos: camposActaRendicion(ctx), hito: null, visible: true };
    default:
      return { ok: true, campos: {}, hito: null, visible: opciones.visibleCliente };
  }
}

export async function emitirDocumento(plantilla: Plantilla, ctx: ContextoExpediente, opciones: OpcionesEmision): Promise<Emitido | FalloEmision> {
  const sql = getSql();
  if (!sql) return { ok: false, status: 503, mensaje: "Falta DATABASE_URL en el servidor." };

  const libro = camposDelLibro(plantilla, ctx, opciones);
  if (!libro.ok) return libro;

  // Lo del libro manda sobre el expediente; lo escrito a mano manda sobre todo
  // (para corregir una fecha); los parámetros de la empresa solo rellenan vacíos.
  const doc = construirDocumento(plantilla, ctx, { ...libro.campos, ...opciones.extra }, opciones.porDefecto ?? {});
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
        ${(plantilla.tipo === "aviso_h3" && libro.hito ? TAREA_AVISO_POR_HITO[libro.hito] : plantilla.tarea) ?? null},
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
    await efectosDelTipo(plantilla, ctx, opciones.actorId, doc.campos);
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
    bytes: { pdf: pdf.byteLength, docx: docx.byteLength },
    urls: { pdf: urlPdf, docx: urlDocx },
  };
}

/** Hoy en Lima (UTC−5), en ISO: la fecha límite del Pago 4 se cuenta desde aquí. */
function hoyLima(): string {
  return new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
}

// Desde el 27 nov 2026 el cliente paga todo a Fondos de Clientes, salvo los tributos (directo a SUNAT).
const CUENTA_DEL_HITO: Record<HitoConAviso, string> = { H4: "fondos_clientes", H5: "directo", H6: "fondos_clientes" };

/**
 * Lo que cada tipo deja además del documento:
 *  · aviso de pago: el monto del hito pasa a ser el del aviso (lo que el
 *    cliente debe pagar): H4 la pro forma del agente, H5 los tributos de la
 *    liquidación con fecha límite a dos días hábiles, H6 los honorarios netos
 *    del saldo de aduana.
 *  · acta de entrega y rendición: la tarea de conformidad del cliente queda
 *    abierta si no existía.
 */
async function efectosDelTipo(plantilla: Plantilla, ctx: ContextoExpediente, actorId: string, campos: Record<string, string>): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  const id = ctx.expediente.id;
  if (plantilla.tipo === "aviso_h3") {
    const hito = campos.HITO as HitoConAviso;
    if (!HITOS_CON_AVISO.includes(hito)) return;
    const montoAviso = montoDelAviso(ctx, hito, campos);
    const actual = ctx.hitos.find((h) => h.tipo === hito);
    const fechaLimite = hito === "H5" ? sumarDiasHabiles(hoyLima(), DIAS_HABILES_PAGO_TRIBUTOS) : actual?.fechaLimite ?? null;
    if (montoAviso !== null) {
      await sql`
        insert into public.expediente_hitos (expediente_id, tipo, monto_estimado_usd, cuenta, fecha_limite)
        values (${id}::uuid, ${hito}::public.tipo_hito, ${montoAviso}, ${CUENTA_DEL_HITO[hito]}::public.cuenta_movimiento, ${fechaLimite}::date)
        on conflict (expediente_id, tipo) do update set monto_estimado_usd = excluded.monto_estimado_usd, fecha_limite = coalesce(excluded.fecha_limite, public.expediente_hitos.fecha_limite)
      `;
      // La tarea del cliente de ese hito hereda la fecha límite del aviso (Pago 4: dos días hábiles).
      if (fechaLimite) {
        await sql`
          update public.expediente_tareas set vence_el = ${fechaLimite}::date
          where expediente_id = ${id}::uuid and clave = ${`cliente.depositar_${hito.toLowerCase()}`} and estado = 'pendiente'
        `;
      }
    }
  }
  if (plantilla.tipo === "acta_rendicion") {
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
