/**
 * Anexo A · Ficha del vehículo y autorización de compra. Transcrito del paquete
 * y adaptado a las decisiones del 27 nov 2026: la unidad ya está elegida al
 * firmar el contrato (el anexo va dentro de él, no se firma aparte); en usados,
 * historial (CarFax) e inspección física con su informe; en nuevos, MSO sin
 * matricular y recalls por VIN, sin inspección; el broker como Vendedor al que
 * se gira el precio y el dealer como emisor de la factura y del MSO.
 */

import type { Campos } from "../../campos";
import { h2, nota, p, tabla, vinetas, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  const usado = c.VEH_CONDICION.toLowerCase().startsWith("usado");
  return {
    titulo: "Anexo A · Ficha del vehículo y autorización de compra",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Anexo A del contrato de mandato del ${c.FECHA_FIRMA}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p("Este anexo identifica la unidad que el Mandante eligió y aprobó desde su cuenta, fija el precio y el precio tope, la modalidad de embarque y la autorización de compra. Forma parte del contrato y se firma con él en el mismo acto. Un cambio de unidad o de precio tope se formaliza con un nuevo Anexo A firmado por ambas partes."),

      h2("1. Vehículo"),
      tabla(["Campo", "Dato"], [
        ["Marca", c.VEH_MARCA],
        ["Modelo", c.VEH_MODELO],
        ["Versión", c.VEH_VERSION],
        ["Año modelo", c.VEH_ANIO],
        ["VIN", c.VEH_VIN],
        ["Color", c.VEH_COLOR],
        [usado ? "Kilometraje a la inspección" : "Kilometraje según la pro forma", c.VEH_KM],
        ["Combustible", c.VEH_COMBUSTIBLE],
        ["Cilindrada", c.VEH_CILINDRADA],
        ["Transmisión", c.VEH_TRANSMISION],
        ["Condición", c.VEH_CONDICION],
        ["Categoría", c.VEH_CATEGORIA],
        ["País de ensamblaje según el VIN", c.VEH_PAIS_ENSAMBLAJE],
        ["Documento de propiedad que entrega el dealer", c.VEH_DOC_PROPIEDAD],
      ], [2, 3]),

      h2("2. Vendedor (broker) y dealer"),
      p("El Vendedor es el intermediario al que LUXCARS gira el precio completo con el Pago 1; el dealer es quien emite la factura o bill of sale y el documento de propiedad a nombre del Mandante."),
      tabla(["Campo", "Dato"], [
        ["Vendedor (broker): nombre o razón social", c.VENDEDOR_NOMBRE],
        ["Dirección del Vendedor", c.VENDEDOR_DIRECCION],
        ["Contacto del Vendedor", c.VENDEDOR_CONTACTO],
        ["Teléfono público verificado del Vendedor", c.VENDEDOR_TELEFONO],
        ["Dealer que emite la factura y el documento de propiedad", c.DEALER_NOMBRE],
        ["Dirección del dealer", c.DEALER_DIRECCION],
        ["Contacto del dealer", c.DEALER_CONTACTO],
      ], [2, 3]),

      h2("3. Precio aprobado"),
      tabla(["Campo", "Dato"], [
        ["Moneda de compra", c.MONEDA_COMPRA],
        ["Precio según la pro forma del Vendedor", `${c.MONEDA_COMPRA} ${c.PRECIO_COMPRA}`],
        ["Precio tope autorizado", `${c.MONEDA_COMPRA} ${c.PRECIO_TOPE}`],
        ["Equivalente en dólares americanos", `USD ${c.PRECIO_COMPRA_USD}`],
        ...(usado ? [["Inspección del vehículo usado (se paga con el Pago 1)", `USD ${c.COSTO_INSPECCION}`]] : []),
        ["Pago 1 de 5", `USD ${c.PAGO1_MONTO}`],
        ["Fecha límite para ejecutar la compra", c.FECHA_LIMITE_COMPRA],
        ["Condición para pagar al Vendedor", "Contrato y LOA firmados y Pago 1 acreditado en Fondos de Clientes"],
      ], [2, 3]),

      h2("4. Verificaciones realizadas antes de la aprobación"),
      p("LUXCARS realizó estas verificaciones antes de que el Mandante aprobara la unidad:"),
      vinetas(
        usado
          ? [
              `Historial del vehículo (CarFax u otro) n.º ${c.HISTORIAL_REF}: sin siniestros graves ni título marcado`,
              "Búsqueda de gravámenes: sin gravámenes",
              "Llamados a revisión (recalls) abiertos: verificados por VIN",
              `Inspección física el ${c.FECHA_INSPECCION} por ${c.INSPECTOR}; informe aprobado por el Mandante desde su cuenta con la unidad y el precio`,
              "Documento de propiedad a nombre del dealer, listo para transferirse al Mandante",
              `Requisitos del Perú a la fecha estimada de numeración de la DAM (${c.FECHA_EST_ARRIBO}): año modelo dentro del límite, kilometraje dentro del tope, timón original a la izquierda, combustible permitido`,
              "Tratamiento de los impuestos del país de origen confirmado por escrito con el Vendedor (venta para exportación)",
            ]
          : [
              `Unidad nueva con MSO (Manufacturer Statement of Origin) sin matricular en ningún estado: ${c.HISTORIAL_REF}`,
              "Llamados a revisión (recalls) abiertos: consulta por VIN sin costo, sin pendientes",
              "Instrucción al dealer de no registrar ni matricular la unidad antes de la exportación",
              `Requisitos del Perú a la fecha estimada de numeración de la DAM (${c.FECHA_EST_ARRIBO}): timón original a la izquierda, combustible permitido`,
              "Tratamiento de los impuestos del país de origen confirmado por escrito con el Vendedor (venta para exportación)",
            ],
      ),
      p("El Mandante aprobó la unidad y el precio desde su cuenta en el portal de LUXCARS, con fecha, hora y usuario (cláusula décima del contrato)."),

      h2("5. Modalidad de embarque y operadores"),
      tabla(["Campo", "Dato"], [
        ["Modalidad", c.MODALIDAD_EMBARQUE],
        ["Equipo", c.TIPO_CONTENEDOR],
        ["Proporción del flete (traslado al puerto y marítimo) y de los gastos del contenedor a cargo de este vehículo", c.PROPORCION_FLETE],
        ["Espera máxima por la otra unidad (solo embarque consolidado)", `${c.DIAS_ESPERA_MAX} días calendario`],
        ["Puerto de origen", c.PUERTO_ORIGEN],
        ["Puerto de destino", c.PUERTO_DESTINO],
        ["Release estimado", c.FECHA_RELEASE],
        ["Forwarder", c.FORWARDER_NOMBRE],
        ["Agente de aduana", `${c.AGENTE_ADUANA}, RUC ${c.AGENTE_ADUANA_RUC}`],
      ], [2, 3]),

      h2("6. Autorización de compra"),
      p(`El Mandante autoriza a LUX CARS IMPORT S.A.C. a adquirir en su nombre y por su cuenta el vehículo descrito en este anexo hasta el precio tope indicado, a emitir al Vendedor y al dealer las instrucciones de compra y exportación y al forwarder las instrucciones de embarque, y a girar el precio al Vendedor con el Pago 1 una vez acreditado. Esta autorización vence el ${c.FECHA_LIMITE_COMPRA} si la compra no se ha ejecutado.`),
      nota("Este anexo se firma junto con el contrato: las firmas constan al final del contrato y en cada página foliada."),
    ],
  };
}

export const anexoA: Plantilla = {
  tipo: "anexo_a",
  version: "anexo_a@2026-11-28",
  nombre: "Anexo A · Ficha del vehículo",
  idioma: "es",
  tarea: "luxcars.generar_contrato",
  seFirma: false,
  construir,
};
