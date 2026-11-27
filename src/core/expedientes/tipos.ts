/**
 * Tipos del dominio de expedientes de importación.
 *
 * TypeScript puro: sin React, sin Next, sin base de datos. Los enums son el
 * espejo exacto de la migración `20261125090000_expedientes.sql`; si uno
 * cambia, cambian los dos. `src/lib/db/types.ts` los reexporta para que la UI
 * consuma un solo módulo de tipos.
 */

import type { VehicleCategoryId } from "../pricing/vehicleCategories";
import type { ImporterProfile, VehicleCondition, VehicleOrigin } from "../pricing/pricingConfig";

export type { VehicleCategoryId, VehicleCondition, VehicleOrigin, ImporterProfile };

/**
 * `public.etapa_expediente`. El orden operativo está en `ETAPAS_ORDEN`. Desde el
 * 27 nov 2026 primero se busca y se elige el auto (sin costo) y el contrato se
 * firma con la unidad ya elegida: `busqueda` va antes de `contrato`.
 */
export type EtapaExpediente =
  | "prospecto"
  | "busqueda"
  | "contrato"
  | "compra"
  | "embarque"
  | "transito"
  | "aduana"
  | "placas"
  | "entrega"
  | "cerrado"
  | "cancelado";

/** Las etapas en línea, de la apertura al cierre. `cancelado` queda fuera: es terminal desde cualquiera. */
export const ETAPAS_ORDEN: readonly EtapaExpediente[] = [
  "prospecto",
  "busqueda",
  "contrato",
  "compra",
  "embarque",
  "transito",
  "aduana",
  "placas",
  "entrega",
  "cerrado",
];

/** Las nueve etapas que ve el cliente en su barra de avance (sin prospecto). */
export const ETAPAS_CLIENTE: readonly EtapaExpediente[] = ETAPAS_ORDEN.filter(
  (e) => e !== "prospecto",
);

export const ETAPAS_EXPEDIENTE: readonly EtapaExpediente[] = [...ETAPAS_ORDEN, "cancelado"];

export type ModalidadEmbarque = "consolidado" | "exclusivo" | "roro";
export const MODALIDADES_EMBARQUE: readonly ModalidadEmbarque[] = ["consolidado", "exclusivo", "roro"];

export type TipoContenedor = "c20" | "c40" | "c40hc" | "roro";
export const TIPOS_CONTENEDOR: readonly TipoContenedor[] = ["c20", "c40", "c40hc", "roro"];

/**
 * Calendario definitivo del dueño (27 nov 2026): cinco pagos, seis hitos, una
 * cuenta por hito.
 *   Pago 1 · H1 · al firmar el contrato · precio del vehículo (pro forma del broker; en
 *            usados, más la inspección) → Fondos de Clientes
 *   Pago 2 · H2 · release · flete (traslado al puerto y marítimo) y seguro → Fondos de Clientes
 *          · H3 · release · 50 % de los honorarios → Operaciones (detracción al Banco de la Nación)
 *   Pago 3 · H4 · al arribo · gastos de aduana (agente, almacenaje, grúa) según la pro forma
 *            del agente → Fondos de Clientes; gasto reembolsable: el sobrante o faltante se
 *            compensa en el Pago 5
 *   Pago 4 · H5 · cuando SUNAT liquida la DAM · tributos exactos de la liquidación, en soles;
 *            por defecto los paga el cliente DIRECTAMENTE a SUNAT → cuenta `directo`
 *   Pago 5 · H6 · con el levante · 50 % restante de los honorarios, neto del saldo de aduana
 *            → Operaciones
 */
export type TipoHito = "H1" | "H2" | "H3" | "H4" | "H5" | "H6";
export const TIPOS_HITO: readonly TipoHito[] = ["H1", "H2", "H3", "H4", "H5", "H6"];

/** Pago que ve el cliente (1 a 5) al que pertenece cada hito. */
export type NumeroPago = 1 | 2 | 3 | 4 | 5;
export const PAGO_POR_HITO: Record<TipoHito, NumeroPago> = { H1: 1, H2: 2, H3: 2, H4: 3, H5: 4, H6: 5 };
export const NUMEROS_PAGO: readonly NumeroPago[] = [1, 2, 3, 4, 5];

