/**
 * "Datos que faltan para esta etapa y la siguiente".
 *
 * Calcula, con el mismo core que emite los documentos, qué campos de la FICHA
 * usan las plantillas que se emiten en la etapa actual y en la siguiente
 * (`PLANTILLAS_POR_ETAPA`) y qué columnas exigen las compuertas
 * (`COLUMNAS_COMPUERTA`); filtra los que ya tienen valor y devuelve los
 * faltantes con DÓNDE se guardan (`ORIGEN_CAMPO`: expediente, cliente,
 * embarque, contraparte, empresa) para que la pantalla los pida en línea una
 * sola vez. TypeScript puro, sin fecha actual ni entrada/salida.
 *
 * Lo que arma el libro al emitir (saldos, totales, correlativos) y lo que se
 * escribe en el formulario de emisión (fecha del aviso, TC referencial) no se
 * pide acá: no son datos del expediente.
 */

import { CAMPOS_EMPRESA, camposPlantilla, type Campo } from "./campos";
import { PLANTILLAS, construirDocumento, plantillaDe } from "./documentos";
import { siguienteEtapa } from "./avance";
import type { ContextoExpediente, EtapaExpediente, TipoContraparte, TipoDocumento, TipoHito } from "./tipos";

/** Documentos que el equipo emite en cada etapa. Una plantilla aparece en la etapa donde se genera por primera vez. */
export const PLANTILLAS_POR_ETAPA: Partial<Record<EtapaExpediente, readonly TipoDocumento[]>> = {
  busqueda: ["anexo_a", "anexo_b"],
  contrato: ["contrato", "anexo_c", "anexo_d", "loa", "poder_inmatriculacion", "instrucciones_vendedor"],
  compra: ["instrucciones_forwarder", "constancia_fondos"],
  embarque: ["constancia_fondos"],
  transito: ["aviso_h3"],
  aduana: ["aviso_h3", "liquidacion_definitiva"],
  placas: ["aviso_h3"],
  entrega: ["acta_rendicion"],
};

/** Qué aviso de pago (tipo `aviso_h3`) se emite en cada etapa: Pago 3 en tránsito, Pago 4 en aduana, Pago 5 en placas. */
export const HITO_AVISO_POR_ETAPA: Partial<Record<EtapaExpediente, TipoHito>> = {
  transito: "H4",
  aduana: "H5",
  placas: "H6",
};

export type DestinoDato = "expediente" | "reservado" | "cliente" | "embarque" | "contraparte" | "empresa" | "emision";

export type OrigenCampo = {
  destino: DestinoDato;
  /** Columna en la tabla de destino (snake_case), cuando se guarda en una. */
  columna?: string;
  /** Tipo del control del formulario. */
  tipo?: "texto" | "fecha" | "numero";
  /** Para `contraparte`: qué contraparte del expediente. */
  contraparte?: "vendedor" | "broker" | "inspector" | "forwarder" | "agente_aduana";
  /** Etiqueta corta para el formulario. */
  etiqueta: string;
};

/**
 * Dónde vive cada campo de la ficha que se puede COMPLETAR. Lo que no está
 * acá lo calcula el core (presupuesto, libro) o se escribe al emitir.
 */
