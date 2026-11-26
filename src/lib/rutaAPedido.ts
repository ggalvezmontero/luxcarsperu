/**
 * Ruta de la importación a pedido, en lenguaje de cliente. La usan la página
 * `/importar/ruta` y la hoja de una página en PDF
 * (`public/documentos/ruta-importacion-a-pedido.pdf`). Si cambia un texto, se
 * cambia aquí y se vuelve a generar el PDF.
 *
 * No son las nueve etapas internas del expediente: son los cinco momentos que
 * el cliente vive, con sus cuatro pagos y las tres cosas que firma. Cuadra con
 * los hitos del core (`src/core/expedientes/hitos.ts`): H1 30 % de honorarios
 * al firmar, H2 vehículo y logística, H3 tributos y gastos, H4 70 % a la
 * entrega.
 */
import type { IconName } from "@/components/ui/Icon";

export type PasoRuta = {
  icon: IconName;
  titulo: string;
  texto: string;
  /** Qué hace el cliente en ese momento (acción suya, no nuestra). */
  tuParte: string;
  /** Pago que se dispara en ese paso, si hay. */
  pago?: { numero: 1 | 2 | 3 | 4; titulo: string; detalle: string };
};

export const PASOS_RUTA: PasoRuta[] = [
  {
    icon: "search",
    titulo: "Acordamos el auto y el presupuesto",
    texto:
      "Nos dices marca, modelo, año y presupuesto. Verificamos que el auto pueda entrar al Perú, buscamos opciones en dealers y portales verificados y te damos el costo puesto en Lima, línea por línea: precio, flete, seguro, tributos y honorarios.",
    tuParte: "Elegir el auto y aprobar el presupuesto. Sin costo ni compromiso.",
  },
  {
    icon: "fileCheck",
    titulo: "Firmas y abres tu expediente",
    texto:
      "Firmas en notaría el contrato de mandato con sus anexos y una carta de autorización en inglés para que compremos a tu nombre. Antes de cualquier depósito te llamamos para que confirmes nuestras cuentas: nunca cambiaremos una cuenta por correo o WhatsApp.",
    tuParte: "Firmar en notaría y confirmar las cuentas por teléfono.",
    pago: {
      numero: 1,
      titulo: "30 % de los honorarios",
      detalle: "Al firmar. Abre tu expediente y la búsqueda formal.",
    },
  },
  {
    icon: "scan",
    titulo: "Compramos e inspeccionamos",
    texto:
      "Revisamos el historial de la unidad e inspeccionamos antes de pagar. El informe y el precio final llegan a tu cuenta para que los apruebes. Con tu aprobación pagamos al vendedor a tu nombre: la factura y el título de propiedad salen a tu nombre desde el primer día.",
    tuParte: "Aprobar el informe de inspección y el precio desde tu cuenta.",
    pago: {
      numero: 2,
      titulo: "El auto y la logística",
      detalle: "Precio del vehículo, transporte interno, flete y seguro. Va a la cuenta de Fondos de Clientes, separada de la nuestra.",
    },
  },
  {
    icon: "ship",
    titulo: "Viaja y pasa aduana",
    texto:
      "El auto se embarca asegurado hasta el Callao y sigues su posición desde tu cuenta. Antes del arribo te damos el cálculo de tributos y gastos; los pagamos a SUNAT por ti con esos fondos. La liquidación definitiva va al tipo de cambio oficial del día y cualquier diferencia se ajusta al final.",
    tuParte: "Depositar los tributos antes del arribo. Nada que tramitar en persona.",
    pago: {
      numero: 3,
      titulo: "Tributos y gastos de aduana",
      detalle: "Una semana antes del arribo, con margen por el tipo de cambio. Lo que sobre se devuelve.",
    },
  },
  {
    icon: "key",
    titulo: "Lo recibes con placas",
    texto:
      "Homologación, placas y tarjeta de propiedad a tu nombre. Te entregamos el auto con un acta y una rendición de cuentas de cada dólar que pasó por el expediente, con sus comprobantes. Si queda saldo a tu favor, se devuelve ese mismo día.",
    tuParte: "Firmar el acta de entrega y dar conformidad a la rendición.",
    pago: {
      numero: 4,
      titulo: "70 % de los honorarios",
      detalle: "A la entrega, con el auto en tu cochera.",
    },
  },
];

export const FIRMAS_RUTA: { titulo: string; texto: string }[] = [
  { titulo: "Contrato de mandato con anexos", texto: "En notaría, con firma certificada. Dice qué auto, cuánto cuesta y de dónde sale el dinero." },
  { titulo: "Carta de autorización en inglés", texto: "En la misma visita. Permite comprar, exportar y embarcar a tu nombre." },
  { titulo: "Acta de entrega y rendición", texto: "Al final, con el auto delante. Cierra el expediente." },
];

export const DINERO_RUTA: { icon: IconName; titulo: string; texto: string }[] = [
  { icon: "shield", titulo: "Cuenta separada", texto: "Tu dinero para el auto y los tributos va a Fondos de Clientes, nunca a la cuenta de operación de Luxcars." },
  { icon: "fileCheck", titulo: "Constancia por cada depósito", texto: "Cada transferencia confirmada genera una constancia con el código de tu expediente." },
  { icon: "eye", titulo: "Estado de cuenta en vivo", texto: "Depósitos, pagos a terceros con su comprobante y saldo, desde tu cuenta en luxcars.pe." },
  { icon: "percent", titulo: "Honorarios publicados", texto: "Por tramos sobre el costo puesto en Lima, con IGV incluido. Los mismos que muestra la calculadora." },
];

export const CUENTA_RUTA: string[] = [
  "Barra de avance con la etapa actual y las fechas estimadas",
  "Qué necesitamos de ti, con botón para aprobar o confirmar",
  "Documentos del expediente para descargar",
  "Estado de cuenta con cada depósito y su constancia",
  "Datos del embarque: nave, zarpe y arribo estimado",
  "WhatsApp directo con tu asesor, con el código del expediente",
];

export const PDF_RUTA = "/documentos/ruta-importacion-a-pedido.pdf";
