/**
 * Acceso a `public.cotizaciones_envio` desde el SERVIDOR, con `DATABASE_URL`.
 *
 * Esta conexión salta RLS, así que solo se usa desde los Route Handlers de
 * `/api/admin/cotizaciones-envio`, DESPUÉS de `verificarSesionPortal()`. Nada
 * de acá llega al navegador: el `import "server-only"` hace fallar el build si
 * alguien lo intenta.
 *
 * Como el resto de `src/lib/db/`, NUNCA lanza: devuelve `null` o una lista
 * vacía y quien llama contesta con un mensaje en español.
 */
import "server-only";

import { getSql } from "@/lib/db/client";
import type {
  EntradaCotizacionEnvio,
  RegimenEnvio,
  ResultadoCotizacionEnvio,
} from "@/core/envios/tipos";

export const ESTADOS_COTIZACION_ENVIO = ["borrador", "enviada", "aceptada"] as const;
export type EstadoCotizacionEnvio = (typeof ESTADOS_COTIZACION_ENVIO)[number];

export const ESTADO_COTIZACION_LABEL: Record<EstadoCotizacionEnvio, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
};

/** Una fila del historial, sin los JSON. */
export type CotizacionEnvioResumen = {
  id: string;
  numero: string;
  clienteNombre: string;
  clienteWhatsapp: string;
  marca: string;
  modelo: string;
  anioModelo: number;
  regimen: RegimenEnvio;
  estado: EstadoCotizacionEnvio;
  totalUsd: number;
  createdAt: string;
  updatedAt: string;
};

export type CotizacionEnvioCompleta = CotizacionEnvioResumen & {
  entrada: EntradaCotizacionEnvio;
  resultado: ResultadoCotizacionEnvio;
  motorVersion: string;
};

type Fila = {
  id: string;
  numero: string;
  cliente_nombre: string;
  cliente_whatsapp: string;
  marca: string;
  modelo: string;
  anio_modelo: number;
  regimen: RegimenEnvio;
  estado: EstadoCotizacionEnvio;
  total_usd: string | number;
  created_at: string;
  updated_at: string;
  entrada?: EntradaCotizacionEnvio;
  resultado?: ResultadoCotizacionEnvio;
  motor_version?: string;
};

const COLUMNAS_RESUMEN =
  "id, numero, cliente_nombre, cliente_whatsapp, marca, modelo, anio_modelo, regimen, estado, total_usd, created_at, updated_at";

function aResumen(f: Fila): CotizacionEnvioResumen {
  return {
    id: f.id,
    numero: f.numero,
    clienteNombre: f.cliente_nombre,
    clienteWhatsapp: f.cliente_whatsapp,
    marca: f.marca,
    modelo: f.modelo,
    anioModelo: Number(f.anio_modelo),
    regimen: f.regimen,
    estado: f.estado,
    totalUsd: Number(f.total_usd),
    createdAt: typeof f.created_at === "string" ? f.created_at : new Date(f.created_at).toISOString(),
    updatedAt: typeof f.updated_at === "string" ? f.updated_at : new Date(f.updated_at).toISOString(),
  };
}

const LIMITE_HISTORIAL = 200;

export async function listarCotizacionesEnvio(): Promise<CotizacionEnvioResumen[] | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const filas = (await sql.query(
      `select ${COLUMNAS_RESUMEN} from public.cotizaciones_envio order by created_at desc limit $1`,
      [LIMITE_HISTORIAL],
    )) as Fila[];
    return filas.map(aResumen);
  } catch {
    return null;
  }
}

export async function obtenerCotizacionEnvio(id: string): Promise<CotizacionEnvioCompleta | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const filas = (await sql.query(
      `select ${COLUMNAS_RESUMEN}, entrada, resultado, motor_version from public.cotizaciones_envio where id = $1::uuid limit 1`,
      [id],
    )) as Fila[];
    const f = filas[0];
    if (!f || !f.entrada || !f.resultado) return null;
    return { ...aResumen(f), entrada: f.entrada, resultado: f.resultado, motorVersion: f.motor_version ?? "" };
  } catch {
    return null;
  }
}

export async function crearCotizacionEnvio(input: {
  entrada: EntradaCotizacionEnvio;
  resultado: ResultadoCotizacionEnvio;
  estado: EstadoCotizacionEnvio;
  createdBy: string | null;
}): Promise<CotizacionEnvioResumen | null> {
  const sql = getSql();
  if (!sql) return null;
  const { entrada, resultado } = input;
  try {
    const filas = (await sql.query(
      `insert into public.cotizaciones_envio
         (cliente_nombre, cliente_whatsapp, marca, modelo, anio_modelo, regimen, estado,
          total_usd, entrada, resultado, motor_version, created_by)
       values ($1, $2, $3, $4, $5, $6::public.regimen_envio, $7::public.estado_cotizacion_envio,
               $8, $9::jsonb, $10::jsonb, $11, $12::uuid)
       returning ${COLUMNAS_RESUMEN}`,
      [
        entrada.cliente.nombre,
        entrada.cliente.whatsapp,
        entrada.vehiculo.marca,
        entrada.vehiculo.modelo,
        entrada.vehiculo.anioModelo,
        entrada.regimen,
        input.estado,
        Math.round(resultado.elegido.totalUsd * 100) / 100,
        JSON.stringify(entrada),
        JSON.stringify(resultado),
        resultado.motorVersion,
        input.createdBy,
      ],
    )) as Fila[];
    return filas[0] ? aResumen(filas[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Reemplaza entrada y resultado de una cotización existente. Conserva el
 * número y la fecha de creación: es la misma cotización corregida, no una
 * nueva. El estado solo cambia si se manda.
 */
export async function actualizarCotizacionEnvio(
  id: string,
  input: {
    entrada: EntradaCotizacionEnvio;
    resultado: ResultadoCotizacionEnvio;
    estado: EstadoCotizacionEnvio | null;
  },
): Promise<CotizacionEnvioResumen | null> {
  const sql = getSql();
  if (!sql) return null;
  const { entrada, resultado } = input;
  try {
    const filas = (await sql.query(
      `update public.cotizaciones_envio set
         cliente_nombre = $2, cliente_whatsapp = $3, marca = $4, modelo = $5, anio_modelo = $6,
         regimen = $7::public.regimen_envio,
         estado = coalesce($8::public.estado_cotizacion_envio, estado),
         total_usd = $9, entrada = $10::jsonb, resultado = $11::jsonb, motor_version = $12
       where id = $1::uuid returning ${COLUMNAS_RESUMEN}`,
      [
        id,
        entrada.cliente.nombre,
        entrada.cliente.whatsapp,
        entrada.vehiculo.marca,
        entrada.vehiculo.modelo,
        entrada.vehiculo.anioModelo,
        entrada.regimen,
        input.estado,
        Math.round(resultado.elegido.totalUsd * 100) / 100,
        JSON.stringify(entrada),
        JSON.stringify(resultado),
        resultado.motorVersion,
      ],
    )) as Fila[];
    return filas[0] ? aResumen(filas[0]) : null;
  } catch {
    return null;
  }
}

export async function cambiarEstadoCotizacionEnvio(
  id: string,
  estado: EstadoCotizacionEnvio,
): Promise<CotizacionEnvioResumen | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const filas = (await sql.query(
      `update public.cotizaciones_envio set estado = $2::public.estado_cotizacion_envio
       where id = $1::uuid returning ${COLUMNAS_RESUMEN}`,
      [id, estado],
    )) as Fila[];
    return filas[0] ? aResumen(filas[0]) : null;
  } catch {
    return null;
  }
}
