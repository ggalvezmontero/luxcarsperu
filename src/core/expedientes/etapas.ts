/**
 * Las nueve etapas de una importación a pedido (más prospecto y cancelado):
 * nombres para el equipo y para el cliente, el texto "qué necesitamos de ti",
 * las tareas plantilla y la compuerta para ENTRAR a cada una.
 *
 * ÚNICA IMPLEMENTACIÓN DE ESTAS REGLAS. Las funciones SQL hacen la
 * transacción (una etapa a la vez, motivo al forzar); lo que falta para
 * avanzar se decide acá y se muestra en pantalla.
 *
 * Evidencia con dos fuentes. Varias compuertas hablan de documentos firmados o
 * de dinero acreditado, que llegan en las fases 2 y 3. Mientras esas tablas no
 * existan, la misma condición se cumple con la TAREA correspondiente marcada
 * como hecha (p. ej. "contrato y LOA firmados" ← `cliente.firmar_contrato_loa`).
 * Cuando el documento o el movimiento existan, cuentan ellos primero.
 */

import { oldestImportableModelYear } from "../pricing/pricingConfig";
import { estadoHito } from "./hitos";
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
  /** Fecha límite tomada del expediente. */
  vence?: "fecha_limite_h2" | "fecha_est_arribo" | "fecha_est_entrega" | "fecha_limite_compra";
  /** Solo aplica en ciertos expedientes (p. ej. consolidado). */
  aplica?: (ctx: ContextoExpediente) => boolean;
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

/** Documento firmado, o la tarea que lo representa mientras no hay documentos. */
function docFirmado(tipo: TipoDocumento, tareaClave: string) {
  return (ctx: ContextoExpediente) =>
    documentoEn(ctx, tipo, ["firmado"]) || tareaHecha(ctx, tareaClave);
}

/** Documento subido o generado (no exige firma). */
function docPresente(tipo: TipoDocumento, tareaClave: string) {
  return (ctx: ContextoExpediente) =>
    documentoEn(ctx, tipo, ["generado", "firmado"]) || tareaHecha(ctx, tareaClave);
}

/** Hito acreditado en el libro, o la tarea de confirmación hecha mientras no hay libro. */
function hitoAcreditado(tipo: TipoHito, tareaClave: string) {
  return (ctx: ContextoExpediente) => {
    const hito = ctx.hitos.find((h) => h.tipo === tipo);
    if (hito && ctx.movimientos.length > 0 && estadoHito(hito, ctx.movimientos) === "acreditado") {
      return true;
    }
    return tareaHecha(ctx, tareaClave);
  };
}

