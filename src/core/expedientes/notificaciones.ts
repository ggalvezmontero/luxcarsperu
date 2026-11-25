/**
 * Plantillas de los avisos al cliente de un expediente (correo y WhatsApp).
 *
 * TypeScript puro: recibe un contexto ya resuelto (código, cliente, auto,
 * enlace) y los datos propios de cada aviso, y devuelve asunto, texto plano y
 * HTML. Quién lo envía, por qué canal y cómo se registra es cosa del servidor
 * (`src/lib/expedientes/servidor/notificar.ts`); acá solo hay palabras.
 *
 * Tono: la marca se escribe "Luxcars" (nunca "LuxCars"), se tutea al cliente,
 * frases cortas, y siempre el código del expediente y el enlace a su cuenta.
 * Ningún aviso menciona montos reservados ni contrapartes.
 */

import type { EtapaExpediente, TipoHito } from "./tipos";
import { nombreEtapaCliente } from "./etapas";

export const PLANTILLAS_NOTIFICACION = [
  "etapa_alcanzada",
  "tarea_pendiente",
  "deposito_confirmado",
  "documento_disponible",
  "aviso_h3",
  "diferencia_h3",
  "auto_listo",
] as const;

export type PlantillaNotificacion = (typeof PLANTILLAS_NOTIFICACION)[number];

export const PLANTILLA_NOTIFICACION_LABEL: Record<PlantillaNotificacion, string> = {
  etapa_alcanzada: "Etapa alcanzada",
  tarea_pendiente: "Tarea pendiente del cliente",
  deposito_confirmado: "Depósito confirmado (con constancia)",
  documento_disponible: "Documento disponible",
  aviso_h3: "Aviso de pago H3",
  diferencia_h3: "Diferencia por depositar",
  auto_listo: "Auto listo para entrega",
};

export function esPlantillaNotificacion(valor: unknown): valor is PlantillaNotificacion {
  return typeof valor === "string" && (PLANTILLAS_NOTIFICACION as readonly string[]).includes(valor);
}

/** Lo común a todos los avisos. `enlace` es la página del expediente en la cuenta del cliente. */
export type ContextoNotificacion = {
  codigo: string;
  /** Razón social o nombre del cliente; el saludo usa el primer nombre si parece persona. */
  cliente: string;
  /** "Toyota Tundra 2026". */
  auto: string;
  etapa: EtapaExpediente;
  enlace: string;
};

/**
 * Datos propios de cada plantilla. Todo opcional: lo que falte se omite del
 * texto en vez de romper. Los montos van en USD.
 */
export type DatosNotificacion = {
  /** etapa_alcanzada: si se omite, se usa la etapa del contexto. */
  etapa?: EtapaExpediente;
  /** tarea_pendiente */
  tarea?: string;
  venceEl?: string | null;
  instrucciones?: string | null;
  /** deposito_confirmado · aviso_h3 · diferencia_h3 */
  montoUsd?: number | null;
  hito?: TipoHito | null;
  fecha?: string | null;
  fechaLimite?: string | null;
  /** deposito_confirmado: si la constancia ya está en la cuenta. */
  conConstancia?: boolean;
  /** documento_disponible */
  documento?: string;
  /** auto_listo */
  lugar?: string | null;
  /** Nota libre que se añade al final de cualquier aviso. */
  nota?: string | null;
};

export type Notificacion = {
  plantilla: PlantillaNotificacion;
  asunto: string;
  texto: string;
  html: string;
};

export const SITIO = "https://www.luxcars.pe";

/** Enlace a la página del expediente en la cuenta del cliente. */
export function enlaceCuenta(codigo: string, sitio: string = SITIO): string {
  return `${sitio}/cuenta/importaciones/${encodeURIComponent(codigo)}`;
}

/** Enlace `wa.me` con el texto listo. `null` si el teléfono no sirve. */
export function enlaceWhatsApp(telefonoDigitos: string | null, texto: string): string | null {
  if (!telefonoDigitos) return null;
  return `https://wa.me/${telefonoDigitos}?text=${encodeURIComponent(texto)}`;
}

