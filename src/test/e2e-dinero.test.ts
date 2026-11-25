/**
 * Prueba de punta a punta de la fase 3 (dinero) contra la base y el bucket
 * REALES (lee .env.local). En `npm test` queda SALTADA; se corre a mano con
 *   E2E_EXPEDIENTES=1 npx vitest run src/test/e2e-dinero.test.ts
 * y borra todo lo que crea al final, reponiendo la secuencia de códigos.
 *
 * Cubre: el cliente no inserta en `expediente_movimientos`; `declarar_deposito`
 * deja un movimiento `por_confirmar` con comprobante; el equipo lo confirma con
 * `registrar_movimiento` (tarea del cliente hecha, tarea "confirmar H2" hecha
 * al quedar acreditado) y nace la constancia por `emitirDocumento`; el cliente
 * ve el movimiento por la vista sin `nota_interna` ni ruta; anular exige
 * motivo; la compuerta de embarque reconoce el H2 acreditado por el libro.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { neon, type NeonQueryFunctionInTransaction, type NeonQueryInTransaction } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ACTIVA = process.env.E2E_EXPEDIENTES === "1";

for (const raw of ACTIVA ? readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n") : []) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq < 1) continue;
  const key = line.slice(0, eq).trim();
  let value = line.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!(key in process.env)) process.env[key] = value;
}

const sql = neon(process.env.DATABASE_URL || "postgres://x:y@localhost/z");
const ADMIN = "c3939210-9184-4e18-8ed3-7d2ce7612a64"; // perfil admin existente (actor de los eventos)
const CLIENTE_USER = "4f5d4d01-ff56-44c2-97be-54019aff4973"; // cuenta cliente existente, dueña del expediente de prueba

let clienteId = "";
let expedienteId = "";
let vendedorId = "";
let secuenciaAntes = 0;
let declaradoId = "";

async function seq(): Promise<{ last_value: number; is_called: boolean }> {
  const [r] = (await sql`select last_value::int as last_value, is_called from public.expediente_numero_seq`) as unknown as { last_value: number; is_called: boolean }[];
  return r;
}

const claims = (sub: string) => JSON.stringify({ sub, role: "authenticated" });
type Tx = NeonQueryFunctionInTransaction<false, false>;
/** Corre una consulta como un usuario de la Data API: primero el rol, DESPUÉS los claims (el orden importa). */
async function comoUsuario(sub: string, consulta: (tx: Tx) => NeonQueryInTransaction) {
  const r = await sql.transaction((tx) => [
    tx`set local role authenticated`,
    tx`select set_config('request.jwt.claims', ${claims(sub)}, true)`,
    consulta(tx),
  ]);
  return r[2] as unknown as Record<string, unknown>[];
}