function aprobacion(tipo: TipoAprobacion) {
  return (ctx: ContextoExpediente) => ctx.aprobaciones.some((a) => a.tipo === tipo);
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

function saldoCero(ctx: ContextoExpediente): boolean {
  let saldo = 0;
  for (const m of ctx.movimientos) {
    if (m.estado !== "confirmado") continue;
    if (m.tipo === "deposito") saldo += m.montoUsd;
    else if (m.tipo === "pago" || m.tipo === "devolucion") saldo -= m.montoUsd;
    else saldo += m.montoUsd;
  }
  return Math.abs(saldo) < 0.01;
}

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
    clave: "contrato",
    orden: 1,
    nombreEquipo: "Contrato y KYC",
    nombreCliente: "Contrato y verificación",
    descripcionCliente:
      "Preparamos el contrato de mandato, los anexos y la carta de autorización, y verificamos tus datos.",
    queNecesitamos: "Firmar en notaría y confirmar las cuentas",
    compuerta: [
      C("cliente_completo", "Cliente creado con datos completos (razón social, RUC o DNI, correo, domicilio y representante si es empresa)", clienteCompleto),
    ],
    tareas: [
      { clave: "luxcars.kyc", titulo: "Ficha RUC, vigencia de poder, DNI y listas", responsable: "luxcars", descripcion: "Debida diligencia: ficha RUC, vigencia de poder del representante, DNI y consulta de listas (PEP, OFAC, ONU)." },
      { clave: "luxcars.generar_contrato", titulo: "Generar contrato, anexos C y D y LOA", responsable: "luxcars" },
      { clave: "cliente.firmar_contrato_loa", titulo: "Firmar el contrato y la LOA en notaría", responsable: "cliente", visibleCliente: true, descripcion: "Te mandamos el contrato y la carta de autorización (LOA). Se firman con firma certificada en notaría; nosotros coordinamos la cita." },
      { clave: "cliente.confirmar_cuentas", titulo: "Confirmar por teléfono las cuentas de Luxcars", responsable: "cliente", visibleCliente: true, accion: "confirmar_cuentas", descripcion: "Antes de tu primer depósito te llamamos para que confirmes los números de cuenta. Nunca cambiaremos una cuenta por correo o WhatsApp." },
      { clave: "sistema.abrir_libro", titulo: "Abrir el libro del expediente", responsable: "luxcars", automatica: true },
    ],
  },
  {
    clave: "busqueda",
    orden: 2,
    nombreEquipo: "Búsqueda e inspección",
    nombreCliente: "Buscando tu auto",
    descripcionCliente:
      "Buscamos unidades que cumplan lo acordado, revisamos historial y gravámenes e inspeccionamos la que elijas.",
    queNecesitamos: "Aprobar la inspección y el precio, y pagar el primer hito",
    compuerta: [
      C("contrato_firmado", "Contrato y LOA firmados", docFirmado("contrato", "cliente.firmar_contrato_loa")),
      C("kyc_completo", "KYC completo (ficha RUC, vigencia y listas con fecha)", (ctx) => Boolean(ctx.cliente?.kycCompleto) || tareaHecha(ctx, "luxcars.kyc")),
    ],
    tareas: [
      { clave: "luxcars.buscar_unidades", titulo: "Buscar unidades que cumplan el pedido", responsable: "luxcars" },
      { clave: "luxcars.historial", titulo: "Historial, gravámenes y recalls de la unidad", responsable: "luxcars" },
      { clave: "luxcars.inspeccion", titulo: "Inspección de la unidad (propia o de tercero)", responsable: "luxcars" },
      { clave: "luxcars.proforma", titulo: "Pro forma del vendedor a nombre del cliente", responsable: "luxcars" },
      { clave: "luxcars.anexo_a_presupuesto", titulo: "Anexo A (unidad) y presupuesto definitivo (Anexo B)", responsable: "luxcars" },
      { clave: "cliente.aprobar_inspeccion", titulo: "Aprobar la inspección y el precio", responsable: "cliente", visibleCliente: true, accion: "aprobar_inspeccion", descripcion: "Revisa el informe de inspección y el precio final. Con tu aprobación firmamos el Anexo A y seguimos con la compra." },
      { clave: "cliente.pagar_h1", titulo: "Pagar el hito H1 (30 % de honorarios) al firmar el Anexo A", responsable: "cliente", visibleCliente: true },
      { clave: "luxcars.verificar_cuenta_vendedor", titulo: "Verificar por teléfono la cuenta del vendedor", responsable: "luxcars" },
      { clave: "luxcars.instrucciones_vendedor", titulo: "Instrucciones al vendedor", responsable: "luxcars" },
    ],
  },
  {
    clave: "compra",
    orden: 3,
    nombreEquipo: "Compra y pago al vendedor",
    nombreCliente: "Compra de tu auto",
    descripcionCliente:
      "Con tu depósito pagamos al vendedor, recibimos el bill of sale definitivo y coordinamos la entrega al forwarder.",
    queNecesitamos: "Depositar el hito H2 antes de la fecha límite",
    compuerta: [
      C("anexo_a_firmado", "Anexo A firmado", docFirmado("anexo_a", "luxcars.anexo_a_presupuesto")),
      C("inspeccion_aprobada", "Aprobación del cliente de la inspección y el precio", aprobacion("aprobar_inspeccion")),
      C("h1_acreditado", "H1 acreditado", hitoAcreditado("H1", "cliente.pagar_h1")),
      C("anio_modelo", "El año modelo cumple la antigüedad máxima a la fecha estimada de numeración de la DAM", anioModeloCumple),
    ],
    tareas: [
      { clave: "cliente.depositar_h2", titulo: "Depositar el hito H2 (precio del auto, transporte, flete y seguro)", responsable: "cliente", visibleCliente: true, vence: "fecha_limite_h2", descripcion: "Transfiere a la cuenta de Fondos de Clientes que confirmaste por teléfono. Al acreditarse te enviamos la constancia." },
      { clave: "luxcars.confirmar_h2", titulo: "Confirmar H2 y emitir la constancia de fondos", responsable: "luxcars" },
      { clave: "luxcars.wire_vendedor", titulo: "Wire al vendedor y archivar el SWIFT", responsable: "luxcars" },
      { clave: "luxcars.bill_of_sale", titulo: "Bill of sale definitivo", responsable: "luxcars" },
      { clave: "luxcars.doc_propiedad_forwarder", titulo: "Documento de propiedad al forwarder", responsable: "luxcars" },
      { clave: "luxcars.coordinar_release", titulo: "Coordinar el release de la unidad", responsable: "luxcars" },
    ],
  },
  {
    clave: "embarque",
    orden: 4,
    nombreEquipo: "Exportación y embarque",
    nombreCliente: "Camino al puerto",
    descripcionCliente:
      "El forwarder recoge tu auto, lo carga con acta y fotos, emite el BL y declara la exportación. La póliza va a tu nombre.",
    queNecesitamos: "Decidir si esperas al consolidado o embarcas solo, si el grupo se retrasa",
    compuerta: [
      C("h2_acreditado", "H2 acreditado", hitoAcreditado("H2", "luxcars.confirmar_h2")),
      C("pago_vendedor", "Pago al vendedor registrado", (ctx) =>
        ctx.movimientos.some((m) => m.tipo === "pago" && m.estado === "confirmado" && /vendedor|wire/i.test(m.concepto ?? "")) ||
        tareaHecha(ctx, "luxcars.wire_vendedor")),
      C("bill_of_sale", "Bill of sale subido", docPresente("bill_of_sale", "luxcars.bill_of_sale")),
    ],
    tareas: [
      { clave: "luxcars.instrucciones_forwarder", titulo: "Instrucciones al forwarder", responsable: "luxcars" },
      { clave: "luxcars.poliza", titulo: "Póliza de seguro a nombre del cliente", responsable: "luxcars" },
      { clave: "tercero.inland_acta_carga", titulo: "Transporte interno y acta de carga con fotos", responsable: "tercero" },
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
    nombreEquipo: "Tránsito",
    nombreCliente: "En el mar",
    descripcionCliente:
      "Tu auto navega hacia el Callao. Mientras, el agente de aduana prepara la DAM anticipada y te enviamos el aviso del hito H3.",
    queNecesitamos: "Otorgar el mandato electrónico al agente y depositar el hito H3",
    compuerta: [
      C("poliza", "Póliza subida", docPresente("poliza", "luxcars.poliza")),
      C("bl_emitido", "House BL emitido", docPresente("bl", "luxcars.borrador_bl")),
      C("zarpe", "Zarpe registrado en el embarque", (ctx) => Boolean(ctx.embarque?.fechaZarpeReal)),
    ],
    tareas: [
      { clave: "luxcars.docs_agente", titulo: "Documentos al agente de aduana", responsable: "luxcars" },
      { clave: "cliente.mandato_electronico", titulo: "Otorgar el mandato electrónico al agente de aduana (Clave SOL)", responsable: "cliente", visibleCliente: true, descripcion: "Entra a SUNAT Operaciones en Línea con tu Clave SOL y autoriza al agente de aduana que te indicamos. Te guiamos por WhatsApp." },
      { clave: "luxcars.aviso_h3", titulo: "Emitir el aviso de pago H3 con los valores reales", responsable: "luxcars" },
      { clave: "cliente.depositar_h3", titulo: "Depositar el hito H3 (tributos, aduana y registrales)", responsable: "cliente", visibleCliente: true, vence: "fecha_est_arribo", descripcion: "Debe estar acreditado antes del arribo para numerar la DAM sin demoras." },
      { clave: "luxcars.confirmar_h3", titulo: "Confirmar H3 y emitir la constancia", responsable: "luxcars" },
      { clave: "tercero.numerar_dam", titulo: "Numerar la DAM anticipada", responsable: "tercero" },
    ],
  },
  {
    clave: "aduana",
    orden: 6,
    nombreEquipo: "Aduana",
    nombreCliente: "Aduana en el Callao",
    descripcionCliente:
      "Pagamos la liquidación de SUNAT por tu cuenta, se asigna el canal, se obtiene el levante y la grúa lleva el auto al taller.",
    queNecesitamos: "Nada por ahora: te avisamos si hay una diferencia por el tipo de cambio",
    compuerta: [
      C("h3_acreditado", "H3 acreditado", hitoAcreditado("H3", "luxcars.confirmar_h3")),
      C("dam_numerada", "DAM numerada (número registrado en el expediente)", (ctx) => Boolean(ctx.expediente.damNumero)),
    ],
    tareas: [
      { clave: "tercero.pagar_liquidacion", titulo: "Pagar la liquidación de SUNAT por cuenta del cliente", responsable: "tercero" },
      { clave: "luxcars.canal_levante", titulo: "Registrar canal y levante", responsable: "luxcars" },
      { clave: "luxcars.grua", titulo: "Grúa del puerto al taller", responsable: "luxcars" },
      { clave: "luxcars.liquidacion_definitiva", titulo: "Liquidación definitiva al tipo de cambio de SUNAT", responsable: "luxcars" },
      { clave: "luxcars.diferencia_h3", titulo: "Cobrar o acreditar la diferencia de H3", responsable: "luxcars" },
    ],
  },
  {
    clave: "placas",
    orden: 7,
    nombreEquipo: "Homologación y placas",
    nombreCliente: "Homologación y placas",
    descripcionCliente:
      "Ficha técnica u homologación, inscripción en SUNARP y placas. Con la placa en mano contratas el SOAT y el seguro.",
    queNecesitamos: "Firmar el formato de inmatriculación y contratar SOAT y seguro",
    compuerta: [
      C("levante", "Levante registrado", (ctx) => Boolean(ctx.expediente.levanteEn)),
      C("liquidacion_definitiva", "Liquidación definitiva emitida", docPresente("liquidacion_definitiva", "luxcars.liquidacion_definitiva")),
    ],
    tareas: [
      { clave: "tercero.homologacion", titulo: "Ficha técnica u homologación", responsable: "tercero" },
      { clave: "cliente.firmar_inmatriculacion", titulo: "Firmar el formato de inmatriculación con firma certificada", responsable: "cliente", visibleCliente: true, descripcion: "Es el formulario de SUNARP para la primera inscripción. Se firma ante notario; coordinamos la cita." },
      { clave: "luxcars.sunarp", titulo: "Inscripción en SUNARP", responsable: "luxcars" },
      { clave: "luxcars.placas_aap", titulo: "Placas en la AAP", responsable: "luxcars" },
      { clave: "cliente.soat_seguro", titulo: "Contratar SOAT y seguro vehicular con la placa", responsable: "cliente", visibleCliente: true },
    ],
  },
  {
    clave: "entrega",
    orden: 8,
    nombreEquipo: "Entrega y rendición",
    nombreCliente: "Entrega",
    descripcionCliente:
      "Te entregamos el auto con acta, la carpeta completa y la rendición de cuentas del expediente.",
    queNecesitamos: "Pagar el último hito y dar conformidad a la rendición",
    compuerta: [
      C("tive_placa", "TIVe y placa registradas", (ctx) => Boolean(ctx.expediente.tiveNumero && ctx.expediente.placa)),
    ],
    tareas: [
      { clave: "luxcars.factura_2", titulo: "Factura 2 de honorarios (70 %)", responsable: "luxcars" },
      { clave: "cliente.pagar_h4", titulo: "Pagar el hito H4 (70 % de honorarios)", responsable: "cliente", visibleCliente: true, vence: "fecha_est_entrega" },
      { clave: "luxcars.acta_entrega", titulo: "Acta de entrega", responsable: "luxcars" },
      { clave: "luxcars.rendicion", titulo: "Rendición de cuentas desde el libro", responsable: "luxcars" },
      { clave: "luxcars.devolver_saldo", titulo: "Devolver el saldo a favor", responsable: "luxcars" },
      { clave: "cliente.conformidad_rendicion", titulo: "Dar conformidad a la rendición de cuentas", responsable: "cliente", visibleCliente: true, accion: "conformidad_rendicion", descripcion: "Revisa la rendición: todo lo depositado, todo lo pagado por tu cuenta y el saldo. Con tu conformidad cerramos el expediente." },
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
      C("h4_acreditado", "H4 acreditado", hitoAcreditado("H4", "cliente.pagar_h4")),
      C("acta_firmada", "Acta de entrega firmada", docFirmado("acta_entrega", "luxcars.acta_entrega")),
      C("rendicion_emitida", "Rendición de cuentas emitida", docPresente("rendicion", "luxcars.rendicion")),
      C("saldo_cero", "Saldo del expediente en cero", saldoCero),
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
