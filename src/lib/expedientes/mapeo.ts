/**
 * Mapeadores fila de Postgres (snake_case, en español) → dominio del core
 * (camelCase). Un solo lugar para traducir; los usan el portal y la cuenta.
 */

import {
  ETAPAS_EXPEDIENTE,
  MODALIDADES_EMBARQUE,
  RESPONSABLES_TAREA,
  TIPOS_CLIENTE,
  TIPOS_CONTENEDOR,
  TIPOS_CONTRAPARTE,
  TIPOS_HITO,
  type Aprobacion,
  type Cliente,
  type Contraparte,
  type Embarque,
  type EstadoTarea,
  type EtapaExpediente,
  type Evento,
  type Expediente,
  type ExpedienteReservado,
  type Hito,
  type Presupuesto,
  type Tarea,
  type TipoAprobacion,
  type TipoEvento,
  type TramoEtapa,
} from "@/core/expedientes/tipos";
import {
  VEHICLE_CATEGORY_IDS,
  VEHICLE_CONDITIONS,
  type ClienteRow,
  type ContraparteRow,
  type EmbarqueClienteRow,
  type EmbarqueRow,
  type ExpedienteAprobacionRow,
  type ExpedienteEtapaRow,
  type ExpedienteEventoRow,
  type ExpedienteHitoRow,
  type ExpedienteReservadoRow,
  type ExpedienteRow,
  type ExpedienteTareaRow,
} from "@/lib/db/types";

export function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const ESTADOS_TAREA: readonly EstadoTarea[] = ["pendiente", "hecha", "no_aplica"];
const TIPOS_EVENTO: readonly TipoEvento[] = ["etapa", "tarea", "hito", "movimiento", "documento", "aprobacion", "nota", "notificacion", "alerta"];
const TIPOS_APROBACION: readonly TipoAprobacion[] = ["aprobar_inspeccion", "elegir_consolidado", "declarar_deposito", "conformidad_rendicion", "confirmar_cuentas"];
const CUENTAS = ["fondos_clientes", "operaciones", "detracciones"] as const;

export function mapEtapa(value: unknown): EtapaExpediente {
  return pick(value, ETAPAS_EXPEDIENTE, "prospecto");
}

export function mapCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    tipo: pick(row.tipo, TIPOS_CLIENTE, "empresa"),
    razonSocial: row.razon_social,
    ruc: row.ruc,
    dni: row.dni,
    domicilio: row.domicilio,
    partida: row.partida,
    representante: row.representante,
    representanteDni: row.representante_dni,
    representanteCargo: row.representante_cargo,
    email: row.email,
    telefono: row.telefono,
    actividad: row.actividad,
    bancoOrigen: row.banco_origen,
    beneficiarioFinal: row.beneficiario_final,
    origenFondos: row.origen_fondos,
    esPep: row.es_pep === true,
    kycFichaRucEn: row.kyc_ficha_ruc_en,
    kycVigenciaEn: row.kyc_vigencia_en,
    kycListasEn: row.kyc_listas_en,
    kycListasResultado: row.kyc_listas_resultado,
    kycCompleto: row.kyc_completo === true,
    userId: row.user_id,
    notasInternas: row.notas_internas,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapContraparte(row: ContraparteRow): Contraparte {
  return {
    id: row.id,
    tipo: pick(row.tipo, TIPOS_CONTRAPARTE, "otro"),
    nombre: row.nombre,
    pais: row.pais,
    contacto: row.contacto,
    email: row.email,
    telefono: row.telefono,
    bancoVerificadoEn: row.banco_verificado_en,
  };
}

