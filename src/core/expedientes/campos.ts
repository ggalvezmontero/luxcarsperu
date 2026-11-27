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
 * `camposPlantilla(ctx, extra, porDefecto)` arma el mapa completo, en tres capas:
 *   1. el expediente, el cliente, el embarque, las otras unidades del mismo
 *      embarque, las contrapartes, los hitos y el presupuesto guardado
 *      (snapshot de `presupuestar()`);
 *   2. `porDefecto`: los parámetros de la EMPRESA (RUC, cuentas, porcentaje de
 *      detracción, ciudad de firma, días de espera) y el tipo de cambio del
 *      día. Solo rellenan lo que el expediente dejó vacío: si el expediente
 *      tiene su propio porcentaje de detracción, ese manda;
 *   3. `extra`: lo que el equipo escribe en el formulario al generar (fecha
 *      del aviso, un VIN que todavía no está en la base…) y lo que arma el
 *      libro. Gana sobre todo.
 *
 * REGLA "SIN RAYAS" (decisión del 27 nov 2026): ningún documento sale con una
 * línea para llenar a mano. Todo campo que la plantilla use y quede vacío es
 * `faltante` y bloquea la emisión; el portal pide el dato (en el formulario o
 * en /portal/configuracion si es de la empresa). Por eso ya no existe la
 * marca `manual` ni la línea en blanco.
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
};

/**
 * Todos los campos del paquete, en el orden de la ficha. Es la ÚNICA lista:
 * de acá salen el tipo `Campo`, la ficha y la validación de las plantillas.
 */
