/** 7 · Acta de entrega del vehículo. Transcrita del paquete. Placa, TIVe, km y fecha vienen del expediente; el H4 del libro. */

import type { Campos } from "../../campos";
import { casillas, firmas, h2, p, tabla, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  const h4Acreditado = Boolean(c.H4_ACREDITADO_FECHA && !/^_+$/.test(c.H4_ACREDITADO_FECHA));
  return {
    titulo: "Acta de entrega del vehículo",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Contrato de mandato del ${c.FECHA_FIRMA}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`En ${c.CIUDAD_FIRMA}, el ${c.FECHA_ENTREGA}, a las ______ horas, en ______________, LUX CARS IMPORT S.A.C., representada por ${c.LUXCARS_REPRESENTANTE} (DNI ${c.LUXCARS_REP_DNI}), entrega a **${c.CLIENTE_RAZON_SOCIAL}**, representada por ${c.CLIENTE_REPRESENTANTE} (DNI ${c.CLIENTE_REP_DNI}) o por la persona autorizada que se identifica al final, el vehículo y los documentos que siguen.`),

      h2("1. Vehículo entregado"),
      tabla(["Campo", "Dato"], [
        ["Marca, modelo y versión", `${c.VEH_MARCA} ${c.VEH_MODELO} ${c.VEH_VERSION}`],
        ["Año modelo", c.VEH_ANIO],
        ["VIN", c.VEH_VIN],
        ["Color", c.VEH_COLOR],
        ["Placa", c.PLACA],
        ["Tarjeta de identificación vehicular (TIVe) n.º", c.TIVE_NUMERO],
        ["Kilometraje a la entrega", c.KM_ENTREGA],
        ["Nivel de combustible o carga", "______________"],
      ], [2, 3]),

      h2("2. Estado del vehículo"),
      p("Revisado en presencia de ambas partes. Lo no marcado se considera conforme."),
      casillas([
        "Carrocería y pintura sin daños, salvo las observaciones anotadas",
        "Vidrios, espejos y luces completos y sin fisuras",
        "Llantas y aro de repuesto (o kit de inflado) en buen estado",
        "Interior: asientos, tapicería, tablero, pantalla y controles sin daños",
        "Aire acondicionado, luces, limpiaparabrisas y bocina funcionan",
        "Encendido normal, sin testigos de falla en el tablero",
        "Accesorios: gata, llave de ruedas, kit de herramientas, triángulos, extintor, alfombras",
        "Cargador y cables (solo híbridos enchufables y eléctricos)",
        "Dos llaves, ambas programadas",
      ]),
      p("Observaciones: ______________________________________________"),
      p("Fotos tomadas en el acto y enviadas a ambas partes: ______ (cantidad)."),

      h2("3. Documentos entregados"),
      casillas([
        "Factura o bill of sale del vendedor a nombre del Mandante y comprobante del pago",
        `Documento de propiedad del exterior (${c.VEH_DOC_PROPIEDAD}) con la transferencia`,
        "Certificado de origen (si se usó)",
        "Informe de inspección previa a la compra",
        "Documento de transporte, lista de empaque y acta de carga con fotos",
        "Póliza de seguro de transporte",
        `DAM n.º ${c.DAM_NUMERO} con levante, liquidación y comprobantes de pago de tributos`,
        "Facturas del agente de aduana, depósito temporal, forwarder, notaría y placas, a nombre del Mandante",
        "Constancia de homologación o ficha técnica",
        "Tarjeta de identificación vehicular y placas colocadas",
        "Facturas de honorarios n.º ______ y ______ con constancias de detracción",
        "Rendición de cuentas y comprobante de devolución del saldo",
        "Manuales del vehículo",
      ]),

      h2("4. Pendientes, si los hay"),
      tabla(["Pendiente", "Responsable", "Fecha compromiso"], [["", "", ""], ["", "", ""]], [3, 2, 2]),

      h2("5. Conformidad"),
      p(`El Mandante declara recibir el vehículo y los documentos a su satisfacción, en el estado descrito, sin perjuicio de las garantías que otorguen el fabricante o el vendedor. Desde este momento la custodia, el riesgo, el SOAT y el seguro vehicular son de su cargo. Hito H4: ${h4Acreditado ? "[X]" : "[ ]"} acreditado el ${h4Acreditado ? c.H4_ACREDITADO_FECHA : "______________"}   ${h4Acreditado ? "[ ]" : "[X]"} pendiente, el vehículo queda en custodia conforme a la cláusula décima tercera del contrato.`),

      firmas(
        ["LUX CARS IMPORT S.A.C.", c.LUXCARS_REPRESENTANTE, `DNI ${c.LUXCARS_REP_DNI}`],
        [c.CLIENTE_RAZON_SOCIAL, `${c.CLIENTE_REPRESENTANTE} o persona autorizada`, "Nombre: ______________ DNI: ______________", "Carta de autorización adjunta: [ ] Sí  [ ] No aplica"],
      ),
    ],
  };
}

export const actaEntrega: Plantilla = {
  tipo: "acta_entrega",
  version: "acta_entrega@2026-11-25",
  nombre: "Acta de entrega del vehículo",
  idioma: "es",
  tarea: "luxcars.acta_entrega",
  seFirma: true,
  construir,
};