export const ORIGEN_CAMPO: Partial<Record<Campo, OrigenCampo>> = {
  FECHA_FIRMA: { destino: "expediente", columna: "fecha_firma", tipo: "fecha", etiqueta: "Fecha de firma del contrato" },
  PAIS_ORIGEN: { destino: "expediente", columna: "pais_origen", etiqueta: "País de origen" },
  PUERTO_ORIGEN: { destino: "expediente", columna: "puerto_origen", etiqueta: "Puerto de salida" },
  SEMANAS_ESTIMADAS: { destino: "expediente", columna: "semanas_estimadas", etiqueta: "Semanas estimadas (texto)" },
  FECHA_LIMITE_H2: { destino: "expediente", columna: "fecha_limite_h2", tipo: "fecha", etiqueta: "Fecha límite del Pago 2" },
  FECHA_EST_EMBARQUE: { destino: "expediente", columna: "fecha_est_embarque", tipo: "fecha", etiqueta: "Zarpe estimado" },
  FECHA_EST_ARRIBO: { destino: "expediente", columna: "fecha_est_arribo", tipo: "fecha", etiqueta: "Arribo estimado" },
  FECHA_EST_ENTREGA: { destino: "expediente", columna: "fecha_est_entrega", tipo: "fecha", etiqueta: "Entrega estimada" },
  LOA_VENCIMIENTO: { destino: "expediente", columna: "loa_vence", tipo: "fecha", etiqueta: "Vencimiento de la LOA" },
  VEH_VERSION: { destino: "expediente", columna: "veh_version", etiqueta: "Versión del vehículo" },
  VEH_VIN: { destino: "expediente", columna: "veh_vin", etiqueta: "VIN" },
  VEH_COLOR: { destino: "expediente", columna: "veh_color", etiqueta: "Color" },
  VEH_KM: { destino: "expediente", columna: "veh_km", tipo: "numero", etiqueta: "Kilometraje" },
  VEH_COMBUSTIBLE: { destino: "expediente", columna: "veh_combustible", etiqueta: "Combustible" },
  VEH_CILINDRADA: { destino: "expediente", columna: "veh_cilindrada_cc", tipo: "numero", etiqueta: "Cilindrada (cc)" },
  VEH_TRANSMISION: { destino: "expediente", columna: "veh_transmision", etiqueta: "Transmisión" },
  VEH_CATEGORIA: { destino: "expediente", columna: "veh_clase", etiqueta: "Clase (M1 o N1)" },
  VEH_PAIS_ENSAMBLAJE: { destino: "expediente", columna: "veh_pais_ensamblaje", etiqueta: "País de ensamblaje" },
  VEH_DOC_PROPIEDAD: { destino: "expediente", columna: "veh_doc_propiedad", etiqueta: "Documento de propiedad (MSO, título…)" },
  VEH_PESO: { destino: "expediente", columna: "veh_peso_kg", tipo: "numero", etiqueta: "Peso bruto (kg)" },
  VEH_MEDIDAS: { destino: "expediente", columna: "veh_medidas", etiqueta: "Medidas (largo × ancho × alto)" },
  MONEDA_COMPRA: { destino: "expediente", columna: "moneda_compra", etiqueta: "Moneda de compra" },
  PRECIO_COMPRA: { destino: "expediente", columna: "precio_compra", tipo: "numero", etiqueta: "Precio de compra" },
  FECHA_LIMITE_COMPRA: { destino: "expediente", columna: "fecha_limite_compra", tipo: "fecha", etiqueta: "Fecha límite de compra" },
  FECHA_INSPECCION: { destino: "expediente", columna: "fecha_inspeccion", tipo: "fecha", etiqueta: "Fecha de la inspección (usado)" },
  COSTO_INSPECCION: { destino: "expediente", columna: "costo_inspeccion_usd", tipo: "numero", etiqueta: "Costo de la inspección en USD (usado)" },
  HISTORIAL_REF: { destino: "expediente", columna: "historial_ref", etiqueta: "Historial (CarFax) o MSO y recalls" },
  FECHA_RELEASE: { destino: "expediente", columna: "fecha_release", tipo: "fecha", etiqueta: "Fecha de release" },
  TARIFA_CUSTODIA: { destino: "expediente", columna: "tarifa_custodia_usd", tipo: "numero", etiqueta: "Tarifa de custodia (USD por día)" },
  DAM_NUMERO: { destino: "expediente", columna: "dam_numero", etiqueta: "Número de la DAM" },
  DAM_FECHA: { destino: "expediente", columna: "dam_fecha", tipo: "fecha", etiqueta: "Fecha de la DAM" },
  CANAL: { destino: "expediente", columna: "dam_canal", etiqueta: "Canal de control" },
  FACTOR_CONVERSION: { destino: "expediente", columna: "dam_factor_conversion", tipo: "numero", etiqueta: "Factor de conversión SUNAT" },
  TC_SBS_PAGO: { destino: "expediente", columna: "dam_tc_sbs", tipo: "numero", etiqueta: "TC venta SBS del pago" },
  FECHA_LEVANTE: { destino: "expediente", columna: "levante_en", tipo: "fecha", etiqueta: "Fecha del levante" },
  FECHA_ENTREGA: { destino: "expediente", columna: "fecha_entrega", tipo: "fecha", etiqueta: "Fecha de entrega" },
  KM_ENTREGA: { destino: "expediente", columna: "km_entrega", tipo: "numero", etiqueta: "Kilometraje a la entrega" },
  PLACA: { destino: "expediente", columna: "placa", etiqueta: "Placa" },
  TIVE_NUMERO: { destino: "expediente", columna: "tive_numero", etiqueta: "Número de la TIVe" },
  PRECIO_TOPE: { destino: "reservado", columna: "precio_tope", tipo: "numero", etiqueta: "Precio tope (reservado)" },

  CLIENTE_RAZON_SOCIAL: { destino: "cliente", columna: "razon_social", etiqueta: "Razón social" },
  CLIENTE_RUC: { destino: "cliente", columna: "ruc", etiqueta: "RUC (o DNI si es persona)" },
  CLIENTE_DOMICILIO: { destino: "cliente", columna: "domicilio", etiqueta: "Domicilio fiscal" },
  CLIENTE_PARTIDA: { destino: "cliente", columna: "partida", etiqueta: "Partida registral" },
  CLIENTE_REPRESENTANTE: { destino: "cliente", columna: "representante", etiqueta: "Representante legal" },
  CLIENTE_REP_DNI: { destino: "cliente", columna: "representante_dni", etiqueta: "DNI del representante" },
  CLIENTE_REP_CARGO: { destino: "cliente", columna: "representante_cargo", etiqueta: "Cargo del representante" },
  CLIENTE_CORREO: { destino: "cliente", columna: "email", etiqueta: "Correo del cliente" },
  CLIENTE_TELEFONO: { destino: "cliente", columna: "telefono", etiqueta: "Teléfono del cliente" },
  CLIENTE_ACTIVIDAD: { destino: "cliente", columna: "actividad", etiqueta: "Actividad económica" },
  CLIENTE_BANCO_ORIGEN: { destino: "cliente", columna: "banco_origen", etiqueta: "Banco y cuenta de origen" },
  CLIENTE_BENEFICIARIO_FINAL: { destino: "cliente", columna: "beneficiario_final", etiqueta: "Beneficiario final" },
  CLIENTE_ORIGEN_FONDOS: { destino: "cliente", columna: "origen_fondos", etiqueta: "Origen de los fondos" },

  MODALIDAD_EMBARQUE: { destino: "embarque", columna: "modalidad", etiqueta: "Modalidad de embarque" },
  TIPO_CONTENEDOR: { destino: "embarque", columna: "contenedor", etiqueta: "Tipo de contenedor" },
  PUERTO_DESTINO: { destino: "embarque", columna: "puerto_destino", etiqueta: "Puerto de destino" },
  ALMACEN_CONSOLIDACION: { destino: "embarque", columna: "almacen_consolidacion", etiqueta: "Almacén de consolidación" },

  VENDEDOR_NOMBRE: { destino: "contraparte", contraparte: "broker", columna: "nombre", etiqueta: "Nombre del broker" },
  VENDEDOR_DIRECCION: { destino: "contraparte", contraparte: "broker", columna: "direccion", etiqueta: "Dirección del broker" },
  VENDEDOR_CONTACTO: { destino: "contraparte", contraparte: "broker", columna: "contacto", etiqueta: "Contacto del broker" },
  VENDEDOR_TELEFONO: { destino: "contraparte", contraparte: "broker", columna: "telefono", etiqueta: "Teléfono del broker" },
  DEALER_NOMBRE: { destino: "contraparte", contraparte: "vendedor", columna: "nombre", etiqueta: "Nombre del dealer" },
  DEALER_DIRECCION: { destino: "contraparte", contraparte: "vendedor", columna: "direccion", etiqueta: "Dirección del dealer" },
  DEALER_CONTACTO: { destino: "contraparte", contraparte: "vendedor", columna: "contacto", etiqueta: "Contacto del dealer" },
  INSPECTOR: { destino: "contraparte", contraparte: "inspector", columna: "nombre", etiqueta: "Inspector (usado)" },
  FORWARDER_NOMBRE: { destino: "contraparte", contraparte: "forwarder", columna: "nombre", etiqueta: "Nombre del forwarder" },
  FORWARDER_CONTACTO: { destino: "contraparte", contraparte: "forwarder", columna: "contacto", etiqueta: "Contacto del forwarder" },
  AGENTE_ADUANA: { destino: "contraparte", contraparte: "agente_aduana", columna: "nombre", etiqueta: "Agencia de aduana" },
  AGENTE_ADUANA_RUC: { destino: "contraparte", contraparte: "agente_aduana", columna: "ruc_o_tax_id", etiqueta: "RUC de la agencia" },
  AGENTE_ADUANA_CONTACTO: { destino: "contraparte", contraparte: "agente_aduana", columna: "contacto", etiqueta: "Sectorista de la agencia" },

  /** Se escriben al emitir (formulario del documento). */
  FECHA_AVISO: { destino: "emision", etiqueta: "Fecha del aviso" },
  TC_REFERENCIAL: { destino: "emision", etiqueta: "Tipo de cambio referencial" },
  FECHA_LIMITE_PAGO: { destino: "emision", etiqueta: "Fecha límite del pago" },
  MONTO_AVISO: { destino: "emision", etiqueta: "Monto del aviso (USD)" },
  LIQUIDACION_NUMERO: { destino: "emision", etiqueta: "Número de liquidación de SUNAT" },
  TRIBUTOS_USD: { destino: "emision", etiqueta: "Tributos según la DAM (USD)" },
  TRIBUTOS_SOLES: { destino: "emision", etiqueta: "Tributos a pagar (S/)" },
};

