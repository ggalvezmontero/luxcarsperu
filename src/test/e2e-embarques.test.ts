/**
 * Prueba de punta a punta de la fase 4 (embarques y notificaciones) contra la
 * base REAL (lee .env.local). En `npm test` queda SALTADA; se corre a mano con
 *   E2E_EXPEDIENTES=1 npx vitest run src/test/e2e-embarques.test.ts
 * y borra todo lo que crea al final, reponiendo las secuencias de códigos.
 * No correr en paralelo con las otras e2e (comparten la cuenta cliente).
 *
 * Cubre: `fijar_reparto_flete` rechaza suma ≠ 1, expedientes ajenos y grupos
 * incompletos, y acepta 0.6/0.4; `registrar_zarpe_arribo` deja un evento
 * visible en los DOS expedientes del contenedor y actualiza sus fechas
 * estimadas; el cliente no ejecuta ninguna de las dos ni lee `notificaciones`,
 * pero sí ve las fechas por `embarque_cliente`; `verificar_banco_contraparte`
 * exige datos bancarios y el trigger borra la verificación al cambiarlos.
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
const CLIENTE_USER = "4f5d4d01-ff56-44c2-97be-54019aff4973"; // cuenta cliente existente, dueña del primer expediente

let clienteId = "";
let clienteBId = "";
let embarqueId = "";
let forwarderId = "";
let expA = "";
let expB = "";
let seqExpAntes = 0;
let seqEmbAntes = 0;

async function seq(nombre: string): Promise<number> {
  const [r] = (await sql.query(`select last_value::int as last_value, is_called from public.${nombre}`)) as unknown as { last_value: number; is_called: boolean }[];
  return r.is_called ? r.last_value : r.last_value - 1;
}
async function reponer(nombre: string, antes: number) {
  const ahora = await seq(nombre);
  if (ahora !== antes + 1 && ahora !== antes + 2) return;
  if (antes === 0) await sql.query(`select setval('public.${nombre}', 1, false)`);
  else await sql.query(`select setval('public.${nombre}', ${antes}, true)`);
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

describe.skipIf(!ACTIVA)("fase 4 de punta a punta (base real)", () => {
  beforeAll(async () => {
    seqExpAntes = await seq("expediente_numero_seq");
    seqEmbAntes = await seq("embarque_numero_seq");
    const [c] = (await sql`
      insert into public.clientes (tipo, razon_social, ruc, domicilio, representante, email, telefono, user_id)
      values ('empresa', 'PRUEBA FASE 4 S.A.C.', '20999999994', 'Calle Prueba 123, Lima', 'Ana Prueba', 'prueba-fase4@luxcars.test', '+51 999 999 999', ${CLIENTE_USER}::uuid)
      returning id
    `) as unknown as { id: string }[];
    clienteId = c.id;
    const [cb] = (await sql`
      insert into public.clientes (tipo, razon_social, ruc, domicilio, representante, email)
      values ('empresa', 'PRUEBA FASE 4 B S.A.C.', '20999999995', 'Av. Prueba 456, Lima', 'Luis Prueba', 'prueba-fase4b@luxcars.test')
      returning id
    `) as unknown as { id: string }[];
    clienteBId = cb.id;
    const [f] = (await sql`
      insert into public.contrapartes (tipo, nombre, pais, email, datos_bancarios)
      values ('forwarder', 'Example Logistics Inc.', 'Canadá', 'ops@example.test', '{"banco":"RBC","titular":"Example Logistics Inc.","cuenta":"1234567","swift":"ROYCCAT2","moneda":"CAD"}'::jsonb)
      returning id
    `) as unknown as { id: string }[];
    forwarderId = f.id;
    const [b] = (await sql`
      insert into public.embarques (modalidad, contenedor, forwarder_id, puerto_origen, fecha_zarpe_est, fecha_arribo_est)
      values ('consolidado', 'c40hc', ${forwarderId}::uuid, 'Vancouver', '2026-12-10', '2027-01-05')
      returning id
    `) as unknown as { id: string }[];
    embarqueId = b.id;
    const [a] = (await sql`
      insert into public.expedientes (cliente_id, etapa, embarque_id, proporcion_flete, veh_marca, veh_modelo, veh_anio, veh_vin, veh_condicion, veh_categoria, veh_origen, fecha_est_arribo)
      values (${clienteId}::uuid, 'embarque', ${embarqueId}::uuid, 0.5, 'Toyota', 'Tundra', 2026, '5TFPC5DB1RX000001', 'nuevo', 'hev', 'otro', '2027-01-05')
      returning id
    `) as unknown as { id: string }[];
    expA = a.id;
    const [bb] = (await sql`
      insert into public.expedientes (cliente_id, etapa, embarque_id, proporcion_flete, veh_marca, veh_modelo, veh_anio, veh_vin, veh_condicion, veh_categoria, veh_origen)
      values (${clienteBId}::uuid, 'embarque', ${embarqueId}::uuid, 0.5, 'Ford', 'F-150', 2026, '1FTFW1E80RF000002', 'nuevo', 'gasolina', 'originario-usa')
      returning id
    `) as unknown as { id: string }[];
    expB = bb.id;
  }, 60_000);

  afterAll(async () => {
    if (expA) await sql`delete from public.expedientes where id = ${expA}::uuid`;
    if (expB) await sql`delete from public.expedientes where id = ${expB}::uuid`;
    if (embarqueId) await sql`delete from public.embarques where id = ${embarqueId}::uuid`;
    if (clienteId) await sql`delete from public.clientes where id = ${clienteId}::uuid`;
    if (clienteBId) await sql`delete from public.clientes where id = ${clienteBId}::uuid`;
    if (forwarderId) await sql`delete from public.contrapartes where id = ${forwarderId}::uuid`;
    await reponer("expediente_numero_seq", seqExpAntes);
    await reponer("embarque_numero_seq", seqEmbAntes);
  }, 60_000);

  it("fijar_reparto_flete valida suma, pertenencia y grupo completo; luego actualiza", async () => {
    await expect(sql`select public.fijar_reparto_flete(${embarqueId}::uuid, ${JSON.stringify([{ expediente_id: expA, proporcion: 0.6 }, { expediente_id: expB, proporcion: 0.3 }])}::jsonb)`).rejects.toThrow(/sumar 1/);
    await expect(sql`select public.fijar_reparto_flete(${embarqueId}::uuid, ${JSON.stringify([{ expediente_id: expA, proporcion: 1 }])}::jsonb)`).rejects.toThrow(/incluir los 2 expedientes/);
    await expect(sql`select public.fijar_reparto_flete(${embarqueId}::uuid, ${JSON.stringify([{ expediente_id: expA, proporcion: 0.5 }, { expediente_id: "00000000-0000-0000-0000-000000000000", proporcion: 0.5 }])}::jsonb)`).rejects.toThrow(/no pertenece/);
    const [{ n }] = (await sql`select public.fijar_reparto_flete(${embarqueId}::uuid, ${JSON.stringify([{ expediente_id: expA, proporcion: 0.6 }, { expediente_id: expB, proporcion: 0.4 }])}::jsonb) as n`) as unknown as { n: number }[];
    expect(n).toBe(2);
    const filas = (await sql`select id, proporcion_flete::float8 as p from public.expedientes where embarque_id = ${embarqueId}::uuid order by codigo`) as unknown as { id: string; p: number }[];
    expect(Object.fromEntries(filas.map((f) => [f.id, f.p]))).toEqual({ [expA]: 0.6, [expB]: 0.4 });
  }, 60_000);

  it("el cliente no fija reparto ni registra zarpe, y no lee notificaciones", async () => {
    await expect(comoUsuario(CLIENTE_USER, (tx) => tx`select public.fijar_reparto_flete(${embarqueId}::uuid, '[]'::jsonb)`)).rejects.toThrow(/administrador/);
    await expect(comoUsuario(CLIENTE_USER, (tx) => tx`select public.registrar_zarpe_arribo(${embarqueId}::uuid, '{"fecha_zarpe_real":"2026-12-11"}'::jsonb, null)`)).rejects.toThrow(/administrador/);
    const notas = await comoUsuario(CLIENTE_USER, (tx) => tx`select id from public.notificaciones`);
    expect(notas).toEqual([]);
    await expect(comoUsuario(CLIENTE_USER, (tx) => tx`insert into public.notificaciones (expediente_id, canal, plantilla, estado) values (${expA}::uuid, 'email', 'x', 'preparada')`)).rejects.toThrow(/row-level security|permission denied/i);
  }, 60_000);

  it("registrar_zarpe_arribo deja evento visible en los dos expedientes, actualiza fechas y devuelve 2", async () => {
    const [{ n }] = (await sql`select public.registrar_zarpe_arribo(${embarqueId}::uuid, ${JSON.stringify({ fecha_zarpe_real: "2026-12-11", fecha_arribo_est: "2027-01-07", nave: "MSC Prueba", master_bl: "MSCUAB123456" })}::jsonb, ${ADMIN}::uuid) as n`) as unknown as { n: number }[];
    expect(n).toBe(2);
    const [b] = (await sql`select fecha_zarpe_real::text as z, fecha_arribo_est::text as a, nave, master_bl, estado from public.embarques where id = ${embarqueId}::uuid`) as unknown as Record<string, unknown>[];
    expect(b).toMatchObject({ z: "2026-12-11", a: "2027-01-07", nave: "MSC Prueba", master_bl: "MSCUAB123456", estado: "en_transito" });
    const exps = (await sql`select id, fecha_est_embarque::text as e, fecha_est_arribo::text as a from public.expedientes where embarque_id = ${embarqueId}::uuid`) as unknown as { id: string; e: string; a: string }[];
    for (const x of exps) expect(x).toMatchObject({ e: "2026-12-11", a: "2027-01-07" });
    const eventos = (await sql`select expediente_id, titulo, detalle, visible_cliente from public.expediente_eventos where expediente_id in (${expA}::uuid, ${expB}::uuid) and tipo = 'hito' order by expediente_id`) as unknown as { expediente_id: string; titulo: string; detalle: string; visible_cliente: boolean }[];
    expect(eventos).toHaveLength(2);
    expect(new Set(eventos.map((e) => e.expediente_id))).toEqual(new Set([expA, expB]));
    for (const e of eventos) {
      expect(e).toMatchObject({ titulo: "Zarpó de Vancouver", visible_cliente: true });
      expect(e.detalle).toContain("11/12/2026");
      expect(e.detalle).toContain("MSC Prueba");
      expect(e.detalle).toContain("07/01/2027");
    }
    // Repetir la misma fecha no duplica el evento; el arribo real sí agrega uno.
    await sql`select public.registrar_zarpe_arribo(${embarqueId}::uuid, '{"fecha_zarpe_real":"2026-12-11"}'::jsonb, ${ADMIN}::uuid)`;
    await expect(sql`select public.registrar_zarpe_arribo(${embarqueId}::uuid, '{"fecha_zarpe_real":"2026-12-11","fecha_arribo_real":"2026-12-01"}'::jsonb, ${ADMIN}::uuid)`).rejects.toThrow(/anterior al zarpe/);
    await sql`select public.registrar_zarpe_arribo(${embarqueId}::uuid, '{"fecha_arribo_real":"2027-01-06"}'::jsonb, ${ADMIN}::uuid)`;
    const titulos = (await sql`select titulo from public.expediente_eventos where expediente_id = ${expA}::uuid and tipo = 'hito' order by created_at`) as unknown as { titulo: string }[];
    expect(titulos.map((t) => t.titulo)).toEqual(["Zarpó de Vancouver", "Arribó al Callao"]);

    // El cliente ve las fechas por la vista, no la tabla base.
    const vista = await comoUsuario(CLIENTE_USER, (tx) => tx`select nave, master_bl, fecha_zarpe_real::text as z from public.embarque_cliente where expediente_id = ${expA}::uuid`);
    expect(vista).toEqual([{ nave: "MSC Prueba", master_bl: "MSCUAB123456", z: "2026-12-11" }]);
    const ajeno = await comoUsuario(CLIENTE_USER, (tx) => tx`select id from public.embarque_cliente where expediente_id = ${expB}::uuid`);
    expect(ajeno).toEqual([]);
  }, 60_000);

  it("verificar_banco_contraparte exige datos bancarios y el trigger borra la verificación al cambiarlos", async () => {
    // Como admin por la Data API (uid_sesion() pone al verificador).
    await comoUsuario(ADMIN, (tx) => tx`select public.verificar_banco_contraparte(${forwarderId}::uuid, true)`);
    const [c] = (await sql`select banco_verificado_en, banco_verificado_por from public.contrapartes where id = ${forwarderId}::uuid`) as unknown as { banco_verificado_en: Date | null; banco_verificado_por: string | null }[];
    expect(c.banco_verificado_en).not.toBeNull();
    expect(c.banco_verificado_por).toBe(ADMIN);
    await expect(comoUsuario(CLIENTE_USER, (tx) => tx`select public.verificar_banco_contraparte(${forwarderId}::uuid, true)`)).rejects.toThrow(/administrador/);
    await sql`update public.contrapartes set datos_bancarios = '{"banco":"TD","cuenta":"999"}'::jsonb where id = ${forwarderId}::uuid`;
    const [d] = (await sql`select banco_verificado_en from public.contrapartes where id = ${forwarderId}::uuid`) as unknown as { banco_verificado_en: Date | null }[];
    expect(d.banco_verificado_en).toBeNull();
    await sql`update public.contrapartes set datos_bancarios = null where id = ${forwarderId}::uuid`;
    await expect(comoUsuario(ADMIN, (tx) => tx`select public.verificar_banco_contraparte(${forwarderId}::uuid, true)`)).rejects.toThrow(/no tiene datos bancarios/);
  }, 60_000);

  it("las plantillas del servidor se registran en notificaciones (fallida sin RESEND_API_KEY, preparada en WhatsApp)", async () => {
    const guardada = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    try {
      const { cargarContextoServidor } = await import("@/lib/expedientes/servidor/contexto");
      const { notificarCliente } = await import("@/lib/expedientes/servidor/notificar");
      const ctx = (await cargarContextoServidor(expA))!;
      const correo = await notificarCliente(ctx, { plantilla: "etapa_alcanzada", canal: "email", datos: {}, actorId: ADMIN });
      expect(correo.ok).toBe(false);
      expect(correo.estado).toBe("fallida");
      expect(correo.error).toMatch(/RESEND_API_KEY/);
      expect(correo.notificacion.texto).toContain(ctx.expediente.codigo);
      const wa = await notificarCliente(ctx, { plantilla: "auto_listo", canal: "whatsapp", datos: { lugar: "San Isidro" }, actorId: ADMIN });
      expect(wa.ok).toBe(true);
      expect(wa.estado).toBe("preparada");
      expect(wa.enlaceWhatsApp).toMatch(/^https:\/\/wa\.me\/51999999999\?text=/);
      const filas = (await sql`select canal, plantilla, estado, destinatario, error, created_by from public.notificaciones where expediente_id = ${expA}::uuid order by created_at`) as unknown as Record<string, unknown>[];
      expect(filas).toEqual([
        { canal: "email", plantilla: "etapa_alcanzada", estado: "fallida", destinatario: "prueba-fase4@luxcars.test", error: expect.stringMatching(/RESEND_API_KEY/), created_by: ADMIN },
        { canal: "whatsapp", plantilla: "auto_listo", estado: "preparada", destinatario: "+51999999999", error: null, created_by: ADMIN },
      ]);
    } finally {
      if (guardada !== undefined) process.env.RESEND_API_KEY = guardada;
    }
  }, 60_000);
});
