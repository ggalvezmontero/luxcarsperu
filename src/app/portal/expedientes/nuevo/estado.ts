/**
 * Estado del asistente de alta de expediente y su traducción a lo que recibe
 * `crear_expediente(p_datos)`. Los campos de formulario son texto (lo que
 * escribe el usuario); se convierten al construir los datos.
 */

import { tareasParaEtapa } from "@/core/expedientes/avance";
import { hitosDesde } from "@/core/expedientes/hitos";
import { entradaPorDefecto, presupuestar } from "@/core/expedientes/presupuesto";
import type {
  Cliente,
  ContextoExpediente,
  Embarque,
  EntradaPresupuesto,
  Expediente,
  ImporterProfile,
  ModalidadEmbarque,
  Presupuesto,
  TipoContenedor,
  VehicleCategoryId,
  VehicleCondition,
  VehicleOrigin,
} from "@/core/expedientes/tipos";
import type { DatosCrearExpediente } from "@/lib/expedientes/consultas";
import { tareasAJson } from "@/lib/expedientes/consultas";
import { leerNumero } from "@/lib/expedientes/formato";

export type Paso = 1 | 2 | 3 | 4;

export type VehiculoForm = {
  vin: string;
  marca: string;
  modelo: string;
  version: string;
  anio: string;
  color: string;
  km: string;
  combustible: string;
  cilindrada_cc: string;
  transmision: string;
  condicion: VehicleCondition;
  categoria: VehicleCategoryId;
  origen: VehicleOrigin;
  pais_ensamblaje: string;
  doc_propiedad: string;
};

export type CompraForm = {
  moneda: string;
  precio: string;
  precio_tope: string;
  tc_ref: string;
  fecha_limite_compra: string;
  pais_origen: string;
  puerto_origen: string;
  modalidad: ModalidadEmbarque;
  embarqueModo: "ninguno" | "existente" | "nuevo";
  embarque_id: string;
  embarque_contenedor: TipoContenedor | "";
  embarque_puerto_origen: string;
  embarque_fecha_release_est: string;
  embarque_fecha_zarpe_est: string;
  embarque_fecha_arribo_est: string;
  proporcion: string;
  fecha_limite_h2: string;
  fecha_est_embarque: string;
  fecha_est_arribo: string;
  fecha_est_entrega: string;
  semanas_estimadas: string;
  notas_internas: string;
};

export type PresupuestoForm = {
  inland: string;
  flete_base: string;
  gastos_aduana: string;
  gastos_registrales: string;
  margen_h3: string;
  perfil: ImporterProfile;
  percepcion_en_h3: boolean;
  etapa_inicial: "prospecto" | "contrato";
};

export type EstadoAlta = {
  paso: Paso;
  cliente: Cliente | null;
  origenSolicitudId: string | null;
  vehiculo: VehiculoForm;
  compra: CompraForm;
  presupuesto: PresupuestoForm;
};

export const VEHICULO_INICIAL: VehiculoForm = {
  vin: "",
  marca: "",
  modelo: "",
  version: "",
  anio: "",
  color: "",
  km: "",
  combustible: "",
  cilindrada_cc: "",
  transmision: "",
  condicion: "nuevo",
  categoria: "gasolina",
  origen: "otro",
  pais_ensamblaje: "",
  doc_propiedad: "",
};

export const COMPRA_INICIAL: CompraForm = {
  moneda: "USD",
  precio: "",
  precio_tope: "",
  tc_ref: "1",
  fecha_limite_compra: "",
  pais_origen: "Estados Unidos",
  puerto_origen: "Miami",
  modalidad: "exclusivo",
  embarqueModo: "ninguno",
  embarque_id: "",
  embarque_contenedor: "c40hc",
  embarque_puerto_origen: "Miami",
  embarque_fecha_release_est: "",
  embarque_fecha_zarpe_est: "",
  embarque_fecha_arribo_est: "",
  proporcion: "1",
  fecha_limite_h2: "",
  fecha_est_embarque: "",
  fecha_est_arribo: "",
  fecha_est_entrega: "",
  semanas_estimadas: "",
  notas_internas: "",
};

