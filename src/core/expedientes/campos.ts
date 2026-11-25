/**
 * Campos `{{CAMPO}}` del paquete de documentos y cómo se llenan desde un
 * expediente.
 *
 * Los NOMBRES son exactamente los del paquete "Paquete de documentos:
 * importación por mandato" (ficha de datos), para que la plantilla se lea igual
 * que el documento original. `FICHA` describe cada uno (qué es, ejemplo) y la
 * prueba de vitest la vuelca como snapshot para mantener el paquete en Claude
 * Docs sincronizado con el código.
 *
 * `camposPlantilla(ctx, extra)` arma el mapa completo:
 *   · del expediente, el cliente, el embarque, las contrapartes, los hitos y el
 *     presupuesto guardado (snapshot de `presupuestar()`);
 *   · de `extra`, que trae lo que no vive en la base: los datos fijos de
 *     Luxcars y sus cuentas (el servidor los lee de una variable de entorno) y
 *     lo que el equipo escribe a mano al generar (fecha de firma, días de
 *     espera, VIN de la otra unidad…). Lo de `extra` siempre gana.
 *
 * Devuelve además la lista de campos VACÍOS. Los marcados `manual` en la ficha
 * no impiden emitir: se imprimen como una línea para llenar a mano
 * ("______________"), como en el paquete original. Los demás sí bloquean la
 * generación: un contrato sin RUC del cliente no se emite.
 *
 * TypeScript puro, sin fecha actual ni entrada/salida.
 */

import type { ContextoExpediente, Contraparte, TipoContenedor } from "./tipos";

/* -------------------------------------------------------------------------- */
/* La lista                                                                   */
/* -------------------------------------------------------------------------- */

export type GrupoCampo =
  | "expediente"
  | "luxcars"
  | "cliente"
  | "vehiculo"
  | "vendedor"
  | "logistica"
  | "presupuesto"
  | "cuentas"
  | "cierre";

export type DefinicionCampo = {
  grupo: GrupoCampo;
  /** Qué es, en las palabras de la ficha de datos del paquete. */
  descripcion: string;
  ejemplo: string;
  /** Se puede dejar en blanco: sale como línea para llenar a mano. */
  manual?: boolean;
};

/**
 * Todos los campos del paquete, en el orden de la ficha. Es la ÚNICA lista:
 * de acá salen el tipo `Campo`, la ficha y la validación de las plantillas.
 */