/** Columna del expediente o del embarque que una compuerta exige y que la pantalla puede pedir. */
export type ColumnaCompuerta = { campo: Campo; condicion: string };

/** Lo que las compuertas de ENTRADA a cada etapa leen de las tablas (además de documentos, hitos y aprobaciones). */
export const COLUMNAS_COMPUERTA: Partial<Record<EtapaExpediente, readonly ColumnaCompuerta[]>> = {
  busqueda: [
    { campo: "CLIENTE_RAZON_SOCIAL", condicion: "cliente_completo" },
    { campo: "CLIENTE_RUC", condicion: "cliente_completo" },
    { campo: "CLIENTE_CORREO", condicion: "cliente_completo" },
    { campo: "CLIENTE_DOMICILIO", condicion: "cliente_completo" },
    { campo: "CLIENTE_REPRESENTANTE", condicion: "cliente_completo" },
    { campo: "CLIENTE_REP_DNI", condicion: "cliente_completo" },
  ],
  compra: [{ campo: "FECHA_EST_ARRIBO", condicion: "anio_modelo" }],
  aduana: [{ campo: "DAM_NUMERO", condicion: "dam_numerada" }],
  placas: [{ campo: "FECHA_LEVANTE", condicion: "levante" }],
  entrega: [
    { campo: "PLACA", condicion: "tive_placa" },
    { campo: "TIVE_NUMERO", condicion: "tive_placa" },
  ],
};

