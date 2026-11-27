/**
 * Etiquetas y formatos compartidos por las pantallas de expedientes (portal y
 * cuenta del cliente). Sin lógica de negocio: eso está en el core.
 */

import type { BadgeTone } from "@/components/portal/CrmUI";
import type {
  CuentaMovimiento,
  NumeroPago,
  EstadoDocumento,
  EstadoHito,
  EstadoMovimiento,
  EstadoTarea,
  EtapaExpediente,
  ModalidadEmbarque,
  ResponsableTarea,
  TipoCliente,
  TipoContenedor,
  TipoContraparte,
  TipoDocumento,
  TipoHito,
  TipoMovimiento,
} from "@/core/expedientes/tipos";

export const ETAPA_TONE: Record<EtapaExpediente, BadgeTone> = {
  prospecto: "neutral",
  busqueda: "info",
  contrato: "silver",
  compra: "warn",
  embarque: "info",
  transito: "info",
  aduana: "warn",
  placas: "silver",
  entrega: "ok",
  cerrado: "ok",
  cancelado: "danger",
};

export const RESPONSABLE_LABEL: Record<ResponsableTarea, string> = {
  luxcars: "Luxcars",
  cliente: "Cliente",
  tercero: "Tercero",
};

export const ESTADO_TAREA_LABEL: Record<EstadoTarea, string> = {
  pendiente: "Pendiente",
  hecha: "Hecha",
  no_aplica: "No aplica",
};

export const MODALIDAD_LABEL: Record<ModalidadEmbarque, string> = {
  consolidado: "Consolidado (contenedor compartido)",
  exclusivo: "Exclusivo (contenedor propio)",
  roro: "Ro-Ro",
};

export const CONTENEDOR_LABEL: Record<TipoContenedor, string> = {
  c20: "20 pies",
  c40: "40 pies",
  c40hc: "40 pies HC",
  roro: "Ro-Ro",
};

export const TIPO_CLIENTE_LABEL: Record<TipoCliente, string> = {
  empresa: "Empresa",
  persona: "Persona natural",
};

export const CONTRAPARTE_LABEL: Record<TipoContraparte, string> = {
  vendedor: "Dealer (emite factura y MSO)",
  broker: "Broker (recibe el pago)",
  forwarder: "Forwarder",
  agente_aduana: "Agente de aduana",
  aseguradora: "Aseguradora",
  inspector: "Inspector (usados)",
  notaria: "Notaría",
  deposito: "Depósito",
  gestor: "Gestor",
  otro: "Otro",
};

export const ESTADO_DOCUMENTO_LABEL: Record<EstadoDocumento, string> = {
  borrador: "Borrador",
  emitido: "Emitido",
  firmado: "Firmado",
  reemplazado: "Reemplazado",
  anulado: "Anulado",
};

export const ESTADO_DOCUMENTO_TONE: Record<EstadoDocumento, BadgeTone> = {
  borrador: "warn",
  emitido: "info",
  firmado: "ok",
  reemplazado: "neutral",
  anulado: "danger",
};

/** Nombre corto de cada tipo de documento, para listas y badges. */
export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  contrato: "Contrato de mandato",
  anexo_a: "Anexo A · Ficha del vehículo",
  anexo_b: "Anexo B · Presupuesto",
  anexo_c: "Anexo C · Origen de fondos",
  anexo_d: "Anexo D · Instrucciones de pago",
  loa: "Letter of Authorization",
  instrucciones_vendedor: "Instrucciones al vendedor",
  instrucciones_forwarder: "Instrucciones al forwarder",
  constancia_fondos: "Constancia de fondos",
  aviso_h3: "Aviso de pago (Pagos 3, 4 y 5)",
  liquidacion_definitiva: "Liquidación definitiva",
  acta_entrega: "Acta de entrega (en desuso)",
  rendicion: "Rendición de cuentas (en desuso)",
  acta_rendicion: "Acta de entrega y rendición",
  poder_inmatriculacion: "Poder para la inmatriculación",
  factura_honorarios: "Factura de honorarios",
  bill_of_sale: "Bill of sale",
  documento_propiedad: "Documento de propiedad",
  informe_inspeccion: "Informe de inspección",
  poliza: "Póliza",
  bl: "Bill of lading",
  acta_carga: "Acta de carga",
  dam: "DAM",
  liquidacion_sunat: "Liquidación de SUNAT",
  comprobante_pago: "Comprobante de pago",
  comprobante_cliente: "Comprobante del cliente",
  tive: "TIVe",
  otro: "Otro",
};

