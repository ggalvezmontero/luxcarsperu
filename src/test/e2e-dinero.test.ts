/**
 * Prueba de punta a punta de la fase 3 (dinero) contra la base y el bucket
 * REALES (lee .env.local). En `npm test` queda SALTADA; se corre a mano con
 *   E2E_EXPEDIENTES=1 npx vitest run src/test/e2e-dinero.test.ts
 * y borra todo lo que crea al final, reponiendo la secuencia de códigos.
 *
 * Cubre (calendario del 27 nov 2026): el cliente no inserta en
 * `expediente_movimientos`; `declarar_deposito` del Pago 1 (H1, precio) deja un
 * movimiento `por_confirmar` con comprobante; el equipo lo confirma con
 * `registrar_movimiento` (tarea del cliente hecha, "confirmar H1" hecha al
 * quedar acreditado) y nace la constancia por `emitirDocumento`; el cliente ve
 * el movimiento por la vista sin `nota_interna` ni ruta; anular exige motivo;
 * la compuerta de compra reconoce el H1 acreditado por el libro; el wire al
 * broker con `comision_bancaria_usd` deja el cargo y la reposición sin mover el
 * saldo; el Pago 4 (H5) se declara en soles a la cuenta `directo` y queda
 * acreditado con el pago confirmado aunque la cifra difiera del estimado.
 *
 * Una sola cuenta (27 nov 2026): el Pago 2 es una sola transferencia a Fondos
 * de Clientes que cubre el H2 y el H3; las tareas del pago se cierran recién
 * con el pago completo; con cliente empresa nace la tarea de autodetracción a
 * cinco días hábiles (la crea el servidor con la regla del core); la factura
 * se aplica de Fondos de Clientes a Operaciones y la detracción se deposita en
 * el Banco de la Nación con asientos internos sin hito, que el cliente no ve
 * como pagos suyos y que no acreditan ningún pago.
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
let brokerId = "";
let secuenciaAntes = 0;
let declaradoId = "";

async function seq(): Promise<{ last_value: number; is_called: boolean }> {
  const [r] = (await sql`select last_value::int as last_value, is_called from public.expediente_numero_seq`) as unknown as { last_value: number; is_called: boolean }[];
  return r;
}

const claims = (sub: string) => JSON.stringify({ sub, role: "authenticated" });
type Tx = NeonQueryFunctionInTransaction<false, false>;
/**
 * Corre una consulta como un usuario de la Data API: primero el rol, DESPUÉS los claims (el orden importa).
 * Esta suplantación por HTTP a veces no ve los claims justo después de consultas del dueño
 * (`auth.uid()` llega nulo y la función responde "Tu sesión no está activa"); en producción la
 * Data API firma cada petición. Por eso, solo ante ese error, se reintenta una vez.
 */