/**
 * `directo` no es una cuenta de Luxcars: marca lo que el cliente paga
 * directamente a un tercero (los tributos a SUNAT, hito H5). Se registra para
 * que el hito quede acreditado y la rendición lo liste, pero no entra en el
 * saldo de Fondos de Clientes.
 */
export type CuentaMovimiento = "fondos_clientes" | "operaciones" | "detracciones" | "directo";

export type ResponsableTarea = "luxcars" | "cliente" | "tercero";
export const RESPONSABLES_TAREA: readonly ResponsableTarea[] = ["luxcars", "cliente", "tercero"];

export type EstadoTarea = "pendiente" | "hecha" | "no_aplica";

export type TipoEvento =
  | "etapa"
  | "tarea"
  | "hito"
  | "movimiento"
  | "documento"
  | "aprobacion"
  | "nota"
  | "notificacion"
  | "alerta";

/** `aprobar_inspeccion` queda en la enum por las filas viejas; desde el 27 nov 2026 la acción es `aprobar_unidad`. */
export type TipoAprobacion =
  | "aprobar_unidad"
  | "aprobar_inspeccion"
  | "elegir_consolidado"
  | "declarar_deposito"
  | "conformidad_rendicion"
  | "confirmar_cuentas";

/** `vendedor` es el DEALER que emite la factura y el MSO a nombre del cliente; `broker` el intermediario al que se gira el precio. */
export type TipoContraparte =
  | "vendedor"
  | "broker"
  | "forwarder"
  | "agente_aduana"
  | "aseguradora"
  | "inspector"
  | "notaria"
  | "deposito"
  | "gestor"
  | "otro";
export const TIPOS_CONTRAPARTE: readonly TipoContraparte[] = [
  "vendedor",
  "broker",
  "forwarder",
  "agente_aduana",
  "aseguradora",
  "inspector",
  "notaria",
  "deposito",
  "gestor",
  "otro",
];

export type TipoCliente = "empresa" | "persona";
export const TIPOS_CLIENTE: readonly TipoCliente[] = ["empresa", "persona"];

/** Tipos de documento (fase 2). Se declaran ya porque las compuertas los nombran. */
export type TipoDocumento =
  | "contrato"
  | "anexo_a"
  | "anexo_b"
  | "anexo_c"
  | "anexo_d"
  | "loa"
  | "instrucciones_vendedor"
  | "instrucciones_forwarder"
  | "constancia_fondos"
  /**
   * Aviso de pago de los hitos que se fijan durante la operación: H4 (gastos de
   * aduana, Pago 3), H5 (tributos de la liquidación de SUNAT, Pago 4) y H6
   * (honorarios netos, Pago 5). La columna `hito` del documento dice cuál. El
   * valor de la enum conserva el nombre viejo `aviso_h3`: renombrar un valor de
   * enum en Postgres costaba más que documentarlo.
   */
  | "aviso_h3"
  | "liquidacion_definitiva"
  /** En desuso desde el 27 nov 2026: los reemplaza `acta_rendicion`. Quedan por las filas viejas. */
  | "acta_entrega"
  | "rendicion"
  /** Acta de entrega y rendición de cuentas: un solo documento que el cliente firma simple con el auto delante. */
  | "acta_rendicion"
  /** Poder especial para la inmatriculación en SUNARP, placas y tarjeta (firma en la misma visita a la notaría). */
  | "poder_inmatriculacion"
  | "factura_honorarios"
  | "bill_of_sale"
  | "documento_propiedad"
  | "informe_inspeccion"
  | "poliza"
  | "bl"
  | "acta_carga"
  | "dam"
  | "liquidacion_sunat"
  | "comprobante_pago"
  | "comprobante_cliente"
  | "tive"
  | "otro";

export const TIPOS_DOCUMENTO: readonly TipoDocumento[] = [
  "contrato",
  "anexo_a",
  "anexo_b",
  "anexo_c",
  "anexo_d",
  "loa",
  "instrucciones_vendedor",
  "instrucciones_forwarder",
  "constancia_fondos",
  "aviso_h3",
  "liquidacion_definitiva",
  "acta_entrega",
  "rendicion",
  "acta_rendicion",
  "poder_inmatriculacion",
  "factura_honorarios",
  "bill_of_sale",
  "documento_propiedad",
  "informe_inspeccion",
  "poliza",
  "bl",
  "acta_carga",
  "dam",
  "liquidacion_sunat",
  "comprobante_pago",
  "comprobante_cliente",
  "tive",
  "otro",
];

