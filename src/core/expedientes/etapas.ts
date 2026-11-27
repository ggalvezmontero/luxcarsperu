/**
 * Las nueve etapas de una importación a pedido (más prospecto y cancelado):
 * nombres para el equipo y para el cliente, el texto "qué necesitamos de ti",
 * las tareas plantilla y la compuerta para ENTRAR a cada una.
 *
 * ÚNICA IMPLEMENTACIÓN DE ESTAS REGLAS. Las funciones SQL hacen la
 * transacción (una etapa a la vez, motivo al forzar); lo que falta para
 * avanzar se decide acá y se muestra en pantalla.
 *
 * FLUJO DESDE EL 27 NOV 2026 (decisión del dueño, manda sobre el diseño del 24):
 *   prospecto → busqueda → contrato → compra → embarque → transito → aduana →
 *   placas → entrega → cerrado (+ cancelado).
 *   · Primero se busca y se elige el auto SIN COSTO; el contrato se firma con
 *     la unidad ya elegida. En usados, historial (CarFax) e inspección; en
 *     nuevos, MSO sin matricular y consulta de recalls por VIN, sin inspección.
 *   · UNA sola visita a la notaría: contrato con sus anexos A, B, C y D, la LOA
 *     y el poder para la inmatriculación, en el mismo acto.
 *   · Cinco pagos, seis hitos (ver hitos.ts): Pago 1 H1 al firmar (precio del
 *     vehículo); Pago 2 H2 + H3 al release (flete y seguro + 50 % honorarios);
 *     Pago 3 H4 al arribo (gastos de aduana); Pago 4 H5 cuando SUNAT liquida
 *     (tributos, directo a SUNAT); Pago 5 H6 al levante (50 % restante, neto
 *     del saldo de aduana).
 *   · Inspección SOLO en usados (tarea en búsqueda, informe subido, aprobación
 *     de la unidad con el informe); en nuevos, MSO sin matricular y recalls.
 *   · A la entrega UN documento, "Acta de entrega y rendición de cuentas", con
 *     firma simple; la conformidad también se registra desde el portal.
 *
 * Evidencia con dos fuentes. Varias compuertas hablan de documentos firmados o
 * de dinero acreditado. Los documentos archivados como `firmado` y los hitos
 * acreditados en el libro cumplen la compuerta; mientras la evidencia formal
 * no esté, la misma condición se cumple con la TAREA correspondiente marcada
 * como hecha (p. ej. "contrato y LOA firmados" ← `cliente.firmar_contrato_loa`).
 * Las dos vías valen.
 */

import { oldestImportableModelYear } from "../pricing/pricingConfig";
import { estadoHito } from "./hitos";
import { conceptoDe, saldoCuenta } from "./ledger";
import type {
  ContextoExpediente,
  EstadoTarea,
  EtapaExpediente,
  Faltante,
  ResponsableTarea,
  TipoAprobacion,
  TipoDocumento,
  TipoHito,
} from "./tipos";

/* -------------------------------------------------------------------------- */
/* Tareas plantilla                                                           */
/* -------------------------------------------------------------------------- */

export type TareaPlantilla = {
  /** Estable: `responsable.accion`. Es la llave única por expediente. */
  clave: string;
  titulo: string;
  descripcion?: string;
  responsable: ResponsableTarea;
  /** Sale en "Qué necesitamos de ti" (las del cliente) o en su actividad. */
  visibleCliente?: boolean;
  /** Se resuelve con un botón en la cuenta del cliente. */
  accion?: TipoAprobacion;
  /** Nace hecha (la hace el sistema al pasar de etapa). */
  automatica?: boolean;
  /** Fecha límite tomada del expediente o de los hitos. */
  vence?: "fecha_firma" | "fecha_limite_pago2" | "fecha_est_arribo" | "fecha_est_entrega" | "fecha_limite_compra" | "fecha_limite_h5" | "fecha_limite_h6";
  /** Solo aplica en ciertos expedientes (p. ej. consolidado, usado, nuevo). */
  aplica?: (ctx: ContextoExpediente) => boolean;
  /** Texto distinto cuando el vehículo es usado (p. ej. aprobar la unidad CON el informe de inspección). */
  usado?: { titulo?: string; descripcion?: string };
};

/* -------------------------------------------------------------------------- */
/* Compuertas                                                                 */
/* -------------------------------------------------------------------------- */

export type Condicion = {
  clave: string;
  descripcion: string;
  cumple: (ctx: ContextoExpediente, hoy: Date) => boolean;
};