export function mapEmbarque(row: EmbarqueRow): Embarque {
  return {
    id: row.id,
    codigo: row.codigo,
    modalidad: pick(row.modalidad, MODALIDADES_EMBARQUE, "exclusivo"),
    contenedor: row.contenedor ? pick(row.contenedor, TIPOS_CONTENEDOR, "c40hc") : null,
    forwarderId: row.forwarder_id,
    aseguradoraId: row.aseguradora_id,
    almacenConsolidacion: row.almacen_consolidacion,
    puertoOrigen: row.puerto_origen,
    puertoDestino: row.puerto_destino,
    fechaReleaseEst: row.fecha_release_est,
    fechaReleaseReal: row.fecha_release_real,
    fechaCarga: row.fecha_carga,
    fechaZarpeEst: row.fecha_zarpe_est,
    fechaZarpeReal: row.fecha_zarpe_real,
    fechaArriboEst: row.fecha_arribo_est,
    fechaArriboReal: row.fecha_arribo_real,
    nave: row.nave,
    masterBl: row.master_bl,
    precinto: row.precinto,
    fleteTotalUsd: num(row.flete_total_usd),
    gastosContenedorUsd: num(row.gastos_contenedor_usd),
    declaracionExportacion: row.declaracion_exportacion,
    estado: row.estado,
    notasInternas: row.notas_internas,
  };
}

/** La vista del cliente trae menos columnas; lo que falta queda nulo. */
export function mapEmbarqueCliente(row: EmbarqueClienteRow): Embarque {
  return mapEmbarque({
    ...row,
    forwarder_id: null,
    aseguradora_id: null,
    almacen_consolidacion: null,
    precinto: null,
    flete_total_usd: null,
    gastos_contenedor_usd: null,
    declaracion_exportacion: null,
    estado: "",
    notas_internas: null,
  });
}

export function mapReservado(row: ExpedienteReservadoRow | null | undefined): ExpedienteReservado | null {
  if (!row) return null;
  return {
    precioTope: num(row.precio_tope),
    tcCompraRef: num(row.tc_compra_ref),
    vendedorId: row.vendedor_id,
    inspectorId: row.inspector_id,
    agenteAduanaId: row.agente_aduana_id,
    notasInternas: row.notas_internas,
  };
}

function esPresupuesto(value: unknown): value is Presupuesto {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as Presupuesto).lineas) && Array.isArray((value as Presupuesto).hitos);
}

export function mapExpediente(row: ExpedienteRow, reservado: ExpedienteReservadoRow | null = null): Expediente {
  return {
    id: row.id,
    codigo: row.codigo,
    clienteId: row.cliente_id,
    etapa: mapEtapa(row.etapa),
    etapaDesde: row.etapa_desde,
    origenSolicitudId: row.origen_solicitud_id ?? null,
    embarqueId: row.embarque_id,
    proporcionFlete: num(row.proporcion_flete) ?? 1,
    vehiculo: {
      marca: row.veh_marca,
      modelo: row.veh_modelo,
      version: row.veh_version,
      anio: row.veh_anio,
      vin: row.veh_vin,
      color: row.veh_color,
      km: row.veh_km,
      combustible: row.veh_combustible,
      cilindradaCc: row.veh_cilindrada_cc,
      transmision: row.veh_transmision,
      condicion: pick(row.veh_condicion, VEHICLE_CONDITIONS, "usado"),
      categoria: pick(row.veh_categoria, VEHICLE_CATEGORY_IDS, "gasolina"),
      origen: row.veh_origen === "originario-usa" ? "originario-usa" : "otro",
      paisEnsamblaje: row.veh_pais_ensamblaje,
      docPropiedad: row.veh_doc_propiedad ?? null,
      pesoKg: row.veh_peso_kg ?? null,
      medidas: row.veh_medidas ?? null,
    },
    monedaCompra: row.moneda_compra,
    precioCompra: num(row.precio_compra),
    precioCompraUsd: num(row.precio_compra_usd),
    fechaLimiteCompra: row.fecha_limite_compra ?? null,
    fechaInspeccion: row.fecha_inspeccion,
    historialRef: row.historial_ref ?? null,
    fechaRelease: row.fecha_release ?? null,
    paisOrigen: row.pais_origen,
    puertoOrigen: row.puerto_origen,
    presupuesto: esPresupuesto(row.presupuesto) ? row.presupuesto : null,
    honorariosUsd: num(row.honorarios_usd),
    honorariosBaseUsd: num(row.honorarios_base_usd),
    honorariosIgvUsd: num(row.honorarios_igv_usd),
    porcentajeDetraccion: num(row.porcentaje_detraccion),
    margenH3: num(row.margen_h3) ?? 0,
    fechaFirma: row.fecha_firma,
    fechaLimiteH2: row.fecha_limite_h2,
    fechaEstEmbarque: row.fecha_est_embarque,
    fechaEstArribo: row.fecha_est_arribo,
    fechaEstEntrega: row.fecha_est_entrega,
    semanasEstimadas: row.semanas_estimadas,
    loaVence: row.loa_vence ?? null,
    damNumero: row.dam_numero,
    damFecha: row.dam_fecha,
    damCanal: row.dam_canal ?? null,
    levanteEn: row.levante_en,
    placa: row.placa,
    tiveNumero: row.tive_numero,
    kmEntrega: row.km_entrega ?? null,
    fechaEntrega: row.fecha_entrega,
    canceladoMotivo: row.cancelado_motivo,
    cerradoEn: row.cerrado_en,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reservado: mapReservado(reservado),
  };
}

