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
  "aviso_pago",
  "auto_listo",
] as const;

export type PlantillaNotificacion = (typeof PLANTILLAS_NOTIFICACION)[number];

export const PLANTILLA_NOTIFICACION_LABEL: Record<PlantillaNotificacion, string> = {
  etapa_alcanzada: "Etapa alcanzada",
  tarea_pendiente: "Tarea pendiente del cliente",
  deposito_confirmado: "Depósito confirmado (con constancia)",
  documento_disponible: "Documento disponible",
  aviso_pago: "Aviso de pago (Pagos 3, 4 y 5)",
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
  /** deposito_confirmado · aviso_pago */
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
  H1: "H1 (Pago 1: precio del vehículo)",
  H2: "H2 (Pago 2: flete y seguro)",
  H3: "H3 (Pago 2: primera mitad de honorarios)",
  H4: "H4 (Pago 3: gastos de aduana)",
  H5: "H5 (Pago 4: tributos a SUNAT)",
  H6: "H6 (Pago 5: segunda mitad de honorarios)",
};

/** Texto de cada aviso de pago, por hito. */
const AVISO_POR_HITO: Partial<Record<TipoHito, { asunto: string; intro: (auto: string) => string; cierre: string }>> = {
  H4: {
    asunto: "Aviso del Pago 3: gastos de aduana",
    intro: (auto) => `Tu ${auto} está por llegar al Callao y toca el Pago 3: los gastos de aduana (agente, almacenaje y grúa del puerto), según la pro forma del agente.`,
    cierre: "Es un gasto reembolsable: si sobra, lo descontamos del Pago 5; si falta, se suma a ese pago. El aviso con las cuentas está en tu cuenta, en Documentos.",
  },
  H5: {
    asunto: "Aviso del Pago 4: tributos a SUNAT",
    intro: (auto) => `SUNAT liquidó la DAM de tu ${auto}. Toca el Pago 4: los tributos de importación, que pagas directamente a SUNAT, en soles, con el número de liquidación.`,
    cierre: "Puedes pagar con tu Clave SOL o en ventanilla bancaria. El aviso con el número de liquidación está en tu cuenta, en Documentos; al pagar, declara «Ya pagué» con el comprobante.",
  },
  H6: {
    asunto: "Aviso del Pago 5: segunda mitad de honorarios",
    intro: (auto) => `Tu ${auto} quedó liberado de aduana. Toca el Pago 5: la segunda mitad de nuestros honorarios, ya ajustada con el saldo de los gastos de aduana.`,
    cierre: "Con este pago acreditado coordinamos la entrega con placas. El aviso con el detalle está en tu cuenta, en Documentos.",
  },
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
    case "aviso_pago": {
      const aviso = (datos.hito && AVISO_POR_HITO[datos.hito]) || AVISO_POR_HITO.H4!;
      return armar(plantilla, ctx, `${aviso.asunto} · ${ctx.codigo}`, [
        aviso.intro(ctx.auto),
        datos.montoUsd ? `Monto: ${montoUsd(datos.montoUsd)}.` : null,
        datos.fechaLimite ? `Fecha límite: ${fechaLarga(datos.fechaLimite)}.` : null,
        aviso.cierre,
      ], datos.nota);
    }
    case "auto_listo":
      return armar(plantilla, ctx, `Tu ${ctx.auto} está listo para la entrega · ${ctx.codigo}`, [
        `Tu ${ctx.auto} ya tiene placa y está listo para que lo recojas.`,
        datos.lugar ? `Lugar de entrega: ${datos.lugar}.` : null,
        datos.fecha ? `Fecha propuesta: ${fechaLarga(datos.fecha)}.` : "Escríbenos para coordinar el día y la hora.",
        "El día de la entrega firmas el acta de entrega y rendición de cuentas, con el auto delante, y te llevas la documentación completa.",
      ], datos.nota);
  }
}

/** Una línea que explica al cliente qué pasa en cada etapa. */
export function textoEtapa(etapa: EtapaExpediente): string | null {
  switch (etapa) {
    case "busqueda":
      return "Estamos buscando tu unidad: revisamos su historial y, si es usada, la inspeccionamos antes de pagar. Cuando tengamos la pro forma a tu nombre te la mandamos para que apruebes la unidad y el precio desde tu cuenta.";
    case "contrato":
      return "Estamos preparando el contrato con sus anexos, la carta de autorización y el poder para la firma en notaría. Con la firma toca el Pago 1.";
    case "compra":
      return "Giramos el precio al broker y la factura sale a tu nombre. Te avisaremos cuando el auto esté listo para embarcar.";
    case "embarque":
      return "El auto está listo para embarcar: en tu cuenta verás el Pago 2 (flete, seguro y primera mitad de honorarios). Te avisaremos la fecha de zarpe.";
    case "transito":
      return "El auto va en la nave rumbo al Callao. Antes del arribo te enviamos el aviso del Pago 3 (gastos de aduana).";
    case "aduana":
      return "El auto llegó y está en despacho aduanero. Cuando SUNAT liquide la DAM te enviamos el aviso del Pago 4 para que pagues los tributos directamente a SUNAT.";
    case "placas":
      return "El auto quedó liberado: toca el Pago 5 y tramitamos la ficha técnica, la inscripción en SUNARP y las placas.";
    case "entrega":
      return "Todo listo: coordinemos la entrega.";
    case "cerrado":
      return "Expediente cerrado. Gracias por confiar en Luxcars.";
    default:
      return null;
  }
}