export function tareaHecha(ctx: ContextoExpediente, clave: string): boolean {
  return ctx.tareas.some((t) => t.clave === clave && t.estado === "hecha");
}

function documentoEn(ctx: ContextoExpediente, tipo: TipoDocumento, estados: readonly string[]): boolean {
  return ctx.documentos.some((d) => d.tipo === tipo && estados.includes(d.estado));
}

/**
 * Documento(s) firmados, o la tarea que los representa mientras no se hayan
 * archivado. Con varios tipos, TODOS deben estar firmados (contrato y LOA).
 */
function docFirmado(tipos: TipoDocumento | TipoDocumento[], tareaClave: string) {
  const lista = Array.isArray(tipos) ? tipos : [tipos];
  return (ctx: ContextoExpediente) =>
    lista.every((tipo) => documentoEn(ctx, tipo, ["firmado"])) || tareaHecha(ctx, tareaClave);
}

/** Documento subido o emitido (no exige firma). */
function docPresente(tipo: TipoDocumento, tareaClave: string) {
  return (ctx: ContextoExpediente) =>
    documentoEn(ctx, tipo, ["emitido", "firmado"]) || tareaHecha(ctx, tareaClave);
}

/**
 * Clave de la tarea del cliente que paga cada hito y de la tarea del equipo
 * que lo confirma. Son las mismas tablas que `tarea_cliente_de_hito` y
 * `tarea_luxcars_de_hito` en SQL (`registrar_movimiento` las cierra al
 * confirmar el depósito). El Pago 2 es UNA transferencia: H2 y H3 comparten
 * la tarea del cliente y la de confirmación.
 */
export const TAREA_CLIENTE_POR_HITO: Record<TipoHito, string> = {
  H1: "cliente.depositar_h1",
  H2: "cliente.depositar_h2",
  H3: "cliente.depositar_h2",
  H4: "cliente.depositar_h4",
  H5: "cliente.depositar_h5",
  H6: "cliente.depositar_h6",
};

export const TAREA_LUXCARS_POR_HITO: Record<TipoHito, string> = {
  H1: "luxcars.confirmar_h1",
  H2: "luxcars.confirmar_h2",
  H3: "luxcars.confirmar_h2",
  H4: "luxcars.confirmar_h4",
  H5: "luxcars.confirmar_h5",
  H6: "luxcars.confirmar_h6",
};

/** Hitos de honorarios: cada uno se factura y se aplica de Fondos de Clientes a Operaciones. */
export const HITOS_HONORARIOS = ["H3", "H6"] as const;
export type HitoHonorarios = (typeof HITOS_HONORARIOS)[number];

/** Tarea del equipo que emite la factura de honorarios y la aplica desde Fondos de Clientes. */
export const TAREA_FACTURA_POR_HITO: Record<HitoHonorarios, string> = {
  H3: "luxcars.factura_h3",
  H6: "luxcars.factura_h6",
};

/** Tarea del equipo que deposita la detracción de cada factura (autodetracción). Nace al confirmar el pago, solo con clientes empresa. */
export const TAREA_AUTODETRACCION_POR_HITO: Record<HitoHonorarios, string> = {
  H3: "luxcars.autodetraccion_h3",
  H6: "luxcars.autodetraccion_h6",
};

/** Número de factura de honorarios de cada hito: la primera mitad (H3) es la factura 1; la segunda (H6), la factura 2. */
export const FACTURA_POR_HITO: Record<HitoHonorarios, 1 | 2> = { H3: 1, H6: 2 };

/** Tarea del equipo que se cumple al emitir el aviso de pago de cada hito (Pagos 3, 4 y 5). */
export const TAREA_AVISO_POR_HITO: Partial<Record<TipoHito, string>> = {
  H4: "luxcars.aviso_pago3",
  H5: "luxcars.aviso_tributos",
  H6: "luxcars.aviso_pago5",
};

/** Hito al que apunta una tarea de pago del cliente, o `null`. */
export function hitoDeTarea(clave: string): TipoHito | null {
  for (const [hito, c] of Object.entries(TAREA_CLIENTE_POR_HITO)) if (c === clave) return hito as TipoHito;
  return null;
}

/** Hito acreditado en el libro, o la tarea de confirmación del equipo hecha mientras no hay libro. */
function hitoAcreditado(tipo: TipoHito) {
  return (ctx: ContextoExpediente) => {
    const hito = ctx.hitos.find((h) => h.tipo === tipo);
    if (hito && ctx.movimientos.length > 0 && estadoHito(hito, ctx.movimientos, ctx.hitos) === "acreditado") {
      return true;
    }
    return tareaHecha(ctx, TAREA_LUXCARS_POR_HITO[tipo]);
  };
}