export const FICHA = {
  // Expediente y operación
  EXPEDIENTE: { grupo: "expediente", descripcion: "Código único por vehículo. Va en cada página y en el concepto de cada transferencia", ejemplo: "LC-2026-011" },
  FECHA_FIRMA: { grupo: "expediente", descripcion: "Fecha del contrato", ejemplo: "28 de noviembre de 2026" },
  CIUDAD_FIRMA: { grupo: "expediente", descripcion: "Ciudad donde se firman los documentos (valor de la empresa)", ejemplo: "Lima" },
  MODALIDAD_EMBARQUE: { grupo: "expediente", descripcion: "Una de tres: contenedor consolidado con otra unidad / contenedor exclusivo / Ro-Ro", ejemplo: "contenedor consolidado con otra unidad" },
  TIPO_CONTENEDOR: { grupo: "expediente", descripcion: "Equipo", ejemplo: "40' HC" },
  PROPORCION_FLETE: { grupo: "expediente", descripcion: "Parte del flete marítimo y de los gastos del contenedor que asume este vehículo", ejemplo: "50 %" },
  DIAS_ESPERA_MAX: { grupo: "expediente", descripcion: "Solo consolidado: días máximos que el cliente acepta esperar a la otra unidad (valor de la empresa; el formulario puede cambiarlo por expediente)", ejemplo: "15" },
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
  CLIENTE_ACTIVIDAD: { grupo: "cliente", descripcion: "Actividad económica (CIIU de la ficha RUC)", ejemplo: "Transporte de carga por carretera" },
  CLIENTE_BANCO_ORIGEN: { grupo: "cliente", descripcion: "Banco y cuenta desde donde pagará (debe ser de la propia empresa)", ejemplo: "BCP, cuenta corriente en dólares" },
  CLIENTE_BENEFICIARIO_FINAL: { grupo: "cliente", descripcion: "Persona natural con 10 % o más del capital: nombre, DNI y porcentaje", ejemplo: "Juan Pérez Rojas, DNI 0XXXXXXX, 60 %" },
  CLIENTE_ORIGEN_FONDOS: { grupo: "cliente", descripcion: "De dónde sale el dinero", ejemplo: "Utilidades acumuladas de la empresa" },

  // Vehículo
  VEH_MARCA: { grupo: "vehiculo", descripcion: "Marca", ejemplo: "Toyota" },
  VEH_MODELO: { grupo: "vehiculo", descripcion: "Modelo", ejemplo: "Tundra" },
  VEH_VERSION: { grupo: "vehiculo", descripcion: "Versión o paquete", ejemplo: "TRD Pro CrewMax" },
  VEH_ANIO: { grupo: "vehiculo", descripcion: "Año modelo", ejemplo: "2026" },
  VEH_VIN: { grupo: "vehiculo", descripcion: "VIN de 17 caracteres", ejemplo: "5TFPC5DB1RX000000" },
  VEH_COLOR: { grupo: "vehiculo", descripcion: "Color", ejemplo: "Blanco" },
  VEH_KM: { grupo: "vehiculo", descripcion: "Kilometraje a la fecha de inspección", ejemplo: "1,200 km" },
  VEH_COMBUSTIBLE: { grupo: "vehiculo", descripcion: "Gasolina / híbrido / eléctrico / diésel (solo nuevo)", ejemplo: "Híbrido gasolina" },
  VEH_CILINDRADA: { grupo: "vehiculo", descripcion: "Cilindrada", ejemplo: "3,445 cc" },
  VEH_TRANSMISION: { grupo: "vehiculo", descripcion: "Transmisión", ejemplo: "Automática 10 velocidades" },
  VEH_CONDICION: { grupo: "vehiculo", descripcion: "Nuevo (sin registro previo) o usado", ejemplo: "Nuevo" },
  VEH_CATEGORIA: { grupo: "vehiculo", descripcion: "Clase del vehículo: M1 (autos y SUV) o N1 (pickups y camionetas); se pide al abrir el expediente", ejemplo: "N1" },
  VEH_PAIS_ENSAMBLAJE: { grupo: "vehiculo", descripcion: "Según el VIN: 1, 4 o 5 EE.UU.; 2 Canadá; 3 México; J Japón", ejemplo: "Estados Unidos" },
  VEH_DOC_PROPIEDAD: { grupo: "vehiculo", descripcion: "Documento que entrega el vendedor: NVIS / MSO / registro provincial / título", ejemplo: "NVIS sin registrar" },
  VEH_PESO: { grupo: "vehiculo", descripcion: "Peso bruto para el forwarder", ejemplo: "2,650 kg" },
  VEH_MEDIDAS: { grupo: "vehiculo", descripcion: "Largo × ancho × alto, para el plano de carga", ejemplo: "5.93 × 2.03 × 1.98 m" },

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
  FECHA_INSPECCION: { grupo: "vendedor", descripcion: "Fecha de la inspección física", ejemplo: "4 de diciembre de 2026" },
  INSPECTOR: { grupo: "vendedor", descripcion: "Quién inspeccionó", ejemplo: "Nombre o empresa" },
  HISTORIAL_REF: { grupo: "vendedor", descripcion: "Número del reporte de historial y de la búsqueda de gravámenes", ejemplo: "CARFAX Canada n.º ..., PPSA BC ..." },
  FECHA_RELEASE: { grupo: "vendedor", descripcion: "Fecha en que el vendedor entrega el auto al transportista del forwarder", ejemplo: "18 de diciembre de 2026" },

  // Logística y aduana
  FORWARDER_NOMBRE: { grupo: "logistica", descripcion: "Consolidador o forwarder", ejemplo: "Example Logistics Inc." },
  FORWARDER_CONTACTO: { grupo: "logistica", descripcion: "Contacto y correo", ejemplo: "ops@example-logistics.com" },
  ALMACEN_CONSOLIDACION: { grupo: "logistica", descripcion: "Dirección del almacén donde se carga el contenedor", ejemplo: "5678 Industrial Ave, Delta, BC" },
  VIN_OTRA_UNIDAD: { grupo: "logistica", descripcion: "Solo consolidado: VIN de la otra unidad del mismo embarque, para el forwarder (sale de los otros expedientes del embarque; en exclusivo o Ro-Ro dice N/A)", ejemplo: "1FTFW1E8XPFA00000" },
  AGENTE_ADUANA: { grupo: "logistica", descripcion: "Agencia de aduana designada", ejemplo: "Agencia ... S.A." },
  AGENTE_ADUANA_RUC: { grupo: "logistica", descripcion: "RUC de la agencia", ejemplo: "20XXXXXXXXX" },
  AGENTE_ADUANA_CONTACTO: { grupo: "logistica", descripcion: "Sectorista y correo", ejemplo: "Nombre, correo" },

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
  PORCENTAJE_DETRACCION: { grupo: "presupuesto", descripcion: "Porcentaje del SPOT (detracción) sobre cada factura de honorarios: 10 % o 12 % según el código de servicio del SPOT; confirmarlo con el contador", ejemplo: "12" },
  EST_TOTAL: { grupo: "presupuesto", descripcion: "Costo total estimado puesto en Lima con placas, honorarios incluidos", ejemplo: "111,867.24" },
  H2_MONTO: { grupo: "presupuesto", descripcion: "Precio del auto en USD + inland + flete + seguro", ejemplo: "73,490.50" },
  MARGEN_H3: { grupo: "presupuesto", descripcion: "Colchón sobre tributos y gastos para cubrir el tipo de cambio", ejemplo: "3" },
  H3_MONTO: { grupo: "presupuesto", descripcion: "(Tributos + gastos de aduana + gastos registrales) × (1 + margen)", ejemplo: "31,006.72" },
  TC_REFERENCIAL: { grupo: "presupuesto", descripcion: "Tipo de cambio referencial soles por dólar del día del aviso de pago (lo trae el servicio de tipo de cambio; se puede corregir a mano)", ejemplo: "3.75" },
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
  FECHA_DEPOSITO: { grupo: "cierre", descripcion: "Fecha del depósito acreditado (constancia de recepción de fondos)", ejemplo: "12 de diciembre de 2026" },
  MONTO_DEPOSITO: { grupo: "cierre", descripcion: "Monto del depósito en USD (constancia)", ejemplo: "73,490.50" },
  HITO: { grupo: "cierre", descripcion: "Hito al que se aplica el depósito (constancia)", ejemplo: "H2" },
  SALDO_ANTERIOR: { grupo: "cierre", descripcion: "Saldo del expediente antes del depósito (constancia)", ejemplo: "0.00" },
  SALDO_NUEVO: { grupo: "cierre", descripcion: "Saldo del expediente después del depósito (constancia)", ejemplo: "73,490.50" },
  DAM_NUMERO: { grupo: "cierre", descripcion: "Número de la DAM (liquidación definitiva)", ejemplo: "118-2027-10-XXXXXX" },
  DAM_FECHA: { grupo: "cierre", descripcion: "Fecha de numeración de la DAM (liquidación definitiva)", ejemplo: "9 de febrero de 2027" },
  CANAL: { grupo: "cierre", descripcion: "Canal de control asignado (liquidación definitiva)", ejemplo: "verde" },
  FACTOR_CONVERSION: { grupo: "cierre", descripcion: "Factor SUNAT para pasar la factura en CAD a USD en la fecha de numeración", ejemplo: "0.7212" },
  TC_SBS_PAGO: { grupo: "cierre", descripcion: "Tipo de cambio venta SBS del día en que se pagaron los tributos", ejemplo: "3.7620" },
  FECHA_ENTREGA: { grupo: "cierre", descripcion: "Fecha de entrega del vehículo (acta y rendición)", ejemplo: "5 de marzo de 2027" },
  KM_ENTREGA: { grupo: "cierre", descripcion: "Kilometraje a la entrega (acta)", ejemplo: "1,260 km" },
  PLACA: { grupo: "cierre", descripcion: "Placa asignada (acta y rendición)", ejemplo: "BXX-000" },
  TIVE_NUMERO: { grupo: "cierre", descripcion: "Número de la tarjeta de identificación vehicular (acta)", ejemplo: "n.º ..." },
  // Fase 3: los arma el libro (src/core/expedientes/ledger.ts); se escriben a mano solo si el libro no los tiene.
  CONSTANCIA_NUMERO: { grupo: "cierre", descripcion: "Correlativo de la constancia dentro del expediente, por orden de depósitos confirmados", ejemplo: "F01" },
  NUMERO_OPERACION: { grupo: "cierre", descripcion: "Número de operación bancaria del depósito o de la devolución", ejemplo: "00123456" },
  FECHA_AVISO: { grupo: "cierre", descripcion: "Fecha en que se emite el aviso de pago H3", ejemplo: "2 de febrero de 2027" },
  FECHA_LIMITE_H3: { grupo: "cierre", descripcion: "Depósito del H3 a más tardar (fecha límite del hito: una semana antes del arribo)", ejemplo: "3 de febrero de 2027" },
  H3_SUBTOTAL: { grupo: "cierre", descripcion: "Tributos (con percepción) más gastos de aduana y registrales, antes del margen (aviso H3)", ejemplo: "30,103.61" },
  H3_MARGEN_MONTO: { grupo: "cierre", descripcion: "Monto del margen por tipo de cambio sobre el subtotal (aviso H3)", ejemplo: "903.11" },
  H3_SOLES: { grupo: "cierre", descripcion: "Equivalente referencial en soles del H3 al tipo de cambio referencial (aviso H3)", ejemplo: "116,275.20" },
  FECHA_LEVANTE: { grupo: "cierre", descripcion: "Fecha del levante (liquidación definitiva)", ejemplo: "12 de febrero de 2027" },
  H3_DEPOSITADO: { grupo: "cierre", descripcion: "Depósitos confirmados aplicados al H3 (liquidación definitiva)", ejemplo: "31,006.72" },
  H3_PAGADO: { grupo: "cierre", descripcion: "Tributos y gastos pagados con cargo al H3, en USD al tipo de cambio de cada pago", ejemplo: "30,412.18" },
  H3_DIFERENCIA: { grupo: "cierre", descripcion: "Diferencia entre lo depositado y lo pagado del H3, en valor absoluto", ejemplo: "594.54" },
  TOTAL_TRIBUTOS_USD: { grupo: "cierre", descripcion: "Total de tributos pagados a SUNAT en USD (liquidación definitiva)", ejemplo: "27,623.61" },
  TOTAL_TRIBUTOS_PEN: { grupo: "cierre", descripcion: "Total de tributos pagados a SUNAT en soles (liquidación definitiva)", ejemplo: "103,920.02" },
  TOTAL_GASTOS_USD: { grupo: "cierre", descripcion: "Total de gastos de aduana y registrales pagados en USD (liquidación definitiva)", ejemplo: "2,480.00" },
  FECHA_RENDICION: { grupo: "cierre", descripcion: "Fecha de la rendición de cuentas", ejemplo: "6 de marzo de 2027" },
  TOTAL_RECIBIDO: { grupo: "cierre", descripcion: "Total depositado por el cliente en Fondos de Clientes (rendición)", ejemplo: "104,497.22" },
  TOTAL_PAGADO: { grupo: "cierre", descripcion: "Total pagado a terceros por cuenta del cliente (rendición)", ejemplo: "103,902.68" },
  SALDO_RENDICION: { grupo: "cierre", descripcion: "Saldo a favor del cliente: recibido menos pagado (rendición)", ejemplo: "594.54" },
  DEVOLUCION_MONTO: { grupo: "cierre", descripcion: "Monto devuelto al cliente (rendición)", ejemplo: "594.54" },
  DEVOLUCION_FECHA: { grupo: "cierre", descripcion: "Fecha de la devolución del saldo (rendición)", ejemplo: "6 de marzo de 2027" },
  TOTAL_OPERACION: { grupo: "cierre", descripcion: "Pagos a terceros más honorarios: costo total para el cliente (rendición)", ejemplo: "112,175.81" },
  DIFERENCIA_ESTIMADO: { grupo: "cierre", descripcion: "Costo total menos el estimado del Anexo B, con signo (rendición)", ejemplo: "+ 308.57" },
  CREDITO_FISCAL: { grupo: "cierre", descripcion: "IGV, IPM y percepción pagados según la DAM: crédito fiscal del cliente (rendición)", ejemplo: "23,203.65" },
  H4_ACREDITADO_FECHA: { grupo: "cierre", descripcion: "Fecha en que se acreditó el H4 (acta de entrega); dice 'pendiente' si todavía no se acreditó", ejemplo: "5 de marzo de 2027" },
} as const satisfies Record<string, DefinicionCampo>;

