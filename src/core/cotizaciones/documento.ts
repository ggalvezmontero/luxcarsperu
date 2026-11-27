/**
 * Documento de la cotización con el formato legal de Luxcars (la misma
 * `Estructura` que renderizan `renderPdf` y `renderDocx` para los documentos
 * del expediente). Sigue el modelo que aprobó el dueño para la COT-2026-035:
 *
 *   1. Vehículos · 2. Costo puesto en Lima (una columna por auto y el total) ·
 *   3. Calendario de pagos (Pago 1 de 5 a Pago 5 de 5, con total) ·
 *   4. Condiciones (la de crédito fiscal y detracción solo con empresas).
 *
 * Con un solo importador los autos se llaman "Auto 1, Auto 2"; con varios
 * importadores en el mismo contenedor, "Empresa 1, Empresa 2" (o "Importador")
 * y el calendario es "de cada empresa".
 */

import { h2, p, tabla, vinetas, type Alineacion, type Bloque, type Estructura } from "../expedientes/documentos/estructura";
import { PRICING_CONFIG } from "../pricing/pricingConfig";
import type { VehicleCategoryId } from "../pricing/vehicleCategories";
import { r2 } from "./calculo";
import type { AutoCotizacion, ClienteCotizacion, DatosCotizacion, ResultadoAuto, ResultadoCotizacion } from "./tipos";

export const PLAZO_POR_DEFECTO = "10 a 14 semanas";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const NUMEROS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];
const NUMEROS_F = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];

/** "USD 92,000.00". */
export const usd = (n: number, decimales = 2): string =>
  "USD " + n.toLocaleString("en-US", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/** 0.155 → "15.5 %", 0.1 → "10 %". */
export function pct(tasa: number): string {
  const v = Math.round(tasa * 1000) / 10;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} %`;
}

/** "2026-11-27" → "27 de noviembre de 2026". */
export function fechaLarga(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1] ?? m[2]} de ${m[1]}`;
}

const PROPULSION_DETALLE: Record<VehicleCategoryId, string> = {
  gasolina: "gasolina",
  hev: "híbrido (HEV)",
  diesel: "diésel",
  ev: "eléctrico (EV)",
  phev: "híbrido enchufable (PHEV)",
};

const PROPULSION_CORTA: Record<VehicleCategoryId, string> = {
  gasolina: "gasolina",
  hev: "híbrido",
  diesel: "diésel",
  ev: "eléctrico",
  phev: "híbrido enchufable",
};

/** El importador de un auto: el suyo o el cliente de la cotización. */
export function importadorDe(auto: AutoCotizacion, cliente: ClienteCotizacion): ClienteCotizacion {
  return auto.importador ?? cliente;
}

/**
 * Quién es el mismo importador: por documento, si no por nombre. Un importador
 * todavía sin razón social ni RUC (pendiente hasta aceptar) cuenta como uno
 * distinto por auto.
 */
function claveImportador(c: ClienteCotizacion, indiceAuto: number): string {
  const doc = c.documento.replace(/\s/g, "");
  if (doc) return `${c.tipo}:${doc}`;
  const nombre = c.nombre.trim().toLowerCase();
  return nombre ? `${c.tipo}:${nombre}` : `pendiente:${indiceAuto}`;
}

/** ¿El importador ya tiene razón social (o nombre) y RUC (o DNI)? Hace falta para aceptar. */
export function importadorCompleto(c: ClienteCotizacion): boolean {
  const doc = c.documento.replace(/\s/g, "");
  return c.nombre.trim().length >= 2 && (c.tipo === "empresa" ? /^\d{11}$/.test(doc) : doc.length >= 6 && doc.length <= 20);
}

/** Clave del importador de cada auto, en orden. */
export function clavesImportadores(datos: DatosCotizacion, cliente: ClienteCotizacion): string[] {
  return datos.autos.map((a, i) => claveImportador(importadorDe(a, cliente), i));
}

/** Importadores distintos, en el orden de los autos. */
export function importadoresDistintos(datos: DatosCotizacion, cliente: ClienteCotizacion): ClienteCotizacion[] {
  const vistos = new Map<string, ClienteCotizacion>();
  datos.autos.forEach((a, i) => {
    const imp = importadorDe(a, cliente);
    const k = claveImportador(imp, i);
    if (!vistos.has(k)) vistos.set(k, imp);
  });
  return [...vistos.values()];
}