export const FICHA = {
  // Expediente y operación
  EXPEDIENTE: { grupo: "expediente", descripcion: "Código único por vehículo. Va en cada página y en el concepto de cada transferencia", ejemplo: "LC-2026-011" },
  FECHA_FIRMA: { grupo: "expediente", descripcion: "Fecha del contrato", ejemplo: "28 de noviembre de 2026", manual: true },
  CIUDAD_FIRMA: { grupo: "expediente", descripcion: "Ciudad de firma", ejemplo: "Lima", manual: true },
  MODALIDAD_EMBARQUE: { grupo: "expediente", descripcion: "Una de tres: contenedor consolidado con otra unidad / contenedor exclusivo / Ro-Ro", ejemplo: "contenedor consolidado con otra unidad" },
  TIPO_CONTENEDOR: { grupo: "expediente", descripcion: "Equipo", ejemplo: "40' HC" },
  PROPORCION_FLETE: { grupo: "expediente", descripcion: "Parte del flete marítimo y de los gastos del contenedor que asume este vehículo", ejemplo: "50 %" },
  DIAS_ESPERA_MAX: { grupo: "expediente", descripcion: "Solo consolidado: días máximos que el cliente acepta esperar a la otra unidad", ejemplo: "15", manual: true },
  PAIS_ORIGEN: { grupo: "expediente", descripcion: "País donde se compra", ejemplo: "Canadá" },
  PUERTO_ORIGEN: { grupo: "expediente", descripcion: "Puerto de embarque", ejemplo: "Vancouver" },
  PUERTO_DESTINO: { grupo: "expediente", descripcion: "Puerto de llegada", ejemplo: "Callao" },
  SEMANAS_ESTIMADAS: { grupo: "expediente", descripcion: "Plazo estimado desde que se acreditan los fondos del auto hasta la entrega con placas", ejemplo: "10 a 14" },
  FECHA_LIMITE_H2: { grupo: "expediente", descripcion: "Fecha máxima para acreditar los fondos del auto", ejemplo: "12 de diciembre de 2026" },
  FECHA_EST_EMBARQUE: { grupo: "expediente", descripcion: "Zarpe estimado", ejemplo: "9 de enero de 2027" },
  FECHA_EST_ARRIBO: { grupo: "expediente", descripcion: "Arribo estimado al Callao", ejemplo: "10 de febrero de 2027" },
  FECHA_EST_ENTREGA: { grupo: "expediente", descripcion: "Entrega estimada con placas", ejemplo: "5 de marzo de 2027" },
  LOA_VENCIMIENTO: { grupo: "expediente", descripcion: "Vigencia de la carta de autorización en inglés (90 días suele bastar)", ejemplo: "28 de febrero de 2027" },

  // Luxcars (fijos)
  LUXCARS_RUC: { grupo: "luxcars", descripcion: "RUC de Lux Cars Import S.A.C.", ejemplo: "20XXXXXXXXX" },
  LUXCARS_DOMICILIO: { grupo: "luxcars", descripcion: "Domicilio fiscal completo", ejemplo: "Av. ..., piso 11, San Isidro, Lima" },
  LUXCARS_PARTIDA: { grupo: "luxcars", descripcion: "Partida registral de la empresa", ejemplo: "1XXXXXXX, Registro de Personas Jurídicas de Lima" },
  LUXCARS_REPRESENTANTE: { grupo: "luxcars", descripcion: "Gerente general que firma", ejemplo: "Gianfranco Gálvez Montero" },
  LUXCARS_REP_DNI: { grupo: "luxcars", descripcion: "DNI del representante", ejemplo: "4XXXXXXX" },
  LUXCARS_CORREO: { grupo: "luxcars", descripcion: "Correo para comunicaciones del contrato", ejemplo: "info@luxcars.pe" },
  LUXCARS_TELEFONO: { grupo: "luxcars", descripcion: "Teléfono y WhatsApp", ejemplo: "+51 980 794 348" },

  // Cliente (mandante)
  CLIENTE_RAZON_SOCIAL: { grupo: "cliente", descripcion: "Razón social exacta, como en la ficha RUC. Es el nombre que irá en el bill of sale, el BL y la DAM", ejemplo: "Inversiones Andinas S.A.C." },
  CLIENTE_RUC: { grupo: "cliente", descripcion: "RUC", ejemplo: "20XXXXXXXXX" },
  CLIENTE_DOMICILIO: { grupo: "cliente", descripcion: "Domicilio fiscal", ejemplo: "Calle ..., Miraflores, Lima" },
  CLIENTE_PARTIDA: { grupo: "cliente", descripcion: "Partida registral", ejemplo: "1XXXXXXX" },
  CLIENTE_REPRESENTANTE: { grupo: "cliente", descripcion: "Nombre completo del representante legal", ejemplo: "Juan Pérez Rojas" },
  CLIENTE_REP_DNI: { grupo: "cliente", descripcion: "DNI del representante", ejemplo: "0XXXXXXX" },
  CLIENTE_REP_CARGO: { grupo: "cliente", descripcion: "Cargo", ejemplo: "Gerente general" },
  CLIENTE_CORREO: { grupo: "cliente", descripcion: "Correo válido para aprobaciones", ejemplo: "jperez@empresa.pe" },
  CLIENTE_TELEFONO: { grupo: "cliente", descripcion: "WhatsApp válido para aprobaciones", ejemplo: "+51 9XX XXX XXX" },
  CLIENTE_ACTIVIDAD: { grupo: "cliente", descripcion: "Actividad económica (CIIU de la ficha RUC)", ejemplo: "Transporte de carga por carretera", manual: true },
  CLIENTE_BANCO_ORIGEN: { grupo: "cliente", descripcion: "Banco y cuenta desde donde pagará (debe ser de la propia empresa)", ejemplo: "BCP, cuenta corriente en dólares", manual: true },
  CLIENTE_BENEFICIARIO_FINAL: { grupo: "cliente", descripcion: "Persona natural con 10 % o más del capital: nombre, DNI y porcentaje", ejemplo: "Juan Pérez Rojas, DNI 0XXXXXXX, 60 %", manual: true },
  CLIENTE_ORIGEN_FONDOS: { grupo: "cliente", descripcion: "De dónde sale el dinero", ejemplo: "Utilidades acumuladas de la empresa", manual: true },

  // Vehículo
  VEH_MARCA: { grupo: "vehiculo", descripcion: "Marca", ejemplo: "Toyota" },
  VEH_MODELO: { grupo: "vehiculo", descripcion: "Modelo", ejemplo: "Tundra" },
  VEH_VERSION: { grupo: "vehiculo", descripcion: "Versión o paquete", ejemplo: "TRD Pro CrewMax", manual: true },
  VEH_ANIO: { grupo: "vehiculo", descripcion: "Año modelo", ejemplo: "2026" },
  VEH_VIN: { grupo: "vehiculo", descripcion: "VIN de 17 caracteres", ejemplo: "5TFPC5DB1RX000000" },
  VEH_COLOR: { grupo: "vehiculo", descripcion: "Color", ejemplo: "Blanco", manual: true },
  VEH_KM: { grupo: "vehiculo", descripcion: "Kilometraje a la fecha de inspección", ejemplo: "1,200 km", manual: true },
  VEH_COMBUSTIBLE: { grupo: "vehiculo", descripcion: "Gasolina / híbrido / eléctrico / diésel (solo nuevo)", ejemplo: "Híbrido gasolina" },
  VEH_CILINDRADA: { grupo: "vehiculo", descripcion: "Cilindrada", ejemplo: "3,445 cc", manual: true },
  VEH_TRANSMISION: { grupo: "vehiculo", descripcion: "Transmisión", ejemplo: "Automática 10 velocidades", manual: true },
  VEH_CONDICION: { grupo: "vehiculo", descripcion: "Nuevo (sin registro previo) o usado", ejemplo: "Nuevo" },
  VEH_CATEGORIA: { grupo: "vehiculo", descripcion: "M1 (autos y SUV) o N1 (pickups y camionetas)", ejemplo: "N1", manual: true },
  VEH_PAIS_ENSAMBLAJE: { grupo: "vehiculo", descripcion: "Según el VIN: 1, 4 o 5 EE.UU.; 2 Canadá; 3 México; J Japón", ejemplo: "Estados Unidos", manual: true },
  VEH_DOC_PROPIEDAD: { grupo: "vehiculo", descripcion: "Documento que entrega el vendedor: NVIS / MSO / registro provincial / título", ejemplo: "NVIS sin registrar", manual: true },
  VEH_PESO: { grupo: "vehiculo", descripcion: "Peso bruto para el forwarder", ejemplo: "2,650 kg", manual: true },
  VEH_MEDIDAS: { grupo: "vehiculo", descripcion: "Largo × ancho × alto, para el plano de carga", ejemplo: "5.93 × 2.03 × 1.98 m", manual: true },

  // Vendedor y compra
  VENDEDOR_NOMBRE: { grupo: "vendedor", descripcion: "Razón social del dealer o nombre del vendedor", ejemplo: "Example Motors Ltd." },
  VENDEDOR_DIRECCION: { grupo: "vendedor", descripcion: "Dirección completa", ejemplo: "1234 Kingsway, Vancouver, BC V5R 5J4, Canada" },
  VENDEDOR_CONTACTO: { grupo: "vendedor", descripcion: "Persona de contacto y correo", ejemplo: "Mark Lee, sales@example.ca" },
  VENDEDOR_TELEFONO: { grupo: "vendedor", descripcion: "Teléfono público del dealer (para confirmar la cuenta bancaria)", ejemplo: "+1 604 000 0000" },
  MONEDA_COMPRA: { grupo: "vendedor", descripcion: "Moneda en que cobra el vendedor", ejemplo: "CAD" },
  PRECIO_COMPRA: { grupo: "vendedor", descripcion: "Precio pactado en esa moneda", ejemplo: "98,500.00" },
  PRECIO_TOPE: { grupo: "vendedor", descripcion: "Máximo que el cliente autoriza pagar, misma moneda", ejemplo: "100,000.00" },
  PRECIO_COMPRA_USD: { grupo: "vendedor", descripcion: "Equivalente estimado en dólares americanos al día de la cotización", ejemplo: "71,000.00" },
  FECHA_LIMITE_COMPRA: { grupo: "vendedor", descripcion: "Hasta cuándo vale la autorización de compra", ejemplo: "15 de diciembre de 2026" },
  FECHA_INSPECCION: { grupo: "vendedor", descripcion: "Fecha de la inspección física", ejemplo: "4 de diciembre de 2026", manual: true },
  INSPECTOR: { grupo: "vendedor", descripcion: "Quién inspeccionó", ejemplo: "Nombre o empresa", manual: true },
  HISTORIAL_REF: { grupo: "vendedor", descripcion: "Número del reporte de historial y de la búsqueda de gravámenes", ejemplo: "CARFAX Canada n.º ..., PPSA BC ...", manual: true },
  FECHA_RELEASE: { grupo: "vendedor", descripcion: "Fecha en que el vendedor entrega el auto al transportista del forwarder", ejemplo: "18 de diciembre de 2026", manual: true },

  // Logística y aduana
  FORWARDER_NOMBRE: { grupo: "logistica", descripcion: "Consolidador o forwarder", ejemplo: "Example Logistics Inc." },
  FORWARDER_CONTACTO: { grupo: "logistica", descripcion: "Contacto y correo", ejemplo: "ops@example-logistics.com" },
  ALMACEN_CONSOLIDACION: { grupo: "logistica", descripcion: "Dirección del almacén donde se carga el contenedor", ejemplo: "5678 Industrial Ave, Delta, BC", manual: true },
  VIN_OTRA_UNIDAD: { grupo: "logistica", descripcion: "Solo consolidado: VIN del otro auto, para el forwarder", ejemplo: "1FTFW1E8XPFA00000", manual: true },
  AGENTE_ADUANA: { grupo: "logistica", descripcion: "Agencia de aduana designada", ejemplo: "Agencia ... S.A." },
  AGENTE_ADUANA_RUC: { grupo: "logistica", descripcion: "RUC de la agencia", ejemplo: "20XXXXXXXXX" },
  AGENTE_ADUANA_CONTACTO: { grupo: "logistica", descripcion: "Sectorista y correo", ejemplo: "Nombre, correo", manual: true },

  // Presupuesto estimado (dólares americanos)
  EST_INLAND: { grupo: "presupuesto", descripcion: "Transporte del vendedor al almacén del forwarder", ejemplo: "450.00" },
  EST_FLETE: { grupo: "presupuesto", descripcion: "Flete marítimo y gastos del contenedor ya multiplicados por {{PROPORCION_FLETE}}", ejemplo: "1,650.00" },
  EST_SEGURO: { grupo: "presupuesto", descripcion: "0.5 % sobre el 110 % del precio del vehículo", ejemplo: "390.50" },
  EST_CIF: { grupo: "presupuesto", descripcion: "Precio + inland + flete + seguro", ejemplo: "73,490.50" },
  TASA_ADVALOREM: { grupo: "presupuesto", descripcion: "6 % salvo preferencia probada", ejemplo: "6 %" },
  EST_ADVALOREM: { grupo: "presupuesto", descripcion: "CIF × tasa", ejemplo: "4,409.43" },
  TASA_ISC: { grupo: "presupuesto", descripcion: "10 % nuevo gasolina, 0 % híbrido o eléctrico nuevo, 40 % usado", ejemplo: "0 %" },
  EST_ISC: { grupo: "presupuesto", descripcion: "(CIF + ad valorem) × tasa", ejemplo: "0.00" },
  EST_IGV_IPM: { grupo: "presupuesto", descripcion: "18 % sobre CIF + ad valorem + ISC", ejemplo: "14,021.99" },
  TASA_PERCEPCION: { grupo: "presupuesto", descripcion: "10 % primera importación, 5 % usado, 3.5 % recurrente nuevo", ejemplo: "10 %" },
  EST_PERCEPCION: { grupo: "presupuesto", descripcion: "Sobre la suma de todo lo anterior", ejemplo: "9,192.19" },
  EST_TRIBUTOS: { grupo: "presupuesto", descripcion: "Ad valorem + ISC + IGV e IPM + percepción", ejemplo: "27,623.61" },
  EST_GASTOS_ADUANA: { grupo: "presupuesto", descripcion: "Agente, depósito temporal, visto bueno, homologación", ejemplo: "2,300.00" },
  EST_GASTOS_REGISTRALES: { grupo: "presupuesto", descripcion: "SUNARP, notaría, placas", ejemplo: "180.00" },
  TASA_COMISION: { grupo: "presupuesto", descripcion: "Tramo aplicable sobre el costo puesto en Lima", ejemplo: "8 %" },
  COMISION_TOTAL: { grupo: "presupuesto", descripcion: "Honorarios con IGV incluido", ejemplo: "8,273.13" },
  COMISION_BASE: { grupo: "presupuesto", descripcion: "Honorarios ÷ 1.18", ejemplo: "7,011.13" },
  COMISION_IGV: { grupo: "presupuesto", descripcion: "18 % de la base", ejemplo: "1,262.00" },
  COMISION_H1: { grupo: "presupuesto", descripcion: "30 % de los honorarios", ejemplo: "2,481.94" },
  COMISION_H4: { grupo: "presupuesto", descripcion: "70 % de los honorarios", ejemplo: "5,791.19" },
  PORCENTAJE_DETRACCION: { grupo: "presupuesto", descripcion: "Porcentaje del SPOT sobre cada factura [CONFIRMAR con el contador: 10 % o 12 %]", ejemplo: "12", manual: true },
  EST_TOTAL: { grupo: "presupuesto", descripcion: "Costo total estimado puesto en Lima con placas, honorarios incluidos", ejemplo: "111,867.24" },
  H2_MONTO: { grupo: "presupuesto", descripcion: "Precio del auto en USD + inland + flete + seguro", ejemplo: "73,490.50" },
  MARGEN_H3: { grupo: "presupuesto", descripcion: "Colchón sobre tributos y gastos para cubrir el tipo de cambio", ejemplo: "3" },
  H3_MONTO: { grupo: "presupuesto", descripcion: "(Tributos + gastos de aduana + gastos registrales) × (1 + margen)", ejemplo: "31,006.72" },
  TC_REFERENCIAL: { grupo: "presupuesto", descripcion: "Tipo de cambio soles por dólar usado en el aviso de pago", ejemplo: "3.75", manual: true },
  TARIFA_CUSTODIA: { grupo: "presupuesto", descripcion: "USD por día si el cliente no recoge el auto en 5 días hábiles", ejemplo: "25.00" },
  COSTO_INSPECCION: { grupo: "presupuesto", descripcion: "Gasto de inspección que se retiene si el cliente desiste antes de la compra", ejemplo: "350.00" },

  // Cuentas de Luxcars (fijas)
  CTA_OPER_BANCO: { grupo: "cuentas", descripcion: "Banco de la cuenta de Operaciones", ejemplo: "BCP" },
  CTA_OPER_NUMERO: { grupo: "cuentas", descripcion: "Número de la cuenta corriente en dólares", ejemplo: "194-XXXXXXX-1-XX" },
  CTA_OPER_CCI: { grupo: "cuentas", descripcion: "CCI", ejemplo: "002-194-XXXXXXXXXXXX-XX" },
  CTA_FONDOS_BANCO: { grupo: "cuentas", descripcion: "Banco de la cuenta Fondos de Clientes", ejemplo: "BCP" },
  CTA_FONDOS_NUMERO: { grupo: "cuentas", descripcion: "Número de la cuenta corriente en dólares", ejemplo: "194-XXXXXXX-1-XX" },
  CTA_FONDOS_CCI: { grupo: "cuentas", descripcion: "CCI", ejemplo: "002-194-XXXXXXXXXXXX-XX" },
  CTA_DETRACCION_NUMERO: { grupo: "cuentas", descripcion: "Cuenta de detracciones en el Banco de la Nación", ejemplo: "00-XXX-XXXXXX" },

  // Campos de cierre (se llenan con cada evento; fases 3 en adelante)
  FECHA_DEPOSITO: { grupo: "cierre", descripcion: "Fecha del depósito acreditado (constancia de recepción de fondos)", ejemplo: "12 de diciembre de 2026", manual: true },
  MONTO_DEPOSITO: { grupo: "cierre", descripcion: "Monto del depósito en USD (constancia)", ejemplo: "73,490.50", manual: true },
  HITO: { grupo: "cierre", descripcion: "Hito al que se aplica el depósito (constancia)", ejemplo: "H2", manual: true },
  SALDO_ANTERIOR: { grupo: "cierre", descripcion: "Saldo del expediente antes del depósito (constancia)", ejemplo: "0.00", manual: true },
  SALDO_NUEVO: { grupo: "cierre", descripcion: "Saldo del expediente después del depósito (constancia)", ejemplo: "73,490.50", manual: true },
  DAM_NUMERO: { grupo: "cierre", descripcion: "Número de la DAM (liquidación definitiva)", ejemplo: "118-2027-10-XXXXXX", manual: true },
  DAM_FECHA: { grupo: "cierre", descripcion: "Fecha de numeración de la DAM (liquidación definitiva)", ejemplo: "9 de febrero de 2027", manual: true },
  CANAL: { grupo: "cierre", descripcion: "Canal de control asignado (liquidación definitiva)", ejemplo: "verde", manual: true },
  FACTOR_CONVERSION: { grupo: "cierre", descripcion: "Factor SUNAT para pasar la factura en CAD a USD en la fecha de numeración", ejemplo: "0.7212", manual: true },
  TC_SBS_PAGO: { grupo: "cierre", descripcion: "Tipo de cambio venta SBS del día en que se pagaron los tributos", ejemplo: "3.7620", manual: true },
  FECHA_ENTREGA: { grupo: "cierre", descripcion: "Fecha de entrega del vehículo (acta y rendición)", ejemplo: "5 de marzo de 2027", manual: true },
  KM_ENTREGA: { grupo: "cierre", descripcion: "Kilometraje a la entrega (acta)", ejemplo: "1,260 km", manual: true },
  PLACA: { grupo: "cierre", descripcion: "Placa asignada (acta y rendición)", ejemplo: "BXX-000", manual: true },
  TIVE_NUMERO: { grupo: "cierre", descripcion: "Número de la tarjeta de identificación vehicular (acta)", ejemplo: "n.º ...", manual: true },
} as const satisfies Record<string, DefinicionCampo>;

