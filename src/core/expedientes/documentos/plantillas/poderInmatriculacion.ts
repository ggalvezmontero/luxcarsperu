/**
 * 9 · Poder especial para la inmatriculación del vehículo. Nuevo el 27 nov
 * 2026: el cliente lo firma en la misma visita a la notaría que el contrato y
 * la LOA, para que Luxcars tramite la primera inscripción en SUNARP, recoja
 * las placas y la tarjeta de identificación vehicular sin otra visita del
 * cliente. Texto corto y formal. Lleva una nota interna [CONFIRMAR con el
 * notario que SUNARP lo acepta] que no se imprime para el cliente.
 */

import type { Campos } from "../../campos";
import { firmas, h2, lista, nota, p, tabla, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  return {
    titulo: "Poder especial para la inmatriculación de vehículo",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Otorgado el ${c.FECHA_FIRMA}, junto con el contrato de mandato de la misma fecha**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`**${c.CLIENTE_RAZON_SOCIAL}**, con RUC ${c.CLIENTE_RUC}, domicilio en ${c.CLIENTE_DOMICILIO}, inscrita en la partida ${c.CLIENTE_PARTIDA} del Registro de Personas Jurídicas de Lima, representada por su ${c.CLIENTE_REP_CARGO} ${c.CLIENTE_REPRESENTANTE}, identificado con DNI ${c.CLIENTE_REP_DNI}, con poderes inscritos en la misma partida (el "Poderdante"), otorga poder especial a favor de **LUX CARS IMPORT S.A.C.**, con RUC ${c.LUXCARS_RUC}, domicilio en ${c.LUXCARS_DOMICILIO}, inscrita en la partida ${c.LUXCARS_PARTIDA} del Registro de Personas Jurídicas de Lima, representada por su gerente general ${c.LUXCARS_REPRESENTANTE}, identificado con DNI ${c.LUXCARS_REP_DNI} (el "Apoderado"), en los términos siguientes.`),

      h2("1. Vehículo"),
      tabla(["Campo", "Dato"], [
        ["Marca, modelo y versión", `${c.VEH_MARCA} ${c.VEH_MODELO} ${c.VEH_VERSION}`],
        ["Año modelo", c.VEH_ANIO],
        ["VIN", c.VEH_VIN],
        ["Color", c.VEH_COLOR],
        ["Condición", c.VEH_CONDICION],
        ["Categoría", c.VEH_CATEGORIA],
      ], [2, 3]),

      h2("2. Facultades"),
      p("El Apoderado queda facultado para realizar en nombre y representación del Poderdante, ante la Superintendencia Nacional de los Registros Públicos (SUNARP), el Ministerio de Transportes y Comunicaciones, la Asociación Automotriz del Perú y cualquier entidad pública o privada que intervenga, los siguientes actos respecto del vehículo descrito:"),
      lista([
        "a) Solicitar y tramitar la primera inscripción (inmatriculación) del vehículo en el Registro de Propiedad Vehicular a nombre del Poderdante, presentar y suscribir el formato de inmatriculación, las solicitudes de inscripción y los formularios registrales, y subsanar observaciones.",
        "b) Presentar la declaración aduanera de mercancías con levante, la factura o bill of sale, el documento de propiedad del exterior, la constancia de homologación o ficha técnica y los demás documentos que exija el registro.",
        "c) Pagar las tasas registrales y los derechos que correspondan, por cuenta del Poderdante, y recabar los comprobantes a su nombre.",
        "d) Solicitar y recoger las placas de rodaje y la tarjeta de identificación vehicular, y suscribir los cargos de entrega.",
        "e) Realizar los demás actos conexos que la inmatriculación requiera, dentro de los límites de este poder.",
      ]),

      h2("3. Límites"),
      lista([
        "a) Este poder no faculta al Apoderado a transferir, gravar, arrendar ni disponer del vehículo, ni a inscribirlo a nombre propio o de un tercero.",
        "b) Se limita al vehículo descrito en la sección 1 y a los actos de la sección 2.",
        "c) Rige desde su otorgamiento hasta la entrega de las placas y la tarjeta de identificación vehicular al Poderdante, o hasta su revocación por escrito.",
      ]),

      p(`${c.CIUDAD_FIRMA}, ${c.FECHA_FIRMA}`),
      firmas(
        [c.CLIENTE_RAZON_SOCIAL, c.CLIENTE_REPRESENTANTE, `${c.CLIENTE_REP_CARGO}, DNI ${c.CLIENTE_REP_DNI}`, "Firma legalizada ante notario"],
        ["Acepta el Apoderado: LUX CARS IMPORT S.A.C.", c.LUXCARS_REPRESENTANTE, `Gerente general, DNI ${c.LUXCARS_REP_DNI}`],
      ),
      nota("*Nota interna, no imprimir para el cliente: [CONFIRMAR con el notario que SUNARP acepta este poder especial con firma legalizada para la inmatriculación; si exige poder por escritura pública o firma directa del propietario en el formato, ajustar antes del primer uso.]*"),
    ],
  };
}

export const poderInmatriculacion: Plantilla = {
  tipo: "poder_inmatriculacion",
  version: "poder_inmatriculacion@2026-11-27",
  nombre: "Poder para la inmatriculación",
  idioma: "es",
  tarea: "luxcars.generar_contrato",
  seFirma: true,
  construir,
};