export function mapTarea(row: ExpedienteTareaRow): Tarea {
  return {
    id: row.id,
    expedienteId: row.expediente_id,
    etapa: mapEtapa(row.etapa),
    clave: row.clave,
    titulo: row.titulo,
    descripcion: row.descripcion,
    responsable: pick(row.responsable, RESPONSABLES_TAREA, "luxcars"),
    estado: pick(row.estado, ESTADOS_TAREA, "pendiente"),
    venceEl: row.vence_el,
    hechaEn: row.hecha_en,
    visibleCliente: row.visible_cliente ?? row.responsable === "cliente",
    orden: row.orden ?? 0,
  };
}

export function mapHito(row: ExpedienteHitoRow): Hito {
  return {
    tipo: pick(row.tipo, TIPOS_HITO, "H1"),
    montoEstimadoUsd: num(row.monto_estimado_usd) ?? 0,
    fechaLimite: row.fecha_limite,
    cuenta: pick(row.cuenta, CUENTAS, "fondos_clientes"),
    nota: row.nota,
  };
}

export function mapEvento(row: ExpedienteEventoRow): Evento {
  return {
    id: row.id,
    expedienteId: row.expediente_id,
    tipo: pick(row.tipo, TIPOS_EVENTO, "nota"),
    titulo: row.titulo,
    detalle: row.detalle,
    visibleCliente: row.visible_cliente ?? true,
    actorTipo: pick(row.actor_tipo, ["admin", "cliente", "sistema"] as const, "sistema"),
    etapa: row.etapa ? mapEtapa(row.etapa) : null,
    createdAt: row.created_at,
  };
}

export function mapAprobacion(row: ExpedienteAprobacionRow): Aprobacion {
  return {
    id: row.id,
    tipo: pick(row.tipo, TIPOS_APROBACION, "confirmar_cuentas"),
    payload: row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {},
    createdAt: row.created_at,
  };
}

export function mapTramo(row: ExpedienteEtapaRow): TramoEtapa {
  return {
    etapa: mapEtapa(row.etapa),
    desde: row.desde,
    hasta: row.hasta,
    forzado: row.forzado === true,
    motivo: row.motivo ?? null,
  };
}