describe.skipIf(!ACTIVA)("fase 3 de punta a punta (base y bucket reales)", () => {
  beforeAll(async () => {
    const antes = await seq();
    secuenciaAntes = antes.is_called ? antes.last_value : antes.last_value - 1;
    const [c] = (await sql`
      insert into public.clientes (tipo, razon_social, ruc, domicilio, partida, representante, representante_dni, representante_cargo, email, telefono, banco_origen, user_id)
      values ('empresa', 'PRUEBA FASE 3 S.A.C.', '20999999992', 'Calle Prueba 123, Miraflores, Lima', '12345678', 'Ana Prueba', '12345678', 'Gerente general', 'prueba-fase3@luxcars.test', '+51 999 999 999', 'BCP dólares', ${CLIENTE_USER}::uuid)
      returning id
    `) as unknown as { id: string }[];
    clienteId = c.id;
    const [v] = (await sql`
      insert into public.contrapartes (tipo, nombre, pais, direccion, contacto, email, telefono)
      values ('vendedor', 'Example Motors Ltd.', 'Canadá', '1234 Kingsway, Vancouver, BC', 'Mark Lee', 'sales@example.test', '+1 604 000 0000')
      returning id
    `) as unknown as { id: string }[];
    vendedorId = v.id;
    const presupuesto = {
      lineas: [], hitos: [
        { tipo: "H1", montoUsd: 2481.94, cuenta: "operaciones", descripcion: "" },
        { tipo: "H2", montoUsd: 73410.5, cuenta: "fondos_clientes", descripcion: "" },
        { tipo: "H3", montoUsd: 31006.72, cuenta: "fondos_clientes", descripcion: "" },
        { tipo: "H4", montoUsd: 5791.19, cuenta: "operaciones", descripcion: "" },
      ],
      motorVersion: "prueba", precioUsd: 70920, inland: 450, fleteBase: 3300, proporcionFlete: 0.5, flete: 1650, seguro: 390.5, cif: 73410.5,
      adValorem: 4404.63, isc: 0, igv: 12445.82, ipm: 1555.73, percepcion: 9181.67, tributos: 18406.18, gastosAduana: 2300, gastosRegistrales: 180,
      costoPuestoEnLima: 94116.68, honorarios: 8273.13, honorariosBase: 7011.13, honorariosIgv: 1262, margenH3: 0.03, totalSinPercepcion: 102389.81, totalConPercepcion: 111571.48,
      tasas: { adValorem: 0.06, isc: 0, igv: 0.16, ipm: 0.02, percepcion: 0.1, seguroTasa: 0.005, seguroFactorAsegurado: 1.1, seguroMinimo: 45, honorariosTramos: [], honorariosMinimo: 5000, honorariosTasaEfectiva: 0.08, igvHonorarios: 0.18 },
      entrada: { precio: 98500, monedaCompra: "CAD", tcCompraRef: 0.72, vehicleType: "hev", condition: "nuevo", origin: "otro", cylinderCapacityCc: 3445, importerProfile: "primera-importacion", inland: 450, fleteBase: 3300, proporcionFlete: 0.5, gastosAduana: 2300, gastosRegistrales: 180, margenH3: 0.03, percepcionEnH3: true },
    };
    const [e] = (await sql`
      insert into public.expedientes (cliente_id, etapa, proporcion_flete, veh_marca, veh_modelo, veh_anio, veh_vin, veh_condicion, veh_categoria, veh_origen,
        moneda_compra, precio_compra, precio_compra_usd, pais_origen, puerto_origen, presupuesto, honorarios_usd, honorarios_base_usd, honorarios_igv_usd, margen_h3, fecha_firma, fecha_limite_h2, fecha_est_arribo)
      values (${clienteId}::uuid, 'compra', 0.5, 'Toyota', 'Tundra', 2026, '5TFPC5DB1RX000000', 'nuevo', 'hev', 'otro',
        'CAD', 98500, 70920, 'Canadá', 'Vancouver', ${JSON.stringify(presupuesto)}::jsonb, 8273.13, 7011.13, 1262, 0.03, '2026-11-28', '2026-12-12', '2027-02-10')
      returning id
    `) as unknown as { id: string }[];
    expedienteId = e.id;
    await sql`insert into public.expedientes_reservado (expediente_id, precio_tope, vendedor_id) values (${expedienteId}::uuid, 100000, ${vendedorId}::uuid)`;
    await sql`insert into public.expediente_hitos (expediente_id, tipo, monto_estimado_usd, cuenta, fecha_limite) values
      (${expedienteId}::uuid, 'H1', 2481.94, 'operaciones', null), (${expedienteId}::uuid, 'H2', 73410.50, 'fondos_clientes', '2026-12-12'),
      (${expedienteId}::uuid, 'H3', 31006.72, 'fondos_clientes', '2027-02-03'), (${expedienteId}::uuid, 'H4', 5791.19, 'operaciones', null)`;
    await sql`insert into public.expediente_tareas (expediente_id, etapa, clave, titulo, responsable, visible_cliente) values
      (${expedienteId}::uuid, 'compra', 'cliente.depositar_h2', 'Depositar el hito H2', 'cliente', true),
      (${expedienteId}::uuid, 'compra', 'luxcars.confirmar_h2', 'Confirmar H2 y emitir la constancia de fondos', 'luxcars', false),
      (${expedienteId}::uuid, 'compra', 'luxcars.wire_vendedor', 'Wire al vendedor y archivar el SWIFT', 'luxcars', false),
      (${expedienteId}::uuid, 'compra', 'luxcars.bill_of_sale', 'Bill of sale definitivo', 'luxcars', false)`;
  }, 60_000);

  afterAll(async () => {
    if (expedienteId) {
      const { EXPEDIENTES_BUCKET, listarObjetos, borrarObjeto } = await import("@/lib/portal/objectStorage");
      const objetos = (await listarObjetos(`expedientes/${expedienteId}/`, EXPEDIENTES_BUCKET)) ?? [];
      for (const o of objetos) await borrarObjeto(o.path, EXPEDIENTES_BUCKET);
      await sql`delete from public.expedientes where id = ${expedienteId}::uuid`;
    }
    if (clienteId) await sql`delete from public.clientes where id = ${clienteId}::uuid`;
    if (vendedorId) await sql`delete from public.contrapartes where id = ${vendedorId}::uuid`;
    const despues = await seq();
    const ultimoUsado = despues.is_called ? despues.last_value : despues.last_value - 1;
    if (ultimoUsado === secuenciaAntes + 1) {
      if (secuenciaAntes === 0) await sql`select setval('public.expediente_numero_seq', 1, false)`;
      else await sql`select setval('public.expediente_numero_seq', ${secuenciaAntes}, true)`;
    }
  }, 60_000);

  it("el cliente no inserta en la tabla base ni llama a registrar_movimiento; otro usuario no ve nada", async () => {
    await expect(
      comoUsuario(CLIENTE_USER, (tx) => tx`insert into public.expediente_movimientos (expediente_id, tipo, monto, monto_usd) values (${expedienteId}::uuid, 'deposito', 1, 1)`),
    ).rejects.toThrow(/row-level security|permission denied/i);
    await expect(
      comoUsuario(CLIENTE_USER, (tx) => tx`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, tipo: "deposito", monto: 1 })}::jsonb, null)`),
    ).rejects.toThrow(/administrador/);
    const base = await comoUsuario(CLIENTE_USER, (tx) => tx`select id from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid`);
    expect(base).toEqual([]);
  }, 60_000);

  it("declarar_deposito deja un movimiento por_confirmar con comprobante, aprobación y evento; la tarea sigue pendiente", async () => {
    const comprobante = `expedientes/${expedienteId}/comprobantes/11111111-2222-3333-4444-555555555555.pdf`;
    // Comprobante de otro expediente: rechazado.
    await expect(
      comoUsuario(CLIENTE_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H2", monto: 73410.5, fecha: "2026-11-20", banco: "BCP", comprobante_path: "expedientes/00000000-0000-0000-0000-000000000000/comprobantes/x.pdf" })}::jsonb)`),
    ).rejects.toThrow(/no pertenece/);
    await expect(
      comoUsuario(CLIENTE_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H2", monto: 0, fecha: "2026-11-20", banco: "BCP" })}::jsonb)`),
    ).rejects.toThrow(/mayor que cero/);

    const r = await comoUsuario(CLIENTE_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H2", monto: 73410.5, fecha: "2026-11-20", banco: "BCP", operacion: "00123456", comprobante_path: comprobante, agente_usuario: "vitest" })}::jsonb) as id`);
    expect(typeof r[0].id).toBe("string");

    const movs = (await sql`select id, tipo, cuenta, hito, estado, moneda, monto::float8 as monto, monto_usd::float8 as monto_usd, concepto, documento_ref, comprobante_path, declarado_por_cliente from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid`) as unknown as Record<string, unknown>[];
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ tipo: "deposito", cuenta: "fondos_clientes", hito: "H2", estado: "por_confirmar", moneda: "USD", monto: 73410.5, monto_usd: 73410.5, documento_ref: "BCP · op. 00123456", comprobante_path: comprobante, declarado_por_cliente: true });
    declaradoId = movs[0].id as string;

    const [tarea] = (await sql`select estado from public.expediente_tareas where expediente_id = ${expedienteId}::uuid and clave = 'cliente.depositar_h2'`) as unknown as { estado: string }[];
    expect(tarea.estado).toBe("pendiente");
    const aprobaciones = (await sql`select tipo, payload from public.expediente_aprobaciones where expediente_id = ${expedienteId}::uuid`) as unknown as { tipo: string; payload: Record<string, unknown> }[];
    expect(aprobaciones).toHaveLength(1);
    expect(aprobaciones[0].payload.movimiento_id).toBe(declaradoId);
    const eventos = (await sql`select titulo, visible_cliente, movimiento_id from public.expediente_eventos where expediente_id = ${expedienteId}::uuid order by created_at`) as unknown as { titulo: string; visible_cliente: boolean; movimiento_id: string }[];
    expect(eventos.at(-1)).toMatchObject({ titulo: "Declaraste un depósito del hito H2", visible_cliente: true, movimiento_id: declaradoId });

    // Un segundo depósito parcial se puede declarar mientras la tarea siga pendiente.
    await comoUsuario(CLIENTE_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H2", monto: 500, fecha: "2026-11-21", banco: "Interbank" })}::jsonb)`);
  }, 60_000);

  it("el cliente ve sus movimientos por la vista, sin nota interna ni ruta; otro usuario, nada", async () => {
    const vista = await comoUsuario(CLIENTE_USER, (tx) => tx`select estado, tiene_comprobante, declarado_por_cliente from public.expediente_movimiento_cliente where expediente_id = ${expedienteId}::uuid order by fecha`);
    expect(vista).toEqual([
      { estado: "por_confirmar", tiene_comprobante: true, declarado_por_cliente: true },
      { estado: "por_confirmar", tiene_comprobante: false, declarado_por_cliente: true },
    ]);
    const columnas = (await sql`select column_name from information_schema.columns where table_name = 'expediente_movimiento_cliente'`) as unknown as { column_name: string }[];
    const nombres = columnas.map((c) => c.column_name);
    for (const prohibida of ["nota_interna", "comprobante_path", "created_by"]) expect(nombres).not.toContain(prohibida);
    const otro = await comoUsuario("00000000-0000-0000-0000-000000000000", (tx) => tx`select id from public.expediente_movimiento_cliente where expediente_id = ${expedienteId}::uuid`);
    expect(otro).toEqual([]);
  }, 60_000);

  it("el equipo confirma el depósito (tareas hechas), nace la constancia visible al cliente y la compuerta reconoce el H2", async () => {
    // Anular exige motivo; confirmar admite corregir el monto a lo que llegó.
    await expect(sql`select public.registrar_movimiento(${JSON.stringify({ id: declaradoId, estado: "anulado" })}::jsonb, ${ADMIN}::uuid)`).rejects.toThrow(/motivo/);
    const [{ id }] = (await sql`select public.registrar_movimiento(${JSON.stringify({ id: declaradoId, estado: "confirmado", monto: 73410, fecha: "2026-11-21", nota_interna: "Llegaron 0.50 menos por comisión del banco." })}::jsonb, ${ADMIN}::uuid) as id`) as unknown as { id: string }[];
    expect(id).toBe(declaradoId);
    // No se confirma dos veces.
    await expect(sql`select public.registrar_movimiento(${JSON.stringify({ id: declaradoId, estado: "confirmado" })}::jsonb, ${ADMIN}::uuid)`).rejects.toThrow(/ya está confirmado/);

    const [mov] = (await sql`select estado, monto::float8 as monto, monto_usd::float8 as monto_usd, fecha::text as fecha, nota_interna from public.expediente_movimientos where id = ${declaradoId}::uuid`) as unknown as Record<string, unknown>[];
    expect(mov).toMatchObject({ estado: "confirmado", monto: 73410, monto_usd: 73410, fecha: "2026-11-21", nota_interna: "Llegaron 0.50 menos por comisión del banco." });
    const tareas = (await sql`select clave, estado from public.expediente_tareas where expediente_id = ${expedienteId}::uuid order by clave`) as unknown as { clave: string; estado: string }[];
    expect(Object.fromEntries(tareas.map((t) => [t.clave, t.estado]))).toMatchObject({ "cliente.depositar_h2": "hecha", "luxcars.confirmar_h2": "hecha" });

    // La constancia, como la emite la ruta de movimientos.
    const { cargarContextoServidor } = await import("@/lib/expedientes/servidor/contexto");
    const { emitirDocumento } = await import("@/lib/expedientes/servidor/emitirDocumento");
    const { plantillaDe } = await import("@/core/expedientes/documentos");
    const { estadoHito } = await import("@/core/expedientes/hitos");
    const { evaluarAvance } = await import("@/core/expedientes/avance");
    const ctx = (await cargarContextoServidor(expedienteId))!;
    expect(ctx.movimientos).toHaveLength(2);
    const confirmado = ctx.movimientos.find((m) => m.id === declaradoId)!;
    expect(confirmado.notaInterna).toBe("Llegaron 0.50 menos por comisión del banco.");
    expect(estadoHito(ctx.hitos.find((h) => h.tipo === "H2")!, ctx.movimientos)).toBe("acreditado");

    const fijos = { LUXCARS_RUC: "20600000001", LUXCARS_DOMICILIO: "Calle Prueba 184", LUXCARS_PARTIDA: "1", LUXCARS_REPRESENTANTE: "Representante Prueba", LUXCARS_REP_DNI: "40000000", LUXCARS_CORREO: "info@luxcars.pe", LUXCARS_TELEFONO: "+51 980 794 348", CTA_OPER_BANCO: "BCP", CTA_OPER_NUMERO: "1", CTA_OPER_CCI: "1", CTA_FONDOS_BANCO: "BCP", CTA_FONDOS_NUMERO: "2", CTA_FONDOS_CCI: "2", CTA_DETRACCION_NUMERO: "3" };
    const r = await emitirDocumento(plantillaDe("constancia_fondos")!, ctx, { actorId: ADMIN, extra: fijos, visibleCliente: true, movimiento: confirmado });
    expect(r.ok, r.ok ? "" : r.mensaje).toBe(true);
    if (!r.ok) return;
    const [doc] = (await sql`select tipo, version, estado, visible_cliente, movimiento_id, hito, titulo, campos->>'CONSTANCIA_NUMERO' as numero, campos->>'SALDO_NUEVO' as saldo from public.expediente_documentos where id = ${r.documentoId}::uuid`) as unknown as Record<string, unknown>[];
    expect(doc).toMatchObject({ tipo: "constancia_fondos", version: 1, estado: "emitido", visible_cliente: true, movimiento_id: declaradoId, hito: "H2", numero: "F01", saldo: "73,410.00" });
    expect(doc.titulo).toContain("F01");
    const vistaDoc = await comoUsuario(CLIENTE_USER, (tx) => tx`select tipo, movimiento_id, hito from public.expediente_documento_cliente where expediente_id = ${expedienteId}::uuid`);
    expect(vistaDoc).toEqual([{ tipo: "constancia_fondos", movimiento_id: declaradoId, hito: "H2" }]);

    // Un pago al vendedor (CAD con tipo de cambio) y la compuerta de embarque: H2 y pago cumplidos, falta el bill of sale.
    const [{ id: pagoId }] = (await sql`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, tipo: "pago", cuenta: "fondos_clientes", hito: "H2", fecha: "2026-11-22", moneda: "CAD", monto: 98500, tipo_cambio: 0.72, contraparte_id: vendedorId, concepto: "Precio del vehículo", documento_ref: "SWIFT 77" })}::jsonb, ${ADMIN}::uuid) as id`) as unknown as { id: string }[];
    const [pago] = (await sql`select monto_usd::float8 as monto_usd, estado from public.expediente_movimientos where id = ${pagoId}::uuid`) as unknown as { monto_usd: number; estado: string }[];
    expect(pago).toEqual({ monto_usd: 70920, estado: "confirmado" });
    const ctx2 = (await cargarContextoServidor(expedienteId))!;
    expect(ctx2.contrapartes?.some((c) => c.id === vendedorId)).toBe(true);
    const avance = evaluarAvance(ctx2, "embarque");
    expect(avance.faltantes.map((f) => f.clave)).toEqual(["bill_of_sale"]);

    // El otro depósito declarado se anula con motivo y el cliente lo ve en su actividad.
    const [otro] = (await sql`select id from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid and estado = 'por_confirmar'`) as unknown as { id: string }[];
    await sql`select public.registrar_movimiento(${JSON.stringify({ id: otro.id, estado: "anulado", motivo: "No llegó a la cuenta; revisa el CCI." })}::jsonb, ${ADMIN}::uuid)`;
    const vista = await comoUsuario(CLIENTE_USER, (tx) => tx`select estado from public.expediente_movimiento_cliente where expediente_id = ${expedienteId}::uuid order by fecha`);
    expect(vista.map((v) => v.estado)).toEqual(["confirmado", "confirmado"]);
    const eventos = (await sql`select titulo, detalle, visible_cliente from public.expediente_eventos where expediente_id = ${expedienteId}::uuid and movimiento_id = ${otro.id}::uuid order by created_at`) as unknown as { titulo: string; detalle: string; visible_cliente: boolean }[];
    expect(eventos.at(-1)).toMatchObject({ titulo: "No pudimos confirmar el depósito que declaraste", detalle: "No llegó a la cuenta; revisa el CCI.", visible_cliente: true });
  }, 180_000);
});
