/**
 * EXPEDIENTE DE DEMOSTRACIÓN para las citas con clientes (no es una prueba).
 *
 * Siembra en la base y el bucket REALES un expediente ficticio, completo hasta
 * la etapa "tránsito", a nombre de la cuenta contacto@luxcars.pe, para enseñar la
 * cuenta del cliente en una reunión, con el flujo del 27 nov 2026: búsqueda sin
 * costo y aprobación de la unidad, una sola firma en notaría (contrato, anexos,
 * LOA y poder), Pago 1 (precio) con su constancia, wire al broker con la
 * comisión del banco repuesta por Luxcars, Pago 2 en una sola transferencia a
 * Fondos de Clientes (flete, seguro y primera mitad de los honorarios), la
 * factura 1 aplicada desde Fondos de Clientes con su autodetracción en el
 * Banco de la Nación (una sola cuenta para el cliente, 27 nov 2026) y el aviso
 * del Pago 3 (gastos de aduana) emitido con el botón "Ya transferí"
 * pendiente. Hace lo mismo que haría el equipo desde el portal, con las mismas
 * funciones SQL, el mismo generador de documentos y la misma regla del core
 * para la tarea de autodetracción.
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
    const { monto } = await import("@/core/expedientes/campos");
    const { crearTareasTrasConfirmar } = await import("@/lib/expedientes/servidor/tareasHonorarios");
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

    // ── Terceros: el dealer emite factura y MSO; el broker recibe el precio ───
    const dealer = await uno(sql`
      insert into public.contrapartes (tipo, nombre, pais, direccion, contacto, email, telefono, ruc_o_tax_id, notas)
      values ('vendedor', 'Sunrise Toyota of Miami (DEMO)', 'Estados Unidos', '9800 NW 12th St, Doral, FL 33172', 'Daniel Ortega', 'fleet@sunrisetoyota.example', '+1 305 555 0148', '59-1234567', 'DEMO')
      returning id`);
    const broker = await uno(sql`
      insert into public.contrapartes (tipo, nombre, pais, direccion, contacto, email, telefono, ruc_o_tax_id, datos_bancarios, banco_verificado_en, banco_verificado_por, notas)
      values ('broker', 'Atlantic Auto Export LLC (DEMO)', 'Estados Unidos', '2600 NW 87th Ave, Doral, FL 33172', 'Sofía Herrera', 'deals@atlanticautoexport.example', '+1 305 555 0177', '65-7654321',
        '{"banco":"Bank of America","titular":"Atlantic Auto Export LLC","cuenta":"XXXX-8812","aba":"026009593","swift":"BOFAUS3N","moneda":"USD"}'::jsonb, '2026-11-04T15:20:00-05:00', ${ADMIN}::uuid, 'DEMO')
      returning id`);
    const forwarder = await uno(sql`
      insert into public.contrapartes (tipo, nombre, pais, direccion, contacto, email, telefono, notas)
      values ('forwarder', 'Andes Cargo Logistics (DEMO)', 'Estados Unidos', '8700 NW 107th Ave, Miami, FL', 'Karen Ruiz', 'ops@andescargo.example', '+1 305 555 0192', 'DEMO')
      returning id`);
    const agente = await uno(sql`
      insert into public.contrapartes (tipo, nombre, pais, direccion, contacto, email, telefono, ruc_o_tax_id, notas)
      values ('agente_aduana', 'Agencia de Aduana Pacífico S.A. (DEMO)', 'Perú', 'Av. Argentina 2020, Callao', 'Rosa Medina', 'despachos@pacifico.example', '+51 1 555 0120', '20555555551', 'DEMO')
      returning id`);

    // ── Cliente ───────────────────────────────────────────────────────────────
    const cliente = await uno(sql`
      insert into public.clientes (tipo, razon_social, ruc, domicilio, partida, representante, representante_dni, representante_cargo, email, telefono, actividad, banco_origen, origen_fondos_tipo, origen_fondos, es_pep, beneficiarios, kyc_ficha_ruc_en, kyc_vigencia_en, kyc_listas_en, kyc_listas_resultado, kyc_uif_en, kyc_responsable, user_id, notas_internas, created_by)
      values ('empresa', 'ANDINA DEMO IMPORTACIONES S.A.C.', '20999999991', 'Av. Demostración 123, Of. 501, San Isidro, Lima', '14999999', 'Lucía Paredes Demo', '09999999', 'Gerente general', ${DEMO_EMAIL}, '+51 999 000 000', 'Comercialización de equipos para minería', 'BCP, cuenta corriente en dólares a nombre de la empresa', 'utilidades', 'Utilidades acumuladas según los estados financieros 2025', false,
        ${JSON.stringify([{ nombre: "Lucía Paredes Demo", documento: "DNI 09999999", porcentaje: 100, pep: false }])}::jsonb,
        '2026-11-03', '2026-11-03', '2026-11-03', 'Sin coincidencias en listas PEP, OFAC ni ONU', '2026-11-06', 'Equipo Luxcars (DEMO)', ${DEMO_USER}::uuid, 'EXPEDIENTE DE DEMOSTRACIÓN para citas. Todo es ficticio.', ${ADMIN}::uuid)
      returning id`);
    const clienteId = cliente.id as string;

    // ── Presupuesto con el motor real (auto nuevo: sin inspección) ────────────
    const presupuesto = presupuestar(entradaPorDefecto({ precio: 78500, vehicleType: "hev", condition: "nuevo", origin: "originario-usa", cylinderCapacityCc: 3445 }));
    const fechas = { fechaFirma: "2026-11-05", fechaLimitePago2: "2026-11-18", fechaReleaseEst: "2026-11-18", fechaEstArribo: "2026-12-15", fechaEstLevante: "2026-12-22" };
    const hitos = hitosDesde(presupuesto, fechas);
    const hito = (t: string) => hitos.find((h) => h.tipo === t)!;

    const datos = {
      cliente_id: clienteId,
      etapa: "busqueda",
      embarque_nuevo: { modalidad: "exclusivo", contenedor: "c40hc", puerto_origen: "Miami", puerto_destino: "Callao", fecha_release_est: "2026-11-18", fecha_zarpe_est: "2026-11-22", fecha_arribo_est: "2026-12-15", almacen_consolidacion: "Andes Cargo Logistics, 8700 NW 107th Ave, Medley, FL 33178" },
      proporcion_flete: 1,
      veh_marca: "Toyota", veh_modelo: "Sequoia", veh_version: "TRD Pro i-FORCE MAX", veh_anio: 2026, veh_vin: "7SVAAABA5SX123456", veh_color: "Wind Chill Pearl",
      veh_km: 12, veh_combustible: "Híbrido (gasolina)", veh_cilindrada_cc: 3445, veh_transmision: "Automática de 10 velocidades",
      veh_condicion: "nuevo", veh_categoria: "hev", veh_clase: "M1", veh_origen: "originario-usa", veh_pais_ensamblaje: "Estados Unidos (San Antonio, TX)", veh_doc_propiedad: "MSO (Manufacturer Statement of Origin)", veh_peso_kg: 2760, veh_medidas: "5.29 × 2.02 × 1.89 m",
      moneda_compra: "USD", precio_compra: 78500, precio_compra_usd: 78500, precio_tope: 82000, fecha_limite_compra: "2026-11-12", pais_origen: "Estados Unidos", puerto_origen: "Miami",
      fecha_release: "2026-11-18",
      presupuesto, honorarios_usd: presupuesto.honorarios, honorarios_base_usd: presupuesto.honorariosBase, honorarios_igv_usd: presupuesto.honorariosIgv,
      fecha_firma: fechas.fechaFirma, fecha_limite_h2: fechas.fechaLimitePago2, fecha_est_embarque: "2026-11-21", fecha_est_arribo: fechas.fechaEstArribo, fecha_est_entrega: "2027-01-08",
      semanas_estimadas: "9 a 10 semanas", loa_vence: "2027-05-05", tarifa_custodia_usd: 25,
      vendedor_id: dealer.id, broker_id: broker.id, agente_aduana_id: agente.id,
      notas_internas: "DEMO para citas: datos ficticios.",
      hitos: hitos.map((h) => ({ tipo: h.tipo, monto_estimado_usd: h.montoEstimadoUsd, fecha_limite: h.fechaLimite, cuenta: h.cuenta, nota: h.nota })),
      tareas: [],
    };
    const creado = await comoUsuario(ADMIN, (tx) => tx`select public.crear_expediente(${JSON.stringify(datos)}::jsonb) as id`);
    const expedienteId = creado[0].id as string;
    await sql`update public.embarques set forwarder_id = ${forwarder.id as string}::uuid where id = (select embarque_id from public.expedientes where id = ${expedienteId}::uuid)`;

    const ctx0 = (await cargarContextoServidor(expedienteId))!;
    await sql`select public.insertar_tareas_expediente(${expedienteId}::uuid, 'busqueda', ${JSON.stringify(tareasAJson(tareasParaEtapa("busqueda", ctx0)))}::jsonb)`;

    // ── Parámetros de la empresa para los documentos ──────────────────────────
    // Mandan los de /portal/configuracion (tabla configuracion_documentos; o la variable de respaldo);
    // el respaldo de la demo solo cubre lo que todavía falte. Así, cuando el dueño llene la configuración,
    // una demo rehecha sale con sus datos reales. Lo que falte sale como "(por confirmar)": ningún campo vacío.
    const configuracion = await camposFijosLuxcars();
    const respaldoDemo: Record<string, string> = {
      LUXCARS_PARTIDA: "(por confirmar)", LUXCARS_REP_DNI: "(por confirmar)", LUXCARS_REPRESENTANTE: "Gianfranco Gálvez Montero",
      LUXCARS_RUC: "20615410935", LUXCARS_DOMICILIO: "Calle Dionisio Derteano 184, Of. 1102, San Isidro, Lima",
      CTA_FONDOS_BANCO: "BCP", CTA_FONDOS_NUMERO: "(por confirmar)", CTA_FONDOS_CCI: "(por confirmar)", CTA_DETRACCION_NUMERO: "(por confirmar)",
      PORCENTAJE_DETRACCION: "12", DIAS_ESPERA_MAX: "15", CIUDAD_FIRMA: "Lima", TC_REFERENCIAL: "3.7500",
    };
    const fijos: Record<string, string> = { ...respaldoDemo };
    for (const [clave, valor] of Object.entries(configuracion)) if (valor && valor.trim()) fijos[clave] = valor.trim();
    const conRespaldo = Object.keys(respaldoDemo).filter((k) => !configuracion[k as keyof typeof configuracion]);
    if (conRespaldo.length) console.log(`Configuración de la empresa incompleta; la demo usa el respaldo en: ${conRespaldo.join(", ")}.`);

    const emitir = async (tipo: string, visible: boolean, extra: Record<string, string> = {}, movimiento: unknown = null) => {
      const ctx = (await cargarContextoServidor(expedienteId))!;
      const r = await emitirDocumento(plantillaDe(tipo as never)!, ctx, { actorId: ADMIN, extra, porDefecto: fijos, visibleCliente: visible, movimiento: movimiento as never });
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
      // La demo debe pasar cada compuerta por las buenas: si algo falta, es un error del flujo.
      expect(ev.faltantes.map((f) => f.clave), `compuerta de ${destino}`).toEqual([]);
      await comoUsuario(ADMIN, (tx) => tx`select public.avanzar_expediente(${expedienteId}::uuid, ${destino}::public.etapa_expediente, ${JSON.stringify(tareas)}::jsonb, false, null)`);
    };
    const mover = async (mov: Record<string, unknown>) => {
      const r = await uno(sql`select public.registrar_movimiento(${JSON.stringify({ expediente_id: expedienteId, ...mov })}::jsonb, ${ADMIN}::uuid) as id`);
      return r.id as string;
    };
    const movimiento = async (id: string) => (await cargarContextoServidor(expedienteId))!.movimientos.find((m) => m.id === id)!;
    /**
     * El cliente declara el pago completo desde su cuenta y el equipo confirma:
     * como en la vida real. El Pago 2 es una sola transferencia (H2 + H3). Al
     * confirmar, la ruta de movimientos emite la constancia y crea las tareas
     * que nacen del pago (la autodetracción con cliente empresa).
     */
    const depositoDelCliente = async (h: string, fecha: string, operacion: string, montoPago = hito(h).montoEstimadoUsd) => {
      await comoUsuario(DEMO_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'declarar_deposito', ${JSON.stringify({ hito: h, monto: montoPago, fecha, banco: "BCP", operacion })}::jsonb)`);
      const declarado = await uno(sql`select id from public.expediente_movimientos where expediente_id = ${expedienteId}::uuid and hito = ${h}::public.tipo_hito and estado = 'por_confirmar'`);
      const id = declarado.id as string;
      await mover({ id, estado: "confirmado", fecha });
      await emitir("constancia_fondos", true, {}, await movimiento(id));
      await crearTareasTrasConfirmar((await cargarContextoServidor(expedienteId))!, await movimiento(id));
      return id;
    };

    // ── BÚSQUEDA (sin costo) ──────────────────────────────────────────────────
    await sql`update public.expedientes set historial_ref = 'MSO sin matricular · recalls por VIN: ninguno pendiente (NHTSA, 2026-11-04)' where id = ${expedienteId}::uuid`;
    for (const clave of ["luxcars.buscar_unidades", "luxcars.proforma", "luxcars.verificar_nuevo", "luxcars.verificar_cuenta_vendedor"]) await completar(expedienteId, clave);
    await emitir("anexo_a", true);
    await emitir("anexo_b", true);
    await comoUsuario(DEMO_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'aprobar_unidad', '{"comentario":"Conforme con la unidad y el presupuesto."}'::jsonb)`);
    await avanzar("contrato");

    // ── CONTRATO: una sola visita a la notaría y el Pago 1 ───────────────────
    await completar(expedienteId, "luxcars.kyc");
    const contrato = await emitir("contrato", true);
    await emitir("anexo_c", true);
    await emitir("anexo_d", true);
    const loa = await emitir("loa", true);
    const poder = await emitir("poder_inmatriculacion", true);
    await firmar(contrato.documentoId, "2026-11-05");
    await firmar(loa.documentoId, "2026-11-05");
    await firmar(poder.documentoId, "2026-11-05");
    await completar(expedienteId, "cliente.firmar_contrato_loa", contrato.documentoId);
    await comoUsuario(DEMO_USER, (tx) => tx`select public.cliente_accion_expediente(${expedienteId}::uuid, 'confirmar_cuentas', '{}'::jsonb)`);
    await emitir("instrucciones_vendedor", false);
    await depositoDelCliente("H1", "2026-11-06", "0451122");
    await avanzar("compra");

    // ── COMPRA: wire al broker con la comisión del banco repuesta ─────────────
    await mover({ tipo: "pago", cuenta: "fondos_clientes", hito: "H1", fecha: "2026-11-09", moneda: "USD", monto: 78500, contraparte_id: broker.id, concepto: "Precio del vehículo (wire al broker)", documento_ref: "SWIFT BOFAUS3N 2026-11-09 · bill of sale SUN-26-0912", comision_bancaria_usd: 45 });
    await emitir("instrucciones_forwarder", false);
    for (const clave of ["luxcars.wire_vendedor", "luxcars.bill_of_sale", "luxcars.doc_propiedad_forwarder", "luxcars.coordinar_release"]) await completar(expedienteId, clave);
    await avanzar("embarque");

    // ── EMBARQUE: Pago 2 en una sola transferencia (flete, seguro y 50 % de honorarios) ──
    const pago2 = Math.round((hito("H2").montoEstimadoUsd + hito("H3").montoEstimadoUsd) * 100) / 100;
    await depositoDelCliente("H2", "2026-11-17", "0458810", pago2);
    const tareaDetraccion = await uno(sql`select estado, vence_el::text as vence_el from public.expediente_tareas where expediente_id = ${expedienteId}::uuid and clave = 'luxcars.autodetraccion_h3'`);
    // Martes 17 de noviembre + cinco días hábiles.
    expect(tareaDetraccion).toEqual({ estado: "pendiente", vence_el: "2026-11-24" });
    // Factura 1: su importe pasa de Fondos de Clientes a Operaciones el día de su emisión.
    await mover({ operacion: "aplicar_honorarios", factura: 1, monto: hito("H3").montoEstimadoUsd, fecha: "2026-11-17", documento_ref: "F001-00000101" });
    // Autodetracción: el 12 % de la factura, en soles redondeados, al Banco de la Nación dentro de los cinco días hábiles.
    const detraccionSoles = Math.round(hito("H3").montoEstimadoUsd * 0.12 * 3.75);
    await mover({ operacion: "autodetraccion", factura: 1, moneda: "PEN", monto: detraccionSoles, tipo_cambio: 1 / 3.75, monto_usd: Math.round((detraccionSoles / 3.75) * 100) / 100, fecha: "2026-11-19", documento_ref: "BN 000184522 (DEMO)" });
    await mover({ tipo: "pago", cuenta: "fondos_clientes", hito: "H2", fecha: "2026-11-20", moneda: "USD", monto: presupuesto.flete, contraparte_id: forwarder.id, concepto: "Flete (traslado al puerto y marítimo)", documento_ref: "Factura ACL-10467" });
    await mover({ tipo: "pago", cuenta: "fondos_clientes", hito: "H2", fecha: "2026-11-20", moneda: "USD", monto: presupuesto.seguro, contraparte_id: forwarder.id, concepto: "Seguro de transporte", documento_ref: "Póliza MAR-26-55821" });
    for (const clave of ["luxcars.poliza", "tercero.acta_carga", "luxcars.borrador_bl", "tercero.declaracion_exportacion"]) await completar(expedienteId, clave);
    const emb = await uno(sql`select embarque_id from public.expedientes where id = ${expedienteId}::uuid`);
    await comoUsuario(ADMIN, (tx) => tx`select public.registrar_zarpe_arribo(${emb.embarque_id as string}::uuid, ${JSON.stringify({ fecha_carga: "2026-11-19", fecha_zarpe_real: "2026-11-22", fecha_arribo_est: "2026-12-15", nave: "MSC Ilona V.246S", master_bl: "MEDUMI2611042" })}::jsonb, ${ADMIN}::uuid)`);
    await avanzar("transito");

    // ── TRÁNSITO (estado actual de la demo): aviso del Pago 3 emitido, H4 pendiente ──
    await completar(expedienteId, "luxcars.docs_agente");
    await emitir("aviso_h3", true, { HITO: "H4", MONTO_AVISO: monto(presupuesto.gastosAduana), FECHA_AVISO: "26 de noviembre de 2026" });

    // ── Lo que ve el cliente ──────────────────────────────────────────────────
    const vista = await comoUsuario(DEMO_USER, (tx) => tx`select codigo, etapa from public.expediente_cliente where id = ${expedienteId}::uuid`);
    const tareasCliente = await comoUsuario(DEMO_USER, (tx) => tx`select clave, estado from public.expediente_tarea_cliente where expediente_id = ${expedienteId}::uuid and estado = 'pendiente' order by clave`);
    const docs = await comoUsuario(DEMO_USER, (tx) => tx`select tipo, estado from public.expediente_documento_cliente where expediente_id = ${expedienteId}::uuid order by tipo`);
    const movs = await comoUsuario(DEMO_USER, (tx) => tx`select tipo, cuenta, hito, estado, monto_usd, concepto from public.expediente_movimiento_cliente where expediente_id = ${expedienteId}::uuid order by fecha, created_at`);
    console.log(JSON.stringify({ expedienteId, vista, tareasCliente, docs, movs }, null, 1));
    expect(vista[0]?.etapa).toBe("transito");
    expect(tareasCliente.map((t) => t.clave)).toContain("cliente.depositar_h4");

    // El libro cuadra con el core: Pagos 1 y 2 acreditados, Pago 3 pendiente, la comisión no movió el saldo,
    // la factura 1 salió de Fondos de Clientes y su detracción está depositada (tareas cerradas).
    const { estadoHito } = await import("@/core/expedientes/hitos");
    const { comisionesBancarias, estadoPagos, saldoCuenta, saldoFondos } = await import("@/core/expedientes/ledger");
    const ctx = (await cargarContextoServidor(expedienteId))!;
    const estados = Object.fromEntries(ctx.hitos.map((h) => [h.tipo, estadoHito(h, ctx.movimientos, ctx.hitos)]));
    expect(estados).toMatchObject({ H1: "acreditado", H2: "acreditado", H3: "acreditado", H4: "pendiente", H5: "pendiente", H6: "pendiente" });
    expect(estadoPagos(ctx.hitos, ctx.movimientos).map((p) => [p.etiqueta, p.estado])).toEqual([
      ["Pago 1 de 5", "acreditado"], ["Pago 2 de 5", "acreditado"], ["Pago 3 de 5", "pendiente"], ["Pago 4 de 5", "pendiente"], ["Pago 5 de 5", "pendiente"],
    ]);
    expect(comisionesBancarias(ctx.movimientos)).toEqual({ cargadas: 45, repuestas: 45, efecto: 0 });
    const esperado = Math.round((hito("H1").montoEstimadoUsd - 78500 + hito("H2").montoEstimadoUsd - presupuesto.flete - presupuesto.seguro) * 100) / 100;
    expect(saldoCuenta(ctx.movimientos)).toBeCloseTo(esperado, 1);
    expect(saldoFondos(ctx.movimientos).detracciones).toBeCloseTo(Math.round((detraccionSoles / 3.75) * 100) / 100, 2);
    const cerradas = Object.fromEntries(ctx.tareas.filter((t) => ["luxcars.factura_h3", "luxcars.autodetraccion_h3", "cliente.depositar_h2", "luxcars.confirmar_h2"].includes(t.clave)).map((t) => [t.clave, t.estado]));
    expect(cerradas).toEqual({ "luxcars.factura_h3": "hecha", "luxcars.autodetraccion_h3": "hecha", "cliente.depositar_h2": "hecha", "luxcars.confirmar_h2": "hecha" });
    // El cliente no ve Operaciones ni la cuenta de detracciones.
    expect(movs.some((m) => m.cuenta === "operaciones" || m.cuenta === "detracciones")).toBe(false);
    expect(ctx.hitos.find((h) => h.tipo === "H4")?.montoEstimadoUsd).toBe(presupuesto.gastosAduana);
  }, 600_000);
});