export type Campo = keyof typeof FICHA;

export const CAMPOS: readonly Campo[] = Object.keys(FICHA) as Campo[];

export function esCampo(nombre: string): nombre is Campo {
  return Object.prototype.hasOwnProperty.call(FICHA, nombre);
}

export function esManual(campo: Campo): boolean {
  return (FICHA[campo] as DefinicionCampo).manual === true;
}

/** Mapa completo: cada campo con su valor (vacío = "") . */
export type Campos = Record<Campo, string>;

/** Lo que llega de fuera del expediente (datos fijos de Luxcars, escritos a mano). */
export type CamposExtra = Partial<Record<Campo, string>>;

export type ResultadoCampos = {
  campos: Campos;
  /** Vacíos que NO son manuales: bloquean la emisión. */
  faltantes: Campo[];
  /** Vacíos manuales: se imprimen como línea para llenar a mano. */
  manualesVacios: Campo[];
};

/** Lo que se imprime donde un campo manual quedó vacío. */
export const LINEA_EN_BLANCO = "______________";

/* -------------------------------------------------------------------------- */
/* Formatos                                                                   */
/* -------------------------------------------------------------------------- */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** `2026-11-28` → "28 de noviembre de 2026". Otra cosa, tal cual. */
export function fechaEnLetras(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return iso;
  return `${Number(m[3])} de ${mes} de ${m[1]}`;
}

