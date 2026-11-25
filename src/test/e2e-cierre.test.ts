/**
 * Prueba de punta a punta de la fase 5 (cierre operativo) contra la base REAL
 * (lee .env.local). En `npm test` queda SALTADA; se corre a mano con
 *   E2E_EXPEDIENTES=1 npx vitest run src/test/e2e-cierre.test.ts
 * y borra todo lo que crea al final, reponiendo la secuencia de códigos.
 * No correr en paralelo con las otras e2e (comparten la cuenta cliente).
 *
 * Cubre: convertir una solicitud de compra en expediente con
 * `crear_expediente` deja `origen_solicitud_id`, cierra la solicitud y escribe
 * la respuesta con el código; el cliente lee esa respuesta y ve el expediente
 * por `expediente_cliente` (vista reescrita con sub-consulta); el admin lee la
 * tabla base con la política `(select es_admin())`; `avanzar_expediente` a
 * `cancelado` fija `cerrado_en`; los índices nuevos existen.
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
const ADMIN = "c3939210-9184-4e18-8ed3-7d2ce7612a64"; // perfil admin existente
const CLIENTE_USER = "4f5d4d01-ff56-44c2-97be-54019aff4973"; // cuenta cliente existente

let clienteId = "";
let solicitudId = "";
let expedienteId = "";
let seqAntes = 0;

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

describe.skipIf(!ACTIVA)("fase 5 de punta a punta (base real)", () => {
  beforeAll(async () => {
    seqAntes = await seq("expediente_numero_seq");
    const [c] = (await sql`
      insert into public.clientes (tipo, razon_social, dni, domicilio, email, telefono, user_id)
      values ('persona', 'Prueba Fase Cinco', '09999995', 'Calle Prueba 123, Lima', 'prueba-fase5@luxcars.test', '+51 999 999 995', ${CLIENTE_USER}::uuid)
      returning id
    `) as unknown as { id: string }[];
    clienteId = c.id;
    const [s] = (await sql`
      insert into public.solicitudes_compra (user_id, marca, modelo, anio_min, anio_max, condicion, presupuesto_max_usd, notas, estado, respuesta_luxcars)
      values (${CLIENTE_USER}::uuid, 'Toyota', 'Sequoia', 2025, 2026, 'nuevo', 91000, 'TRD Pro, color verde', 'en_busqueda', 'Estamos buscando opciones.')
      returning id
    `) as unknown as { id: string }[];
    solicitudId = s.id;
  }, 60_000);

  afterAll(async () => {
    if (expedienteId) await sql`delete from public.expedientes where id = ${expedienteId}::uuid`;
    if (solicitudId) await sql`delete from public.solicitudes_compra where id = ${solicitudId}::uuid`;
    if (clienteId) await sql`delete from public.clientes where id = ${clienteId}::uuid`;
    await reponer("expediente_numero_seq", seqAntes);
  }, 60_000);

  it("crear_expediente desde la solicitud la enlaza, la cierra y le deja la respuesta con el código", async () => {
    const datos = {
      cliente_id: clienteId,
      etapa: "contrato",
      origen_solicitud_id: solicitudId,
      veh_marca: "Toyota",
      veh_modelo: "Sequoia",
      veh_anio: 2026,
      veh_condicion: "nuevo",
      veh_categoria: "hev",
      precio_tope: 91000,
      notas_internas: "Desde la solicitud de compra.",
      hitos: [],
      tareas: [],
    };
    const [{ id }] = (await comoUsuario(ADMIN, (tx) => tx`select public.crear_expediente(${JSON.stringify(datos)}::jsonb) as id`)) as { id: string }[];
    expedienteId = id;

    const [e] = (await sql`select codigo, origen_solicitud_id, cerrado_en from public.expedientes where id = ${id}::uuid`) as unknown as { codigo: string; origen_solicitud_id: string; cerrado_en: string | null }[];
    expect(e.origen_solicitud_id).toBe(solicitudId);
    expect(e.cerrado_en).toBeNull();

    const [s] = (await sql`select estado, respuesta_luxcars, atendido_por from public.solicitudes_compra where id = ${solicitudId}::uuid`) as unknown as { estado: string; respuesta_luxcars: string; atendido_por: string }[];
    expect(s.estado).toBe("cerrada");
    expect(s.respuesta_luxcars).toContain("Estamos buscando opciones.");
    expect(s.respuesta_luxcars).toContain(e.codigo);
    expect(s.atendido_por).toBe(ADMIN);

    // Repetir el enlace no duplica el texto (idempotencia del trigger).
    await sql`update public.expedientes set origen_solicitud_id = null where id = ${id}::uuid`;
    await sql`update public.expedientes set origen_solicitud_id = ${solicitudId}::uuid where id = ${id}::uuid`;
    const [s2] = (await sql`select respuesta_luxcars from public.solicitudes_compra where id = ${solicitudId}::uuid`) as unknown as { respuesta_luxcars: string }[];
    expect(s2.respuesta_luxcars.split(e.codigo).length).toBe(2);
  }, 60_000);

  it("el cliente lee la respuesta de su solicitud y ve el expediente por la vista reescrita; el admin lee la tabla base", async () => {
    const mias = await comoUsuario(CLIENTE_USER, (tx) => tx`select estado, respuesta_luxcars from public.solicitudes_compra where id = ${solicitudId}::uuid`);
    expect(mias).toHaveLength(1);
    expect(mias[0].estado).toBe("cerrada");

    const vista = await comoUsuario(CLIENTE_USER, (tx) => tx`select id, codigo, etapa from public.expediente_cliente where id = ${expedienteId}::uuid`);
    expect(vista).toHaveLength(1);
    expect(vista[0].etapa).toBe("contrato");

    const base = await comoUsuario(CLIENTE_USER, (tx) => tx`select id from public.expedientes where id = ${expedienteId}::uuid`);
    expect(base).toEqual([]);

    const admin = await comoUsuario(ADMIN, (tx) => tx`select id, origen_solicitud_id from public.expedientes where origen_solicitud_id = ${solicitudId}::uuid`);
    expect(admin).toHaveLength(1);

    const etapasAdmin = await comoUsuario(ADMIN, (tx) => tx`select etapa from public.expediente_etapas where expediente_id = ${expedienteId}::uuid`);
    expect(etapasAdmin.map((r) => r.etapa)).toEqual(["contrato"]);
  }, 60_000);

  it("cancelar fija cerrado_en y el expediente sale del tablero y entra al archivo", async () => {
    await comoUsuario(ADMIN, (tx) => tx`select public.avanzar_expediente(${expedienteId}::uuid, 'cancelado', '[]'::jsonb, true, 'Prueba de cierre: el cliente desistió')`);
    const [e] = (await sql`select etapa, cerrado_en, cancelado_motivo from public.expedientes where id = ${expedienteId}::uuid`) as unknown as { etapa: string; cerrado_en: string | null; cancelado_motivo: string }[];
    expect(e.etapa).toBe("cancelado");
    expect(e.cerrado_en).not.toBeNull();
    expect(e.cancelado_motivo).toMatch(/desistió/);

    const activos = await comoUsuario(ADMIN, (tx) => tx`select id from public.expedientes where id = ${expedienteId}::uuid and etapa not in ('cerrado','cancelado')`);
    expect(activos).toEqual([]);
    const archivo = await comoUsuario(ADMIN, (tx) => tx`select id from public.expedientes where id = ${expedienteId}::uuid and etapa in ('cerrado','cancelado') and cerrado_en >= date_trunc('year', now())`);
    expect(archivo).toHaveLength(1);
  }, 60_000);

  it("los índices y la política reescrita de la migración de cierre están aplicados", async () => {
    const idx = (await sql`select indexname from pg_indexes where schemaname = 'public' and indexname in ('expedientes_activos_idx','expedientes_cerrado_en_idx','expedientes_origen_solicitud_idx','expediente_movimientos_fecha_idx') order by 1`) as unknown as { indexname: string }[];
    expect(idx.map((i) => i.indexname)).toEqual(["expediente_movimientos_fecha_idx", "expedientes_activos_idx", "expedientes_cerrado_en_idx", "expedientes_origen_solicitud_idx"]);
    const [pol] = (await sql`select qual from pg_policies where schemaname = 'public' and tablename = 'expedientes' and policyname = 'expedientes: el equipo lee'`) as unknown as { qual: string }[];
    expect(pol.qual).toMatch(/SELECT es_admin\(\)/);
    const [vista] = (await sql`select pg_get_viewdef('public.expediente_cliente'::regclass) as def`) as unknown as { def: string }[];
    expect(vista.def).not.toMatch(/es_dueno_expediente/);
    expect(vista.def).toMatch(/clientes c/);
  }, 60_000);
});
