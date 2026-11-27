/**
 * Lado servidor de las cotizaciones: lee la fila con `DATABASE_URL` y arma el
 * documento con el core. SOLO para rutas que ya verificaron la sesión
 * (`verificarSesionPortal` o `verificarSesionCliente` + dueño).
 */

import "server-only";

import {
  calcularCotizacion,
  construirDocumentoCotizacion,
  type ClienteCotizacion,
  type DatosCotizacion,
  type EstadoCotizacion,
} from "@/core/cotizaciones";
import type { Estructura } from "@/core/expedientes/documentos/estructura";
import { getSql } from "@/lib/db/client";

export type FilaServidor = {
  id: string;
  codigo: string;
  estado: EstadoCotizacion;
  cliente_tipo: "persona" | "empresa";
  cliente_nombre: string;
  cliente_documento: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  datos: DatosCotizacion;
  fecha: string;
  ruta_pdf: string | null;
  ruta_docx: string | null;
  documento_version: number;
};

export async function leerCotizacion(id: string): Promise<FilaServidor | null> {
  const sql = getSql();
  if (!sql) return null;
  const filas = (await sql`
    select id, codigo, estado, cliente_tipo, cliente_nombre, cliente_documento, cliente_email, cliente_telefono,
           datos, fecha::text as fecha, ruta_pdf, ruta_docx, documento_version
    from public.cotizaciones where id = ${id}::uuid limit 1
  `) as unknown as FilaServidor[];
  return filas[0] ?? null;
}

export function clienteDe(f: FilaServidor): ClienteCotizacion {
  return {
    tipo: f.cliente_tipo,
    nombre: f.cliente_nombre,
    documento: f.cliente_documento ?? "",
    email: f.cliente_email ?? "",
    telefono: f.cliente_telefono ?? "",
  };
}

/** Documento con la fecha de emisión dada (por defecto la de la fila). */
export function estructuraDe(f: FilaServidor, fechaIso?: string): Estructura {
  const resultado = calcularCotizacion(f.datos);
  return construirDocumentoCotizacion({ codigo: f.codigo, fecha: fechaIso ?? f.fecha, cliente: clienteDe(f), datos: f.datos, resultado });
}