/** 12450 → "12,450.00". Separador de miles y dos decimales, como pide el paquete. */
export function monto(n: number | null | undefined, decimales = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n);
}

/** 0.06 → "6 %", 0.035 → "3.5 %". */
export function porcentaje(tasa: number | null | undefined): string {
  if (tasa === null || tasa === undefined || !Number.isFinite(tasa)) return "";
  const valor = tasa * 100;
  const texto = Math.abs(valor - Math.round(valor)) < 1e-9 ? String(Math.round(valor)) : valor.toFixed(1);
  return `${texto} %`;
}

/** Un número de porcentaje sin el signo: 0.03 → "3" (el texto ya dice "%"). */
function porcentajeSinSigno(tasa: number | null | undefined): string {
  return porcentaje(tasa).replace(/\s*%$/, "");
}

function entero(n: number | null | undefined, sufijo = ""): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return `${new Intl.NumberFormat("en-US").format(n)}${sufijo}`;
}

const MODALIDAD_TEXTO = {
  consolidado: "contenedor consolidado con otra unidad",
  exclusivo: "contenedor exclusivo",
  roro: "Ro-Ro",
} as const;

const CONTENEDOR_TEXTO: Record<TipoContenedor, string> = {
  c20: "20'",
  c40: "40'",
  c40hc: "40' HC",
  roro: "Ro-Ro",
};