function aprobacion(tipo: TipoAprobacion, tareaClave?: string) {
  return (ctx: ContextoExpediente) => ctx.aprobaciones.some((a) => a.tipo === tipo) || (tareaClave ? tareaHecha(ctx, tareaClave) : false);
}

export function clienteCompleto(ctx: ContextoExpediente): boolean {
  const c = ctx.cliente;
  if (!c) return false;
  const identificado = Boolean(c.ruc || c.dni);
  const base = Boolean(c.razonSocial && identificado && c.email && c.domicilio);
  if (c.tipo === "empresa") return base && Boolean(c.representante && c.representanteDni);
  return base;
}

/**
 * ¿El año modelo sigue cumpliendo la regla de antigüedad el año en que se
 * numera la DAM? Se evalúa contra el año de la FECHA ESTIMADA DE ARRIBO, no el
 * actual: un usado 2025 que entra en 2026 cumple, el mismo auto que arriba en
 * enero de 2027 ya no. Un vehículo nuevo siempre cumple.
 */
export function anioModeloCumple(ctx: ContextoExpediente, hoy: Date): boolean {
  const v = ctx.expediente.vehiculo;
  if (v.condicion === "nuevo") return true;
  const anioNumeracion = anioDeNumeracion(ctx, hoy);
  return v.anio >= oldestImportableModelYear(anioNumeracion);
}

/** Año en que se estima numerar la DAM: el del arribo estimado, o el actual. */
export function anioDeNumeracion(ctx: ContextoExpediente, hoy: Date): number {
  const fecha = ctx.expediente.fechaEstArribo ?? ctx.embarque?.fechaArriboEst ?? null;
  if (fecha) {
    const anio = Number(fecha.slice(0, 4));
    if (Number.isFinite(anio)) return anio;
  }
  return hoy.getFullYear();
}

/**
 * Saldo de Fondos de Clientes en cero (lo que el cliente dejó para pagar a
 * terceros, ya pagado o devuelto). Los honorarios (Operaciones) y lo pagado
 * directo a SUNAT no son saldo del cliente en custodia.
 */
function saldoCero(ctx: ContextoExpediente): boolean {
  return Math.abs(saldoCuenta(ctx.movimientos, "fondos_clientes")) < 0.01;
}

export const esUsado = (ctx: ContextoExpediente) => ctx.expediente.vehiculo.condicion === "usado";
const esNuevo = (ctx: ContextoExpediente) => ctx.expediente.vehiculo.condicion === "nuevo";

/* -------------------------------------------------------------------------- */
/* Definición de cada etapa                                                   */
/* -------------------------------------------------------------------------- */

export type DefinicionEtapa = {
  clave: EtapaExpediente;
  orden: number;
  nombreEquipo: string;
  /** `null` = no se muestra al cliente (prospecto). */
  nombreCliente: string | null;
  /** Qué está pasando, en palabras para el cliente. */
  descripcionCliente: string;
  /** Encabezado de la lista de tareas del cliente en esa etapa. */
  queNecesitamos: string;
  compuerta: Condicion[];
  tareas: TareaPlantilla[];
};

const C = (clave: string, descripcion: string, cumple: Condicion["cumple"]): Condicion => ({
  clave,
  descripcion,
  cumple,
});