export const HITO_LABEL: Record<TipoHito, string> = {
  H1: "H1 · Precio del vehículo",
  H2: "H2 · Flete y seguro",
  H3: "H3 · Honorarios 50 %",
  H4: "H4 · Gastos de aduana",
  H5: "H5 · Tributos (directo a SUNAT)",
  H6: "H6 · Honorarios 50 % restante",
};

/** Los cinco pagos que ve el cliente; el Pago 2 agrupa H2 y H3. */
export const PAGO_LABEL: Record<NumeroPago, string> = {
  1: "Pago 1 de 5 · El auto (al firmar)",
  2: "Pago 2 de 5 · Flete, seguro y primera mitad de honorarios (al embarcar)",
  3: "Pago 3 de 5 · Gastos de aduana (al arribo)",
  4: "Pago 4 de 5 · Tributos, directo a SUNAT (con la liquidación)",
  5: "Pago 5 de 5 · Segunda mitad de honorarios (con el levante)",
};

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  deposito: "Depósito del cliente",
  pago: "Pago a tercero",
  devolucion: "Devolución al cliente",
  ajuste: "Ajuste",
};

export const ESTADO_MOVIMIENTO_LABEL: Record<EstadoMovimiento, string> = {
  por_confirmar: "Por confirmar",
  confirmado: "Confirmado",
  anulado: "Anulado",
};

export const ESTADO_MOVIMIENTO_TONE: Record<EstadoMovimiento, BadgeTone> = {
  por_confirmar: "warn",
  confirmado: "ok",
  anulado: "neutral",
};

export const CUENTA_LABEL: Record<CuentaMovimiento, string> = {
  fondos_clientes: "Fondos de clientes",
  operaciones: "Operaciones",
  detracciones: "Detracciones",
  directo: "Pagado directo por el cliente",
};

export const ESTADO_HITO_LABEL: Record<EstadoHito, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  acreditado: "Acreditado",
};

export const ESTADO_HITO_TONE: Record<EstadoHito, BadgeTone> = {
  pendiente: "neutral",
  parcial: "warn",
  acreditado: "ok",
};

/** Monto en su moneda (CAD 98,500.00 · PEN 16,570.22). */
export function dinero(moneda: string, n: number | null | undefined, decimales = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${moneda} ${new Intl.NumberFormat("en-US", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n)}`;
}

/** `2026-11-24` o un ISO con hora → "24 nov 2026". Vacío si no hay fecha. */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: iso.length === 10 ? "UTC" : "America/Lima",
  }).format(d);
}

export function fechaHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Lima",
  }).format(d);
}

export function diasDesde(iso: string, hoy: Date = new Date()): number {
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return 0;
  return Math.max(0, Math.floor((hoy.getTime() - d) / 86_400_000));
}

export function usd(n: number | null | undefined, decimales = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n);
}

export function autoDe(v: { marca: string; modelo: string; version?: string | null; anio: number }): string {
  return [v.marca, v.modelo, v.version ?? "", String(v.anio)].filter(Boolean).join(" ");
}

/** Lee un número escrito a mano (acepta coma decimal). `null` si no es número. */
export function leerNumero(raw: string): number | null {
  const limpio = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!limpio || !/^-?\d+(\.\d+)?$/.test(limpio)) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

export function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}
