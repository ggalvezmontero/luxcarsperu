/**
 * GET /api/portal/expedientes/uif?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&formato=csv|json
 *
 * Registro de Operaciones para la UIF (Ley 27693): las operaciones del libro
 * de los expedientes que superan los umbrales (individual ≥ USD 10,000;
 * múltiples que suman ≥ USD 50,000 por cliente en un mes calendario). Qué
 * cuenta y cómo se agrupa lo decide el core (`src/core/expedientes/uif.ts`);
 * acá solo se lee y se entrega.
 *
 * Solo administradores (`verificarSesionPortal`). Lee con `getSql()` porque
 * cruza cinco tablas y entrega un archivo: es exactamente el caso de "ruta de
 * servidor tras comprobar el rol". Sin librerías de hojas de cálculo en el
 * proyecto, el archivo es CSV con BOM y `;` (Excel en español lo abre bien).
 *
 * Datos personales (RUC, DNI, razón social) viajan en la descarga: es el fin
 * del registro. No se guarda copia en el servidor.
 */

import { NextResponse } from "next/server";

import { UMBRALES_UIF_DEFECTO, csvRegistroUif, filasRegistroUif, operacionesReportables, type ExpedienteUif, type MovimientoUif } from "@/core/expedientes/uif";
import type { Cliente, CuentaMovimiento, EstadoMovimiento, TipoHito, TipoMovimiento } from "@/core/expedientes/tipos";
import { getSql } from "@/lib/db/client";
import { verificarSesionPortal } from "@/lib/portal/authServer";

export const dynamic = "force-dynamic";

type Fila = {
  id: string;
  expediente_id: string;
  tipo: TipoMovimiento;
  cuenta: CuentaMovimiento;
  hito: TipoHito | null;
  estado: EstadoMovimiento;
  fecha: string | Date;
  moneda: string | null;
  monto: string | number;
  tipo_cambio: string | number | null;
  monto_usd: string | number;
  concepto: string | null;
  contraparte_id: string | null;
  documento_ref: string | null;
  created_at: string | Date;
  codigo: string;
  cliente_id: string;
  cliente_tipo: "empresa" | "persona" | null;
  razon_social: string | null;
  ruc: string | null;
  dni: string | null;
  contraparte_nombre: string | null;
  registrado_por: string | null;
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function fallo(status: number, mensaje: string) {
  return NextResponse.json({ ok: false, mensaje }, { status });
}

function textoFecha(v: string | Date): string {
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

function num(v: string | number | null | undefined): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(request: Request) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return fallo(sesion.status, sesion.mensaje);
  const sql = getSql();
  if (!sql) return fallo(503, "Falta DATABASE_URL en el servidor.");

  const url = new URL(request.url);
  const desde = url.searchParams.get("desde") ?? "";
  const hasta = url.searchParams.get("hasta") ?? "";
  const formato = url.searchParams.get("formato") ?? "csv";
  if (!FECHA.test(desde) || !FECHA.test(hasta)) return fallo(400, "Indica el rango con desde=YYYY-MM-DD y hasta=YYYY-MM-DD.");
  if (desde > hasta) return fallo(400, "La fecha inicial es posterior a la final.");
  if (formato !== "csv" && formato !== "json") return fallo(400, "Formato desconocido: csv o json.");

  // El acumulado mensual necesita el MES completo de cada operación del rango,
  // no solo los días pedidos: se lee desde el primer día del mes de `desde`
  // hasta el último del mes de `hasta` y luego se recorta al rango.
  const mesDesde = `${desde.slice(0, 7)}-01`;
  const [anioH, mesH] = hasta.slice(0, 7).split("-").map(Number);
  const mesSiguiente = mesH === 12 ? `${anioH + 1}-01-01` : `${anioH}-${String(mesH + 1).padStart(2, "0")}-01`;

  let filas: Fila[];
  try {
    filas = (await sql`
      select m.id, m.expediente_id, m.tipo, m.cuenta, m.hito, m.estado, m.fecha, m.moneda, m.monto, m.tipo_cambio, m.monto_usd,
             m.concepto, m.contraparte_id, m.documento_ref, m.created_at,
             e.codigo, e.cliente_id,
             c.tipo as cliente_tipo, c.razon_social, c.ruc, c.dni,
             cp.nombre as contraparte_nombre,
             coalesce(p.email, p.nombre) as registrado_por
      from public.expediente_movimientos m
      join public.expedientes e on e.id = m.expediente_id
      left join public.clientes c on c.id = e.cliente_id
      left join public.contrapartes cp on cp.id = m.contraparte_id
      left join public.profiles p on p.id = m.created_by
      where m.estado = 'confirmado'
        and m.tipo <> 'ajuste'
        and m.fecha >= ${mesDesde}::date
        and m.fecha < ${mesSiguiente}::date
      order by m.fecha, e.codigo, m.created_at
    `) as unknown as Fila[];
  } catch (e) {
    console.error("[uif] leer", e);
    return fallo(500, "No se pudieron leer los movimientos.");
  }

  const expedientes = new Map<string, ExpedienteUif>();
  const clientes = new Map<string, Pick<Cliente, "id" | "tipo" | "razonSocial" | "ruc" | "dni">>();
  const movimientos: MovimientoUif[] = [];
  for (const f of filas) {
    expedientes.set(f.expediente_id, { id: f.expediente_id, codigo: f.codigo, clienteId: f.cliente_id });
    if (f.cliente_id && f.razon_social) {
      clientes.set(f.cliente_id, { id: f.cliente_id, tipo: f.cliente_tipo ?? "empresa", razonSocial: f.razon_social, ruc: f.ruc, dni: f.dni });
    }
    movimientos.push({
      id: f.id,
      expedienteId: f.expediente_id,
      tipo: f.tipo,
      cuenta: f.cuenta,
      hito: f.hito,
      estado: f.estado,
      fecha: textoFecha(f.fecha),
      moneda: f.moneda ?? "USD",
      monto: num(f.monto),
      tipoCambio: num(f.tipo_cambio) || 1,
      montoUsd: num(f.monto_usd),
      concepto: f.concepto,
      contraparteId: f.contraparte_id,
      documentoRef: f.documento_ref,
      createdAt: f.created_at instanceof Date ? f.created_at.toISOString() : String(f.created_at),
      contraparteNombre: f.contraparte_nombre,
      registradoPor: f.registrado_por,
    });
  }

  const operaciones = operacionesReportables(movimientos, [...expedientes.values()], [...clientes.values()], UMBRALES_UIF_DEFECTO).filter(
    (o) => o.movimiento.fecha >= desde && o.movimiento.fecha <= hasta,
  );
  const salida = filasRegistroUif(operaciones);

  if (formato === "json") {
    return NextResponse.json({ ok: true, filas: salida, total: salida.length, umbrales: UMBRALES_UIF_DEFECTO, desde, hasta });
  }

  const csv = csvRegistroUif(salida);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registro-uif-${desde}-a-${hasta}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