export const ETAPAS: readonly DefinicionEtapa[] = [
  {
    clave: "prospecto",
    orden: 0,
    nombreEquipo: "Prospecto",
    nombreCliente: null,
    descripcionCliente: "Estamos preparando tu propuesta.",
    queNecesitamos: "Por ahora nada: te avisamos cuando la propuesta esté lista.",
    compuerta: [],
    tareas: [
      { clave: "luxcars.cotizar", titulo: "Cotizar el vehículo (presupuesto preliminar)", responsable: "luxcars" },
      { clave: "luxcars.crear_cliente", titulo: "Completar los datos del cliente", responsable: "luxcars" },
    ],
  },
  {
    clave: "busqueda",
    orden: 1,
    nombreEquipo: "Búsqueda y elección del auto",
    nombreCliente: "Buscando tu auto",
    descripcionCliente:
      "Buscamos unidades que cumplan lo acordado, revisamos el historial y, si es usado, lo inspeccionamos. Te traemos la pro forma del vendedor a tu nombre. Sin costo hasta que elijas.",
    queNecesitamos: "Aprobar la unidad y el precio",
    compuerta: [
      C("cliente_completo", "Cliente creado con datos completos (razón social, RUC o DNI, correo, domicilio y representante si es empresa)", clienteCompleto),
    ],
    tareas: [
      { clave: "luxcars.buscar_unidades", titulo: "Buscar unidades que cumplan el pedido", responsable: "luxcars" },
      { clave: "luxcars.proforma", titulo: "Pro forma del broker a nombre del cliente", responsable: "luxcars", descripcion: "Precio del vehículo: es el hito H1 (Pago 1)." },
      { clave: "luxcars.historial", titulo: "Historial de la unidad (CarFax) y gravámenes", responsable: "luxcars", aplica: esUsado },
      { clave: "luxcars.inspeccion", titulo: "Inspección de la unidad usada y subir el informe", responsable: "luxcars", descripcion: "Solo usados: inspección física por el inspector del expediente. El informe se sube como documento y el cliente lo aprueba con la unidad.", aplica: esUsado },
      { clave: "luxcars.verificar_nuevo", titulo: "MSO sin matricular y consulta de recalls por VIN", responsable: "luxcars", descripcion: "Unidad nueva: el MSO debe estar sin registrar en ningún estado y la consulta de recalls por VIN no tiene costo.", aplica: esNuevo },
      { clave: "luxcars.presupuesto_definitivo", titulo: "Presupuesto definitivo (Anexo B) con la unidad elegida", responsable: "luxcars" },
      {
        clave: "cliente.aprobar_unidad",
        titulo: "Aprobar la unidad y el precio",
        responsable: "cliente",
        visibleCliente: true,
        accion: "aprobar_unidad",
        descripcion: "Revisa la unidad, el MSO sin matricular, la consulta de recalls y el presupuesto definitivo. Con tu aprobación preparamos el contrato con esa unidad para firmarlo en notaría.",
        usado: {
          titulo: "Aprobar la unidad, el informe de inspección y el precio",
          descripcion: "Revisa la unidad, su historial, el informe de inspección y el presupuesto definitivo. Con tu aprobación preparamos el contrato con esa unidad para firmarlo en notaría.",
        },
      },
      { clave: "luxcars.verificar_cuenta_vendedor", titulo: "Verificar por teléfono la cuenta del broker", responsable: "luxcars" },
    ],
  },
  {
    clave: "contrato",
    orden: 2,
    nombreEquipo: "Contrato, KYC y Pago 1",
    nombreCliente: "Contrato y primer pago",
    descripcionCliente:
      "Preparamos el contrato de mandato con sus anexos, la carta de autorización en inglés y el poder para las placas. Se firma todo en una sola visita a la notaría y haces el Pago 1: el precio del auto.",
    queNecesitamos: "Firmar en notaría, confirmar las cuentas y hacer el Pago 1",
    compuerta: [
      C("unidad_aprobada", "El cliente aprobó la unidad y el precio desde su cuenta", aprobacion("aprobar_unidad", "cliente.aprobar_unidad")),
      C("presupuesto_definitivo", "Presupuesto definitivo (Anexo B) con la unidad elegida", (ctx) => Boolean(ctx.expediente.presupuesto) || tareaHecha(ctx, "luxcars.presupuesto_definitivo")),
      C("informe_inspeccion", "Solo usados: informe de inspección subido", (ctx) => esNuevo(ctx) || docPresente("informe_inspeccion", "luxcars.inspeccion")(ctx)),
    ],
    tareas: [
      { clave: "luxcars.kyc", titulo: "Ficha RUC, vigencia de poder, DNI y listas", responsable: "luxcars", descripcion: "Debida diligencia: ficha RUC, vigencia de poder del representante, DNI y consulta de listas (PEP, OFAC, ONU)." },
      { clave: "luxcars.generar_contrato", titulo: "Generar contrato, anexos A a D, LOA y poder para la inmatriculación", responsable: "luxcars" },
      { clave: "cliente.firmar_contrato_loa", titulo: "Firmar en notaría: contrato con sus anexos, LOA y poder", responsable: "cliente", visibleCliente: true, descripcion: "Una sola visita a la notaría: el contrato con sus cuatro anexos, la carta de autorización en inglés (LOA) y el poder para tramitar tus placas. Nosotros coordinamos la cita." },
      { clave: "cliente.confirmar_cuentas", titulo: "Confirmar por teléfono las cuentas de Luxcars", responsable: "cliente", visibleCliente: true, accion: "confirmar_cuentas", descripcion: "Antes de tu primer depósito te llamamos para que confirmes los números de cuenta. Nunca cambiaremos una cuenta por correo o WhatsApp." },
      { clave: "cliente.depositar_h1", titulo: "Pago 1 de 5: el precio del auto", responsable: "cliente", visibleCliente: true, vence: "fecha_firma", accion: "declarar_deposito", descripcion: "Al firmar el contrato. Transfiere el precio del auto a la cuenta Fondos de Clientes del Anexo D y avísanos aquí con el comprobante. Cuando llegue te mandamos la constancia.", usado: { titulo: "Pago 1 de 5: el precio del auto y la inspección" } },
      { clave: "luxcars.confirmar_h1", titulo: "Confirmar el Pago 1 (H1) y emitir la constancia de fondos", responsable: "luxcars" },
      { clave: "luxcars.instrucciones_vendedor", titulo: "Instrucciones de compra y exportación al broker y al dealer", responsable: "luxcars" },
      { clave: "sistema.abrir_libro", titulo: "Abrir el libro del expediente", responsable: "luxcars", automatica: true },
    ],
  },
  {
    clave: "compra",
    orden: 3,
    nombreEquipo: "Compra y pago al broker",
    nombreCliente: "Compra de tu auto",
    descripcionCliente:
      "Con tu Pago 1 giramos el precio completo al broker, que paga al dealer. La factura y el título o MSO salen a tu nombre y coordinamos la entrega al forwarder.",
    queNecesitamos: "Nada por ahora: te avisamos cuando el auto esté listo para embarcar",
    compuerta: [
      C("contrato_firmado", "Contrato y LOA firmados en notaría", docFirmado(["contrato", "loa"], "cliente.firmar_contrato_loa")),
      C("kyc_completo", "KYC completo (ficha RUC, vigencia y listas con fecha)", (ctx) => Boolean(ctx.cliente?.kycCompleto) || tareaHecha(ctx, "luxcars.kyc")),
      C("h1_acreditado", "H1 acreditado (Pago 1: precio del vehículo)", hitoAcreditado("H1")),
      C("anio_modelo", "El año modelo cumple la antigüedad máxima a la fecha estimada de numeración de la DAM", anioModeloCumple),
    ],
    tareas: [
      { clave: "luxcars.wire_vendedor", titulo: "Wire del precio completo al broker y archivar el SWIFT", responsable: "luxcars", descripcion: "La comisión del banco por el wire la repone Luxcars el mismo día (campo «Comisión bancaria» del pago)." },
      { clave: "luxcars.bill_of_sale", titulo: "Factura o bill of sale y título o MSO del dealer a nombre del cliente", responsable: "luxcars" },
      { clave: "luxcars.doc_propiedad_forwarder", titulo: "Documento de propiedad al forwarder", responsable: "luxcars" },
      { clave: "luxcars.coordinar_release", titulo: "Coordinar el release de la unidad", responsable: "luxcars" },
    ],
  },
  {
    clave: "embarque",
    orden: 4,
    nombreEquipo: "Exportación, embarque y Pago 2",
    nombreCliente: "Camino al puerto",
    descripcionCliente:
      "El auto está listo para embarcar: toca el Pago 2 (flete, seguro y la primera mitad de nuestros honorarios). El forwarder lo recoge, lo carga con acta y fotos, emite el BL y declara la exportación. La póliza va a tu nombre.",
    queNecesitamos: "Hacer el Pago 2 y, si el consolidado se retrasa, decidir si esperas o embarcas solo",
    compuerta: [
      C("pago_vendedor", "Pago al broker registrado en el libro", (ctx) =>
        ctx.movimientos.some((m) => m.tipo === "pago" && m.estado === "confirmado" && conceptoDe(m).clave === "precio_vehiculo") ||
        tareaHecha(ctx, "luxcars.wire_vendedor")),
      C("bill_of_sale", "Factura o bill of sale y título o MSO subidos", docPresente("bill_of_sale", "luxcars.bill_of_sale")),
    ],
    tareas: [
      { clave: "cliente.depositar_h2", titulo: "Pago 2 de 5: flete, seguro y primera mitad de los honorarios", responsable: "cliente", visibleCliente: true, vence: "fecha_limite_pago2", accion: "declarar_deposito", descripcion: "Una sola transferencia a la cuenta Fondos de Clientes: el flete hasta el Callao, el seguro y la mitad de nuestros honorarios. Avísanos aquí con el comprobante. Te mandamos la constancia y la factura." },
      { clave: "luxcars.confirmar_h2", titulo: "Confirmar el Pago 2 (H2 + H3) y emitir la constancia de fondos", responsable: "luxcars" },
      { clave: "luxcars.factura_h3", titulo: "Emitir la factura 1 de honorarios y aplicarla desde Fondos de Clientes (H3)", responsable: "luxcars", descripcion: "Pestaña Dinero, «Aplicar honorarios»: pasa el importe de la factura de Fondos de Clientes a Operaciones. Con cliente empresa, la detracción se deposita dentro de los cinco días hábiles del pago." },
      { clave: "luxcars.instrucciones_forwarder", titulo: "Instrucciones al forwarder", responsable: "luxcars" },
      { clave: "luxcars.poliza", titulo: "Póliza de seguro a nombre del cliente", responsable: "luxcars" },
      { clave: "tercero.acta_carga", titulo: "Recojo, traslado al puerto y acta de carga con fotos", responsable: "tercero" },
      { clave: "luxcars.borrador_bl", titulo: "Aprobar el borrador del BL", responsable: "luxcars" },
      { clave: "tercero.declaracion_exportacion", titulo: "Declaración de exportación", responsable: "tercero" },
      {
        clave: "cliente.elegir_consolidado",
        titulo: "Elegir: esperar al consolidado o embarcar solo",
        responsable: "cliente",
        visibleCliente: true,
        accion: "elegir_consolidado",
        descripcion: "Si el contenedor compartido se retrasa, puedes esperar (mantienes el flete compartido) o embarcar solo (flete completo a tu cargo).",
        aplica: (ctx) => ctx.embarque?.modalidad === "consolidado",
      },
    ],
  },
  {
    clave: "transito",
    orden: 5,
    nombreEquipo: "Tránsito y Pago 3",
    nombreCliente: "En el mar",
    descripcionCliente:
      "Tu auto navega hacia el Callao. Mientras, el agente de aduana prepara la DAM anticipada y te enviamos el aviso del Pago 3 (gastos de aduana) con la pro forma del agente, para depositarlo al arribo.",
    queNecesitamos: "Otorgar el mandato electrónico al agente y hacer el Pago 3 al arribo",
    compuerta: [
      C("h2_acreditado", "H2 acreditado (flete y seguro)", hitoAcreditado("H2")),
      C("h3_acreditado", "H3 acreditado (50 % de honorarios)", hitoAcreditado("H3")),
      C("poliza", "Póliza subida", docPresente("poliza", "luxcars.poliza")),
      C("bl_emitido", "House BL emitido", docPresente("bl", "luxcars.borrador_bl")),
      C("zarpe", "Zarpe registrado en el embarque", (ctx) => Boolean(ctx.embarque?.fechaZarpeReal)),
    ],
    tareas: [
      { clave: "luxcars.docs_agente", titulo: "Documentos al agente de aduana", responsable: "luxcars" },
      { clave: "cliente.mandato_electronico", titulo: "Otorgar el mandato electrónico al agente de aduana (Clave SOL)", responsable: "cliente", visibleCliente: true, descripcion: "Entra a SUNAT Operaciones en Línea con tu Clave SOL y autoriza al agente de aduana que te indicamos. Te guiamos por WhatsApp." },
      { clave: "luxcars.aviso_pago3", titulo: "Emitir el aviso del Pago 3 con la pro forma del agente (H4)", responsable: "luxcars" },
      { clave: "cliente.depositar_h4", titulo: "Pago 3 de 5: gastos de aduana", responsable: "cliente", visibleCliente: true, vence: "fecha_est_arribo", accion: "declarar_deposito", descripcion: "Cuando el auto llega al Callao: agente de aduana, almacén y grúa del puerto, según la pro forma del agente. Transfiere a la cuenta Fondos de Clientes y avísanos aquí. Si sobra o falta, se ajusta en el Pago 5." },
      { clave: "luxcars.confirmar_h4", titulo: "Confirmar el Pago 3 (H4) y emitir la constancia", responsable: "luxcars" },
      { clave: "tercero.numerar_dam", titulo: "Numerar la DAM anticipada", responsable: "tercero" },
    ],
  },
  {
    clave: "aduana",
    orden: 6,
    nombreEquipo: "Aduana, Pago 4 y levante",
    nombreCliente: "Aduana en el Callao",
    descripcionCliente:
      "SUNAT liquida la DAM: te enviamos el aviso del Pago 4 con el número de liquidación y el monto exacto en soles, y lo pagas directamente a SUNAT. Luego se asigna el canal, se obtiene el levante y la grúa lleva el auto al taller.",
    queNecesitamos: "Pagar los tributos directamente a SUNAT dentro de los dos días hábiles del aviso",
    compuerta: [
      C("h4_acreditado", "H4 acreditado (gastos de aduana)", hitoAcreditado("H4")),
      C("dam_numerada", "DAM numerada (número registrado en el expediente)", (ctx) => Boolean(ctx.expediente.damNumero)),
    ],
    tareas: [
      { clave: "luxcars.aviso_tributos", titulo: "Emitir el aviso del Pago 4 con la liquidación de SUNAT (H5)", responsable: "luxcars" },
      { clave: "cliente.depositar_h5", titulo: "Pago 4 de 5: tributos, directo a SUNAT", responsable: "cliente", visibleCliente: true, vence: "fecha_limite_h5", accion: "declarar_deposito", descripcion: "Págalos tú, en soles, con tu Clave SOL o en la ventanilla de un banco, con el número de liquidación del aviso. Luego avísanos aquí con «Ya pagué» y el comprobante." },
      { clave: "luxcars.confirmar_h5", titulo: "Confirmar el Pago 4 (H5): comprobante de SUNAT", responsable: "luxcars" },
      { clave: "luxcars.pagar_gastos_aduana", titulo: "Pagar al agente, al almacén y la grúa con el Pago 3 (facturas a nombre del cliente)", responsable: "luxcars" },
      { clave: "luxcars.canal_levante", titulo: "Registrar canal y levante", responsable: "luxcars" },
      { clave: "luxcars.grua", titulo: "Grúa del puerto al taller", responsable: "luxcars" },
      { clave: "luxcars.liquidacion_definitiva", titulo: "Liquidación definitiva: tributos y gastos de aduana con el saldo para el Pago 5", responsable: "luxcars" },
    ],
  },
  {
    clave: "placas",
    orden: 7,
    nombreEquipo: "Pago 5, homologación y placas",
    nombreCliente: "Homologación y placas",
    descripcionCliente:
      "Con el auto liberado toca el Pago 5: la segunda mitad de nuestros honorarios, neta del sobrante o faltante de los gastos de aduana. Mientras, tramitamos la ficha técnica, la inscripción en SUNARP con tu poder y las placas.",
    queNecesitamos: "Hacer el Pago 5 y contratar SOAT y seguro cuando te avisemos la placa",
    compuerta: [
      C("levante", "Levante registrado", (ctx) => Boolean(ctx.expediente.levanteEn)),
      C("h5_acreditado", "H5 acreditado (tributos pagados a SUNAT)", hitoAcreditado("H5")),
      C("liquidacion_definitiva", "Liquidación definitiva emitida", docPresente("liquidacion_definitiva", "luxcars.liquidacion_definitiva")),
    ],
    tareas: [
      { clave: "luxcars.aviso_pago5", titulo: "Emitir el aviso del Pago 5: honorarios netos del saldo de aduana (H6)", responsable: "luxcars" },
      { clave: "cliente.depositar_h6", titulo: "Pago 5 de 5: segunda mitad de los honorarios", responsable: "cliente", visibleCliente: true, vence: "fecha_limite_h6", accion: "declarar_deposito", descripcion: "El monto del aviso ya resta lo que sobró de los gastos de aduana (o suma lo que faltó). Transfiere a la cuenta Fondos de Clientes y avísanos aquí con el comprobante." },
      { clave: "luxcars.confirmar_h6", titulo: "Confirmar el Pago 5 (H6) y emitir la constancia", responsable: "luxcars" },
      { clave: "luxcars.factura_h6", titulo: "Emitir la factura 2 de honorarios y aplicarla desde Fondos de Clientes (H6)", responsable: "luxcars", descripcion: "Pestaña Dinero, «Aplicar honorarios»: la mitad completa sale de Fondos de Clientes, porque el cliente ya pagó el Pago 5 neto del saldo de aduana. Con cliente empresa, la detracción se deposita dentro de los cinco días hábiles del pago." },
      { clave: "tercero.homologacion", titulo: "Ficha técnica u homologación (a cargo de Luxcars)", responsable: "tercero" },
      { clave: "luxcars.sunarp", titulo: "Inscripción en SUNARP con el poder para la inmatriculación", responsable: "luxcars" },
      { clave: "luxcars.placas_aap", titulo: "Placas y tarjeta en la AAP", responsable: "luxcars" },
      { clave: "cliente.soat_seguro", titulo: "Contratar SOAT y seguro vehicular con la placa", responsable: "cliente", visibleCliente: true },
    ],
  },
  {
    clave: "entrega",
    orden: 8,
    nombreEquipo: "Entrega y rendición",
    nombreCliente: "Entrega",
    descripcionCliente:
      "Te entregamos el auto con el acta de entrega y rendición de cuentas, la carpeta completa y la devolución del saldo si lo hay.",
    queNecesitamos: "Firmar el acta con el auto delante y dar conformidad a la rendición",
    compuerta: [
      C("tive_placa", "TIVe y placa registradas", (ctx) => Boolean(ctx.expediente.tiveNumero && ctx.expediente.placa)),
      C("h6_acreditado", "H6 acreditado (segunda mitad de honorarios)", hitoAcreditado("H6")),
    ],
    tareas: [
      { clave: "luxcars.acta_rendicion", titulo: "Acta de entrega y rendición de cuentas desde el libro", responsable: "luxcars" },
      { clave: "luxcars.devolver_saldo", titulo: "Devolver el saldo a favor", responsable: "luxcars" },
      { clave: "cliente.conformidad_rendicion", titulo: "Dar conformidad a la rendición de cuentas", responsable: "cliente", visibleCliente: true, accion: "conformidad_rendicion", descripcion: "Revisa la rendición: todo lo depositado, todo lo pagado por tu cuenta, lo que pagaste directo a SUNAT y el saldo. Con tu conformidad cerramos el expediente." },
      { clave: "luxcars.carpeta", titulo: "Carpeta de documentos entregada", responsable: "luxcars" },
      { clave: "luxcars.registro_uif", titulo: "Registro de operaciones (UIF)", responsable: "luxcars" },
    ],
  },
  {
    clave: "cerrado",
    orden: 9,
    nombreEquipo: "Cerrado",
    nombreCliente: "Completado",
    descripcionCliente: "Tu importación terminó. Gracias por confiar en Luxcars.",
    queNecesitamos: "Nada más. Expediente cerrado.",
    compuerta: [
      C("acta_firmada", "Acta de entrega y rendición firmada", docFirmado("acta_rendicion", "luxcars.acta_rendicion")),
      C("conformidad_rendicion", "Conformidad del cliente a la rendición", aprobacion("conformidad_rendicion", "cliente.conformidad_rendicion")),
      C("saldo_cero", "Saldo de Fondos de Clientes en cero", saldoCero),
    ],
    tareas: [],
  },
  {
    clave: "cancelado",
    orden: 99,
    nombreEquipo: "Cancelado",
    nombreCliente: "Cancelado",
    descripcionCliente: "El expediente se canceló. Te enviamos la rendición de cierre y la devolución de los fondos no aplicados.",
    queNecesitamos: "Nada: te contactamos para la devolución.",
    compuerta: [],
    tareas: [
      { clave: "luxcars.devolucion", titulo: "Devolución de fondos no aplicados", responsable: "luxcars" },
      { clave: "luxcars.rendicion_cierre", titulo: "Rendición de cierre (honorarios devengados, cláusula 15)", responsable: "luxcars" },
    ],
  },
];