/** Columnas que se piden a la Data API. Explícitas, para que el tipo de fila no mienta. */
export const COLUMNAS = {
  cliente:
    "id, tipo, razon_social, ruc, dni, domicilio, partida, representante, representante_dni, representante_cargo, email, telefono, actividad, banco_origen, beneficiario_final, origen_fondos, es_pep, kyc_ficha_ruc_en, kyc_vigencia_en, kyc_listas_en, kyc_listas_resultado, kyc_completo, user_id, notas_internas, created_at, updated_at",
  contraparte: "id, tipo, nombre, pais, contacto, email, telefono, banco_verificado_en",
  embarque:
    "id, codigo, modalidad, contenedor, forwarder_id, aseguradora_id, almacen_consolidacion, puerto_origen, puerto_destino, fecha_release_est, fecha_release_real, fecha_carga, fecha_zarpe_est, fecha_zarpe_real, fecha_arribo_est, fecha_arribo_real, nave, master_bl, precinto, flete_total_usd, gastos_contenedor_usd, declaracion_exportacion, estado, notas_internas",
  expediente:
    "id, codigo, cliente_id, etapa, etapa_desde, origen_solicitud_id, embarque_id, proporcion_flete, veh_marca, veh_modelo, veh_version, veh_anio, veh_vin, veh_color, veh_km, veh_combustible, veh_cilindrada_cc, veh_transmision, veh_condicion, veh_categoria, veh_origen, veh_pais_ensamblaje, veh_doc_propiedad, veh_peso_kg, veh_medidas, moneda_compra, precio_compra, precio_compra_usd, fecha_limite_compra, fecha_inspeccion, historial_ref, fecha_release, pais_origen, puerto_origen, presupuesto, honorarios_usd, honorarios_base_usd, honorarios_igv_usd, porcentaje_detraccion, margen_h3, fecha_firma, fecha_limite_h2, fecha_est_embarque, fecha_est_arribo, fecha_est_entrega, semanas_estimadas, loa_vence, dam_numero, dam_fecha, dam_canal, levante_en, placa, tive_numero, km_entrega, fecha_entrega, cancelado_motivo, cerrado_en, created_at, updated_at",
  /** Columnas de la vista `expediente_cliente` (sin reservado ni margen). */
  expedienteCliente:
    "id, codigo, cliente_id, etapa, etapa_desde, embarque_id, veh_marca, veh_modelo, veh_version, veh_anio, veh_vin, veh_color, veh_km, veh_combustible, veh_cilindrada_cc, veh_transmision, veh_condicion, veh_categoria, veh_pais_ensamblaje, moneda_compra, precio_compra, precio_compra_usd, fecha_inspeccion, pais_origen, puerto_origen, honorarios_usd, honorarios_base_usd, honorarios_igv_usd, fecha_firma, fecha_limite_h2, fecha_est_embarque, fecha_est_arribo, fecha_est_entrega, semanas_estimadas, dam_numero, dam_fecha, levante_en, placa, tive_numero, fecha_entrega, cancelado_motivo, cerrado_en, created_at, updated_at",
  reservado: "precio_tope, tc_compra_ref, vendedor_id, inspector_id, agente_aduana_id, notas_internas",
  tarea: "id, expediente_id, etapa, clave, titulo, descripcion, responsable, estado, vence_el, hecha_en, visible_cliente, orden",
  tareaCliente: "id, expediente_id, etapa, clave, titulo, descripcion, responsable, estado, vence_el, hecha_en, orden",
  hito: "id, expediente_id, tipo, monto_estimado_usd, fecha_limite, cuenta, nota",
  hitoCliente: "id, expediente_id, tipo, monto_estimado_usd, fecha_limite, nota",
  evento: "id, expediente_id, tipo, titulo, detalle, visible_cliente, actor_tipo, etapa, created_at",
  eventoCliente: "id, expediente_id, tipo, titulo, detalle, actor_tipo, etapa, created_at",
  etapaHist: "id, expediente_id, etapa, desde, hasta, forzado, motivo",
  etapaHistCliente: "id, expediente_id, etapa, desde, hasta",
  aprobacion: "id, expediente_id, tipo, payload, created_at",
  embarqueCliente:
    "expediente_id, id, codigo, modalidad, contenedor, puerto_origen, puerto_destino, fecha_release_est, fecha_release_real, fecha_carga, fecha_zarpe_est, fecha_zarpe_real, fecha_arribo_est, fecha_arribo_real, nave, master_bl",
} as const;