async function comoUsuario(sub: string, consulta: (tx: Tx) => NeonQueryInTransaction, intento = 1): Promise<Record<string, unknown>[]> {
  try {
    const r = await sql.transaction((tx) => [
      tx`set local role authenticated`,
      tx`select set_config('request.jwt.claims', ${claims(sub)}, true)`,
      consulta(tx),
    ]);
    return r[2] as unknown as Record<string, unknown>[];
  } catch (error) {
    if (intento === 1 && error instanceof Error && /Tu sesión no está activa/.test(error.message)) {
      await new Promise((listo) => setTimeout(listo, 500));
      return comoUsuario(sub, consulta, 2);
    }
    throw error;
  }
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
    const [k] = (await sql`
      insert into public.contrapartes (tipo, nombre, pais, direccion, contacto, email, telefono)
      values ('broker', 'Example Auto Brokers LLC', 'Estados Unidos', '9800 NW 12th St, Doral, FL', 'Daniel Ortega', 'deals@example-brokers.test', '+1 305 000 0000')
      returning id
    `) as unknown as { id: string }[];
    brokerId = k.id;
    const { entradaPorDefecto, presupuestar } = await import("@/core/expedientes/presupuesto");
    const presupuesto = presupuestar(entradaPorDefecto({ precio: 98500, monedaCompra: "CAD", tcCompraRef: 0.72, vehicleType: "hev", condition: "nuevo", origin: "otro", cylinderCapacityCc: 3445, proporcionFlete: 0.5 }));
    const [e] = (await sql`
      insert into public.expedientes (cliente_id, etapa, proporcion_flete, veh_marca, veh_modelo, veh_anio, veh_vin, veh_condicion, veh_categoria, veh_origen,
        moneda_compra, precio_compra, precio_compra_usd, pais_origen, puerto_origen, presupuesto, honorarios_usd, honorarios_base_usd, honorarios_igv_usd, margen_h3, fecha_firma, fecha_limite_h2, fecha_est_arribo)
      values (${clienteId}::uuid, 'contrato', 0.5, 'Toyota', 'Tundra', 2026, '5TFPC5DB1RX000000', 'nuevo', 'hev', 'otro',
        'CAD', 98500, 70920, 'Canadá', 'Vancouver', ${JSON.stringify(presupuesto)}::jsonb, ${presupuesto.honorarios}, ${presupuesto.honorariosBase}, ${presupuesto.honorariosIgv}, 0, '2026-11-28', '2026-12-12', '2027-02-10')
      returning id
    `) as unknown as { id: string }[];
    expedienteId = e.id;
    await sql`insert into public.expedientes_reservado (expediente_id, precio_tope, vendedor_id, broker_id) values (${expedienteId}::uuid, 100000, ${vendedorId}::uuid, ${brokerId}::uuid)`;
    for (const h of presupuesto.hitos) {
      // El H5 (tributos, directo a SUNAT) queda con un estimado distinto de lo que se pagará: se acredita igual.
      await sql`insert into public.expediente_hitos (expediente_id, tipo, monto_estimado_usd, cuenta, fecha_limite)
        values (${expedienteId}::uuid, ${h.tipo}::public.tipo_hito, ${h.tipo === "H5" ? 30000 : h.montoUsd}, ${h.cuenta}::public.cuenta_movimiento, ${h.tipo === "H1" ? "2026-11-28" : null}::date)`;
    }
    await sql`insert into public.expediente_tareas (expediente_id, etapa, clave, titulo, responsable, visible_cliente) values
      (${expedienteId}::uuid, 'contrato', 'cliente.depositar_h1', 'Pago 1: depositar el precio del vehículo (hito H1)', 'cliente', true),
      (${expedienteId}::uuid, 'contrato', 'luxcars.confirmar_h1', 'Confirmar H1 y emitir la constancia de fondos', 'luxcars', false),
      (${expedienteId}::uuid, 'contrato', 'cliente.firmar_contrato_loa', 'Firmar en notaría', 'cliente', true),
      (${expedienteId}::uuid, 'contrato', 'cliente.depositar_h5', 'Pago 4: pagar los tributos directamente a SUNAT (hito H5)', 'cliente', true),
      (${expedienteId}::uuid, 'contrato', 'luxcars.confirmar_h5', 'Confirmar el pago de tributos', 'luxcars', false),
      (${expedienteId}::uuid, 'contrato', 'cliente.depositar_h2', 'Pago 2 de 5: flete, seguro y primera mitad de los honorarios', 'cliente', true),
      (${expedienteId}::uuid, 'contrato', 'luxcars.confirmar_h2', 'Confirmar el Pago 2 y emitir la constancia', 'luxcars', false),
      (${expedienteId}::uuid, 'contrato', 'luxcars.factura_h3', 'Emitir la factura 1 de honorarios y aplicarla desde Fondos de Clientes', 'luxcars', false)`;
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
    if (brokerId) await sql`delete from public.contrapartes where id = ${brokerId}::uuid`;
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
      comoUsuario(CLIENTE_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H1", monto: 70920, fecha: "2026-11-20", banco: "BCP", comprobante_path: "expedientes/00000000-0000-0000-0000-000000000000/comprobantes/x.pdf" })}::jsonb)`),
    ).rejects.toThrow(/no pertenece/);
    await expect(
      comoUsuario(CLIENTE_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H1", monto: 0, fecha: "2026-11-20", banco: "BCP" })}::jsonb)`),
    ).rejects.toThrow(/mayor que cero/);

    const r = await comoUsuario(CLIENTE_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H1", monto: 70920, fecha: "2026-11-20", banco: "BCP", operacion: "00123456", comprobante_path: comprobante, agente_usuario: "vitest" })}::jsonb) as id`);
    expect(typeof r[0].id).toBe("string");

    const movs = (await sql`select id, tipo, cuenta, hito, estado, moneda, monto::float8 as monto, monto_usd::float8 as monto_usd, concepto, documento_ref, comprobante_path, declarado_por_cliente from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid`) as unknown as Record<string, unknown>[];
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ tipo: "deposito", cuenta: "fondos_clientes", hito: "H1", estado: "por_confirmar", moneda: "USD", monto: 70920, monto_usd: 70920, concepto: "Pago 1 de 5 declarado por el cliente", documento_ref: "BCP · op. 00123456", comprobante_path: comprobante, declarado_por_cliente: true });
    declaradoId = movs[0].id as string;

    const [tarea] = (await sql`select estado from public.expediente_tareas where expediente_id = ${expedienteId}::uuid and clave = 'cliente.depositar_h1'`) as unknown as { estado: string }[];
    expect(tarea.estado).toBe("pendiente");
    const aprobaciones = (await sql`select tipo, payload from public.expediente_aprobaciones where expediente_id = ${expedienteId}::uuid`) as unknown as { tipo: string; payload: Record<string, unknown> }[];
    expect(aprobaciones).toHaveLength(1);
    expect(aprobaciones[0].payload.movimiento_id).toBe(declaradoId);
    const eventos = (await sql`select titulo, visible_cliente, movimiento_id from public.expediente_eventos where expediente_id = ${expedienteId}::uuid order by created_at`) as unknown as { titulo: string; visible_cliente: boolean; movimiento_id: string }[];
    expect(eventos.at(-1)).toMatchObject({ titulo: "Declaraste el Pago 1 de 5", visible_cliente: true, movimiento_id: declaradoId });

    // Un segundo depósito parcial se puede declarar mientras la tarea siga pendiente.
    await comoUsuario(CLIENTE_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H1", monto: 500, fecha: "2026-11-21", banco: "Interbank" })}::jsonb)`);
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

  it("el equipo confirma el depósito (tareas hechas), nace la constancia visible al cliente y la compuerta reconoce el H1", async () => {
    // Anular exige motivo; confirmar admite corregir el monto a lo que llegó.
    await expect(sql`select public.registrar_movimiento(${JSON.stringify({ id: declaradoId, estado: "anulado" })}::jsonb, ${ADMIN}::uuid)`).rejects.toThrow(/motivo/);
    const [{ id }] = (await sql`select public.registrar_movimiento(${JSON.stringify({ id: declaradoId, estado: "confirmado", monto: 70919.5, fecha: "2026-11-21", nota_interna: "Llegaron 0.50 menos por comisión del banco." })}::jsonb, ${ADMIN}::uuid) as id`) as unknown as { id: string }[];
    expect(id).toBe(declaradoId);
    // No se confirma dos veces.
    await expect(sql`select public.registrar_movimiento(${JSON.stringify({ id: declaradoId, estado: "confirmado" })}::jsonb, ${ADMIN}::uuid)`).rejects.toThrow(/ya está confirmado/);

    const [mov] = (await sql`select estado, monto::float8 as monto, monto_usd::float8 as monto_usd, fecha::text as fecha, nota_interna from public.expediente_movimientos where id = ${declaradoId}::uuid`) as unknown as Record<string, unknown>[];
    expect(mov).toMatchObject({ estado: "confirmado", monto: 70919.5, monto_usd: 70919.5, fecha: "2026-11-21", nota_interna: "Llegaron 0.50 menos por comisión del banco." });
    const tareas = (await sql`select clave, estado from public.expediente_tareas where expediente_id = ${expedienteId}::uuid order by clave`) as unknown as { clave: string; estado: string }[];
    expect(Object.fromEntries(tareas.map((t) => [t.clave, t.estado]))).toMatchObject({ "cliente.depositar_h1": "hecha", "luxcars.confirmar_h1": "hecha" });

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
    expect(estadoHito(ctx.hitos.find((h) => h.tipo === "H1")!, ctx.movimientos)).toBe("acreditado");

    const fijos = { LUXCARS_RUC: "20600000001", LUXCARS_DOMICILIO: "Calle Prueba 184", LUXCARS_PARTIDA: "1", LUXCARS_REPRESENTANTE: "Representante Prueba", LUXCARS_REP_DNI: "40000000", LUXCARS_CORREO: "info@luxcars.pe", LUXCARS_TELEFONO: "+51 980 794 348", CTA_FONDOS_BANCO: "BCP", CTA_FONDOS_NUMERO: "2", CTA_FONDOS_CCI: "2", CTA_DETRACCION_NUMERO: "3", PORCENTAJE_DETRACCION: "12", CIUDAD_FIRMA: "Lima", DIAS_ESPERA_MAX: "15" };
    const r = await emitirDocumento(plantillaDe("constancia_fondos")!, ctx, { actorId: ADMIN, extra: {}, porDefecto: fijos, visibleCliente: true, movimiento: confirmado });
    expect(r.ok, r.ok ? "" : r.mensaje).toBe(true);
    if (!r.ok) return;
    const [doc] = (await sql`select tipo, version, estado, visible_cliente, movimiento_id, hito, titulo, campos->>'CONSTANCIA_NUMERO' as numero, campos->>'SALDO_NUEVO' as saldo from public.expediente_documentos where id = ${r.documentoId}::uuid`) as unknown as Record<string, unknown>[];
    expect(doc).toMatchObject({ tipo: "constancia_fondos", version: 1, estado: "emitido", visible_cliente: true, movimiento_id: declaradoId, hito: "H1", numero: "F01", saldo: "70,919.50" });
    expect(doc.titulo).toContain("F01");
    const vistaDoc = await comoUsuario(CLIENTE_USER, (tx) => tx`select tipo, movimiento_id, hito from public.expediente_documento_cliente where expediente_id = ${expedienteId}::uuid`);
    expect(vistaDoc).toEqual([{ tipo: "constancia_fondos", movimiento_id: declaradoId, hito: "H1" }]);

    // La compuerta de compra ya no pide el H1 (acreditado por el libro con la tolerancia de un dólar); falta la firma.
    const avance = evaluarAvance(ctx, "compra");
    expect(avance.faltantes.map((f) => f.clave)).not.toContain("h1_acreditado");
    expect(avance.faltantes.map((f) => f.clave)).toContain("contrato_firmado");

    // El wire al broker (CAD con tipo de cambio) con la comisión del banco: dos asientos más que se anulan entre sí.
    const { comisionesBancarias, saldoCuenta } = await import("@/core/expedientes/ledger");
    const saldoAntes = saldoCuenta(ctx.movimientos);
    await expect(sql`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, tipo: "deposito", cuenta: "fondos_clientes", fecha: "2026-11-22", monto: 10, comision_bancaria_usd: 45 })}::jsonb, ${ADMIN}::uuid)`).rejects.toThrow(/solo acompaña un pago desde Fondos de Clientes/);
    const [{ id: pagoId }] = (await sql`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, tipo: "pago", cuenta: "fondos_clientes", hito: "H1", fecha: "2026-11-22", moneda: "CAD", monto: 98500, tipo_cambio: 0.72, contraparte_id: brokerId, concepto: "Precio del vehículo (wire al broker)", documento_ref: "SWIFT 77", comision_bancaria_usd: 45 })}::jsonb, ${ADMIN}::uuid) as id`) as unknown as { id: string }[];
    const [pago] = (await sql`select monto_usd::float8 as monto_usd, estado from public.expediente_movimientos where id = ${pagoId}::uuid`) as unknown as { monto_usd: number; estado: string }[];
    expect(pago).toEqual({ monto_usd: 70920, estado: "confirmado" });
    const par = (await sql`select tipo, cuenta, monto_usd::float8 as monto_usd, concepto from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid and (concepto like 'Comisión bancaria%' or concepto like 'Reposición de la comisión%') order by tipo`) as unknown as Record<string, unknown>[];
    // Orden de la enum tipo_movimiento: el pago (cargo del banco) antes del ajuste (reposición).
    expect(par).toEqual([
      { tipo: "pago", cuenta: "fondos_clientes", monto_usd: 45, concepto: "Comisión bancaria del wire (cargo del banco)" },
      { tipo: "ajuste", cuenta: "fondos_clientes", monto_usd: 45, concepto: "Reposición de la comisión bancaria, por cuenta de Luxcars" },
    ]);
    const ctx2 = (await cargarContextoServidor(expedienteId))!;
    expect(ctx2.contrapartes?.some((c) => c.id === brokerId)).toBe(true);
    expect(comisionesBancarias(ctx2.movimientos)).toEqual({ cargadas: 45, repuestas: 45, efecto: 0 });
    expect(saldoCuenta(ctx2.movimientos)).toBe(Math.round((saldoAntes - 70920) * 100) / 100);
    const [evento] = (await sql`select visible_cliente from public.expediente_eventos where expediente_id = ${expedienteId}::uuid and titulo = 'Comisión bancaria del wire repuesta por Luxcars'`) as unknown as { visible_cliente: boolean }[];
    expect(evento.visible_cliente).toBe(true);

    // El otro depósito declarado se anula con motivo y el cliente lo ve en su actividad.
    const [otro] = (await sql`select id from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid and estado = 'por_confirmar'`) as unknown as { id: string }[];
    await sql`select public.registrar_movimiento(${JSON.stringify({ id: otro.id, estado: "anulado", motivo: "No llegó a la cuenta; revisa el CCI." })}::jsonb, ${ADMIN}::uuid)`;
    const vista = await comoUsuario(CLIENTE_USER, (tx) => tx`select estado from public.expediente_movimiento_cliente where expediente_id = ${expedienteId}::uuid order by fecha`);
    expect(vista.map((v) => v.estado)).toEqual(["confirmado", "confirmado", "confirmado", "confirmado"]);
    const eventos = (await sql`select titulo, detalle, visible_cliente from public.expediente_eventos where expediente_id = ${expedienteId}::uuid and movimiento_id = ${otro.id}::uuid order by created_at`) as unknown as { titulo: string; detalle: string; visible_cliente: boolean }[];
    expect(eventos.at(-1)).toMatchObject({ titulo: "No pudimos confirmar el depósito que declaraste", detalle: "No llegó a la cuenta; revisa el CCI.", visible_cliente: true });
  }, 180_000);
  it("el Pago 4 (H5) se declara en soles a la cuenta directo y queda acreditado con el pago confirmado", async () => {
    await expect(
      comoUsuario(CLIENTE_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H5", monto: 27587.85, soles: -1, fecha: "2026-11-23", banco: "Clave SOL" })}::jsonb)`),
    ).rejects.toThrow(/soles debe ser mayor que cero/);
    await comoUsuario(CLIENTE_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H5", monto: 27587.85, soles: 103920.02, fecha: "2026-11-23", banco: "Clave SOL", operacion: "Liquidación 118-2026-0001234" })}::jsonb)`);
    const [m] = (await sql`select id, cuenta, moneda, monto::float8 as monto, tipo_cambio::float8 as tipo_cambio, monto_usd::float8 as monto_usd, concepto, documento_ref, estado from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid and hito = 'H5'`) as unknown as Record<string, unknown>[];
    expect(m).toMatchObject({ cuenta: "directo", moneda: "PEN", monto: 103920.02, tipo_cambio: 0.2655, monto_usd: 27587.85, concepto: "Pago 4 de 5 pagado directo a SUNAT, declarado por el cliente", documento_ref: "Clave SOL · Liquidación 118-2026-0001234", estado: "por_confirmar" });
    const [declarado] = (await sql`select titulo, detalle from public.expediente_eventos where expediente_id = ${expedienteId}::uuid and movimiento_id = ${m.id as string}::uuid order by created_at`) as unknown as { titulo: string; detalle: string }[];
    expect(declarado.titulo).toBe("Declaraste el Pago 4 de 5: tributos pagados a SUNAT");
    expect(declarado.detalle).toContain("S/ 103,920.02 (USD 27,587.85) pagados a SUNAT");

    // El equipo confirma: mantiene los dólares de la DAM y el H5 queda acreditado aunque el estimado era 30,000.
    await sql`select public.registrar_movimiento(${JSON.stringify({ id: m.id, estado: "confirmado" })}::jsonb, ${ADMIN}::uuid)`;
    const [c] = (await sql`select estado, monto_usd::float8 as monto_usd from public.expediente_movimientos where id = ${m.id as string}::uuid`) as unknown as Record<string, unknown>[];
    expect(c).toEqual({ estado: "confirmado", monto_usd: 27587.85 });
    const tareas = (await sql`select clave, estado from public.expediente_tareas where expediente_id = ${expedienteId}::uuid and clave in ('cliente.depositar_h5', 'luxcars.confirmar_h5') order by clave`) as unknown as { clave: string; estado: string }[];
    expect(tareas).toEqual([{ clave: "cliente.depositar_h5", estado: "hecha" }, { clave: "luxcars.confirmar_h5", estado: "hecha" }]);
    const [confirmado] = (await sql`select titulo from public.expediente_eventos where expediente_id = ${expedienteId}::uuid and movimiento_id = ${m.id as string}::uuid order by created_at desc limit 1`) as unknown as { titulo: string }[];
    expect(confirmado.titulo).toBe("Pago 4 de 5 confirmado: tributos pagados a SUNAT");

    const { cargarContextoServidor } = await import("@/lib/expedientes/servidor/contexto");
    const { estadoHito } = await import("@/core/expedientes/hitos");
    const { pagosDirectos, saldoCuenta } = await import("@/core/expedientes/ledger");
    const ctx = (await cargarContextoServidor(expedienteId))!;
    expect(estadoHito(ctx.hitos.find((h) => h.tipo === "H5")!, ctx.movimientos)).toBe("acreditado");
    expect(pagosDirectos(ctx.movimientos).map((d) => [d.moneda, d.monto, d.montoUsd])).toEqual([["PEN", 103920.02, 27587.85]]);
    // No toca Fondos de Clientes.
    expect(saldoCuenta(ctx.movimientos, "directo")).toBe(27587.85);
    // El cliente lo ve en su estado de cuenta.
    const vista = await comoUsuario(CLIENTE_USER, (tx) => tx`select cuenta, moneda, monto_usd::float8 as monto_usd from public.expediente_movimiento_cliente where expediente_id = ${expedienteId}::uuid and hito = 'H5'`);
    expect(vista).toEqual([{ cuenta: "directo", moneda: "PEN", monto_usd: 27587.85 }]);
  }, 120_000);

  it("el Pago 2 es una sola transferencia; con el pago completo nace la autodetracción, se aplica la factura 1 y se deposita la detracción", async () => {
    const { cargarContextoServidor } = await import("@/lib/expedientes/servidor/contexto");
    const { crearTareasTrasConfirmar } = await import("@/lib/expedientes/servidor/tareasHonorarios");
    const { sumarDiasHabiles } = await import("@/core/expedientes/hitos");
    const { estadoPagos, saldoFondos } = await import("@/core/expedientes/ledger");
    const { alertas } = await import("@/core/expedientes/alertas");
    const ctx0 = (await cargarContextoServidor(expedienteId))!;
    const h2 = ctx0.hitos.find((h) => h.tipo === "H2")!.montoEstimadoUsd;
    const h3 = ctx0.hitos.find((h) => h.tipo === "H3")!.montoEstimadoUsd;
    const total = Math.round((h2 + h3) * 100) / 100;
    const tareasDe = async () => Object.fromEntries(((await sql`select clave, estado, vence_el::text as vence_el from public.expediente_tareas where expediente_id = ${expedienteId}::uuid`) as unknown as { clave: string; estado: string; vence_el: string | null }[]).map((t) => [t.clave, t]));

    // Una primera transferencia que solo cubre el flete y el seguro: el H2 queda acreditado pero el pago no, y sus tareas siguen pendientes.
    await sql`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, tipo: "deposito", cuenta: "fondos_clientes", hito: "H2", fecha: "2026-12-03", monto: h2, documento_ref: "BCP · op. 1" })}::jsonb, ${ADMIN}::uuid)`;
    let t = await tareasDe();
    expect(t["cliente.depositar_h2"].estado).toBe("pendiente");
    expect(t["luxcars.confirmar_h2"].estado).toBe("pendiente");
    const ctx1 = (await cargarContextoServidor(expedienteId))!;
    expect(estadoPagos(ctx1.hitos, ctx1.movimientos).find((p) => p.pago === 2)).toMatchObject({ estado: "parcial", pendiente: h3 });
    // Sin el pago completo no nace la autodetracción.
    expect(await crearTareasTrasConfirmar(ctx1, ctx1.movimientos.find((m) => m.hito === "H2" && m.tipo === "deposito")!)).toEqual([]);

    // El resto lo declara el cliente como Pago 2 (cuenta Fondos de Clientes) y el equipo lo confirma: el pago queda completo.
    await comoUsuario(CLIENTE_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H2", monto: h3, fecha: "2026-11-26", banco: "BCP" })}::jsonb)`);
    const [resto] = (await sql`select id, cuenta, concepto from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid and hito = 'H2' and estado = 'por_confirmar'`) as unknown as { id: string; cuenta: string; concepto: string }[];
    expect(resto).toMatchObject({ cuenta: "fondos_clientes", concepto: "Pago 2 de 5 declarado por el cliente" });
    // El equipo lo confirma con la fecha en que se acreditó (viernes 4 de diciembre).
    await sql`select public.registrar_movimiento(${JSON.stringify({ id: resto.id, estado: "confirmado", fecha: "2026-12-04" })}::jsonb, ${ADMIN}::uuid)`;
    t = await tareasDe();
    expect(t["cliente.depositar_h2"].estado).toBe("hecha");
    expect(t["luxcars.confirmar_h2"].estado).toBe("hecha");
    const [titulo] = (await sql`select titulo from public.expediente_eventos where movimiento_id = ${resto.id}::uuid order by created_at desc limit 1`) as unknown as { titulo: string }[];
    expect(titulo.titulo).toBe("Pago 2 de 5 confirmado");

    // Cliente empresa: la confirmación hace nacer la autodetracción a cinco días hábiles (viernes 4 + 5, con el 8 y el 9 de diciembre feriados).
    const ctx2 = (await cargarContextoServidor(expedienteId))!;
    expect(estadoPagos(ctx2.hitos, ctx2.movimientos).find((p) => p.pago === 2)).toMatchObject({ estado: "acreditado", acreditado: total });
    const confirmado = ctx2.movimientos.find((m) => m.id === resto.id)!;
    expect(await crearTareasTrasConfirmar(ctx2, confirmado)).toEqual(["luxcars.autodetraccion_h3"]);
    t = await tareasDe();
    expect(t["luxcars.autodetraccion_h3"]).toMatchObject({ estado: "pendiente", vence_el: sumarDiasHabiles("2026-12-04", 5) });
    expect(t["luxcars.autodetraccion_h3"].vence_el).toBe("2026-12-15");
    // No se repite.
    const ctx3 = (await cargarContextoServidor(expedienteId))!;
    expect(await crearTareasTrasConfirmar(ctx3, confirmado)).toEqual([]);
    // Vencida, el cron la alerta.
    expect(alertas(ctx3, new Date("2026-12-16T15:00:00Z")).map((a) => a.clave)).toContain("autodetraccion_vencida_h3");

    // Aplicar la factura 1: exige número y factura válida; arma el par interno y cierra la tarea de la factura.
    await expect(sql`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, operacion: "aplicar_honorarios", factura: 1, monto: h3, fecha: "2026-12-04" })}::jsonb, ${ADMIN}::uuid)`).rejects.toThrow(/número de la factura/);
    await expect(sql`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, operacion: "aplicar_honorarios", factura: 3, monto: h3, documento_ref: "F001-1" })}::jsonb, ${ADMIN}::uuid)`).rejects.toThrow(/factura de honorarios: 1/);
    await sql`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, operacion: "aplicar_honorarios", factura: 1, monto: h3, fecha: "2026-12-04", documento_ref: "F001-000101" })}::jsonb, ${ADMIN}::uuid)`;
    // Autodetracción en soles, con la constancia del Banco de la Nación.
    await expect(sql`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, operacion: "autodetraccion", factura: 1, moneda: "PEN", monto: 2110, fecha: "2026-12-10" })}::jsonb, ${ADMIN}::uuid)`).rejects.toThrow(/tipo de cambio/);
    await sql`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, operacion: "autodetraccion", factura: 1, moneda: "PEN", monto: 2110, tipo_cambio: 0.2659, fecha: "2026-12-10", documento_ref: "BN 123456789" })}::jsonb, ${ADMIN}::uuid)`;
    t = await tareasDe();
    expect(t["luxcars.factura_h3"].estado).toBe("hecha");
    expect(t["luxcars.autodetraccion_h3"].estado).toBe("hecha");
    // Cada par nace en la misma transacción: el pago (sale) y el depósito (entra); en la enum el depósito va primero, por eso `tipo desc`.
    const internos = (await sql`select tipo, cuenta, hito, monto_usd::float8 as monto_usd, concepto, documento_ref from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid and hito is null and (concepto like 'Aplicación%' or concepto like 'Honorarios recibidos%' or concepto like 'Detracción%') order by created_at, tipo desc`) as unknown as Record<string, unknown>[];
    expect(internos).toEqual([
      { tipo: "pago", cuenta: "fondos_clientes", hito: null, monto_usd: h3, concepto: "Aplicación de honorarios · factura 1 F001-000101", documento_ref: "F001-000101" },
      { tipo: "deposito", cuenta: "operaciones", hito: null, monto_usd: h3, concepto: "Honorarios recibidos desde Fondos de Clientes · factura 1 F001-000101", documento_ref: "F001-000101" },
      { tipo: "pago", cuenta: "operaciones", hito: null, monto_usd: 561.05, concepto: "Detracción de la factura 1 depositada en el Banco de la Nación (autodetracción)", documento_ref: "BN 123456789" },
      { tipo: "deposito", cuenta: "detracciones", hito: null, monto_usd: 561.05, concepto: "Detracción de la factura 1 (autodetracción)", documento_ref: "BN 123456789" },
    ]);

    // Saldos: la factura salió de Fondos de Clientes; Operaciones queda con los honorarios menos la detracción; el Pago 2 sigue igual.
    const ctx4 = (await cargarContextoServidor(expedienteId))!;
    const saldo = saldoFondos(ctx4.movimientos);
    expect(saldo.operaciones).toBe(Math.round((h3 - 561.05) * 100) / 100);
    expect(saldo.detracciones).toBe(561.05);
    expect(saldo.fondos_clientes).toBe(Math.round((saldoFondos(ctx2.movimientos).fondos_clientes - h3) * 100) / 100);
    expect(estadoPagos(ctx4.hitos, ctx4.movimientos).find((p) => p.pago === 2)!.acreditado).toBe(total);
    expect(estadoPagos(ctx4.hitos, ctx4.movimientos).find((p) => p.pago === 5)!.acreditado).toBe(0);

    // El cliente ve la factura aplicada en su cuenta Fondos de Clientes y los avisos; no ve Operaciones ni la cuenta de detracciones.
    const vista = await comoUsuario(CLIENTE_USER, (tx) => tx`select cuenta, tipo, concepto from public.expediente_movimiento_cliente where expediente_id = ${expedienteId}::uuid and hito is null`);
    expect(vista.some((v) => v.cuenta === "operaciones" || v.cuenta === "detracciones")).toBe(false);
    expect(vista).toContainEqual({ cuenta: "fondos_clientes", tipo: "pago", concepto: "Aplicación de honorarios · factura 1 F001-000101" });
    const eventos = await comoUsuario(CLIENTE_USER, (tx) => tx`select titulo from public.expediente_evento_cliente where expediente_id = ${expedienteId}::uuid`);
    expect(eventos.map((e) => e.titulo)).toEqual(expect.arrayContaining(["Factura 1 de honorarios aplicada", "Detracción de la factura 1 depositada"]));
  }, 180_000);
});
