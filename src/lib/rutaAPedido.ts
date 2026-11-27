/**
 * Ruta de la importación a pedido, en lenguaje de cliente. La usan la página
 * `/importar/ruta` y la hoja de una página en PDF
 * (`public/documentos/ruta-importacion-a-pedido.pdf`). Si cambia un texto, se
 * cambia aquí y se vuelve a generar el PDF (`node scripts/ruta-pdf/generar.mjs`).
 *
 * No son las nueve etapas internas del expediente: son los cinco momentos que
 * el cliente vive, con sus cinco pagos y sus dos momentos de firma. Cuadra con
 * el calendario del core (`src/core/expedientes/hitos.ts`, 27 nov 2026): una
 * sola cuenta para el cliente (Fondos de Clientes) salvo los tributos, que se
 * pagan directo a SUNAT; el Pago 2 es una sola transferencia (flete, seguro y
 * primera mitad de los honorarios); el Pago 5 es la segunda mitad, ajustada con
 * el saldo de aduana. La tabla de pagos tiene las mismas columnas y los mismos
 * textos que el contrato, los anexos, los avisos y la cuenta del cliente
 * (Pago, Cuándo, Qué cubre, Monto, Dónde pagas; lo comprueba
 * `rutaAPedido.test.ts`), pero el monto se describe sin cifras: es una página
 * pública. Este módulo no importa nada en tiempo de ejecución porque el
 * generador del PDF lo transpila solo.
 */
import type { IconName } from "@/components/ui/Icon";

export type PagoRuta = {
  numero: 1 | 2 | 3 | 4 | 5;
  /** Título corto, para la tarjeta del paso. */
  titulo: string;
  /** Las columnas de la tabla de cinco pagos: los textos de `CUANDO_PAGO`, `QUE_CUBRE_PAGO` y `DONDE_PAGA` del core. */
  cuando: string;
  queCubre: string;
  /** Sin cifras (página pública): de dónde sale el monto. */
  monto: string;
  donde: string;
};

export type PasoRuta = {
  icon: IconName;
  titulo: string;
  texto: string;
  /** Qué hace el cliente en ese momento (acción suya, no nuestra). */
  tuParte: string;
  /** Pagos que se disparan en ese paso (ninguno en la búsqueda). */
  pagos?: PagoRuta[];
};

/** Cabecera de la tabla de pagos, igual que en el contrato y los anexos. */
export const CABECERA_PAGOS_RUTA = ["Pago", "Cuándo", "Qué cubre", "Monto", "Dónde pagas"] as const;

const FONDOS = "Cuenta Fondos de Clientes de LUXCARS";

