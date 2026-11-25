/** Anexo A · Ficha del vehículo y autorización de compra. Transcrito del paquete. */

import type { Campos } from "../../campos";
import { casillas, firmas, h2, p, tabla, type Estructura } from "../estructura";
import { firmasLuxcarsYMandante, type Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  return {
    titulo: "Anexo A · Ficha del vehículo y autorización de compra",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Anexo A del contrato de mandato del ${c.FECHA_FIRMA}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p("Este anexo identifica la unidad, fija el precio tope y la modalidad de embarque, y contiene la autorización de compra. Un cambio de unidad o de precio tope se formaliza con un nuevo Anexo A firmado por ambas partes."),

      h2("1. Vehículo"),
      tabla(["Campo", "Dato"], [
        ["Marca", c.VEH_MARCA],
        ["Modelo", c.VEH_MODELO],
        ["Versión", c.VEH_VERSION],
        ["Año modelo", c.VEH_ANIO],
        ["VIN", c.VEH_VIN],
        ["Color", c.VEH_COLOR],
        ["Kilometraje a la inspección", c.VEH_KM],
        ["Combustible", c.VEH_COMBUSTIBLE],
        ["Cilindrada", c.VEH_CILINDRADA],
        ["Transmisión", c.VEH_TRANSMISION],
        ["Condición", c.VEH_CONDICION],
        ["Categoría", c.VEH_CATEGORIA],
        ["País de ensamblaje según el VIN", c.VEH_PAIS_ENSAMBLAJE],
        ["Documento de propiedad que entrega el vendedor", c.VEH_DOC_PROPIEDAD],
      ], [2, 3]),

      h2("2. Vendedor"),
      tabla(["Campo", "Dato"], [
        ["Nombre o razón social", c.VENDEDOR_NOMBRE],
        ["Dirección", c.VENDEDOR_DIRECCION],
        ["Contacto", c.VENDEDOR_CONTACTO],
        ["Teléfono público verificado", c.VENDEDOR_TELEFONO],
      ], [2, 3]),

      h2("3. Precio autorizado"),
      tabla(["Campo", "Dato"], [
        ["Moneda de compra", c.MONEDA_COMPRA],
        ["Precio pactado", `${c.MONEDA_COMPRA} ${c.PRECIO_COMPRA}`],
        ["Precio tope autorizado", `${c.MONEDA_COMPRA} ${c.PRECIO_TOPE}`],
        ["Equivalente estimado en dólares americanos", `USD ${c.PRECIO_COMPRA_USD}`],
        ["Fecha límite para ejecutar la compra", c.FECHA_LIMITE_COMPRA],
        ["Condición para pagar", "Informe de inspección aprobado por el Mandante y fondos del hito H2 acreditados"],
      ], [2, 3]),

      h2("4. Verificaciones realizadas antes de la compra"),
      casillas([
        `Historial del vehículo (CARFAX Canada u otro) n.º ${c.HISTORIAL_REF}: sin siniestros graves ni título marcado`,
        "Búsqueda de gravámenes en el registro provincial: sin gravámenes",
        "Llamados a revisión (recalls) abiertos: verificados",
        `Inspección física el ${c.FECHA_INSPECCION} por ${c.INSPECTOR}; informe aprobado por el Mandante el ______________`,
        "Documento de propiedad a nombre del vendedor y, si la unidad es nueva, sin registro en ninguna provincia",
        `Requisitos del Perú a la fecha estimada de numeración de la DAM (${c.FECHA_EST_ARRIBO}): año modelo dentro del límite, kilometraje dentro del tope, timón original a la izquierda, combustible permitido`,
        "Tratamiento de los impuestos del país de origen confirmado por escrito con el vendedor (venta para exportación)",
      ]),

      h2("5. Modalidad de embarque y operadores"),
      tabla(["Campo", "Dato"], [
        ["Modalidad", c.MODALIDAD_EMBARQUE],
        ["Equipo", c.TIPO_CONTENEDOR],
        ["Proporción del flete marítimo y de los gastos del contenedor a cargo de este vehículo", c.PROPORCION_FLETE],
        ["Espera máxima por la otra unidad (solo embarque consolidado)", `${c.DIAS_ESPERA_MAX} días calendario`],
        ["Puerto de origen", c.PUERTO_ORIGEN],
        ["Puerto de destino", c.PUERTO_DESTINO],
        ["Forwarder", c.FORWARDER_NOMBRE],
        ["Agente de aduana", `${c.AGENTE_ADUANA}, RUC ${c.AGENTE_ADUANA_RUC}`],
      ], [2, 3]),

      h2("6. Autorización de compra"),
      p(`El Mandante autoriza a LUX CARS IMPORT S.A.C. a adquirir en su nombre y por su cuenta el vehículo descrito en este anexo hasta el precio tope indicado, a emitir al vendedor las instrucciones de compra y exportación y al forwarder las instrucciones de embarque, y a pagar el precio con los fondos del hito H2 una vez acreditados. Esta autorización vence el ${c.FECHA_LIMITE_COMPRA} si la compra no se ha ejecutado.`),
      p(`Con la firma de este anexo se devenga el hito H1 (USD ${c.COMISION_H1}).`),
      p(`${c.CIUDAD_FIRMA}, ______ de ______________ de 20____`),
      firmas(...firmasLuxcarsYMandante(c)),
    ],
  };
}

export const anexoA: Plantilla = {
  tipo: "anexo_a",
  version: "anexo_a@2026-11-25",
  nombre: "Anexo A · Ficha del vehículo",
  idioma: "es",
  tarea: "luxcars.anexo_a_presupuesto",
  seFirma: true,
  construir,
};
