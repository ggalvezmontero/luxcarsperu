/**
 * Prueba de punta a punta de la fase 2 contra la base y el bucket REALES
 * (lee .env.local). En `npm test` queda SALTADA; se corre a mano con
 *   E2E_EXPEDIENTES=1 npx vitest run src/test/e2e-documentos.test.ts
 * y borra todo lo que crea (cliente, expediente, embarque, contraparte,
 * documentos, objetos del bucket) al final, reiniciando la secuencia de
 * códigos como hizo la fase 1.
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
const ADMIN = "c3939210-9184-4e18-8ed3-7d2ce7612a64"; // perfil admin existente (solo como actor del evento)
const CLIENTE_USER = "4f5d4d01-ff56-44c2-97be-54019aff4973"; // cuenta cliente existente, para la vista

let clienteId = "";
let expedienteId = "";
let vendedorId = "";
let embarqueId = "";
let secuenciaAntes = 0;

async function seq(): Promise<{ last_value: number; is_called: boolean }> {
  const [r] = (await sql`select last_value::int as last_value, is_called from public.expediente_numero_seq`) as unknown as { last_value: number; is_called: boolean }[];
  return r;
}

describe.skipIf(!ACTIVA)("fase 2 de punta a punta (base y bucket reales)", () => {
  beforeAll(async () => {
    const antes = await seq();
    secuenciaAntes = antes.is_called ? antes.last_value : antes.last_value - 1;
    const [c] = (await sql`
      insert into public.clientes (tipo, razon_social, ruc, domicilio, partida, representante, representante_dni, representante_cargo, email, telefono, actividad, banco_origen, beneficiario_final, origen_fondos, user_id)
      values ('empresa', 'PRUEBA FASE 2 S.A.C.', '20999999981', 'Calle Prueba 123, Miraflores, Lima', '12345678', 'Ana Prueba', '12345678', 'Gerente general', 'prueba-fase2@luxcars.test', '+51 999 999 999', 'Transporte', 'BCP dólares', 'Ana Prueba, DNI 12345678, 100 %', 'Utilidades', ${CLIENTE_USER}::uuid)
      returning id
    `) as unknown as { id: string }[];
    clienteId = c.id;
    const [v] = (await sql`
      insert into public.contrapartes (tipo, nombre, pais, direccion, contacto, email, telefono)
      values ('vendedor', 'Example Motors Ltd.', 'Canadá', '1234 Kingsway, Vancouver, BC', 'Mark Lee', 'sales@example.test', '+1 604 000 0000')
      returning id
    `) as unknown as { id: string }[];
    vendedorId = v.id;
    const [b] = (await sql`
      insert into public.embarques (modalidad, contenedor, puerto_origen, puerto_destino, fecha_zarpe_est, fecha_arribo_est)
      values ('consolidado', 'c40hc', 'Vancouver', 'Callao', '2027-01-09', '2027-02-10')
      returning id
    `) as unknown as { id: string }[];
    embarqueId = b.id;
    const { entradaPorDefecto, presupuestar } = await import("@/core/expedientes/presupuesto");
    const presupuesto = presupuestar(entradaPorDefecto({ precio: 98500, monedaCompra: "CAD", tcCompraRef: 0.72, vehicleType: "hev", condition: "nuevo", origin: "otro", cylinderCapacityCc: 3445, proporcionFlete: 0.5 }));
    const [e] = (await sql`
      insert into public.expedientes (cliente_id, etapa, embarque_id, proporcion_flete, veh_marca, veh_modelo, veh_version, veh_anio, veh_vin, veh_color, veh_km, veh_cilindrada_cc, veh_condicion, veh_categoria, veh_origen, veh_clase,
        moneda_compra, precio_compra, precio_compra_usd, fecha_limite_compra, pais_origen, puerto_origen, presupuesto, honorarios_usd, honorarios_base_usd, honorarios_igv_usd,
        porcentaje_detraccion, margen_h3, tarifa_custodia_usd, costo_inspeccion_usd, fecha_firma, fecha_limite_h2, fecha_est_embarque, fecha_est_arribo, fecha_est_entrega, semanas_estimadas, loa_vence)
      values (${clienteId}::uuid, 'contrato', ${embarqueId}::uuid, 0.5, 'Toyota', 'Tundra', 'TRD Pro', 2026, '5TFPC5DB1RX000000', 'Blanco', 1200, 3445, 'nuevo', 'hev', 'otro', 'N1',
        'CAD', 98500, 70920, '2026-12-15', 'Canadá', 'Vancouver', ${JSON.stringify(presupuesto)}::jsonb, ${presupuesto.honorarios}, ${presupuesto.honorariosBase}, ${presupuesto.honorariosIgv},
        12, 0, 25, null, '2026-11-28', '2026-12-12', '2027-01-09', '2027-02-10', '2027-03-05', '10 a 14', '2027-02-28')
      returning id
    `) as unknown as { id: string }[];
    expedienteId = e.id;
    // El contrato fija el Pago 2 con el release del vehículo.
    await sql`update public.expedientes set fecha_release = '2026-12-18' where id = ${expedienteId}::uuid`;
    await sql`insert into public.expedientes_reservado (expediente_id, precio_tope, vendedor_id) values (${expedienteId}::uuid, 100000, ${vendedorId}::uuid)`;
    for (const h of presupuesto.hitos) {
      await sql`insert into public.expediente_hitos (expediente_id, tipo, monto_estimado_usd, cuenta) values (${expedienteId}::uuid, ${h.tipo}::public.tipo_hito, ${h.montoUsd}, ${h.cuenta}::public.cuenta_movimiento)`;
    }
    await sql`insert into public.expediente_tareas (expediente_id, etapa, clave, titulo, responsable) values
      (${expedienteId}::uuid, 'contrato', 'luxcars.generar_contrato', 'Generar contrato, anexos A a D, LOA y poder para la inmatriculación', 'luxcars'),
      (${expedienteId}::uuid, 'contrato', 'cliente.firmar_contrato_loa', 'Firmar el contrato y la LOA en notaría', 'cliente')`;
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
    if (embarqueId) await sql`delete from public.embarques where id = ${embarqueId}::uuid`;
    // La secuencia como estaba: si nadie más la usó, vuelve al valor previo.
    const despues = await seq();
    const ultimoUsado = despues.is_called ? despues.last_value : despues.last_value - 1;
    if (ultimoUsado === secuenciaAntes + 1) {
      if (secuenciaAntes === 0) await sql`select setval('public.expediente_numero_seq', 1, false)`;
      else await sql`select setval('public.expediente_numero_seq', ${secuenciaAntes}, true)`;
    }
  }, 60_000);

  it("genera el contrato (PDF y DOCX reales en el bucket privado), lo registra y completa la tarea", async () => {
    const { cargarContextoServidor } = await import("@/lib/expedientes/servidor/contexto");
    const { construirDocumento, plantillaDe } = await import("@/core/expedientes/documentos");
    const { renderPdf } = await import("@/lib/expedientes/documentos/renderPdf");
    const { renderDocx } = await import("@/lib/expedientes/documentos/renderDocx");
    const { EXPEDIENTES_BUCKET, subirObjeto, firmarDescarga, existeObjeto } = await import("@/lib/portal/objectStorage");

    const ctx = await cargarContextoServidor(expedienteId);
    expect(ctx).not.toBeNull();
    expect(ctx!.contrapartes?.map((c) => c.nombre)).toEqual(["Example Motors Ltd."]);

    const fijos = {
      LUXCARS_RUC: "20600000001", LUXCARS_DOMICILIO: "Calle Prueba 184, San Isidro, Lima", LUXCARS_PARTIDA: "14000000", LUXCARS_REPRESENTANTE: "Representante Prueba", LUXCARS_REP_DNI: "40000000",
      LUXCARS_CORREO: "info@luxcars.pe", LUXCARS_TELEFONO: "+51 980 794 348", CTA_FONDOS_BANCO: "BCP", CTA_FONDOS_NUMERO: "2", CTA_FONDOS_CCI: "2", CTA_DETRACCION_NUMERO: "3",
      PORCENTAJE_DETRACCION: "10", CIUDAD_FIRMA: "Lima", DIAS_ESPERA_MAX: "15",
    };
    const plantilla = plantillaDe("contrato")!;
    // Sin los parámetros de la empresa el contrato no se emite (regla "sin rayas").
    const sinEmpresa = construirDocumento(plantilla, ctx!, {});
    expect(sinEmpresa.faltantes).toEqual(expect.arrayContaining(["LUXCARS_RUC", "LUXCARS_REP_DNI", "CIUDAD_FIRMA"]));
    // Con ellos como porDefecto, sale completo; la clase N1 llega de la columna nueva.
    const doc = construirDocumento(plantilla, ctx!, {}, fijos);
    expect(doc.faltantes).toEqual([]);
    expect(ctx!.expediente.vehiculo.clase).toBe("N1");
    expect(construirDocumento(plantillaDe("anexo_a")!, ctx!, {}, fijos).campos.VEH_CATEGORIA).toBe("N1");
    // El loader del servidor trae las unidades del embarque (acá solo esta).
    expect(ctx!.unidadesDelEmbarque?.map((u) => u.id)).toEqual([expedienteId]);

    const [pdf, docx] = await Promise.all([renderPdf(doc.estructura), renderDocx(doc.estructura)]);
    const rutaPdf = `expedientes/${expedienteId}/documentos/prueba-v1.pdf`;
    const rutaDocx = `expedientes/${expedienteId}/documentos/prueba-v1.docx`;
    expect(await subirObjeto(EXPEDIENTES_BUCKET, rutaPdf, pdf, "application/pdf")).toBe(true);
    expect(await subirObjeto(EXPEDIENTES_BUCKET, rutaDocx, docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(await existeObjeto(EXPEDIENTES_BUCKET, rutaPdf)).toBe(true);

    // Privado de verdad: sin firma, 403; con URL firmada, el PDF completo.
    const endpoint = process.env.NEXT_PUBLIC_NEON_STORAGE_URL!.replace(/\/+$/, "");
    const sinFirma = await fetch(`${endpoint}/${EXPEDIENTES_BUCKET}/${rutaPdf}`);
    expect([401, 403]).toContain(sinFirma.status);
    const firmada = await firmarDescarga(EXPEDIENTES_BUCKET, rutaPdf, 120, "LC-prueba-contrato-v1.pdf");
    const bajada = await fetch(firmada!);
    expect(bajada.status).toBe(200);
    const bytes = new Uint8Array(await bajada.arrayBuffer());
    expect(bytes.byteLength).toBe(pdf.byteLength);
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");

    const [{ r }] = (await sql`
      select public.registrar_documento(${expedienteId}::uuid, 'contrato', ${"Contrato de mandato · prueba"}, ${plantilla.version}, ${JSON.stringify(doc.campos)}::jsonb, ${rutaPdf}, ${rutaDocx}, 'luxcars.generar_contrato', ${ADMIN}::uuid, false) as r
    `) as unknown as { r: { id: string; version: number } }[];
    expect(r.version).toBe(1);

    const [tarea] = (await sql`select estado, documento_id from public.expediente_tareas where expediente_id = ${expedienteId}::uuid and clave = 'luxcars.generar_contrato'`) as unknown as { estado: string; documento_id: string }[];
    expect(tarea.estado).toBe("hecha");
    expect(tarea.documento_id).toBe(r.id);
    const eventos = (await sql`select titulo, visible_cliente from public.expediente_eventos where expediente_id = ${expedienteId}::uuid order by created_at`) as unknown as { titulo: string; visible_cliente: boolean }[];
    expect(eventos.map((e) => e.titulo)).toEqual(["Documento generado: Contrato de mandato · prueba", "Listo: Generar contrato, anexos A a D, LOA y poder para la inmatriculación"]);

    // Regenerar: versión 2, la 1 queda reemplazada.
    const [{ r: r2 }] = (await sql`
      select public.registrar_documento(${expedienteId}::uuid, 'contrato', ${"Contrato de mandato · prueba"}, ${plantilla.version}, ${JSON.stringify(doc.campos)}::jsonb, ${rutaPdf}, ${rutaDocx}, 'luxcars.generar_contrato', ${ADMIN}::uuid, true) as r
    `) as unknown as { r: { id: string; version: number } }[];
    expect(r2.version).toBe(2);
    const estados = (await sql`select version, estado, visible_cliente from public.expediente_documentos where expediente_id = ${expedienteId}::uuid order by version`) as unknown as { version: number; estado: string; visible_cliente: boolean }[];
    expect(estados).toEqual([{ version: 1, estado: "reemplazado", visible_cliente: false }, { version: 2, estado: "emitido", visible_cliente: true }]);

    // Firmado: sube un "escaneo" (el mismo PDF) y lo marca.
    const rutaFirmado = `expedientes/${expedienteId}/firmados/${r2.id}.pdf`;
    expect(await subirObjeto(EXPEDIENTES_BUCKET, rutaFirmado, pdf, "application/pdf")).toBe(true);
    await sql`select public.marcar_documento_firmado(${r2.id}::uuid, ${rutaFirmado}, '2026-11-28'::date, ${ADMIN}::uuid)`;
    const [firmado] = (await sql`select estado, firmado_en::text as firmado_en, ruta_firmado from public.expediente_documentos where id = ${r2.id}::uuid`) as unknown as { estado: string; firmado_en: string; ruta_firmado: string }[];
    expect(firmado).toEqual({ estado: "firmado", firmado_en: "2026-11-28", ruta_firmado: rutaFirmado });
    // Sobre la reemplazada no se puede.
    await expect(sql`select public.marcar_documento_firmado(${r.id}::uuid, ${rutaFirmado}, null, ${ADMIN}::uuid)`).rejects.toThrow(/reemplazado/);

    // La compuerta de búsqueda con el core: falta la LOA firmada.
    const { evaluarAvance } = await import("@/core/expedientes/avance");
    const ctx2 = (await cargarContextoServidor(expedienteId))!;
    expect(ctx2.documentos.map((d) => [d.tipo, d.version, d.estado, d.tieneFirmado])).toEqual([["contrato", 2, "firmado", true], ["contrato", 1, "reemplazado", false]]);
    // Búsqueda va antes del contrato desde el 27 nov 2026: la compuerta que pide la firma es la de compra.
    const r3 = evaluarAvance(ctx2, "compra");
    expect(r3.faltantes.map((f) => f.clave)).toContain("contrato_firmado");
  }, 120_000);

  it("el cliente dueño ve solo el visible por la vista, sin rutas; otro cliente no ve nada; el rol authenticated no toca la tabla base", async () => {
    const claims = (sub: string) => JSON.stringify({ sub, role: "authenticated" });
    type Tx = NeonQueryFunctionInTransaction<false, false>;
    const comoUsuario = async (sub: string, consulta: (tx: Tx) => NeonQueryInTransaction) => {
      const r = await sql.transaction((tx) => [
        tx`select set_config('request.jwt.claims', ${claims(sub)}, true)`,
        tx`set local role authenticated`,
        consulta(tx),
      ]);
      return r[2] as unknown as Record<string, unknown>[];
    };
    const vista = await comoUsuario(CLIENTE_USER, (tx) => tx`select tipo, version, estado, tiene_firmado, tiene_pdf from public.expediente_documento_cliente where expediente_id = ${expedienteId}::uuid`);
    expect(vista).toEqual([{ tipo: "contrato", version: 2, estado: "firmado", tiene_firmado: true, tiene_pdf: true }]);
    const columnas = (await sql`select column_name from information_schema.columns where table_name = 'expediente_documento_cliente'`) as unknown as { column_name: string }[];
    const nombres = columnas.map((c) => c.column_name);
    for (const prohibida of ["ruta_pdf", "ruta_docx", "ruta_firmado", "campos", "plantilla_version", "emitido_por"]) expect(nombres).not.toContain(prohibida);

    const otro = await comoUsuario("00000000-0000-0000-0000-000000000000", (tx) => tx`select id from public.expediente_documento_cliente where expediente_id = ${expedienteId}::uuid`);
    expect(otro).toEqual([]);
    const base = await comoUsuario(CLIENTE_USER, (tx) => tx`select id from public.expediente_documentos where expediente_id = ${expedienteId}::uuid`);
    expect(base).toEqual([]);
    await expect(comoUsuario(CLIENTE_USER, (tx) => tx`select public.registrar_documento(${expedienteId}::uuid, 'loa', 'x', 'v', '{}'::jsonb, 'a', 'b', null, null, false)`)).rejects.toThrow(/administrador/);

    // La consulta de la ruta del cliente (propiedad + visible) encuentra el firmado.
    const filas = (await sql`
      select d.ruta_firmado, d.ruta_pdf from public.expediente_documentos d
      join public.expedientes e on e.id = d.expediente_id join public.clientes c on c.id = e.cliente_id
      where d.expediente_id = ${expedienteId}::uuid and d.visible_cliente and d.estado <> 'borrador' and e.etapa <> 'prospecto' and c.user_id = ${CLIENTE_USER}::uuid
    `) as unknown as { ruta_firmado: string | null }[];
    expect(filas).toHaveLength(1);
    expect(filas[0].ruta_firmado).toMatch(/\/firmados\//);
  }, 60_000);
});
