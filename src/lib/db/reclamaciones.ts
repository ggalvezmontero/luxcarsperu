/**
 * Libro de Reclamaciones: acceso a `public.reclamaciones` desde el SERVIDOR.
 *
 * `crearReclamacion` la llama el formulario público a través de
 * `/api/reclamaciones` (sin sesión). `listar` y `responder` son para
 * /admin/reclamaciones, siempre después de `verificarSesionPortal()`.
 * Como el resto de `src/lib/db/`, NUNCA lanza: devuelve `null` y quien llama
 * contesta en español.
 */
import "server-only";

import { getSql } from "@/lib/db/client";

export const TIPOS_RECLAMACION = ["reclamo", "queja"] as const;
export type TipoReclamacion = (typeof TIPOS_RECLAMACION)[number];
export const TIPOS_BIEN = ["producto", "servicio"] as const;
export type TipoBien = (typeof TIPOS_BIEN)[number];
export type EstadoReclamacion = "recibida" | "respondida";

export type EntradaReclamacion = {
  tipo: TipoReclamacion;
  consumidor: {
    nombre: string;
    documento: string;
    domicilio: string;
    telefono: string | null;
    email: string | null;
    apoderado: string | null;
  };
  bien: { tipo: TipoBien; descripcion: string; montoUsd: number | null };
  detalle: string;
  pedido: string;
};

export type HojaReclamacion = {
  id: string;
  numero: string;
  tipo: TipoReclamacion;
  estado: EstadoReclamacion;
  consumidorNombre: string;
  consumidorDocumento: string;
  consumidorDomicilio: string;
  consumidorTelefono: string | null;
  consumidorEmail: string | null;
  apoderadoNombre: string | null;
  bienTipo: TipoBien;
  bienDescripcion: string;
  montoReclamadoUsd: number | null;
  detalle: string;
  pedido: string;
  respuesta: string | null;
  respondidaEn: string | null;
  createdAt: string;
};

type Fila = {
  id: string;
  numero: string;
  tipo: TipoReclamacion;
  estado: EstadoReclamacion;
  consumidor_nombre: string;
  consumidor_documento: string;
  consumidor_domicilio: string;
  consumidor_telefono: string | null;
  consumidor_email: string | null;
  apoderado_nombre: string | null;
  bien_tipo: TipoBien;
  bien_descripcion: string;
  monto_reclamado_usd: string | number | null;
  detalle: string;
  pedido: string;
  respuesta: string | null;
  respondida_en: string | Date | null;
  created_at: string | Date;
};

const COLUMNAS = `id, numero, tipo, estado, consumidor_nombre, consumidor_documento, consumidor_domicilio,
  consumidor_telefono, consumidor_email, apoderado_nombre, bien_tipo, bien_descripcion, monto_reclamado_usd,
  detalle, pedido, respuesta, respondida_en, created_at`;

const iso = (v: string | Date | null): string | null =>
  v === null ? null : v instanceof Date ? v.toISOString() : String(v);

function aHoja(f: Fila): HojaReclamacion {
  return {
    id: f.id,
    numero: f.numero,
    tipo: f.tipo,
    estado: f.estado,
    consumidorNombre: f.consumidor_nombre,
    consumidorDocumento: f.consumidor_documento,
    consumidorDomicilio: f.consumidor_domicilio,
    consumidorTelefono: f.consumidor_telefono,
    consumidorEmail: f.consumidor_email,
    apoderadoNombre: f.apoderado_nombre,
    bienTipo: f.bien_tipo,
    bienDescripcion: f.bien_descripcion,
    montoReclamadoUsd: f.monto_reclamado_usd === null ? null : Number(f.monto_reclamado_usd),
    detalle: f.detalle,
    pedido: f.pedido,
    respuesta: f.respuesta,
    respondidaEn: iso(f.respondida_en),
    createdAt: iso(f.created_at) ?? "",
  };
}

/** Inserta la hoja y devuelve número y fecha. `null` si no hay base o falla. */
export async function crearReclamacion(
  e: EntradaReclamacion,
): Promise<Pick<HojaReclamacion, "id" | "numero" | "createdAt"> | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const filas = (await sql.query(
      `insert into public.reclamaciones
         (tipo, consumidor_nombre, consumidor_documento, consumidor_domicilio, consumidor_telefono,
          consumidor_email, apoderado_nombre, bien_tipo, bien_descripcion, monto_reclamado_usd, detalle, pedido)
       values ($1::public.tipo_reclamacion, $2, $3, $4, $5, $6, $7, $8::public.tipo_bien_reclamado, $9, $10, $11, $12)
       returning id, numero, created_at`,
      [
        e.tipo,
        e.consumidor.nombre,
        e.consumidor.documento,
        e.consumidor.domicilio,
        e.consumidor.telefono,
        e.consumidor.email,
        e.consumidor.apoderado,
        e.bien.tipo,
        e.bien.descripcion,
        e.bien.montoUsd,
        e.detalle,
        e.pedido,
      ],
    )) as Pick<Fila, "id" | "numero" | "created_at">[];
    const f = filas[0];
    return f ? { id: f.id, numero: f.numero, createdAt: iso(f.created_at) ?? "" } : null;
  } catch {
    return null;
  }
}

/** Todas las hojas, las más recientes primero. `null` si no hay base o tabla. */
export async function listarReclamaciones(): Promise<HojaReclamacion[] | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const filas = (await sql.query(
      `select ${COLUMNAS} from public.reclamaciones order by created_at desc limit 500`,
    )) as Fila[];
    return filas.map(aHoja);
  } catch {
    return null;
  }
}

/** Registra la respuesta del proveedor y marca la hoja como respondida. */
export async function responderReclamacion(
  id: string,
  respuesta: string,
  respondidaPor: string | null,
): Promise<HojaReclamacion | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const filas = (await sql.query(
      `update public.reclamaciones
         set respuesta = $2, respondida_en = now(), respondida_por = $3::uuid, estado = 'respondida'
       where id = $1::uuid returning ${COLUMNAS}`,
      [id, respuesta, respondidaPor],
    )) as Fila[];
    return filas[0] ? aHoja(filas[0]) : null;
  } catch {
    return null;
  }
}
