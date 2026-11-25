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

/** `public.etapa_expediente`. El orden operativo está en `ETAPAS_ORDEN`. */
export type EtapaExpediente =
  | "prospecto"
  | "contrato"
  | "busqueda"
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
  "contrato",
  "busqueda",
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

export type TipoHito = "H1" | "H2" | "H3" | "H4";
export const TIPOS_HITO: readonly TipoHito[] = ["H1", "H2", "H3", "H4"];

export type CuentaMovimiento = "fondos_clientes" | "operaciones" | "detracciones";

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

export type TipoAprobacion =
  | "aprobar_inspeccion"
  | "elegir_consolidado"
  | "declarar_deposito"
  | "conformidad_rendicion"
  | "confirmar_cuentas";

export type TipoContraparte =
  | "vendedor"
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
  | "aviso_h3"
  | "liquidacion_definitiva"
  | "acta_entrega"
  | "rendicion"
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
  bancoVerificadoEn: string | null;
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
};

/** Parte reservada del expediente (`expedientes_reservado`): solo admin. */
export type ExpedienteReservado = {
  precioTope: number | null;
  tcCompraRef: number | null;
  vendedorId: string | null;
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
  fechaInspeccion: FechaIso | null;
  historialRef: string | null;
  fechaRelease: FechaIso | null;
  paisOrigen: string | null;
  puertoOrigen: string | null;
  presupuesto: Presupuesto | null;
  honorariosUsd: number | null;
  honorariosBaseUsd: number | null;
  honorariosIgvUsd: number | null;
  porcentajeDetraccion: number | null;
  margenH3: number;
  /** USD por día de custodia si el cliente no recoge el auto (cláusula 13.d). */
  tarifaCustodiaUsd: number | null;
  /** Gasto de inspección que se retiene si el cliente desiste antes de la compra (cláusula 15.1). */
  costoInspeccionUsd: number | null;
  fechaFirma: FechaIso | null;
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

export const CUENTAS_MOVIMIENTO: readonly CuentaMovimiento[] = ["fondos_clientes", "operaciones", "detracciones"];

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
  /** Aviso H3: el hito al que se refiere. */
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
   * Terceros del expediente (vendedor, forwarder, agente, inspector), solo
   * para el equipo: las plantillas de documentos los nombran. El cliente no
   * los recibe (sus datos salen en el Anexo A ya generado).
   */
  contrapartes?: Contraparte[];
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
  precioUsd: number;
  inland: number;
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
  gastosRegistrales: number;
  costoPuestoEnLima: number;
  honorarios: number;
  honorariosBase: number;
  honorariosIgv: number;
  margenH3: number;
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
  inland: number;
  /** Flete del contenedor completo. Por defecto el del motor público. */
  fleteBase: number;
  /** 1 exclusivo · 0.5 consolidado a dos. */
  proporcionFlete: number;
  gastosAduana: number;
  gastosRegistrales: number;
  margenH3: number;
  /** Si la percepción se incluye en H3 (el cliente la pone al numerar la DAM). Por defecto sí. */
  percepcionEnH3?: boolean;
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