export function presupuestoInicial(categoria: VehicleCategoryId): PresupuestoForm {
  const base = entradaPorDefecto({ precio: 0, vehicleType: categoria, condition: "nuevo", origin: "otro" });
  return {
    inland: "0",
    flete_base: String(Math.round(base.fleteBase)),
    gastos_aduana: String(base.gastosAduana),
    gastos_registrales: "0",
    margen_h3: "0",
    perfil: "primera-importacion",
    percepcion_en_h3: true,
    etapa_inicial: "prospecto",
  };
}

export const ESTADO_INICIAL: EstadoAlta = {
  paso: 1,
  cliente: null,
  origenSolicitudId: null,
  vehiculo: VEHICULO_INICIAL,
  compra: COMPRA_INICIAL,
  presupuesto: presupuestoInicial("gasolina"),
};

/* -------------------------------------------------------------------------- */

export function validarVehiculo(v: VehiculoForm): string | null {
  if (v.marca.trim().length < 1) return "Falta la marca.";
  if (v.modelo.trim().length < 1) return "Falta el modelo.";
  const anio = Number(v.anio);
  if (!Number.isInteger(anio) || anio < 1980 || anio > 2100) return "El año modelo no es válido.";
  if (v.vin && v.vin.length !== 17) return "El VIN tiene 17 caracteres (o déjalo vacío si todavía no hay unidad).";
  return null;
}

export function validarCompra(c: CompraForm): string | null {
  const precio = leerNumero(c.precio);
  if (precio === null || precio <= 0) return "Escribe el precio de compra (o el estimado).";
  if (c.moneda !== "USD") {
    const tc = leerNumero(c.tc_ref);
    if (tc === null || tc <= 0) return "Con otra moneda hace falta el tipo de cambio de referencia a USD.";
  }
  const prop = leerNumero(c.proporcion);
  if (prop === null || prop <= 0 || prop > 1) return "La proporción del flete va de 0 a 1.";
  if (c.embarqueModo === "existente" && !c.embarque_id) return "Elige el embarque o crea uno nuevo.";
  return null;
}

export function tipoDeCambio(c: CompraForm): number {
  return c.moneda === "USD" ? 1 : (leerNumero(c.tc_ref) ?? 0);
}

export function precioUsd(c: CompraForm): number {
  return (leerNumero(c.precio) ?? 0) * tipoDeCambio(c);
}

export function entradaDesde(estado: EstadoAlta): EntradaPresupuesto {
  const { vehiculo: v, compra: c, presupuesto: p } = estado;
  return entradaPorDefecto({
    precio: leerNumero(c.precio) ?? 0,
    monedaCompra: c.moneda,
    tcCompraRef: tipoDeCambio(c),
    vehicleType: v.categoria,
    condition: v.condicion,
    origin: v.origen,
    cylinderCapacityCc: leerNumero(v.cilindrada_cc),
    importerProfile: p.perfil,
    inland: leerNumero(p.inland) ?? 0,
    fleteBase: leerNumero(p.flete_base) ?? 0,
    proporcionFlete: leerNumero(c.proporcion) ?? 1,
    gastosAduana: leerNumero(p.gastos_aduana) ?? 0,
    gastosRegistrales: leerNumero(p.gastos_registrales) ?? 0,
    margenH3: (leerNumero(p.margen_h3) ?? 0) / 100,
    percepcionEnH3: p.percepcion_en_h3,
  });
}

export function calcularPresupuesto(estado: EstadoAlta): { presupuesto: Presupuesto | null; error: string | null } {
  try {
    return { presupuesto: presupuestar(entradaDesde(estado)), error: null };
  } catch (e) {
    return { presupuesto: null, error: e instanceof Error ? e.message : "No se pudo calcular." };
  }
}

