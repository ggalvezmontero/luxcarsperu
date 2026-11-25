/**
 * Etiquetas y formatos compartidos por las pantallas de expedientes (portal y
 * cuenta del cliente). Sin lógica de negocio: eso está en el core.
 */

import type { BadgeTone } from "@/components/portal/CrmUI";
import type {
  EstadoTarea,
  EtapaExpediente,
  ModalidadEmbarque,
  ResponsableTarea,
  TipoCliente,
  TipoContenedor,
  TipoContraparte,
  TipoHito,
} from "@/core/expedientes/tipos";

export const ETAPA_TONE: Record<EtapaExpediente, BadgeTone> = {
  prospecto: "neutral",
  contrato: "silver",
  busqueda: "info",
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
  vendedor: "Vendedor",
  forwarder: "Forwarder",
  agente_aduana: "Agente de aduana",
  aseguradora: "Aseguradora",
  inspector: "Inspector",
  notaria: "Notaría",
  deposito: "Depósito",
  gestor: "Gestor",
  otro: "Otro",
};

export const HITO_LABEL: Record<TipoHito, string> = {
  H1: "H1 · Honorarios 30 %",
  H2: "H2 · Compra y flete",
  H3: "H3 · Tributos y gastos",
  H4: "H4 · Honorarios 70 %",
};

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