/** `public.documento_estado`. `emitido` es el generado vigente; al regenerar pasa a `reemplazado`. */
export type EstadoDocumento = "borrador" | "emitido" | "firmado" | "reemplazado" | "anulado";
export const ESTADOS_DOCUMENTO: readonly EstadoDocumento[] = ["borrador", "emitido", "firmado", "reemplazado", "anulado"];

/* -------------------------------------------------------------------------- */
/* Entidades (ya mapeadas a camelCase; las filas crudas viven en lib/db)      */
/* -------------------------------------------------------------------------- */

/** Fecha ISO `YYYY-MM-DD` (columna `date`). */
export type FechaIso = string;

export type Cliente = {
  id: string;
  tipo: TipoCliente;
  razonSocial: string;
  ruc: string | null;
  dni: string | null;
  domicilio: string | null;
  partida: string | null;
  representante: string | null;
  representanteDni: string | null;
  representanteCargo: string | null;
  email: string | null;
  telefono: string | null;
  actividad: string | null;
  bancoOrigen: string | null;
  beneficiarioFinal: string | null;
  origenFondos: string | null;
  esPep: boolean;
  kycFichaRucEn: FechaIso | null;
  kycVigenciaEn: FechaIso | null;
  kycListasEn: FechaIso | null;
  kycListasResultado: string | null;
  kycCompleto: boolean;
  /** Cuenta en /cuenta vinculada. `null` hasta vincular. */
  userId: string | null;
  notasInternas: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Embarque = {
  id: string;
  codigo: string;
  modalidad: ModalidadEmbarque;
  contenedor: TipoContenedor | null;
  forwarderId: string | null;
  aseguradoraId: string | null;
  almacenConsolidacion: string | null;
  puertoOrigen: string | null;
  puertoDestino: string;
  fechaReleaseEst: FechaIso | null;
  fechaReleaseReal: FechaIso | null;
  fechaCarga: FechaIso | null;
  fechaZarpeEst: FechaIso | null;
  fechaZarpeReal: FechaIso | null;
  fechaArriboEst: FechaIso | null;
  fechaArriboReal: FechaIso | null;
  nave: string | null;
  masterBl: string | null;
  precinto: string | null;
  fleteTotalUsd: number | null;
  gastosContenedorUsd: number | null;
  declaracionExportacion: string | null;
  estado: string;
  notasInternas: string | null;
};

/** Datos bancarios de una contraparte, como campos sueltos (nunca texto libre). */
export type DatosBancarios = {
  banco?: string;
  titular?: string;
  cuenta?: string;
  swift?: string;
  iban?: string;
  aba?: string;
  moneda?: string;
  direccionBanco?: string;
};

export type Contraparte = {
  id: string;
  tipo: TipoContraparte;
  nombre: string;
  pais: string | null;
  direccion: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  rucOTaxId: string | null;
  /** Solo lo trae el equipo cuando pide la columna; `null` si no hay. */
  datosBancarios: DatosBancarios | null;
  bancoVerificadoEn: string | null;
  bancoVerificadoPor: string | null;
  notas: string | null;
};

export type CanalNotificacion = "email" | "whatsapp";
export type EstadoNotificacion = "enviada" | "fallida" | "preparada";

/** Aviso preparado o enviado a un cliente (`notificaciones`). */
export type NotificacionRegistrada = {
  id: string;
  expedienteId: string | null;
  canal: CanalNotificacion;
  plantilla: string;
  destinatario: string | null;
  asunto: string | null;
  cuerpoTexto: string | null;
  estado: EstadoNotificacion;
  enviadoEn: string | null;
  error: string | null;
  createdAt: string;
};

export type Vehiculo = {
  marca: string;
  modelo: string;
  version: string | null;
  anio: number;
  vin: string | null;
  color: string | null;
  km: number | null;
  combustible: string | null;
  cilindradaCc: number | null;
  transmision: string | null;
  condicion: VehicleCondition;
  categoria: VehicleCategoryId;
  origen: VehicleOrigin;
  paisEnsamblaje: string | null;
  docPropiedad: string | null;
  pesoKg: number | null;
  medidas: string | null;
  /** Clase para el Anexo A y la aduana: M1 (autos y SUV) o N1 (pickups y camionetas). */
  clase: ClaseVehiculo | null;
};

export const CLASES_VEHICULO = ["M1", "N1"] as const;
export type ClaseVehiculo = (typeof CLASES_VEHICULO)[number];

/** Otro expediente del mismo embarque (consolidado): lo nombran las instrucciones al forwarder. */
export type UnidadDelEmbarque = {
  id: string;
  codigo: string;
  vin: string | null;
  marca: string;
  modelo: string;
};

/** Parte reservada del expediente (`expedientes_reservado`): solo admin. */
export type ExpedienteReservado = {
  precioTope: number | null;
  tcCompraRef: number | null;
  /** Dealer: emite la factura o bill of sale y el MSO a nombre del cliente. */
  vendedorId: string | null;
  /** Broker al que se gira el precio completo y que paga al dealer. Sin broker, el dealer cobra directo. */
  brokerId: string | null;
  /** Solo usados: quién inspecciona la unidad antes de que el cliente la apruebe. */
  inspectorId: string | null;
  agenteAduanaId: string | null;
  notasInternas: string | null;
};

export type Expediente = {
  id: string;
  codigo: string;
  clienteId: string;
  etapa: EtapaExpediente;
  etapaDesde: string;
  origenSolicitudId: string | null;
  embarqueId: string | null;
  proporcionFlete: number;
  vehiculo: Vehiculo;
  monedaCompra: string;
  precioCompra: number | null;
  precioCompraUsd: number | null;
  fechaLimiteCompra: FechaIso | null;
  /** Solo usados: fecha de la inspección física. */
  fechaInspeccion: FechaIso | null;
  /** CarFax (usado) o MSO sin matricular y consulta de recalls por VIN (nuevo). */
  historialRef: string | null;
  fechaRelease: FechaIso | null;
  paisOrigen: string | null;
  puertoOrigen: string | null;
  presupuesto: Presupuesto | null;
  honorariosUsd: number | null;
  honorariosBaseUsd: number | null;
  honorariosIgvUsd: number | null;
  porcentajeDetraccion: number | null;
  /** USD por día de custodia si el cliente no recoge el auto (cláusula 13.d). */
  tarifaCustodiaUsd: number | null;
  /** Solo usados: costo de la inspección (se cobra con el Pago 1; en nuevos es cero y no aparece). */
  costoInspeccionUsd: number | null;
  fechaFirma: FechaIso | null;
  /** Fecha límite del Pago 2 (H2 flete y seguro + H3 primera mitad de honorarios); por defecto el release estimado. Columna `fecha_limite_h2`. */
  fechaLimiteH2: FechaIso | null;
  fechaEstEmbarque: FechaIso | null;
  fechaEstArribo: FechaIso | null;
  fechaEstEntrega: FechaIso | null;
  semanasEstimadas: string | null;
  loaVence: FechaIso | null;
  damNumero: string | null;
  damFecha: FechaIso | null;
  damCanal: string | null;
  /** Factor de conversión monetaria de SUNAT aplicado en la DAM (factura en otra moneda). */
  damFactorConversion: number | null;
  /** Tipo de cambio venta SBS del día en que se pagaron los tributos. */
  damTcSbs: number | null;
  levanteEn: FechaIso | null;
  placa: string | null;
  tiveNumero: string | null;
  kmEntrega: number | null;
  fechaEntrega: FechaIso | null;
  canceladoMotivo: string | null;
  cerradoEn: string | null;
  createdAt: string;
  updatedAt: string;
  /** Solo lo tiene el equipo; en la vista del cliente es `null`. */
  reservado: ExpedienteReservado | null;
};

export type Tarea = {
  id: string;
  expedienteId: string;
  etapa: EtapaExpediente;
  clave: string;
  titulo: string;
  descripcion: string | null;
  responsable: ResponsableTarea;
  estado: EstadoTarea;
  venceEl: FechaIso | null;
  hechaEn: string | null;
  visibleCliente: boolean;
  orden: number;
};

export type Hito = {
  tipo: TipoHito;
  montoEstimadoUsd: number;
  fechaLimite: FechaIso | null;
  cuenta: CuentaMovimiento;
  nota: string | null;
};

export type EstadoHito = "pendiente" | "parcial" | "acreditado";

export type TipoMovimiento = "deposito" | "pago" | "devolucion" | "ajuste";
export const TIPOS_MOVIMIENTO: readonly TipoMovimiento[] = ["deposito", "pago", "devolucion", "ajuste"];

export type EstadoMovimiento = "por_confirmar" | "confirmado" | "anulado";
export const ESTADOS_MOVIMIENTO: readonly EstadoMovimiento[] = ["por_confirmar", "confirmado", "anulado"];

export const CUENTAS_MOVIMIENTO: readonly CuentaMovimiento[] = ["fondos_clientes", "operaciones", "detracciones", "directo"];

/**
 * Asiento del libro (`expediente_movimientos`). Solo los `confirmado` cuentan
 * para saldos e hitos; los `por_confirmar` (declarados por el cliente) se
 * muestran aparte. `notaInterna` solo llega al equipo; la ruta del comprobante
 * no viaja al dominio, solo si existe.
 */
export type Movimiento = {
  id: string;
  expedienteId?: string;
  tipo: TipoMovimiento;
  cuenta: CuentaMovimiento;
  hito: TipoHito | null;
  estado: EstadoMovimiento;
  fecha: FechaIso;
  /** Moneda del asiento (USD, CAD, PEN…). */
  moneda?: string;
  /** Monto en `moneda`. */
  monto?: number;
  /** USD por una unidad de `moneda`; con USD es 1. */
  tipoCambio?: number;
  montoUsd: number;
  concepto: string | null;
  contraparteId: string | null;
  /** Factura, SWIFT, DAM, número de operación o banco de origen. */
  documentoRef?: string | null;
  tieneComprobante?: boolean;
  declaradoPorCliente?: boolean;
  notaInterna?: string | null;
  createdAt?: string;
};

/**
 * Documento del expediente (`expediente_documentos`). Las rutas de objeto no
 * viajan al dominio: solo si existe cada archivo. La descarga pasa siempre por
 * la ruta de servidor que firma la URL.
 */
export type Documento = {
  id: string;
  expedienteId: string;
  tipo: TipoDocumento;
  version: number;
  estado: EstadoDocumento;
  origen: "generado" | "subido";
  titulo: string;
  plantillaVersion: string | null;
  tienePdf: boolean;
  tieneDocx: boolean;
  tieneFirmado: boolean;
  visibleCliente: boolean;
  emitidoEn: string | null;
  firmadoEn: FechaIso | null;
  createdAt: string;
  /** Constancia de fondos: el depósito que la originó. */
  movimientoId?: string | null;
  /** Aviso de pago: el hito al que se refiere (H4, H5 o H6). */
  hito?: TipoHito | null;
};

export type Evento = {
  id: string;
  expedienteId: string;
  tipo: TipoEvento;
  titulo: string;
  detalle: string | null;
  visibleCliente: boolean;
  actorTipo: "admin" | "cliente" | "sistema";
  etapa: EtapaExpediente | null;
  createdAt: string;
};

export type Aprobacion = {
  id: string;
  tipo: TipoAprobacion;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type TramoEtapa = {
  etapa: EtapaExpediente;
  desde: string;
  hasta: string | null;
  forzado: boolean;
  motivo: string | null;
};

/**
 * Todo lo cargado de un expediente, listo para que el core evalúe compuertas,
 * alertas y tareas. Movimientos y documentos llegan vacíos hasta las fases 2
 * y 3; las compuertas lo saben y usan las tareas como evidencia mientras.
 */
export type ContextoExpediente = {
  expediente: Expediente;
  cliente: Cliente | null;
  embarque: Embarque | null;
  tareas: Tarea[];
  hitos: Hito[];
  aprobaciones: Aprobacion[];
  etapas: TramoEtapa[];
  movimientos: Movimiento[];
  documentos: Documento[];
  /**
   * Terceros del expediente (dealer, broker, forwarder, agente de aduana), solo
   * para el equipo: las plantillas de documentos los nombran. El cliente no
   * los recibe (sus datos salen en el Anexo A ya generado).
   */
  contrapartes?: Contraparte[];
  /**
   * Los otros expedientes del mismo embarque (incluido este, se filtra por id),
   * solo para el equipo: en consolidado el VIN de la otra unidad va en las
   * instrucciones al forwarder.
   */
  unidadesDelEmbarque?: UnidadDelEmbarque[];
};

/* -------------------------------------------------------------------------- */
/* Presupuesto (salida de presupuestar(), se guarda en expedientes.presupuesto) */
/* -------------------------------------------------------------------------- */

export type GrupoLinea = "vehiculo" | "logistica" | "tributos" | "gastos" | "honorarios" | "informativo";

export type LineaPresupuesto = {
  clave: string;
  concepto: string;
  montoUsd: number;
  grupo: GrupoLinea;
  /** Texto corto que acompaña la línea (tasa, base, aclaración). */
  detalle?: string;
};

export type HitoPresupuesto = {
  tipo: TipoHito;
  montoUsd: number;
  cuenta: CuentaMovimiento;
  descripcion: string;
};

export type SnapshotTasas = {
  adValorem: number;
  isc: number;
  igv: number;
  ipm: number;
  percepcion: number;
  seguroTasa: number;
  seguroFactorAsegurado: number;
  seguroMinimo: number;
  honorariosTramos: { hasta: number | null; tasa: number }[];
  honorariosMinimo: number;
  honorariosTasaEfectiva: number;
  igvHonorarios: number;
};

export type Presupuesto = {
  motorVersion: string;
  entrada: EntradaPresupuesto;
  /** Precio del vehículo según la pro forma del broker. */
  precioUsd: number;
  /** Solo usados: inspección (hito H1). Cero en nuevos. */
  costoInspeccion: number;
  fleteBase: number;
  proporcionFlete: number;
  flete: number;
  seguro: number;
  cif: number;
  adValorem: number;
  isc: number;
  igv: number;
  ipm: number;
  percepcion: number;
  tributos: number;
  gastosAduana: number;
  costoPuestoEnLima: number;
  honorarios: number;
  honorariosBase: number;
  honorariosIgv: number;
  /** Costo total para el cliente sin la percepción (que es recuperable). */
  totalSinPercepcion: number;
  /** Efectivo total que el cliente pone, percepción incluida. */
  totalConPercepcion: number;
  lineas: LineaPresupuesto[];
  hitos: HitoPresupuesto[];
  tasas: SnapshotTasas;
};

export type EntradaPresupuesto = {
  /** Precio en la moneda de compra. */
  precio: number;
  monedaCompra: string;
  /** USD por una unidad de la moneda de compra (ej. CAD→USD ≈ 0.72). Con USD es 1. */
  tcCompraRef: number;
  vehicleType: VehicleCategoryId;
  condition: VehicleCondition;
  origin: VehicleOrigin;
  cylinderCapacityCc?: number | null;
  importerProfile: ImporterProfile;
  /** Flete del contenedor completo, traslado al puerto incluido. Por defecto el del motor público. */
  fleteBase: number;
  /** 1 exclusivo · 0.5 consolidado a dos. */
  proporcionFlete: number;
  /** Agente de aduana, almacenaje y grúa del puerto (hito H4). */
  gastosAduana: number;
  /** Solo usados: costo de la inspección en USD. Se ignora si el vehículo es nuevo. */
  costoInspeccion?: number;
  /** Si la percepción se suma a los tributos del Pago 4 (se paga con la DAM). Por defecto sí. */
  percepcionEnTributos?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Compuertas, avance y alertas                                               */
/* -------------------------------------------------------------------------- */

export type Faltante = {
  clave: string;
  descripcion: string;
};

export type ResultadoAvance = {
  permitido: boolean;
  faltantes: Faltante[];
  /** `true` si `destino` no es la etapa siguiente (la base lo rechaza salvo a cancelado). */
  salto: boolean;
};

export type TareaNueva = {
  etapa: EtapaExpediente;
  clave: string;
  titulo: string;
  descripcion: string | null;
  responsable: ResponsableTarea;
  estado: EstadoTarea;
  venceEl: FechaIso | null;
  visibleCliente: boolean;
  orden: number;
};

export type NivelAlerta = "alta" | "media";

export type Alerta = {
  clave: string;
  nivel: NivelAlerta;
  titulo: string;
  detalle: string;
};