export type DatoFaltante = {
  campo: Campo;
  origen: OrigenCampo;
  /** Documentos de la etapa actual o la siguiente que lo usan (vacío si solo lo pide una compuerta). */
  documentos: TipoDocumento[];
  /** Compuertas que lo exigen. */
  compuertas: string[];
  /** `true` si lo usa un documento de la etapa actual o una compuerta de la siguiente: urge. */
  urgente: boolean;
};

export type ResultadoDatosPorEtapa = {
  etapaActual: EtapaExpediente;
  etapaSiguiente: EtapaExpediente | null;
  /** Documentos considerados, por etapa. */
  documentos: { etapa: EtapaExpediente; tipos: TipoDocumento[] }[];
  /** Faltantes que se guardan en el expediente, el cliente, el embarque o una contraparte, agrupados por destino. */
  faltantes: DatoFaltante[];
  /** Faltantes de la empresa: se completan en /portal/configuracion. */
  empresa: Campo[];
  /** Contrapartes que el expediente todavía no tiene asignadas y que algún documento necesita. */
  contrapartesSinAsignar: TipoContraparte[];
};

const CAMPOS_DEL_LIBRO = new Set<Campo>([
  "FECHA_DEPOSITO", "MONTO_DEPOSITO", "HITO", "SALDO_ANTERIOR", "SALDO_NUEVO", "CONSTANCIA_NUMERO", "NUMERO_OPERACION",
  "ADUANA_RECIBIDO", "ADUANA_PAGADO", "ADUANA_SALDO", "PAGO5_NETO",
  "TOTAL_TRIBUTOS_USD", "TOTAL_TRIBUTOS_PEN", "TOTAL_GASTOS_USD", "TOTAL_RECIBIDO", "TOTAL_PAGADO", "TOTAL_DIRECTO", "SALDO_RENDICION",
  "DEVOLUCION_MONTO", "DEVOLUCION_FECHA", "TOTAL_OPERACION", "DIFERENCIA_ESTIMADO", "CREDITO_FISCAL", "COMISIONES_BANCARIAS", "H6_ACREDITADO_FECHA",
]);