export type Campo = keyof typeof FICHA;

export const CAMPOS: readonly Campo[] = Object.keys(FICHA) as Campo[];

export function esCampo(nombre: string): nombre is Campo {
  return Object.prototype.hasOwnProperty.call(FICHA, nombre);
}

/**
 * Parámetros de la EMPRESA: se fijan una vez en /portal/configuracion
 * (tabla `configuracion_documentos`; `LUXCARS_DOCUMENTOS_JSON` como respaldo) y
 * llegan a `camposPlantilla` como `porDefecto`. El correo y el teléfono no
 * están porque salen de `LUXCARS_CONFIG.contact` (son públicos, van en la web).
 */
export const CAMPOS_EMPRESA: readonly Campo[] = [
  ...CAMPOS.filter((k) => (FICHA[k].grupo === "luxcars" || FICHA[k].grupo === "cuentas") && k !== "LUXCARS_CORREO" && k !== "LUXCARS_TELEFONO"),
  "PORCENTAJE_DETRACCION",
  "CIUDAD_FIRMA",
  "DIAS_ESPERA_MAX",
];

export function esCampoEmpresa(campo: Campo): boolean {
  return CAMPOS_EMPRESA.includes(campo);
}

/** Mapa completo: cada campo con su valor (vacío = "") . */
export type Campos = Record<Campo, string>;

