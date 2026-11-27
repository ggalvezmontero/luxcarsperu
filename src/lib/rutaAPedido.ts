/**
 * Ruta de la importación a pedido, en lenguaje de cliente. La usan la página
 * `/importar/ruta` y la hoja de una página en PDF
 * (`public/documentos/ruta-importacion-a-pedido.pdf`). Si cambia un texto, se
 * cambia aquí y se vuelve a generar el PDF (`node scripts/ruta-pdf/generar.mjs`).
 *
 * No son las nueve etapas internas del expediente: son los cinco momentos que
 * el cliente vive, con sus cinco pagos y sus dos momentos de firma. Cuadra con
 * los hitos del core (`src/core/expedientes/hitos.ts`, calendario del 27 nov
 * 2026): Pago 1 = H1 precio del auto al firmar; Pago 2 = H2 flete y seguro +
 * H3 50 % de honorarios al release; Pago 3 = H4 gastos de aduana al arribo;
 * Pago 4 = H5 tributos directo a SUNAT; Pago 5 = H6 50 % de honorarios al
 * levante, ajustado con el saldo de aduana.
 */
import type { IconName } from "@/components/ui/Icon";

export type PagoRuta = { numero: 1 | 2 | 3 | 4 | 5; titulo: string; detalle: string };

export type PasoRuta = {
  icon: IconName;
  titulo: string;
  texto: string;
  /** Qué hace el cliente en ese momento (acción suya, no nuestra). */
  tuParte: string;
  /** Pagos que se disparan en ese paso (ninguno en la búsqueda). */
  pagos?: PagoRuta[];
};

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
        detalle: "Al firmar, según la pro forma del vendedor (en usados, más la inspección). Va a Fondos de Clientes.",
      },
    ],
  },
  {
    icon: "ship",
    titulo: "Compramos y embarcamos",
    texto:
      "Pagamos al vendedor a tu nombre: la factura y el título salen a tu nombre desde el primer día. Cuando el auto está listo para embarcar, viaja asegurado al Callao y sigues su posición desde tu cuenta.",
    tuParte: "Hacer el Pago 2 cuando el auto está listo para embarcar.",
    pagos: [
      {
        numero: 2,
        titulo: "Flete, seguro y 50 % de honorarios",
        detalle: "Flete (traslado al puerto y marítimo) y seguro, a Fondos de Clientes; la primera mitad de los honorarios, a Luxcars con factura.",
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
        detalle: "Agente, almacenaje y grúa del puerto, según la pro forma del agente. Se rinde factura por factura.",
      },
      {
        numero: 4,
        titulo: "Tributos, directo a SUNAT",
        detalle: "La cifra exacta de la liquidación, en soles. No pasa por nuestras cuentas.",
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
        titulo: "50 % restante de los honorarios",
        detalle: "Al levante, ajustado con el saldo de los gastos de aduana.",
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
  { icon: "shield", titulo: "Cuenta separada", texto: "El precio, el flete y los gastos de aduana van a Fondos de Clientes, nunca a la cuenta de operación de Luxcars." },
  { icon: "building", titulo: "Tributos directo a SUNAT", texto: "Los pagas tú con el número de liquidación: la cifra exacta, sin márgenes ni intermediarios." },
  { icon: "eye", titulo: "Estado de cuenta en vivo", texto: "Cada depósito con su constancia y cada pago a terceros con su comprobante, desde tu cuenta." },
  { icon: "percent", titulo: "Honorarios publicados", texto: "Por tramos sobre el costo puesto en Lima, IGV y placas incluidos, en dos mitades." },
];

export const CUENTA_RUTA: string[] = [
  "Barra de avance con la etapa actual y las fechas estimadas",
  "Qué necesitamos de ti, con botón para aprobar o declarar un pago",
  "Tus cinco pagos con su monto, fecha límite y estado",
  "Documentos del expediente para descargar",
  "Datos del embarque: nave, zarpe y arribo estimado",
  "WhatsApp directo con tu asesor, con el código del expediente",
];

export const PDF_RUTA = "/documentos/ruta-importacion-a-pedido.pdf";