function enumerar(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** "la Alfa": la primera palabra del modelo, salvo que dos autos la compartan. */
function apodoDe(autos: readonly ResultadoAuto[]) {
  const primeras = autos.map((a) => a.nombreCorto.split(/\s+/)[0] ?? a.nombreCorto);
  return (a: ResultadoAuto) => {
    const pr = primeras[a.indice - 1];
    return primeras.filter((x) => x === pr).length > 1 ? a.nombreCorto : pr;
  };
}

function detalleAuto(a: AutoCotizacion): string {
  const partes = [a.condicion === "usado" ? "Usado" : "Nuevo"];
  if (a.color.trim()) partes.push(`color ${a.color.trim()}`);
  partes.push(PROPULSION_DETALLE[a.propulsion] ?? a.propulsion);
  return partes.join(" · ");
}

export type EntradaDocumento = {
  codigo: string;
  /** Fecha de emisión, ISO. */
  fecha: string;
  cliente: ClienteCotizacion;
  datos: DatosCotizacion;
  resultado: ResultadoCotizacion;
};

export function construirDocumentoCotizacion(e: EntradaDocumento): Estructura {
  const { datos, resultado, cliente } = e;
  const autos = resultado.autos;
  const n = autos.length;
  const varios = n > 1;
  const importadores = importadoresDistintos(datos, cliente);
  const variosImportadores = importadores.length > 1;
  const apodo = apodoDe(autos);
  const todosEmpresa = importadores.every((i) => i.tipo === "empresa");
  const algunaEmpresa = importadores.some((i) => i.tipo === "empresa");
  const sustantivo = todosEmpresa ? "empresa" : "importador";
  const sustantivoPlural = todosEmpresa ? "empresas" : "importadores";
  const nuevos = datos.autos.every((a) => a.condicion === "nuevo");
  const usados = datos.autos.every((a) => a.condicion === "usado");
  const condicionPlural = nuevos ? " nuevos" : usados ? " usados" : "";
  const condicionSingular = nuevos ? " nuevo" : usados ? " usado" : "";
  const contacto = cliente.nombre.trim();
  const reparto = datos.reparto;
  const iguales = reparto.modo === "iguales";

  // Cómo se nombra la parte de cada auto en las filas de costos repartidos.
  const parte = !varios ? "" : iguales ? (n === 2 ? "mitad" : "parte igual") : "según el porcentaje";
  const sufijoParte = (conContenedor: boolean) =>
    !varios ? "" : iguales && n === 2 ? ` (mitad${conContenedor ? " del contenedor" : ""})` : ` (${parte})`;

  // Entre "las dos" empresas o "los dos" autos.
  const femenino = variosImportadores && todosEmpresa;
  const textoReparto = iguales
    ? `en partes iguales entre ${femenino ? "las" : "los"} ${(femenino ? NUMEROS_F : NUMEROS)[n] ?? n}`
    : `según el porcentaje de cada auto: ${enumerar(autos.map((a) => pct(a.proporcion)))}`;

  // ---------------------------------------------------------------- portada
  const nombreAutos = enumerar(autos.map((a) => a.nombre.replace(/\s\d{4}$/, "")));
  const unoImp = importadores[0];
  const claves = clavesImportadores(datos, cliente);
  const ordenImportador = [...new Set(claves)];
  const contactoEsImportador = !variosImportadores && datos.autos.every((a) => a.importador === null || claveImportador(a.importador, 0) === claveImportador(cliente, -1));
  const nombreDe = (c: ClienteCotizacion, numero: number) => c.nombre.trim() || `${c.tipo === "empresa" ? "Empresa" : "Importador"} ${numero}`;
  const subtitulo = variosImportadores
    ? `Atención: ${contacto} · un contenedor · ${NUMEROS_F[importadores.length] ?? importadores.length} ${sustantivoPlural} importador${todosEmpresa ? "as" : "es"}`
    : [
        contactoEsImportador ? `Para ${contacto}` : `Atención: ${contacto}`,
        contactoEsImportador ? null : `importa ${nombreDe(unoImp, 1)}`,
        nombreAutos,
        varios ? "un contenedor" : null,
      ]
        .filter(Boolean)
        .join(" · ");

  let intro: string;
  if (variosImportadores) {
    intro =
      `A la atención de ${contacto}. Cotización para importar ${NUMEROS[n] ?? n} vehículos${condicionPlural} desde Estados Unidos en un solo contenedor al Callao. ` +
      `Cada auto se importa a nombre de ${todosEmpresa ? "una empresa distinta" : "un importador distinto"}, y cada ${sustantivo} es importador${todosEmpresa ? "a" : ""} de su vehículo, con su propio BL, su DAM y sus facturas. ` +
      `El flete, el seguro, los gastos de aduana y los honorarios de Luxcars se reparten ${textoReparto}.`;
  } else if (varios) {
    intro =
      `Cotización para ${nombreDe(unoImp, 1)} por la importación de ${NUMEROS[n] ?? n} vehículos${condicionPlural} desde Estados Unidos, en un solo contenedor al Callao. ` +
      `${n === 2 ? "Ambos autos" : "Todos los autos"} se importan a su nombre. ` +
      `Para mostrar el costo de cada auto, el flete, el seguro, los gastos de aduana y los honorarios de Luxcars se ${iguales ? "dividen en partes iguales" : `reparten ${textoReparto}`}.`;
  } else {
    intro = `Cotización para ${nombreDe(unoImp, 1)} por la importación de un vehículo${condicionSingular} desde Estados Unidos al Callao.`;
  }
  if (!variosImportadores && !contactoEsImportador) {
    intro = `A la atención de ${contacto}. ${intro}`;
  }

  // ------------------------------------------------------------- vehículos
  // Varios importadores: la razón social si ya se conoce; si no, "Empresa 1", "Empresa 2".
  const etiquetaAuto = (i: number) => {
    if (!variosImportadores) return `Auto ${i + 1}`;
    const numero = ordenImportador.indexOf(claves[i]) + 1;
    const imp = importadorDe(datos.autos[i], cliente);
    return imp.nombre.trim() || `${todosEmpresa ? "Empresa" : "Importador"} ${numero}`;
  };
  const tablaVehiculos = tabla(
    ["", "Vehículo", "Detalle", "Precio"],
    datos.autos.map((a, i) => [etiquetaAuto(i), autos[i].nombre, detalleAuto(a), usd(autos[i].precio)]),
    [1.3, 3, 3, 1.7],
  );

  // ------------------------------------------------- costo puesto en Lima
  const columnasAutos = autos.map((a) => a.nombreCorto);
  const cabeceraCostos = varios ? ["Concepto", ...columnasAutos, "Total"] : ["Concepto", "Monto"];
  const anchoNum = varios ? 5.8 / (n + 1) : 3;
  const anchosCostos = [varios ? 4.4 : 6, ...Array.from({ length: varios ? n + 1 : 1 }, () => Math.round(anchoNum * 10) / 10)];
  const alineacionesNum = (k: number): Alineacion[] => Array.from({ length: k }, () => "derecha" as const);

  const fila = (concepto: string, f: (a: ResultadoAuto) => number, negrita = false): string[] => {
    const v = autos.map(f);
    const w = (t: string) => (negrita ? `**${t}**` : t);
    const celdas = v.map((x) => w(usd(x)));
    return varios ? [w(concepto), ...celdas, w(usd(r2(v.reduce((s, x) => s + x, 0))))] : [w(concepto), ...celdas];
  };

  const tasasAdv = [...new Set(autos.map((a) => a.tasaAdValorem))];
  const etiquetaAdv =
    tasasAdv.length === 1
      ? tasasAdv[0] === 0
        ? "Ad valorem (0 %, TLC Perú–EE.UU.)"
        : `Ad valorem (${pct(tasasAdv[0])})`
      : "Ad valorem (0 % con TLC, 6 % sin TLC)";

  const combosIsc: string[] = [];
  for (const [i, a] of autos.entries()) {
    const auto = datos.autos[i];
    const nombre = auto.condicion === "usado" ? "usado" : PROPULSION_CORTA[auto.propulsion];
    const txt = `${nombre} ${pct(a.tasaIsc)}`;
    if (!combosIsc.includes(txt)) combosIsc.push(txt);
  }
  const etiquetaIsc = `ISC (${combosIsc.join(", ")})`;

  const filasCostos: string[][] = [
    fila("Precio del vehículo", (a) => a.precio),
    fila(`Flete al Callao${sufijoParte(true)}`, (a) => a.flete),
    fila(`Seguro${sufijoParte(false)}`, (a) => a.seguro),
    fila("Valor CIF", (a) => a.cif, true),
    fila(etiquetaAdv, (a) => a.adValorem),
    fila(etiquetaIsc, (a) => a.isc),
    fila(`IGV (${pct(PRICING_CONFIG.igvRate)})`, (a) => a.igv),
    fila(`IPM (${pct(PRICING_CONFIG.ipmRate)})`, (a) => a.ipm),
    fila("Tributos (estimado)", (a) => a.tributos, true),
    fila(`Gastos de aduana${sufijoParte(false)}`, (a) => a.gastosAduana),
    fila(`Honorarios Luxcars, IGV incl.${sufijoParte(false)}`, (a) => a.honorarios),
    fila("Total puesto en Lima", (a) => a.total, true),
  ];

  const tablaCostos: Bloque = {
    tipo: "tabla",
    cabecera: cabeceraCostos,
    filas: filasCostos,
    anchos: anchosCostos,
    alineaciones: ["izquierda", ...alineacionesNum(cabeceraCostos.length - 1)],
  };

  // ------------------------------------------------------ calendario
  const PAGOS: [string, string, string][] = [
    ["Pago 1 de 5", "Al firmar el contrato", "El precio del auto"],
    ["Pago 2 de 5", "Al embarcar", "Flete, seguro y la primera mitad de los honorarios"],
    ["Pago 3 de 5", "Al llegar al Callao", "Gastos de aduana"],
    ["Pago 4 de 5", "Cuando SUNAT liquida", "Tributos, directo a SUNAT (estimado)"],
    ["Pago 5 de 5", "Al levante", "La segunda mitad de los honorarios"],
  ];
  const celdasPago = (k: number): string[] => {
    const v = autos.map((a) => a.pagos[k]);
    const celdas = v.map((x) => usd(x));
    return varios ? [...celdas, usd(r2(v.reduce((s, x) => s + x, 0)))] : celdas;
  };
  const totales = autos.map((a) => `**${usd(a.total)}**`);
  const filaTotal = ["", "", "**Total**", ...totales, ...(varios ? [`**${usd(resultado.total)}**`] : [])];
  const cabeceraCalendario = ["Pago", "Cuándo", "Qué cubre", ...(varios ? [...columnasAutos, "Total"] : ["Monto"])];
  const anchoPago = varios ? 5.2 / (n + 1) : 1.8;
  const tablaCalendario: Bloque = {
    tipo: "tabla",
    cabecera: cabeceraCalendario,
    filas: [...PAGOS.map((pg, k) => [...pg, ...celdasPago(k)]), filaTotal],
    anchos: [1.3, 2.1, 2.6, ...Array.from({ length: cabeceraCalendario.length - 3 }, () => Math.round(anchoPago * 10) / 10)],
    alineaciones: ["izquierda", "izquierda", "izquierda", ...alineacionesNum(cabeceraCalendario.length - 3)],
  };

  const tituloCalendario = variosImportadores ? `3. Calendario de pagos de cada ${sustantivo}` : "3. Calendario de pagos";
  const textoCalendario = variosImportadores
    ? `Cada ${sustantivo} hace cinco pagos por su auto. Todos van a la cuenta Fondos de Clientes de Luxcars, salvo los tributos, que cada ${sustantivo} paga directo a SUNAT.`
    : varios
      ? `Son cinco pagos, cada uno por los ${NUMEROS[n] ?? n} autos juntos. Todos van a la cuenta Fondos de Clientes de Luxcars, salvo los tributos, que se pagan directo a SUNAT.`
      : "Son cinco pagos. Todos van a la cuenta Fondos de Clientes de Luxcars, salvo los tributos, que se pagan directo a SUNAT.";

  // ------------------------------------------------------ condiciones
  const quien = todosEmpresa ? "de la empresa importadora" : "del importador";
  const condiciones: string[] = [
    `**Tributos.** Son un estimado. SUNAT fija la cifra exacta al numerar la DAM y se paga en soles. Cualquier ajuste, diferencia o reliquidación de SUNAT corre por cuenta ${quien}.`,
  ];

  const conTlc = autos.filter((a) => a.tasaAdValorem === 0);
  if (conTlc.length > 0) {
    const extra = conTlc.map((a) => Math.round(a.cif * 0.06));
    const iguala = extra.every((x) => x === extra[0]);
    const cuanto = iguala
      ? `unos ${usd(extra[0], 0)} más${conTlc.length > 1 ? " por auto" : ""}`
      : `unos ${enumerar(conTlc.map((a, i) => `${usd(extra[i], 0)} más por la ${apodo(a)}`))}`;
    condiciones.push(
      `**TLC Perú–Estados Unidos.** El ad valorem de 0 % exige que el vehículo sea originario de EE.UU. y tenga certificado de origen. Si no se acredita, se aplica 6 % sobre el CIF: ${cuanto}, y el ISC, el IGV y el IPM suben en proporción.`,
    );
  }

  const tasasPrimera = [...new Set(autos.map((a) => a.tasaPercepcionPrimera))];
  const tasasRecurrente = [...new Set(autos.map((a) => a.tasaPercepcionRecurrente))];
  const listaPercepcion = (f: (a: ResultadoAuto) => number, conNombres: boolean) =>
    varios ? enumerar(autos.map((a) => (conNombres ? `${usd(f(a))} por la ${apodo(a)}` : usd(f(a))))) : usd(f(autos[0]));
  const textoTasa = (tasas: number[]) => (tasas.length === 1 ? pct(tasas[0]) : enumerar(tasas.map(pct)));
  condiciones.push(
    `**Percepción del IGV.** SUNAT la cobra junto con los tributos, pero no es un costo: es un adelanto que se recupera como crédito fiscal. ` +
      `Si es la primera importación${todosEmpresa ? " de la empresa" : ""}, es de ${textoTasa(tasasPrimera)}: ${listaPercepcion((a) => a.percepcionPrimera, true)}. ` +
      `Para un importador recurrente es de ${textoTasa(tasasRecurrente)}: ${listaPercepcion((a) => a.percepcionRecurrente, false)}. No está incluida en el total.` +
      (algunaEmpresa ? "" : " Si el importador no usa el crédito fiscal, puede pedir a SUNAT su devolución."),
  );

  if (algunaEmpresa) {
    const deQuien = variosImportadores ? (todosEmpresa ? "de cada empresa" : "de cada empresa importadora") : "de la empresa";
    condiciones.push(
      `**Crédito fiscal y detracción.** El IGV y el IPM de la importación, y el IGV de los honorarios, son crédito fiscal ${deQuien}. La empresa paga cada factura de honorarios completa, y Luxcars deposita la detracción y le envía la constancia.`,
    );
  }

  condiciones.push(
    "**Gastos de aduana.** Son reembolsables. Lo que sobre se descuenta del Pago 5 y lo que falte se suma.",
    `**Plazo y vigencia.** El plazo estimado es de ${(datos.plazo ?? "").trim() || PLAZO_POR_DEFECTO} desde el Pago 1. Los precios están sujetos a disponibilidad del vendedor. Esta cotización vale por 15 días.`,
  );

  return {
    titulo: "Cotización de importación a pedido",
    subtitulo,
    tituloCorto: "Cotización de importación",
    idioma: "es",
    codigoExpediente: e.codigo,
    lugarFecha: `Lima, ${fechaLarga(e.fecha)}`,
    marcaDeAgua: "isotipo",
    bloques: [
      p(intro),
      h2("1. Vehículos"),
      tablaVehiculos,
      h2("2. Costo puesto en Lima"),
      tablaCostos,
      p(
        "Los honorarios incluyen la búsqueda y verificación de la unidad, la gestión completa de la importación, la homologación, la inscripción en SUNARP, las placas y la tarjeta de propiedad, y las comisiones bancarias de las transferencias al exterior.",
      ),
      h2(tituloCalendario),
      p(textoCalendario),
      tablaCalendario,
      h2("4. Condiciones"),
      vinetas(condiciones),
    ],
  };
}

/** "cotizacion-COT-2026-036-v2.pdf". */
export function nombreArchivoCotizacion(codigo: string, version: number, extension: "pdf" | "docx"): string {
  return `cotizacion-${codigo.replace(/[^A-Za-z0-9-]/g, "")}${version > 1 ? `-v${version}` : ""}.${extension}`;
}