export function montoUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  return `USD ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

const NOMBRE_HITO: Record<TipoHito, string> = {
  H1: "H1 (honorarios iniciales)",
  H2: "H2 (compra y flete)",
  H3: "H3 (tributos y gastos de aduana)",
  H4: "H4 (saldo de honorarios)",
};

/** "Hola Ana," para personas; "Hola," para razones sociales (S.A.C., S.A., E.I.R.L., Ltd…). */
export function saludo(cliente: string): string {
  const limpio = cliente.trim();
  const pareceEmpresa = /\b(s\.?a\.?c?\.?|s\.?r\.?l\.?|e\.?i\.?r\.?l\.?|ltd|inc|corp|s\.?a\.?)\b\.?$/i.test(limpio) || /[A-Z]{3,}/.test(limpio.replace(/\b[A-Z]\./g, ""));
  if (!limpio || pareceEmpresa) return "Hola,";
  const primero = limpio.split(/\s+/)[0];
  return `Hola ${primero},`;
}

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Cuerpo: párrafos en texto plano y el mismo contenido en HTML sobrio. */
function armar(plantilla: PlantillaNotificacion, ctx: ContextoNotificacion, asunto: string, parrafos: (string | null | undefined)[], nota?: string | null): Notificacion {
  const cuerpo = [saludo(ctx.cliente), ...parrafos, nota?.trim() || null].filter((p): p is string => Boolean(p && p.trim()));
  const cierre = [
    `Puedes ver el detalle en tu cuenta: ${ctx.enlace}`,
    "Si tienes alguna duda, respóndenos por aquí o escríbenos por WhatsApp.",
    "Equipo Luxcars",
  ];
  const texto = [...cuerpo, "", ...cierre].join("\n\n").replace(/\n\n\n\n/g, "\n\n");
  const html = [
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1f;max-width:560px">',
    ...cuerpo.map((p) => `<p>${escapar(p)}</p>`),
    `<p><a href="${escapar(ctx.enlace)}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#111114;color:#fff;text-decoration:none">Ver mi expediente ${escapar(ctx.codigo)}</a></p>`,
    `<p style="color:#55555f;font-size:13px">Si el botón no abre, copia este enlace: ${escapar(ctx.enlace)}</p>`,
    '<p style="color:#55555f;font-size:13px">Si tienes alguna duda, respóndenos por aquí o escríbenos por WhatsApp.<br>Equipo Luxcars</p>',
    "</div>",
  ].join("");
  return { plantilla, asunto, texto, html };
}

export function construirNotificacion(plantilla: PlantillaNotificacion, ctx: ContextoNotificacion, datos: DatosNotificacion = {}): Notificacion {
  const ref = `${ctx.auto} · expediente ${ctx.codigo}`;
  switch (plantilla) {
    case "etapa_alcanzada": {
      const etapa = datos.etapa ?? ctx.etapa;
      const nombre = nombreEtapaCliente(etapa);
      return armar(plantilla, ctx, `Tu importación avanzó: ${nombre} · ${ctx.codigo}`, [
        `Tu ${ctx.auto} pasó a la etapa "${nombre}".`,
        textoEtapa(etapa),
      ], datos.nota);
    }
    case "tarea_pendiente":
      return armar(plantilla, ctx, `Necesitamos algo de ti · ${ctx.codigo}`, [
        `Para seguir con tu ${ctx.auto} necesitamos que hagas lo siguiente: ${datos.tarea ?? "revisa la tarea pendiente en tu cuenta"}.`,
        datos.venceEl ? `Fecha límite: ${fechaLarga(datos.venceEl)}.` : null,
        datos.instrucciones ?? null,
      ], datos.nota);
    case "deposito_confirmado":
      return armar(plantilla, ctx, `Depósito confirmado · ${ctx.codigo}`, [
        `Confirmamos la recepción de tu depósito${datos.montoUsd ? ` de ${montoUsd(datos.montoUsd)}` : ""}${datos.hito ? ` para el hito ${NOMBRE_HITO[datos.hito]}` : ""}${datos.fecha ? `, acreditado el ${fechaLarga(datos.fecha)}` : ""}.`,
        datos.conConstancia === false
          ? "La constancia de recepción de fondos quedará disponible en tu cuenta en breve."
          : "La constancia de recepción de fondos ya está en tu cuenta, en la sección Documentos.",
        `Referencia: ${ref}.`,
      ], datos.nota);
    case "documento_disponible":
      return armar(plantilla, ctx, `Documento disponible: ${datos.documento ?? "nuevo documento"} · ${ctx.codigo}`, [
        `Ya puedes descargar "${datos.documento ?? "el documento"}" desde tu cuenta, en la sección Documentos.`,
        `Referencia: ${ref}.`,
      ], datos.nota);
    case "aviso_h3":
      return armar(plantilla, ctx, `Aviso de pago H3: tributos y gastos de aduana · ${ctx.codigo}`, [
        `Tu ${ctx.auto} está por llegar y toca el tercer hito: los tributos y gastos de aduana.`,
        datos.montoUsd ? `Monto a depositar: ${montoUsd(datos.montoUsd)}.` : null,
        datos.fechaLimite ? `Fecha límite: ${fechaLarga(datos.fechaLimite)}. Sin este depósito no se puede numerar la DAM y el auto genera almacenaje en el puerto.` : "Sin este depósito no se puede numerar la DAM y el auto genera almacenaje en el puerto.",
        "El aviso con el detalle y las cuentas está en tu cuenta, en Documentos. Cuando transfieras, decláralo desde ahí con el comprobante.",
      ], datos.nota);
    case "diferencia_h3":
      return armar(plantilla, ctx, `Diferencia por depositar · ${ctx.codigo}`, [
        `La liquidación definitiva de aduana de tu ${ctx.auto} salió ${datos.montoUsd ? `${montoUsd(datos.montoUsd)} ` : ""}por encima de lo depositado para el hito H3.`,
        datos.montoUsd ? `Monto por depositar: ${montoUsd(datos.montoUsd)}.` : null,
        datos.fechaLimite ? `Te pedimos cubrirlo antes del ${fechaLarga(datos.fechaLimite)} para no detener el despacho.` : "Te pedimos cubrirlo a la brevedad para no detener el despacho.",
        "La liquidación con el detalle está en tu cuenta, en Documentos.",
      ], datos.nota);
    case "auto_listo":
      return armar(plantilla, ctx, `Tu ${ctx.auto} está listo para la entrega · ${ctx.codigo}`, [
        `Tu ${ctx.auto} ya tiene placa y está listo para que lo recojas.`,
        datos.lugar ? `Lugar de entrega: ${datos.lugar}.` : null,
        datos.fecha ? `Fecha propuesta: ${fechaLarga(datos.fecha)}.` : "Escríbenos para coordinar el día y la hora.",
        "El día de la entrega firmamos el acta y te llevas la documentación completa.",
      ], datos.nota);
  }
}

/** Una línea que explica al cliente qué pasa en cada etapa. */
export function textoEtapa(etapa: EtapaExpediente): string | null {
  switch (etapa) {
    case "contrato":
      return "Estamos preparando el contrato y sus anexos para la firma.";
    case "busqueda":
      return "Ya buscamos tu unidad con el presupuesto aprobado. Te avisaremos cuando tengamos una opción para inspeccionar.";
    case "compra":
      return "Vamos a cerrar la compra con el vendedor. En tu cuenta verás el hito de pago que corresponde.";
    case "embarque":
      return "El auto va camino al puerto de origen. Te avisaremos la fecha de zarpe.";
    case "transito":
      return "El auto va en la nave rumbo al Callao. Te avisaremos cuando arribe.";
    case "aduana":
      return "El auto llegó y está en despacho aduanero. Pronto te enviaremos la liquidación de tributos.";
    case "placas":
      return "Trámite de placa y tarjeta de propiedad en curso.";
    case "entrega":
      return "Todo listo: coordinemos la entrega.";
    case "cerrado":
      return "Expediente cerrado. Gracias por confiar en Luxcars.";
    default:
      return null;
  }
}