const POR_CLAVE = new Map(ETAPAS.map((e) => [e.clave, e]));

export function definicionEtapa(clave: EtapaExpediente): DefinicionEtapa {
  const def = POR_CLAVE.get(clave);
  if (!def) throw new Error(`Etapa desconocida: ${clave}`);
  return def;
}

export function nombreEtapaEquipo(clave: EtapaExpediente): string {
  return definicionEtapa(clave).nombreEquipo;
}

export function nombreEtapaCliente(clave: EtapaExpediente): string {
  return definicionEtapa(clave).nombreCliente ?? definicionEtapa(clave).nombreEquipo;
}

/** Tipo de acción del portal que resuelve una tarea, por su clave. */
export function accionDeTarea(clave: string): TipoAprobacion | null {
  for (const etapa of ETAPAS) {
    const t = etapa.tareas.find((x) => x.clave === clave);
    if (t) return t.accion ?? null;
  }
  return null;
}

export function esEtapaTerminal(clave: EtapaExpediente): boolean {
  return clave === "cerrado" || clave === "cancelado";
}

export function evaluarCompuerta(destino: EtapaExpediente, ctx: ContextoExpediente, hoy: Date): Faltante[] {
  return definicionEtapa(destino)
    .compuerta.filter((c) => !c.cumple(ctx, hoy))
    .map((c) => ({ clave: c.clave, descripcion: c.descripcion }));
}

export const ESTADO_TAREA_INICIAL: EstadoTarea = "pendiente";
