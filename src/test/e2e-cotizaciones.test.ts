/**
 * Prueba de punta a punta de las cotizaciones contra la base REAL (lee
 * .env.local). En `npm test` queda SALTADA; se corre a mano con
 *   E2E_COTIZACIONES=1 npx vitest run src/test/e2e-cotizaciones.test.ts
 * y borra todo lo que crea al final, reponiendo el correlativo de
 * cotizaciones y las secuencias de expedientes y embarques. Cifras y empresas
 * inventadas. No correr en paralelo con las otras e2e (comparten la cuenta cliente).
 *
 * Cubre: `guardar_cotizacion` asigna el siguiente COT-AAAA-NNN y solo edita
 * en borrador; los importadores pueden quedar pendientes (sin razón social ni
 * RUC) hasta aceptar: `clientes_de_cotizacion` lo rechaza y
 * `completar_importadores_cotizacion` los fija ya enviada, sin tocar cifras;
 * `cambiar_estado_cotizacion` exige PDF para enviar y fija la
 * vigencia de 15 días; el cliente ve la cotización por `cotizacion_cliente`
 * (correo de su cuenta) y otro usuario no; `clientes_de_cotizacion` crea una
 * ficha por importador; `aceptar_cotizacion` abre un expediente por auto, en
 * búsqueda, con el presupuesto y los hitos de la cotización, enlazados en los
 * dos sentidos y en un mismo embarque consolidado; no se acepta dos veces.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { neon, type NeonQueryFunctionInTransaction, type NeonQueryInTransaction } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { calcularCotizacion, type DatosCotizacion } from "@/core/cotizaciones";
import { datosExpedienteDesdeCotizacion } from "@/lib/cotizaciones/aExpediente";
import type { ClienteRow } from "@/lib/db/types";
import { mapCliente } from "@/lib/expedientes/mapeo";

const ACTIVA = process.env.E2E_COTIZACIONES === "1";

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
const ADMIN = "c3939210-9184-4e18-8ed3-7d2ce7612a64"; // perfil admin existente
const CLIENTE_USER = "4f5d4d01-ff56-44c2-97be-54019aff4973"; // cuenta cliente existente
const RUC_1 = "20999990361";
const RUC_2 = "20999990362";

const claims = (sub: string) => JSON.stringify({ sub, role: "authenticated" });
type Tx = NeonQueryFunctionInTransaction<false, false>;
async function comoUsuario(sub: string, consulta: (tx: Tx) => NeonQueryInTransaction) {
  const r = await sql.transaction((tx) => [
    tx`set local role authenticated`,
    tx`select set_config('request.jwt.claims', ${claims(sub)}, true)`,
    consulta(tx),
  ]);
  return r[2] as unknown as Record<string, unknown>[];
}

async function seq(nombre: string): Promise<number> {
  const [r] = (await sql.query(`select last_value::int as last_value, is_called from public.${nombre}`)) as unknown as { last_value: number; is_called: boolean }[];
  return r.is_called ? r.last_value : r.last_value - 1;
}
async function reponer(nombre: string, antes: number) {
  if (antes === 0) await sql.query(`select setval('public.${nombre}', 1, false)`);
  else await sql.query(`select setval('public.${nombre}', ${antes}, true)`);
}

const IMPORTADORES = [
  { tipo: "empresa", nombre: "Prueba Uno E2E S.A.C.", documento: RUC_1, email: "uno-e2e@luxcars.test", telefono: "" },
  { tipo: "empresa", nombre: "Prueba Dos E2E S.A.C.", documento: RUC_2, email: "dos-e2e@luxcars.test", telefono: "" },
] as const;

const datos: DatosCotizacion = {
  autos: [
    // Importadores pendientes: la razón social y el RUC se completan al aceptar.
    { marca: "Marca", modelo: "Alfa Sport", anio: 2026, color: "Gris", condicion: "nuevo", propulsion: "gasolina", origen: "originario-usa", precio: 50000, clase: "M1", importador: { tipo: "empresa", nombre: "", documento: "", email: "", telefono: "" } },
    { marca: "Otra", modelo: "Beta Hybrid", anio: 2026, color: "", condicion: "nuevo", propulsion: "hev", origen: "originario-usa", precio: 60000, clase: "M1", importador: { tipo: "empresa", nombre: "", documento: "", email: "", telefono: "" } },
  ],
  costos: { flete: 4000, seguro: 600, gastosAduana: 3000, honorarios: 12000 },
  reparto: { modo: "iguales" },
};

let correlativoAntes = 0;
let seqExpAntes = 0;
let seqEmbAntes = 0;
let correoCliente = "";
let cotizacionId = "";
let expedienteIds: string[] = [];
let embarqueId: string | null = null;
let clientesCreados: string[] = [];

describe.skipIf(!ACTIVA)("cotizaciones de punta a punta (base real)", () => {
  beforeAll(async () => {
    const [k] = (await sql`select ultimo from public.cotizacion_correlativos where anio = extract(year from (now() at time zone 'America/Lima'))::int`) as unknown as { ultimo: number }[];
    correlativoAntes = k?.ultimo ?? 0;
    seqExpAntes = await seq("expediente_numero_seq");
    seqEmbAntes = await seq("embarque_numero_seq");
    const [p] = (await sql`select email from public.profiles where id = ${CLIENTE_USER}::uuid`) as unknown as { email: string }[];
    correoCliente = p.email;
    const previos = (await sql`select id from public.clientes where ruc in (${RUC_1}, ${RUC_2})`) as unknown as { id: string }[];
    expect(previos).toEqual([]);
  }, 60_000);

  afterAll(async () => {
    for (const id of expedienteIds) await sql`delete from public.expedientes where id = ${id}::uuid`;
    if (embarqueId) await sql`delete from public.embarques where id = ${embarqueId}::uuid`;
    if (cotizacionId) await sql`delete from public.cotizaciones where id = ${cotizacionId}::uuid`;
    for (const id of clientesCreados) await sql`delete from public.clientes where id = ${id}::uuid`;
    await sql`update public.cotizacion_correlativos set ultimo = ${correlativoAntes} where anio = extract(year from (now() at time zone 'America/Lima'))::int`;
    await reponer("expediente_numero_seq", seqExpAntes);
    await reponer("embarque_numero_seq", seqEmbAntes);
  }, 60_000);

  it("guardar_cotizacion asigna el siguiente código y solo un admin la crea", async () => {
    const resultado = calcularCotizacion(datos);
    const payload = {
      cliente_tipo: "persona",
      cliente_nombre: "Contacto de Prueba E2E",
      cliente_documento: "09999036",
      cliente_email: correoCliente,
      cliente_telefono: "+51 999 000 036",
      datos,
      resultado,
      total_usd: resultado.total,
    };
    await expect(comoUsuario(CLIENTE_USER, (tx) => tx`select public.guardar_cotizacion(null, ${JSON.stringify(payload)}::jsonb) as id`)).rejects.toThrow(/administrador/);
    const [{ id }] = (await comoUsuario(ADMIN, (tx) => tx`select public.guardar_cotizacion(null, ${JSON.stringify(payload)}::jsonb) as id`)) as { id: string }[];
    cotizacionId = id;
    const [q] = (await sql`select codigo, estado, total_usd::float as total from public.cotizaciones where id = ${id}::uuid`) as unknown as { codigo: string; estado: string; total: number }[];
    const anio = new Date().getFullYear();
    expect(q.codigo).toBe(`COT-${anio}-${String(correlativoAntes + 1).padStart(3, "0")}`);
    expect(q.estado).toBe("borrador");
    expect(q.total).toBe(resultado.total);
  }, 60_000);

  it("enviar exige el PDF y fija 15 días; ya enviada no se edita; el cliente la ve y otro no", async () => {
    await expect(comoUsuario(ADMIN, (tx) => tx`select public.cambiar_estado_cotizacion(${cotizacionId}::uuid, 'enviada', null)`)).rejects.toThrow(/PDF/);
    await sql`update public.cotizaciones set ruta_pdf = ${`cotizaciones/${cotizacionId}/prueba.pdf`}, documento_version = 1 where id = ${cotizacionId}::uuid`;
    await comoUsuario(ADMIN, (tx) => tx`select public.cambiar_estado_cotizacion(${cotizacionId}::uuid, 'enviada', null)`);
    const [q] = (await sql`select estado, (vence_el - (now() at time zone 'America/Lima')::date) as dias from public.cotizaciones where id = ${cotizacionId}::uuid`) as unknown as { estado: string; dias: number }[];
    expect(q.estado).toBe("enviada");
    expect(q.dias).toBe(15);
    await expect(
      comoUsuario(ADMIN, (tx) => tx`select public.guardar_cotizacion(${cotizacionId}::uuid, ${JSON.stringify({ cliente_tipo: "persona", cliente_nombre: "X Y", datos })}::jsonb)`),
    ).rejects.toThrow(/borrador/);

    const mia = await comoUsuario(CLIENTE_USER, (tx) => tx`select codigo, estado from public.cotizacion_cliente where id = ${cotizacionId}::uuid`);
    expect(mia).toHaveLength(1);
    const ajena = await comoUsuario(ADMIN, (tx) => tx`select codigo from public.cotizacion_cliente where id = ${cotizacionId}::uuid`);
    expect(ajena).toEqual([]);
    const base = await comoUsuario(CLIENTE_USER, (tx) => tx`select id from public.cotizaciones where id = ${cotizacionId}::uuid`);
    expect(base).toEqual([]);
  }, 60_000);

  it("importadores pendientes: no se aceptan hasta completarlos, y se completan ya enviada sin tocar cifras", async () => {
    await expect(comoUsuario(ADMIN, (tx) => tx`select public.clientes_de_cotizacion(${cotizacionId}::uuid)`)).rejects.toThrow(/Falta el nombre|Falta el documento/);
    const [antes] = (await sql`select total_usd::float as total, datos->'costos' as costos from public.cotizaciones where id = ${cotizacionId}::uuid`) as unknown as { total: number; costos: unknown }[];
    await expect(
      comoUsuario(ADMIN, (tx) => tx`select public.completar_importadores_cotizacion(${cotizacionId}::uuid, ${JSON.stringify([{ ...IMPORTADORES[0], documento: "123" }, IMPORTADORES[1]])}::jsonb)`),
    ).rejects.toThrow(/11 dígitos/);
    await comoUsuario(ADMIN, (tx) => tx`select public.completar_importadores_cotizacion(${cotizacionId}::uuid, ${JSON.stringify(IMPORTADORES)}::jsonb)`);
    const [despues] = (await sql`select estado, total_usd::float as total, datos->'costos' as costos, datos->'autos'->1->'importador'->>'documento' as ruc from public.cotizaciones where id = ${cotizacionId}::uuid`) as unknown as { estado: string; total: number; costos: unknown; ruc: string }[];
    expect(despues.estado).toBe("enviada");
    expect(despues.total).toBe(antes.total);
    expect(despues.costos).toEqual(antes.costos);
    expect(despues.ruc).toBe(RUC_2);
  }, 60_000);

  it("aceptar abre un expediente por auto con las cifras de la cotización, en búsqueda y en un embarque", async () => {
    const [{ ids }] = (await comoUsuario(ADMIN, (tx) => tx`select public.clientes_de_cotizacion(${cotizacionId}::uuid) as ids`)) as { ids: string[] }[];
    expect(ids).toHaveLength(2);
    clientesCreados = [...new Set(ids)];
    expect(clientesCreados).toHaveLength(2);
    // Idempotente: la segunda vez encuentra las mismas fichas.
    const [{ ids: otra }] = (await comoUsuario(ADMIN, (tx) => tx`select public.clientes_de_cotizacion(${cotizacionId}::uuid) as ids`)) as { ids: string[] }[];
    expect(otra).toEqual(ids);

    const filas = (await sql`select * from public.clientes where id = any(${ids}::uuid[])`) as unknown as ClienteRow[];
    const resultado = calcularCotizacion(datos);
    const [q] = (await sql`select codigo, datos from public.cotizaciones where id = ${cotizacionId}::uuid`) as unknown as { codigo: string; datos: DatosCotizacion }[];
    const expedientes = q.datos.autos.map((auto, i) =>
      datosExpedienteDesdeCotizacion({
        codigo: q.codigo,
        datos: q.datos,
        auto,
        resultado: resultado.autos[i],
        cliente: mapCliente(filas.find((f) => f.id === ids[i])!),
        opciones: { perfil: "primera-importacion", percepcionEnTributos: false },
      }),
    );
    const [{ creados }] = (await comoUsuario(ADMIN, (tx) => tx`select public.aceptar_cotizacion(${cotizacionId}::uuid, ${JSON.stringify(expedientes)}::jsonb) as creados`)) as { creados: string[] }[];
    expedienteIds = creados;
    expect(creados).toHaveLength(2);

    const exp = (await sql`
      select e.id, e.etapa, e.cotizacion_id, e.cotizacion_auto, e.embarque_id, e.cliente_id, e.proporcion_flete::float as proporcion,
             e.honorarios_usd::float as honorarios, e.presupuesto, b.modalidad
      from public.expedientes e left join public.embarques b on b.id = e.embarque_id
      where e.id = any(${creados}::uuid[]) order by e.cotizacion_auto
    `) as unknown as { id: string; etapa: string; cotizacion_id: string; cotizacion_auto: number; embarque_id: string; cliente_id: string; proporcion: number; honorarios: number; presupuesto: { totalSinPercepcion: number; seguro: number }; modalidad: string }[];
    embarqueId = exp[0].embarque_id;
    expect(exp.map((e) => e.etapa)).toEqual(["busqueda", "busqueda"]);
    expect(exp.map((e) => e.cotizacion_auto)).toEqual([1, 2]);
    expect(exp.every((e) => e.cotizacion_id === cotizacionId)).toBe(true);
    expect(exp[1].embarque_id).toBe(embarqueId);
    expect(exp[0].modalidad).toBe("consolidado");
    expect(exp.map((e) => e.cliente_id)).toEqual(ids);
    expect(exp[0].proporcion).toBe(0.5);
    expect(exp[0].honorarios).toBe(6000);
    expect(exp[0].presupuesto.seguro).toBe(300);
    expect(exp.map((e) => e.presupuesto.totalSinPercepcion)).toEqual(resultado.autos.map((a) => a.total));

    for (const [i, e] of exp.entries()) {
      const hitos = (await sql`select tipo, monto_estimado_usd::float as monto from public.expediente_hitos where expediente_id = ${e.id}::uuid`) as unknown as { tipo: string; monto: number }[];
      const suma = Math.round(hitos.reduce((s, h) => s + h.monto, 0) * 100) / 100;
      expect(suma).toBe(resultado.autos[i].total);
      const h = Object.fromEntries(hitos.map((x) => [x.tipo, x.monto]));
      expect(h.H5).toBe(resultado.autos[i].pagos[3]);
      const tareas = (await sql`select count(*)::int as n from public.expediente_tareas where expediente_id = ${e.id}::uuid and etapa = 'busqueda'`) as unknown as { n: number }[];
      expect(tareas[0].n).toBeGreaterThan(0);
    }

    const [qq] = (await sql`select estado, expediente_ids from public.cotizaciones where id = ${cotizacionId}::uuid`) as unknown as { estado: string; expediente_ids: string[] }[];
    expect(qq.estado).toBe("aceptada");
    expect(qq.expediente_ids).toEqual(creados);

    await expect(comoUsuario(ADMIN, (tx) => tx`select public.aceptar_cotizacion(${cotizacionId}::uuid, ${JSON.stringify(expedientes)}::jsonb)`)).rejects.toThrow(/ya fue aceptada/);
    await expect(comoUsuario(ADMIN, (tx) => tx`select public.cambiar_estado_cotizacion(${cotizacionId}::uuid, 'borrador', null)`)).rejects.toThrow(/aceptada/);
  }, 120_000);
});