/**
 * Expediente "previo", tal como quedará, para que el core genere las tareas
 * de la etapa inicial (necesita fechas y modalidad) y la alerta de año modelo.
 */
export function contextoPrevio(estado: EstadoAlta, embarqueElegido: Embarque | null): ContextoExpediente {
  const { vehiculo: v, compra: c } = estado;
  const expediente: Expediente = {
    id: "",
    codigo: "",
    clienteId: estado.cliente?.id ?? "",
    etapa: estado.presupuesto.etapa_inicial,
    etapaDesde: new Date().toISOString(),
    origenSolicitudId: estado.origenSolicitudId,
    embarqueId: embarqueElegido?.id ?? null,
    proporcionFlete: leerNumero(c.proporcion) ?? 1,
    vehiculo: {
      marca: v.marca.trim(),
      modelo: v.modelo.trim(),
      version: v.version.trim() || null,
      anio: Number(v.anio),
      vin: v.vin || null,
      color: v.color || null,
      km: leerNumero(v.km),
      combustible: v.combustible || null,
      cilindradaCc: leerNumero(v.cilindrada_cc),
      transmision: v.transmision || null,
      condicion: v.condicion,
      categoria: v.categoria,
      origen: v.origen,
      paisEnsamblaje: v.pais_ensamblaje || null,
      docPropiedad: v.doc_propiedad || null,
      pesoKg: null,
      medidas: null,
    },
    monedaCompra: c.moneda,
    precioCompra: leerNumero(c.precio),
    precioCompraUsd: precioUsd(c),
    fechaLimiteCompra: c.fecha_limite_compra || null,
    fechaInspeccion: null,
    historialRef: null,
    fechaRelease: null,
    paisOrigen: c.pais_origen || null,
    puertoOrigen: c.puerto_origen || null,
    presupuesto: null,
    honorariosUsd: null,
    honorariosBaseUsd: null,
    honorariosIgvUsd: null,
    porcentajeDetraccion: null,
    margenH3: (leerNumero(estado.presupuesto.margen_h3) ?? 0) / 100,
    tarifaCustodiaUsd: null,
    costoInspeccionUsd: null,
    fechaFirma: null,
    fechaLimiteH2: c.fecha_limite_h2 || null,
    fechaEstEmbarque: c.fecha_est_embarque || null,
    fechaEstArribo: c.fecha_est_arribo || (c.embarqueModo === "nuevo" ? c.embarque_fecha_arribo_est || null : embarqueElegido?.fechaArriboEst ?? null),
    fechaEstEntrega: c.fecha_est_entrega || null,
    semanasEstimadas: c.semanas_estimadas || null,
    loaVence: null,
    damNumero: null,
    damFecha: null,
    damCanal: null,
    damFactorConversion: null,
    damTcSbs: null,
    levanteEn: null,
    placa: null,
    tiveNumero: null,
    kmEntrega: null,
    fechaEntrega: null,
    canceladoMotivo: null,
    cerradoEn: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reservado: null,
  };
  const embarque: Embarque | null =
    c.embarqueModo === "nuevo"
      ? {
          id: "",
          codigo: "",
          modalidad: c.modalidad,
          contenedor: c.embarque_contenedor || null,
          forwarderId: null,
          aseguradoraId: null,
          almacenConsolidacion: null,
          puertoOrigen: c.embarque_puerto_origen || null,
          puertoDestino: "Callao",
          fechaReleaseEst: c.embarque_fecha_release_est || null,
          fechaReleaseReal: null,
          fechaCarga: null,
          fechaZarpeEst: c.embarque_fecha_zarpe_est || null,
          fechaZarpeReal: null,
          fechaArriboEst: c.embarque_fecha_arribo_est || null,
          fechaArriboReal: null,
          nave: null,
          masterBl: null,
          precinto: null,
          fleteTotalUsd: null,
          gastosContenedorUsd: null,
          declaracionExportacion: null,
          estado: "planificado",
          notasInternas: null,
        }
      : embarqueElegido;
  return {
    expediente,
    cliente: estado.cliente,
    embarque,
    tareas: [],
    hitos: [],
    aprobaciones: [],
    etapas: [],
    movimientos: [],
    documentos: [],
  };
}