/** Lo que llega de fuera del expediente (parámetros de la empresa, el libro, el formulario). */
export type CamposExtra = Partial<Record<Campo, string>>;

export type ResultadoCampos = {
  campos: Campos;
  /** Todos los campos vacíos. Quien construye un documento filtra por los que su plantilla usa. */
  faltantes: Campo[];
};

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

const CLASE_TEXTO = { M1: "M1", N1: "N1" } as const;

/** Copia en `base` lo que `capa` traiga con contenido; con `soloVacios`, solo donde `base` está vacío. */
function aplicarCapa(base: Campos, capa: CamposExtra, soloVacios: boolean): void {
  for (const [k, valor] of Object.entries(capa)) {
    if (!esCampo(k)) continue;
    const limpio = (valor ?? "").trim();
    if (!limpio) continue;
    if (soloVacios && base[k]) continue;
    base[k] = limpio;
  }
}

/**
 * Arma el mapa completo de campos de un expediente. Nunca lanza: lo que no se
 * puede llenar queda vacío y aparece en `faltantes`.
 *
 *  · `porDefecto` (parámetros de la empresa, tipo de cambio del día) solo
 *    rellena lo que el expediente dejó vacío.
 *  · `extra` (formulario, libro) gana sobre todo.
 */
export function camposPlantilla(ctx: ContextoExpediente, extra: CamposExtra = {}, porDefecto: CamposExtra = {}): ResultadoCampos {
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

  // Solo en consolidado hay otra unidad: los VIN de los demás expedientes del
  // mismo embarque (si alguno todavía no tiene VIN, queda vacío y se pide a
  // mano). En exclusivo o Ro-Ro no aplica y el forwarder lo lee así.
  const otras = (ctx.unidadesDelEmbarque ?? []).filter((u) => u.id !== e.id);
  const vinOtraUnidad =
    emb?.modalidad === "consolidado"
      ? otras.length > 0 && otras.every((u) => texto(u.vin))
        ? otras.map((u) => texto(u.vin)).join(", ")
        : ""
      : "N/A";

  const base: Campos = {
    EXPEDIENTE: e.codigo,
    FECHA_FIRMA: fechaEnLetras(e.fechaFirma),
    CIUDAD_FIRMA: "",
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
    VEH_CATEGORIA: v.clase ? CLASE_TEXTO[v.clase] : "",
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
    VIN_OTRA_UNIDAD: vinOtraUnidad,
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
    FACTOR_CONVERSION: e.damFactorConversion !== null && e.damFactorConversion !== undefined ? String(e.damFactorConversion) : "",
    TC_SBS_PAGO: e.damTcSbs !== null && e.damTcSbs !== undefined ? e.damTcSbs.toFixed(4) : "",
    FECHA_ENTREGA: fechaEnLetras(e.fechaEntrega),
    KM_ENTREGA: e.kmEntrega !== null ? entero(e.kmEntrega, " km") : "",
    PLACA: texto(e.placa),
    TIVE_NUMERO: texto(e.tiveNumero),
    CONSTANCIA_NUMERO: "",
    NUMERO_OPERACION: "",
    FECHA_AVISO: "",
    FECHA_LIMITE_H3: fechaEnLetras(ctx.hitos.find((h) => h.tipo === "H3")?.fechaLimite),
    H3_SUBTOTAL: "",
    H3_MARGEN_MONTO: "",
    H3_SOLES: "",
    FECHA_LEVANTE: fechaEnLetras(e.levanteEn),
    H3_DEPOSITADO: "",
    H3_PAGADO: "",
    H3_DIFERENCIA: "",
    TOTAL_TRIBUTOS_USD: "",
    TOTAL_TRIBUTOS_PEN: "",
    TOTAL_GASTOS_USD: "",
    FECHA_RENDICION: "",
    TOTAL_RECIBIDO: "",
    TOTAL_PAGADO: "",
    SALDO_RENDICION: "",
    DEVOLUCION_MONTO: "",
    DEVOLUCION_FECHA: "",
    TOTAL_OPERACION: "",
    DIFERENCIA_ESTIMADO: "",
    CREDITO_FISCAL: "",
    H4_ACREDITADO_FECHA: "",
  };

  aplicarCapa(base, porDefecto, true);
  aplicarCapa(base, extra, false);

  const faltantes = CAMPOS.filter((campo) => !base[campo]);
  return { campos: base, faltantes };
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