export const PASOS_RUTA: PasoRuta[] = [
  {
    icon: "search",
    titulo: "Elegimos el auto juntos",
    texto:
      "Nos dices marca, modelo, año y presupuesto. Verificamos que pueda entrar al Perú y buscamos unidades con dealers y brokers verificados. Revisamos el historial y, si es usado, lo inspeccionamos antes de pagar. Te damos la pro forma y el costo puesto en Lima, línea por línea.",
    tuParte: "Aprobar la unidad y el presupuesto desde tu cuenta. Buscar no cuesta.",
  },
  {
    icon: "fileCheck",
    titulo: "Firmas una sola vez",
    texto:
      "Con la unidad elegida firmas, en una sola visita a la notaría, el contrato de mandato con sus anexos, la carta de autorización en inglés y el poder para las placas. Antes de depositar te llamamos para confirmar nuestras cuentas: nunca las cambiaremos por correo o WhatsApp.",
    tuParte: "Firmar en notaría, confirmar las cuentas por teléfono y hacer el Pago 1.",
    pagos: [
      {
        numero: 1,
        titulo: "Precio del auto",
        cuando: "Al firmar el contrato",
        queCubre: "El precio del auto, según la pro forma del vendedor",
        monto: "El de la pro forma; en usados, más la inspección",
        donde: FONDOS,
      },
    ],
  },
  {
    icon: "ship",
    titulo: "Compramos y embarcamos",
    texto:
      "Pagamos al vendedor a tu nombre: la factura y el título salen a tu nombre desde el primer día. Cuando el auto está listo para embarcar, viaja asegurado al Callao y sigues su posición desde tu cuenta.",
    tuParte: "Hacer el Pago 2, en una sola transferencia, cuando el auto está listo para embarcar.",
    pagos: [
      {
        numero: 2,
        titulo: "Flete, seguro y primera mitad de los honorarios",
        cuando: "Cuando el auto está listo para embarcar",
        queCubre: "El flete hasta el Callao, el seguro y la primera mitad de nuestros honorarios",
        monto: "El de tu presupuesto, en una sola transferencia",
        donde: FONDOS,
      },
    ],
  },
  {
    icon: "building",
    titulo: "Llega y pasa aduana",
    texto:
      "Al arribo cubres los gastos de aduana según la pro forma del agente. SUNAT liquida los tributos y te damos el número de liquidación: los pagas tú, en soles, con tu Clave SOL o en el banco. Lo que sobre o falte de los gastos de aduana se ajusta en el último pago.",
    tuParte: "Hacer el Pago 3 al arribo y pagar los tributos a SUNAT en dos días hábiles.",
    pagos: [
      {
        numero: 3,
        titulo: "Gastos de aduana",
        cuando: "Cuando el auto llega al Callao",
        queCubre: "Los gastos de aduana: agente, almacén y grúa del puerto",
        monto: "El exacto llega en un aviso, según el agente",
        donde: FONDOS,
      },
      {
        numero: 4,
        titulo: "Tributos, directo a SUNAT",
        cuando: "Cuando SUNAT calcula los tributos (tienes dos días hábiles)",
        queCubre: "Los tributos de importación, la cifra exacta que fija SUNAT",
        monto: "El exacto llega en un aviso, en soles",
        donde: "Directo a SUNAT, con el número de liquidación",
      },
    ],
  },
  {
    icon: "key",
    titulo: "Lo recibes con placas",
    texto:
      "Homologación, placas y tarjeta a tu nombre, incluidas en los honorarios. Te entregamos el auto con el acta de entrega y rendición de cuentas: cada dólar del expediente, con sus comprobantes. Si queda saldo a tu favor, se devuelve con la rendición.",
    tuParte: "Hacer el Pago 5 y firmar el acta de entrega con el auto delante.",
    pagos: [
      {
        numero: 5,
        titulo: "Segunda mitad de los honorarios",
        cuando: "Cuando aduana entrega el auto (levante)",
        queCubre: "La segunda mitad de nuestros honorarios, menos lo que sobró de los gastos de aduana o más lo que faltó",
        monto: "El exacto llega en un aviso, con el ajuste",
        donde: FONDOS,
      },
    ],
  },
];

/** Todos los pagos, en orden (cinco). */
export const PAGOS_RUTA: PagoRuta[] = PASOS_RUTA.flatMap((p) => p.pagos ?? []);

export const FIRMAS_RUTA: { titulo: string; texto: string }[] = [
  {
    titulo: "En notaría, una sola visita",
    texto: "Contrato de mandato con sus anexos, carta de autorización en inglés para comprar y exportar a tu nombre, y poder para inscribir el auto y tramitar las placas.",
  },
  { titulo: "A la entrega", texto: "Acta de entrega y rendición de cuentas, con el auto delante. Firma simple. Cierra el expediente." },
];

export const DINERO_RUTA: { icon: IconName; titulo: string; texto: string }[] = [
  { icon: "shield", titulo: "Una sola cuenta", texto: "Todo va a Fondos de Clientes, separada de la nuestra. De ahí solo tomamos cada factura de honorarios, al emitirla." },
  { icon: "building", titulo: "Tributos directo a SUNAT", texto: "Los pagas tú con el número de liquidación: la cifra exacta, sin márgenes ni intermediarios." },
  { icon: "eye", titulo: "Estado de cuenta en vivo", texto: "Cada depósito con su constancia y cada pago a terceros con su comprobante, desde tu cuenta." },
  { icon: "percent", titulo: "Honorarios publicados", texto: "Por tramos sobre el costo puesto en Lima, IGV y placas incluidos. Si eres empresa, la detracción la depositamos nosotros." },
];

export const CUENTA_RUTA: string[] = [
  "Barra de avance con la etapa actual y las fechas estimadas",
  "Qué necesitamos de ti, con botón para aprobar o declarar un pago",
  "Tus cinco pagos: cuándo, qué cubren, cuánto, dónde pagar y su estado",
  "Documentos del expediente para descargar",
  "Datos del embarque: nave, zarpe y arribo estimado",
  "WhatsApp directo con tu asesor, con el código del expediente",
];

export const PDF_RUTA = "/documentos/ruta-importacion-a-pedido.pdf";
