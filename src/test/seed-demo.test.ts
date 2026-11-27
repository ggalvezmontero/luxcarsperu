/**
 * EXPEDIENTE DE DEMOSTRACIÓN para las citas con clientes (no es una prueba).
 *
 * Siembra en la base y el bucket REALES un expediente ficticio, completo hasta
 * la etapa "tránsito", a nombre de la cuenta contacto@luxcars.pe, para enseñar la
 * cuenta del cliente en una reunión: avance, documentos firmados, estado de
 * cuenta con constancias, aprobación de la inspección y el botón "Ya transferí"
 * del hito H3. Hace lo mismo que haría el equipo desde el portal, con las
 * mismas funciones SQL y el mismo generador de documentos.
 *
 *   SEED_DEMO=1 npx vitest run src/test/seed-demo.test.ts
 *   SEED_DEMO=1 SEED_DEMO_RESET=1 npx vitest run src/test/seed-demo.test.ts   (borra la demo anterior y la rehace)
 *
 * Queda SALTADO en `npm test`. Requiere `DATABASE_URL` y las credenciales del
 * bucket en `.env.local`, y que exista la cuenta contacto@luxcars.pe en Neon Auth.
 * Todos los datos (empresa, RUC, VIN, dealer, montos de operación) son
 * inventados y se nota: la razón social dice "DEMO".
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { neon, type NeonQueryFunctionInTransaction, type NeonQueryInTransaction } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

const ACTIVA = process.env.SEED_DEMO === "1";

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
const ADMIN = "c3939210-9184-4e18-8ed3-7d2ce7612a64"; // cuenta admin del dueño: actor de lo que "hizo el equipo"
const DEMO_EMAIL = "demo@luxcars.pe"; // correo del CLIENTE ficticio (clave de idempotencia)
const DEMO_CUENTA = "contacto@luxcars.pe"; // cuenta de Neon Auth con la que el dueño entra en las citas

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

type Fila = Record<string, unknown>;
const uno = async (q: Promise<unknown>) => ((await q) as Fila[])[0];

async function completar(expedienteId: string, clave: string, documentoId: string | null = null) {
  const t = await uno(sql`select id from public.expediente_tareas where expediente_id = ${expedienteId}::uuid and clave = ${clave}`);
  if (!t) throw new Error(`No existe la tarea ${clave}`);
  await comoUsuario(ADMIN, (tx) => tx`select public.completar_tarea(${t.id as string}::uuid, ${documentoId}::uuid, 'hecha')`);
}

describe.skipIf(!ACTIVA)("expediente de demostración", () => {
  it("siembra la demo completa hasta tránsito", async () => {
    const { cargarContextoServidor } = await import("@/lib/expedientes/servidor/contexto");
    const { emitirDocumento } = await import("@/lib/expedientes/servidor/emitirDocumento");
    const { camposFijosLuxcars } = await import("@/lib/expedientes/servidor/datosFijos");
    const { plantillaDe } = await import("@/core/expedientes/documentos");
    const { tareasParaEtapa, evaluarAvance } = await import("@/core/expedientes/avance");
    const { tareasAJson } = await import("@/lib/expedientes/consultas");
    const { entradaPorDefecto, presupuestar } = await import("@/core/expedientes/presupuesto");
    const { hitosDesde } = await import("@/core/expedientes/hitos");
    const { EXPEDIENTES_BUCKET, subirObjeto, listarObjetos, borrarObjeto } = await import("@/lib/portal/objectStorage");

    // ── La cuenta demo tiene que existir (la crea el dueño o Neon) ────────────
    const cuenta = await uno(sql`select id from neon_auth."user" where lower(email) = ${DEMO_CUENTA}`);
    expect(cuenta, `No existe la cuenta ${DEMO_CUENTA} en Neon Auth`).toBeTruthy();
    const DEMO_USER = cuenta.id as string;

    // ── Idempotencia: una sola demo ───────────────────────────────────────────
    const previo = await uno(sql`select c.id as cliente_id, e.id as expediente_id from public.clientes c left join public.expedientes e on e.cliente_id = c.id where lower(c.email) = ${DEMO_EMAIL}`);
    if (previo) {
      if (process.env.SEED_DEMO_RESET !== "1") {
        console.log("Ya existe la demo; usa SEED_DEMO_RESET=1 para rehacerla.");
        return;
      }
      if (previo.expediente_id) {
        const objetos = (await listarObjetos(`expedientes/${previo.expediente_id}/`, EXPEDIENTES_BUCKET)) ?? [];
        for (const o of objetos) await borrarObjeto(o.path, EXPEDIENTES_BUCKET);
        const emb = await uno(sql`select embarque_id from public.expedientes where id = ${previo.expediente_id as string}::uuid`);
        await sql`delete from public.expedientes where id = ${previo.expediente_id as string}::uuid`;
        if (emb?.embarque_id) await sql`delete from public.embarques where id = ${emb.embarque_id as string}::uuid`;
      }
      await sql`delete from public.clientes where id = ${previo.cliente_id as string}::uuid`;
      await sql`delete from public.contrapartes where notas = 'DEMO'`;
    }

    // ── Terceros ──────────────────────────────────────────────────────────────
    const vendedor = await uno(sql`
      insert into public.contrapartes (tipo, nombre, pais, direccion, contacto, email, telefono, ruc_o_tax_id, datos_bancarios, banco_verificado_en, banco_verificado_por, notas)
      values ('vendedor', 'Sunrise Toyota of Miami', 'Estados Unidos', '9800 NW 12th St, Doral, FL 33172', 'Daniel Ortega', 'fleet@sunrisetoyota.example', '+1 305 555 0148', '59-1234567',
        '{"banco":"Bank of America","titular":"Sunrise Toyota of Miami LLC","cuenta":"XXXX-4471","aba":"026009593","swift":"BOFAUS3N","moneda":"USD"}'::jsonb, '2026-11-07T15:20:00-05:00', ${ADMIN}::uuid, 'DEMO')
      returning id`);
    const forwarder = await uno(sql`
      insert into public.contrapartes (tipo, nombre, pais, direccion, contacto, email, telefono, notas)
      values ('forwarder', 'Andes Cargo Logistics', 'Estados Unidos', '8700 NW 107th Ave, Miami, FL', 'Karen Ruiz', 'ops@andescargo.example', '+1 305 555 0192', 'DEMO')
      returning id`);
    const agente = await uno(sql`
      insert into public.contrapartes (tipo, nombre, pais, direccion, contacto, email, telefono, ruc_o_tax_id, notas)
      values ('agente_aduana', 'Agencia de Aduana Pacífico S.A.', 'Perú', 'Av. Argentina 2020, Callao', 'Rosa Medina', 'despachos@pacifico.example', '+51 1 555 0120', '20555555551', 'DEMO')
      returning id`);
    const inspector = await uno(sql`
      insert into public.contrapartes (tipo, nombre, pais, contacto, email, telefono, notas)
      values ('inspector', 'Lemon Squad Vehicle Inspections', 'Estados Unidos', 'Mike Carter', 'book@lemonsquad.example', '+1 888 555 0100', 'DEMO')
      returning id`);

    // ── Cliente ───────────────────────────────────────────────────────────────
    const cliente = await uno(sql`
      insert into public.clientes (tipo, razon_social, ruc, domicilio, partida, representante, representante_dni, representante_cargo, email, telefono, actividad, banco_origen, beneficiario_final, origen_fondos, es_pep, kyc_ficha_ruc_en, kyc_vigencia_en, kyc_listas_en, kyc_listas_resultado, user_id, notas_internas, created_by)
      values ('empresa', 'ANDINA DEMO IMPORTACIONES S.A.C.', '20999999991', 'Av. Demostración 123, Of. 501, San Isidro, Lima', '14999999', 'Lucía Paredes Demo', '09999999', 'Gerente general', ${DEMO_EMAIL}, '+51 999 000 000', 'Comercialización de equipos para minería', 'BCP cuenta corriente en dólares', 'Lucía Paredes Demo (100 %)', 'Utilidades acumuladas de la empresa (estados financieros 2025)', false, '2026-11-03', '2026-11-03', '2026-11-03', 'Sin coincidencias en listas PEP, OFAC ni ONU', ${DEMO_USER}::uuid, 'EXPEDIENTE DE DEMOSTRACIÓN para citas. Todo es ficticio.', ${ADMIN}::uuid)
      returning id`);
    const clienteId = cliente.id as string;

    // ── Presupuesto con el motor real ─────────────────────────────────────────
    const presupuesto = presupuestar(entradaPorDefecto({ precio: 78500, vehicleType: "hev", condition: "nuevo", origin: "originario-usa", cylinderCapacityCc: 3445, inland: 650, margenH3: 0.03 }));
    const fechas = { fechaFirma: "2026-11-03", fechaLimiteH2: "2026-11-14", fechaEstArribo: "2026-12-15", fechaEstEntrega: "2027-01-08" };
    const hitos = hitosDesde(presupuesto, fechas);

    const datos = {
      cliente_id: clienteId,
      etapa: "contrato",
      embarque_nuevo: { modalidad: "exclusivo", contenedor: "c40hc", puerto_origen: "Miami", puerto_destino: "Callao", fecha_release_est: "2026-11-18", fecha_zarpe_est: "2026-11-22", fecha_arribo_est: "2026-12-15" },
      proporcion_flete: 1,
      veh_marca: "Toyota", veh_modelo: "Sequoia", veh_version: "TRD Pro i-FORCE MAX", veh_anio: 2026, veh_vin: "7SVAAABA5SX123456", veh_color: "Wind Chill Pearl",
      veh_km: 12, veh_combustible: "Híbrido (gasolina)", veh_cilindrada_cc: 3445, veh_transmision: "Automática de 10 velocidades",
      veh_condicion: "nuevo", veh_categoria: "hev", veh_origen: "originario-usa", veh_pais_ensamblaje: "Estados Unidos (San Antonio, TX)", veh_doc_propiedad: "MSO (Manufacturer Statement of Origin)",
      moneda_compra: "USD", precio_compra: 78500, precio_compra_usd: 78500, precio_tope: 82000, fecha_limite_compra: "2026-11-12", pais_origen: "Estados Unidos", puerto_origen: "Miami",
      presupuesto, honorarios_usd: presupuesto.honorarios, honorarios_base_usd: presupuesto.honorariosBase, honorarios_igv_usd: presupuesto.honorariosIgv, margen_h3: presupuesto.margenH3,
      fecha_firma: fechas.fechaFirma, fecha_limite_h2: fechas.fechaLimiteH2, fecha_est_embarque: "2026-11-21", fecha_est_arribo: fechas.fechaEstArribo, fecha_est_entrega: fechas.fechaEstEntrega,
      semanas_estimadas: "9 a 10 semanas", loa_vence: "2027-05-03", tarifa_custodia_usd: 25, costo_inspeccion_usd: 350, vendedor_id: vendedor.id, inspector_id: inspector.id, agente_aduana_id: agente.id,
      notas_internas: "DEMO para citas: datos ficticios.",
      hitos: hitos.map((h) => ({ tipo: h.tipo, monto_estimado_usd: h.montoEstimadoUsd, fecha_limite: h.fechaLimite, cuenta: h.cuenta, nota: h.nota })),
      tareas: [],
    };
    const creado = await comoUsuario(ADMIN, (tx) => tx`select public.crear_expediente(${JSON.stringify(datos)}::jsonb) as id`);
    const expedienteId = creado[0].id as string;
    await sql`update public.embarques set forwarder_id = ${forwarder.id as string}::uuid where id = (select embarque_id from public.expedientes where id = ${expedienteId}::uuid)`;

    const ctx0 = (await cargarContextoServidor(expedienteId))!;
    await sql`select public.insertar_tareas_expediente(${expedienteId}::uuid, 'contrato', ${JSON.stringify(tareasAJson(tareasParaEtapa("contrato", ctx0)))}::jsonb)`;

    // ── Datos fijos de Luxcars para los documentos (los reales si están puestos) ──
    const fijos = {
      LUXCARS_PARTIDA: "(por confirmar)", LUXCARS_REP_DNI: "(por confirmar)", LUXCARS_REPRESENTANTE: "Gianfranco Gálvez Montero",
      LUXCARS_RUC: "20615410935", LUXCARS_DOMICILIO: "Calle Dionisio Derteano 184, Of. 1102, San Isidro, Lima",
      CTA_OPER_BANCO: "BCP", CTA_OPER_NUMERO: "(por confirmar)", CTA_OPER_CCI: "(por confirmar)",
      CTA_FONDOS_BANCO: "BCP", CTA_FONDOS_NUMERO: "(por confirmar)", CTA_FONDOS_CCI: "(por confirmar)", CTA_DETRACCION_NUMERO: "(por confirmar)",
      ...camposFijosLuxcars(),
    };

    const emitir = async (tipo: string, visible: boolean, extra: Record<string, string> = {}, movimiento: unknown = null) => {
      const ctx = (await cargarContextoServidor(expedienteId))!;
      const r = await emitirDocumento(plantillaDe(tipo as never)!, ctx, { actorId: ADMIN, extra: { ...fijos, ...extra }, visibleCliente: visible, movimiento: movimiento as never });
      if (!r.ok) throw new Error(`${tipo}: ${r.mensaje} ${"faltantes" in r ? JSON.stringify(r.faltantes) : ""}`);
      return r;
    };
    const firmar = async (documentoId: string, fecha: string) => {
      const d = await uno(sql`select ruta_pdf from public.expediente_documentos where id = ${documentoId}::uuid`);
      const ruta = `expedientes/${expedienteId}/firmados/${documentoId}.pdf`;
      // En la demo el "escaneo firmado" es el mismo PDF emitido.
      const { firmarDescarga } = await import("@/lib/portal/objectStorage");
      const url = await firmarDescarga(EXPEDIENTES_BUCKET, d.ruta_pdf as string, 120);
      const bytes = new Uint8Array(await (await fetch(url!)).arrayBuffer());
      if (!(await subirObjeto(EXPEDIENTES_BUCKET, ruta, bytes, "application/pdf"))) throw new Error("No subió el firmado");
      await sql`select public.marcar_documento_firmado(${documentoId}::uuid, ${ruta}, ${fecha}::date, ${ADMIN}::uuid)`;
    };
    const avanzar = async (destino: string) => {
      const ctx = (await cargarContextoServidor(expedienteId))!;
      const ev = evaluarAvance(ctx, destino as never, new Date("2026-11-26T12:00:00-05:00"));
      const tareas = tareasAJson(tareasParaEtapa(destino as never, ctx));
      const forzado = !ev.permitido;
      if (forzado) console.log(`avance a ${destino} forzado; faltaban:`, ev.faltantes.map((f) => f.clave));
      await comoUsuario(ADMIN, (tx) => tx`select public.avanzar_expediente(${expedienteId}::uuid, ${destino}::public.etapa_expediente, ${JSON.stringify(tareas)}::jsonb, ${forzado}, ${forzado ? "Demo: etapa cargada de una vez." : null})`);
    };
    const mover = async (mov: Record<string, unknown>) => {
      const r = await uno(sql`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, ...mov })}::jsonb, ${ADMIN}::uuid) as id`);
      return r.id as string;
    };
    const movimiento = async (id: string) => (await cargarContextoServidor(expedienteId))!.movimientos.find((m) => m.id === id)!;

    // Antes de emitir nada: qué le falta a cada plantilla del contrato (de una vez).
    {
      const { construirDocumento } = await import("@/core/expedientes/documentos");
      const ctx = (await cargarContextoServidor(expedienteId))!;
      const faltas: Record<string, string[]> = {};
      for (const tipo of ["contrato", "anexo_a", "anexo_b", "anexo_c", "anexo_d", "loa", "instrucciones_vendedor", "instrucciones_forwarder"]) {
        const d = construirDocumento(plantillaDe(tipo as never)!, ctx, fijos);
        if (d.faltantes.length) faltas[tipo] = d.faltantes;
      }
      if (Object.keys(faltas).length) console.log("faltantes por plantilla (antes de avanzar):", JSON.stringify(faltas));
    }

    // ── CONTRATO ──────────────────────────────────────────────────────────────
    await completar(expedienteId, "luxcars.kyc");
    const contrato = await emitir("contrato", true);
    await emitir("anexo_c", true);
    await emitir("anexo_d", true);
    const loa = await emitir("loa", true);
    await firmar(contrato.documentoId, "2026-11-05");
    await firmar(loa.documentoId, "2026-11-05");
    await completar(expedienteId, "cliente.firmar_contrato_loa", contrato.documentoId);
    await comoUsuario(DEMO_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'confirmar_cuentas', '{}'::jsonb)`);
    await avanzar("busqueda");

    // ── BÚSQUEDA ──────────────────────────────────────────────────────────────
    await sql`update public.expedientes set fecha_inspeccion = '2026-11-08', historial_ref = 'CarFax 7SVAAABA5SX123456 · sin siniestros · 1 dueño (dealer)' where id = ${expedienteId}::uuid`;
    for (const clave of ["luxcars.buscar_unidades", "luxcars.historial", "luxcars.inspeccion", "luxcars.proforma", "luxcars.verificar_cuenta_vendedor"]) await completar(expedienteId, clave);
    const anexoA = await emitir("anexo_a", true);
    await emitir("anexo_b", true);
    await firmar(anexoA.documentoId, "2026-11-10");
    await emitir("instrucciones_vendedor", false);
    await comoUsuario(DEMO_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'aprobar_inspeccion', '{"comentario":"Conforme con el informe y el precio."}'::jsonb)`);
    const h1 = hitos.find((h) => h.tipo === "H1")!;
    const h1Id = await mover({ tipo: "deposito", cuenta: "operaciones", hito: "H1", fecha: "2026-11-10", moneda: "USD", monto: h1.montoEstimadoUsd, concepto: "Honorarios 30 % (hito H1)", documento_ref: "BCP · op. 0451122" });
    await emitir("constancia_fondos", true, {}, await movimiento(h1Id));
    const pagoH1 = await uno(sql`select id from public.expediente_tareas where expediente_id = ${expedienteId}::uuid and clave = 'cliente.pagar_h1'`);
    if (pagoH1) await comoUsuario(ADMIN, (tx) => tx`select public.completar_tarea(${pagoH1.id as string}::uuid, null, 'hecha')`);
    await avanzar("compra");

    // ── COMPRA ────────────────────────────────────────────────────────────────
    const h2 = hitos.find((h) => h.tipo === "H2")!;
    await comoUsuario(DEMO_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: "H2", monto: h2.montoEstimadoUsd, fecha: "2026-11-12", banco: "BCP", operacion: "0458810" })}::jsonb)`);
    const declarado = await uno(sql`select id from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid and hito = 'H2' and estado = 'por_confirmar'`);
    const h2Id = declarado.id as string;
    await mover({ id: h2Id, estado: "confirmado", fecha: "2026-11-12" });
    await emitir("constancia_fondos", true, {}, await movimiento(h2Id));
    await mover({ tipo: "pago", cuenta: "fondos_clientes", hito: "H2", fecha: "2026-11-13", moneda: "USD", monto: 78500, contraparte_id: vendedor.id, concepto: "Precio del vehículo", documento_ref: "SWIFT BOFAUS3N 2026-11-13" });
    await mover({ tipo: "pago", cuenta: "fondos_clientes", hito: "H2", fecha: "2026-11-18", moneda: "USD", monto: 650, contraparte_id: forwarder.id, concepto: "Transporte interno", documento_ref: "Factura ACL-10422" });
    for (const clave of ["luxcars.wire_vendedor", "luxcars.bill_of_sale", "luxcars.doc_propiedad_forwarder", "luxcars.coordinar_release"]) await completar(expedienteId, clave);
    await avanzar("embarque");

    // ── EMBARQUE ──────────────────────────────────────────────────────────────
    await emitir("instrucciones_forwarder", false);
    await mover({ tipo: "pago", cuenta: "fondos_clientes", hito: "H2", fecha: "2026-11-20", moneda: "USD", monto: presupuesto.flete + presupuesto.seguro, contraparte_id: forwarder.id, concepto: "Flete y seguro", documento_ref: "Factura ACL-10467" });
    for (const clave of ["luxcars.poliza", "tercero.inland_acta_carga", "luxcars.borrador_bl", "tercero.declaracion_exportacion"]) await completar(expedienteId, clave);
    const emb = await uno(sql`select embarque_id from public.expedientes where id = ${expedienteId}::uuid`);
    await comoUsuario(ADMIN, (tx) => tx`select public.registrar_zarpe_arribo(${emb.embarque_id as string}::uuid, ${JSON.stringify({ fecha_carga: "2026-11-19", fecha_zarpe_real: "2026-11-22", fecha_arribo_est: "2026-12-15", nave: "MSC Ilona V.246S", master_bl: "MEDUMI2611042" })}::jsonb, ${ADMIN}::uuid)`);
    await avanzar("transito");

    // ── TRÁNSITO (estado actual de la demo) ───────────────────────────────────
    await completar(expedienteId, "luxcars.docs_agente");
    await emitir("aviso_h3", true);

    // ── Lo que ve el cliente ──────────────────────────────────────────────────
    const vista = await comoUsuario(DEMO_USER, (tx) => tx`select codigo, etapa from public.expediente_cliente where id = ${expedienteId}::uuid`);
    const tareasCliente = await comoUsuario(DEMO_USER, (tx) => tx`select clave, estado from public.expediente_tarea_cliente where expediente_id = ${expedienteId}::uuid and estado = 'pendiente' order by clave`);
    const docs = await comoUsuario(DEMO_USER, (tx) => tx`select tipo, estado from public.expediente_documento_cliente where expediente_id = ${expedienteId}::uuid order by tipo`);
    const movs = await comoUsuario(DEMO_USER, (tx) => tx`select tipo, hito, estado, monto_usd from public.expediente_movimiento_cliente where expediente_id = ${expedienteId}::uuid order by fecha`);
    console.log(JSON.stringify({ expedienteId, vista, tareasCliente, docs, movs }, null, 1));
    expect(vista[0]?.etapa).toBe("transito");
    expect(tareasCliente.map((t) => t.clave)).toContain("cliente.depositar_h3");
  }, 600_000);
});