export function construirDatos(estado: EstadoAlta, presupuesto: Presupuesto, embarqueElegido: Embarque | null): DatosCrearExpediente {
  const { vehiculo: v, compra: c, presupuesto: p } = estado;
  const ctx = contextoPrevio(estado, embarqueElegido);
  const e = ctx.expediente;
  const hitos = hitosDesde(presupuesto, {
    fechaLimiteH2: e.fechaLimiteH2,
    fechaEstArribo: e.fechaEstArribo,
    fechaEstEntrega: e.fechaEstEntrega,
  });
  return {
    cliente_id: estado.cliente!.id,
    etapa: p.etapa_inicial,
    origen_solicitud_id: estado.origenSolicitudId,
    embarque_id: c.embarqueModo === "existente" ? c.embarque_id : null,
    embarque_nuevo:
      c.embarqueModo === "nuevo"
        ? {
            modalidad: c.modalidad,
            contenedor: c.embarque_contenedor || null,
            puerto_origen: c.embarque_puerto_origen || null,
            puerto_destino: "Callao",
            fecha_release_est: c.embarque_fecha_release_est || null,
            fecha_zarpe_est: c.embarque_fecha_zarpe_est || null,
            fecha_arribo_est: c.embarque_fecha_arribo_est || null,
          }
        : null,
    proporcion_flete: e.proporcionFlete,
    veh_marca: e.vehiculo.marca,
    veh_modelo: e.vehiculo.modelo,
    veh_version: e.vehiculo.version,
    veh_anio: e.vehiculo.anio,
    veh_vin: e.vehiculo.vin,
    veh_color: e.vehiculo.color,
    veh_km: e.vehiculo.km,
    veh_combustible: e.vehiculo.combustible,
    veh_cilindrada_cc: e.vehiculo.cilindradaCc,
    veh_transmision: e.vehiculo.transmision,
    veh_condicion: v.condicion,
    veh_categoria: v.categoria,
    veh_origen: v.origen,
    veh_pais_ensamblaje: e.vehiculo.paisEnsamblaje,
    veh_doc_propiedad: e.vehiculo.docPropiedad,
    moneda_compra: c.moneda,
    precio_compra: e.precioCompra,
    precio_compra_usd: Math.round(precioUsd(c) * 100) / 100,
    precio_tope: leerNumero(c.precio_tope),
    tc_compra_ref: c.moneda === "USD" ? null : tipoDeCambio(c),
    fecha_limite_compra: e.fechaLimiteCompra,
    pais_origen: e.paisOrigen,
    puerto_origen: e.puertoOrigen,
    presupuesto,
    honorarios_usd: presupuesto.honorarios,
    honorarios_base_usd: presupuesto.honorariosBase,
    honorarios_igv_usd: presupuesto.honorariosIgv,
    margen_h3: presupuesto.margenH3,
    fecha_limite_h2: e.fechaLimiteH2,
    fecha_est_embarque: e.fechaEstEmbarque,
    fecha_est_arribo: e.fechaEstArribo,
    fecha_est_entrega: e.fechaEstEntrega,
    semanas_estimadas: e.semanasEstimadas,
    notas_internas: c.notas_internas.trim() || null,
    hitos: hitos.map((h) => ({
      tipo: h.tipo,
      monto_estimado_usd: h.montoEstimadoUsd,
      fecha_limite: h.fechaLimite,
      cuenta: h.cuenta,
      nota: h.nota,
    })),
    tareas: tareasAJson(tareasParaEtapa(p.etapa_inicial, ctx)),
  };
}
