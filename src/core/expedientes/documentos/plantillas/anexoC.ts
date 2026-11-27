/** Anexo C · Declaración jurada de origen de fondos y datos del cliente (KYC). Transcrito del paquete. */

import type { Campos } from "../../campos";
import { casillas, firmas, h2, lista, nota, p, tabla, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  return {
    titulo: "Anexo C · Declaración jurada de origen de fondos y datos del cliente",
    subtitulo: `**Expediente ${c.EXPEDIENTE} · Anexo C del contrato de mandato del ${c.FECHA_FIRMA}**`,
    idioma: "es",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p("LUX CARS IMPORT S.A.C. es sujeto obligado a informar ante la Unidad de Inteligencia Financiera del Perú. Esta declaración es requisito para recibir fondos del Mandante y se conserva con el expediente durante el plazo que exige la ley."),

      h2("1. Datos del Mandante"),
      tabla(["Campo", "Dato"], [
        ["Razón social", c.CLIENTE_RAZON_SOCIAL],
        ["RUC", c.CLIENTE_RUC],
        ["Domicilio fiscal", c.CLIENTE_DOMICILIO],
        ["Partida registral", c.CLIENTE_PARTIDA],
        ["Actividad económica principal", c.CLIENTE_ACTIVIDAD],
        ["Correo y teléfono", `${c.CLIENTE_CORREO} · ${c.CLIENTE_TELEFONO}`],
      ], [2, 3]),

      h2("2. Representante legal que firma"),
      tabla(["Campo", "Dato"], [
        ["Nombre completo", c.CLIENTE_REPRESENTANTE],
        ["DNI", c.CLIENTE_REP_DNI],
        ["Cargo", c.CLIENTE_REP_CARGO],
        ["¿Es o ha sido en los últimos cinco años persona expuesta políticamente (PEP), o pariente o asociado cercano de una?", "[ ] No [ ] Sí: ______________"],
      ], [2, 3]),

      h2("3. Beneficiarios finales"),
      p("Personas naturales que poseen, directa o indirectamente, el 10 % o más del capital, o que ejercen el control de la empresa."),
      tabla(["Nombre completo", "DNI o pasaporte", "Participación", "¿PEP?"], [
        [c.CLIENTE_BENEFICIARIO_FINAL, "", "", "[ ] No [ ] Sí"],
        ["", "", "", "[ ] No [ ] Sí"],
        ["", "", "", "[ ] No [ ] Sí"],
      ], [3, 2, 1.5, 1.5]),

      h2("4. Origen de los fondos"),
      tabla(["Campo", "Dato"], [
        ["Monto estimado de la operación", `USD ${c.EST_TOTAL}`],
        ["Origen de los fondos", c.CLIENTE_ORIGEN_FONDOS],
        ["Banco y cuenta desde la que se pagará (a nombre del Mandante)", c.CLIENTE_BANCO_ORIGEN],
      ], [2, 3]),
      p("Marcar lo que corresponda:"),
      casillas([
        "Ingresos ordinarios o utilidades acumuladas de la empresa",
        "Préstamo bancario o arrendamiento financiero (entidad: ______________)",
        "Aporte de capital de los socios",
        "Venta de un activo (detalle: ______________)",
        "Otro: ______________",
      ]),

      h2("5. Declaración jurada"),
      p("El Mandante, a través de su representante legal, declara bajo juramento que:"),
      lista([
        "a) La información consignada en este anexo es veraz, completa y actual.",
        "b) Los fondos destinados a esta operación tienen origen lícito, provienen de las fuentes declaradas y no están relacionados con el lavado de activos, el financiamiento del terrorismo ni ninguna actividad ilícita.",
        "c) Ni la empresa, ni sus representantes, ni sus beneficiarios finales figuran en listas de sanciones nacionales o internacionales, ni tienen procesos en curso por los delitos indicados.",
        "d) Comunicará a LUXCARS cualquier cambio en la información declarada mientras dure el mandato y entregará la documentación adicional que LUXCARS le solicite en cumplimiento de la normativa de prevención del lavado de activos.",
        "e) Conoce que LUXCARS registra las operaciones iguales o mayores a USD 10,000 y, cuando la ley lo exige, las reporta a la UIF-Perú, y que puede resolver el contrato si esta declaración resulta falsa o si el Mandante no entrega la información requerida.",
        "f) Consiente el tratamiento de los datos personales contenidos en este anexo conforme a la Ley 29733, para la ejecución del contrato y el cumplimiento de obligaciones legales.",
      ]),
      p(`${c.CIUDAD_FIRMA}, ${c.FECHA_FIRMA}`),
      firmas(["Por el Mandante", c.CLIENTE_REPRESENTANTE, `${c.CLIENTE_REP_CARGO}, DNI ${c.CLIENTE_REP_DNI}`, c.CLIENTE_RAZON_SOCIAL]),

      h2("6. Verificación de LUXCARS (uso interno, no se entrega al cliente)"),
      casillas([
        "Ficha RUC consultada el ______________: activo y habido",
        "Vigencia de poder del representante, fecha de emisión ______________",
        "DNI del representante validado contra el documento físico",
        "Listas de sanciones (OFAC, ONU, otras) consultadas el ______________, resultado: ______________, captura archivada",
        "Cuenta de origen de los fondos a nombre del Mandante, verificada en la primera transferencia",
        "Registro de operaciones de la UIF completado el ______________",
      ]),
      nota("Responsable: ______________"),
    ],
  };
}

export const anexoC: Plantilla = {
  tipo: "anexo_c",
  version: "anexo_c@2026-11-27",
  nombre: "Anexo C · Origen de fondos (KYC)",
  idioma: "es",
  tarea: "luxcars.generar_contrato",
  seFirma: false,
  construir,
};