const COMBUSTIBLE_POR_CATEGORIA = {
  gasolina: "Gasolina",
  diesel: "Diésel",
  hev: "Híbrido gasolina",
  phev: "Híbrido enchufable",
  ev: "Eléctrico",
} as const;

function contacto(c: Contraparte | null | undefined): string {
  if (!c) return "";
  return [c.contacto, c.email].filter(Boolean).join(", ");
}

function texto(v: string | null | undefined): string {
  return (v ?? "").trim();
}

/* -------------------------------------------------------------------------- */
/* Armado                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Arma el mapa completo de campos de un expediente. Nunca lanza: lo que no se
 * puede llenar queda vacío y aparece en `faltantes` o `manualesVacios`.
 */
export function camposPlantilla(ctx: ContextoExpediente, extra: CamposExtra = {}): ResultadoCampos {
  const e = ctx.expediente;
  const v = e.vehiculo;
  const c = ctx.cliente;
  const emb = ctx.embarque;
  const p = e.presupuesto;
  const r = e.reservado;
  const terceros = ctx.contrapartes ?? [];
  const porId = (id: string | null | undefined) => (id ? terceros.find((t) => t.id === id) ?? null : null);
  const vendedor = porId(r?.vendedorId);
  const inspector = porId(r?.inspectorId);
  const agente = porId(r?.agenteAduanaId);
  const forwarder = porId(emb?.forwarderId);
  const hito = (tipo: "H1" | "H2" | "H3" | "H4") =>
    ctx.hitos.find((h) => h.tipo === tipo)?.montoEstimadoUsd ?? p?.hitos.find((h) => h.tipo === tipo)?.montoUsd ?? null;

  const esPersona = c?.tipo === "persona";

  const base: Campos = {
    EXPEDIENTE: e.codigo,
    FECHA_FIRMA: fechaEnLetras(e.fechaFirma),
    CIUDAD_FIRMA: "Lima",
    MODALIDAD_EMBARQUE: emb ? MODALIDAD_TEXTO[emb.modalidad] : "",
    TIPO_CONTENEDOR: emb?.contenedor ? CONTENEDOR_TEXTO[emb.contenedor] : emb?.modalidad === "roro" ? "Ro-Ro" : "",
    PROPORCION_FLETE: porcentaje(e.proporcionFlete),
    DIAS_ESPERA_MAX: "",
    PAIS_ORIGEN: texto(e.paisOrigen),
    PUERTO_ORIGEN: texto(e.puertoOrigen) || texto(emb?.puertoOrigen),
    PUERTO_DESTINO: texto(emb?.puertoDestino) || "Callao",
    SEMANAS_ESTIMADAS: texto(e.semanasEstimadas),
    FECHA_LIMITE_H2: fechaEnLetras(e.fechaLimiteH2),
    FECHA_EST_EMBARQUE: fechaEnLetras(e.fechaEstEmbarque ?? emb?.fechaZarpeEst),
    FECHA_EST_ARRIBO: fechaEnLetras(e.fechaEstArribo ?? emb?.fechaArriboEst),
    FECHA_EST_ENTREGA: fechaEnLetras(e.fechaEstEntrega),
    LOA_VENCIMIENTO: fechaEnLetras(e.loaVence),

    LUXCARS_RUC: "",
    LUXCARS_DOMICILIO: "",
    LUXCARS_PARTIDA: "",
    LUXCARS_REPRESENTANTE: "",
    LUXCARS_REP_DNI: "",
    LUXCARS_CORREO: "",
    LUXCARS_TELEFONO: "",

    CLIENTE_RAZON_SOCIAL: texto(c?.razonSocial),
    CLIENTE_RUC: texto(c?.ruc) || (esPersona ? texto(c?.dni) : ""),
    CLIENTE_DOMICILIO: texto(c?.domicilio),
    CLIENTE_PARTIDA: texto(c?.partida) || (esPersona ? "no aplica" : ""),
    CLIENTE_REPRESENTANTE: texto(c?.representante) || (esPersona ? texto(c?.razonSocial) : ""),
    CLIENTE_REP_DNI: texto(c?.representanteDni) || (esPersona ? texto(c?.dni) : ""),
    CLIENTE_REP_CARGO: texto(c?.representanteCargo) || (esPersona ? "titular" : ""),
    CLIENTE_CORREO: texto(c?.email),
    CLIENTE_TELEFONO: texto(c?.telefono),
    CLIENTE_ACTIVIDAD: texto(c?.actividad),
    CLIENTE_BANCO_ORIGEN: texto(c?.bancoOrigen),
    CLIENTE_BENEFICIARIO_FINAL: texto(c?.beneficiarioFinal),
    CLIENTE_ORIGEN_FONDOS: texto(c?.origenFondos),

    VEH_MARCA: v.marca,
    VEH_MODELO: v.modelo,
    VEH_VERSION: texto(v.version),
    VEH_ANIO: String(v.anio),
    VEH_VIN: texto(v.vin),
    VEH_COLOR: texto(v.color),
    VEH_KM: v.km !== null ? entero(v.km, " km") : "",
    VEH_COMBUSTIBLE: texto(v.combustible) || COMBUSTIBLE_POR_CATEGORIA[v.categoria] || "",
    VEH_CILINDRADA: v.cilindradaCc ? entero(v.cilindradaCc, " cc") : "",
    VEH_TRANSMISION: texto(v.transmision),
    VEH_CONDICION: v.condicion === "nuevo" ? "Nuevo" : "Usado",
    VEH_CATEGORIA: "",
    VEH_PAIS_ENSAMBLAJE: texto(v.paisEnsamblaje),
    VEH_DOC_PROPIEDAD: texto(v.docPropiedad),
    VEH_PESO: v.pesoKg ? entero(v.pesoKg, " kg") : "",
    VEH_MEDIDAS: texto(v.medidas),

    VENDEDOR_NOMBRE: texto(vendedor?.nombre),
    VENDEDOR_DIRECCION: texto(vendedor?.direccion),
    VENDEDOR_CONTACTO: contacto(vendedor),
    VENDEDOR_TELEFONO: texto(vendedor?.telefono),
    MONEDA_COMPRA: e.monedaCompra,
    PRECIO_COMPRA: monto(e.precioCompra),
    PRECIO_TOPE: monto(r?.precioTope),
    PRECIO_COMPRA_USD: monto(e.precioCompraUsd ?? p?.precioUsd),
    FECHA_LIMITE_COMPRA: fechaEnLetras(e.fechaLimiteCompra),
    FECHA_INSPECCION: fechaEnLetras(e.fechaInspeccion),
    INSPECTOR: texto(inspector?.nombre),
    HISTORIAL_REF: texto(e.historialRef),
    FECHA_RELEASE: fechaEnLetras(e.fechaRelease ?? emb?.fechaReleaseEst),

    FORWARDER_NOMBRE: texto(forwarder?.nombre),
    FORWARDER_CONTACTO: contacto(forwarder),
    ALMACEN_CONSOLIDACION: texto(emb?.almacenConsolidacion),
    VIN_OTRA_UNIDAD: "",
    AGENTE_ADUANA: texto(agente?.nombre),
    AGENTE_ADUANA_RUC: texto(agente?.rucOTaxId),
    AGENTE_ADUANA_CONTACTO: contacto(agente),

    EST_INLAND: monto(p?.inland),
    EST_FLETE: monto(p?.flete),
    EST_SEGURO: monto(p?.seguro),
    EST_CIF: monto(p?.cif),
    TASA_ADVALOREM: porcentaje(p?.tasas.adValorem),
    EST_ADVALOREM: monto(p?.adValorem),
    TASA_ISC: porcentaje(p?.tasas.isc),
    EST_ISC: monto(p?.isc),
    EST_IGV_IPM: p ? monto(p.igv + p.ipm) : "",
    TASA_PERCEPCION: porcentaje(p?.tasas.percepcion),
    EST_PERCEPCION: monto(p?.percepcion),
    EST_TRIBUTOS: p ? monto(p.tributos + p.percepcion) : "",
    EST_GASTOS_ADUANA: monto(p?.gastosAduana),
    EST_GASTOS_REGISTRALES: monto(p?.gastosRegistrales),
    TASA_COMISION: porcentaje(p?.tasas.honorariosTasaEfectiva),
    COMISION_TOTAL: monto(e.honorariosUsd ?? p?.honorarios),
    COMISION_BASE: monto(e.honorariosBaseUsd ?? p?.honorariosBase),
    COMISION_IGV: monto(e.honorariosIgvUsd ?? p?.honorariosIgv),
    COMISION_H1: monto(hito("H1")),
    COMISION_H4: monto(hito("H4")),
    PORCENTAJE_DETRACCION: e.porcentajeDetraccion !== null ? porcentajeSinSigno(e.porcentajeDetraccion / 100) : "",
    EST_TOTAL: monto(p?.totalConPercepcion),
    H2_MONTO: monto(hito("H2")),
    MARGEN_H3: porcentajeSinSigno(e.margenH3 ?? p?.margenH3),
    H3_MONTO: monto(hito("H3")),
    TC_REFERENCIAL: "",
    TARIFA_CUSTODIA: monto(e.tarifaCustodiaUsd),
    COSTO_INSPECCION: monto(e.costoInspeccionUsd),

    CTA_OPER_BANCO: "",
    CTA_OPER_NUMERO: "",
    CTA_OPER_CCI: "",
    CTA_FONDOS_BANCO: "",
    CTA_FONDOS_NUMERO: "",
    CTA_FONDOS_CCI: "",
    CTA_DETRACCION_NUMERO: "",

    FECHA_DEPOSITO: "",
    MONTO_DEPOSITO: "",
    HITO: "",
    SALDO_ANTERIOR: "",
    SALDO_NUEVO: "",
    DAM_NUMERO: texto(e.damNumero),
    DAM_FECHA: fechaEnLetras(e.damFecha),
    CANAL: texto(e.damCanal),
    FACTOR_CONVERSION: "",
    TC_SBS_PAGO: "",
    FECHA_ENTREGA: fechaEnLetras(e.fechaEntrega),
    KM_ENTREGA: e.kmEntrega !== null ? entero(e.kmEntrega, " km") : "",
    PLACA: texto(e.placa),
    TIVE_NUMERO: texto(e.tiveNumero),
  };

  // Lo que llega de fuera gana, pero solo si trae algo.
  for (const [k, valor] of Object.entries(extra)) {
    if (!esCampo(k)) continue;
    const limpio = (valor ?? "").trim();
    if (limpio) base[k] = limpio;
  }

  const faltantes: Campo[] = [];
  const manualesVacios: Campo[] = [];
  for (const campo of CAMPOS) {
    if (base[campo]) continue;
    (esManual(campo) ? manualesVacios : faltantes).push(campo);
  }
  return { campos: base, faltantes, manualesVacios };
}

/**
 * Mapa listo para imprimir: los manuales vacíos salen como línea en blanco.
 * Los no manuales vacíos quedan vacíos (quien emite ya los filtró).
 */
export function camposParaImprimir(campos: Campos): Campos {
  const salida = { ...campos };
  for (const campo of CAMPOS) {
    if (!salida[campo] && esManual(campo)) salida[campo] = LINEA_EN_BLANCO;
  }
  return salida;
}

/**
 * Envuelve un mapa para REGISTRAR qué campos lee una plantilla. Con eso se
 * sabe qué faltantes importan para ESTE documento (una plantilla no usa los
 * cien campos) y la prueba comprueba que ninguna lea un nombre que no existe.
 */
export function espiarCampos(campos: Campos): { campos: Campos; usados: Set<Campo> } {
  const usados = new Set<Campo>();
  const proxy = new Proxy(campos, {
    get(objetivo, prop) {
      if (typeof prop !== "string") return undefined;
      if (!esCampo(prop)) {
        throw new Error(`La plantilla usa un campo que no existe en la ficha: ${prop}`);
      }
      usados.add(prop);
      return objetivo[prop];
    },
  });
  return { campos: proxy, usados };
}