function contraparteAsignada(ctx: ContextoExpediente, cual: NonNullable<OrigenCampo["contraparte"]>): boolean {
  const r = ctx.expediente.reservado;
  switch (cual) {
    case "vendedor":
      return Boolean(r?.vendedorId);
    case "broker":
      // Sin broker, el dealer cobra directo y ocupa VENDEDOR_*: se da por asignado si hay dealer.
      return Boolean(r?.brokerId ?? r?.vendedorId);
    case "inspector":
      return Boolean(r?.inspectorId);
    case "forwarder":
      return Boolean(ctx.embarque?.forwarderId);
    case "agente_aduana":
      return Boolean(r?.agenteAduanaId);
  }
}

/**
 * Faltantes de la etapa actual y la siguiente. `porDefecto` son los parámetros
 * de la empresa ya cargados (si llegan, lo de empresa que falte es real).
 */
export function datosPorEtapa(ctx: ContextoExpediente, porDefecto: Partial<Record<Campo, string>> = {}): ResultadoDatosPorEtapa {
  const actual = ctx.expediente.etapa;
  const siguiente = siguienteEtapa(actual);
  const etapas: EtapaExpediente[] = siguiente ? [actual, siguiente] : [actual];
  const { campos } = camposPlantilla(ctx, {}, porDefecto);

  const documentos = etapas.map((etapa) => ({ etapa, tipos: [...(PLANTILLAS_POR_ETAPA[etapa] ?? [])] }));
  const usadosPor = new Map<Campo, Set<TipoDocumento>>();
  for (const { etapa, tipos } of documentos) {
    for (const tipo of tipos) {
      const plantilla = plantillaDe(tipo);
      if (!plantilla) continue;
      const hitoAviso = tipo === "aviso_h3" ? HITO_AVISO_POR_ETAPA[etapa] : undefined;
      if (tipo === "aviso_h3" && !hitoAviso) continue;
      const doc = construirDocumento(plantilla, ctx, hitoAviso ? { HITO: hitoAviso } : {}, porDefecto);
      for (const campo of doc.usados) {
        if (campos[campo]) continue;
        if (CAMPOS_DEL_LIBRO.has(campo)) continue;
        if (!usadosPor.has(campo)) usadosPor.set(campo, new Set());
        usadosPor.get(campo)!.add(tipo);
      }
    }
  }

  const compuertasPor = new Map<Campo, Set<string>>();
  if (siguiente) {
    for (const { campo, condicion } of COLUMNAS_COMPUERTA[siguiente] ?? []) {
      if (campos[campo]) continue;
      if (!compuertasPor.has(campo)) compuertasPor.set(campo, new Set());
      compuertasPor.get(campo)!.add(condicion);
    }
  }

  const empresa: Campo[] = [];
  const faltantes: DatoFaltante[] = [];
  const sinAsignar = new Set<TipoContraparte>();
  const tiposActual = new Set(PLANTILLAS_POR_ETAPA[actual] ?? []);
  const todos = new Set<Campo>([...usadosPor.keys(), ...compuertasPor.keys()]);
  for (const campo of todos) {
    if (CAMPOS_EMPRESA.includes(campo)) {
      empresa.push(campo);
      continue;
    }
    const origen = ORIGEN_CAMPO[campo];
    if (!origen || origen.destino === "emision") continue;
    if (origen.destino === "contraparte" && origen.contraparte && !contraparteAsignada(ctx, origen.contraparte)) {
      sinAsignar.add(origen.contraparte);
      continue;
    }
    const docs = [...(usadosPor.get(campo) ?? [])];
    const condiciones = [...(compuertasPor.get(campo) ?? [])];
    faltantes.push({
      campo,
      origen,
      documentos: docs,
      compuertas: condiciones,
      urgente: condiciones.length > 0 || docs.some((d) => tiposActual.has(d)),
    });
  }

  const ordenDestino: DestinoDato[] = ["expediente", "reservado", "cliente", "embarque", "contraparte", "empresa", "emision"];
  faltantes.sort((a, b) => Number(b.urgente) - Number(a.urgente) || ordenDestino.indexOf(a.origen.destino) - ordenDestino.indexOf(b.origen.destino) || a.campo.localeCompare(b.campo));

  return { etapaActual: actual, etapaSiguiente: siguiente, documentos, faltantes, empresa, contrapartesSinAsignar: [...sinAsignar] };
}

/** Comprobación de consistencia para las pruebas: toda plantilla del mapa existe. */
export function plantillasDelMapaExisten(): boolean {
  const tipos = new Set(PLANTILLAS.map((p) => p.tipo));
  return Object.values(PLANTILLAS_POR_ETAPA).every((lista) => lista!.every((t) => tipos.has(t)));
}
