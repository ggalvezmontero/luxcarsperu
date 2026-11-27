/**
 * Fixture con TODOS los tipos de bloque, para las pruebas de los renderizadores
 * y para generar los ejemplos de formato. No es una plantilla: el texto es de
 * muestra y no sale de ninguna pantalla.
 */
import {
  casillas,
  centrado,
  firmas,
  h1,
  h2,
  h3,
  lista,
  nota,
  numerada,
  p,
  salto,
  tabla,
  vinetas,
  type Estructura,
} from "@/core/expedientes/documentos/estructura";

export function fixtureCompleto(cambios: Partial<Estructura> = {}): Estructura {
  return {
    titulo: "Contrato de mandato para la importación de un vehículo",
    subtitulo: "**Expediente LC-2026-099** · Mandante: Prueba & Cía S.A.C.",
    lugarFecha: "Lima, 28 de noviembre de 2026",
    tituloCorto: "Contrato de mandato",
    idioma: "es",
    codigoExpediente: "LC-2026-099",
    bloques: [
      p("Conste por el presente documento el **contrato de mandato** que celebran *Lux Cars Import S.A.C.* y el Mandante, en los términos siguientes."),
      h1("Título preliminar"),
      h2("Primera: Antecedentes"),
      p("1.1 LUXCARS se dedica a la intermediación y a la gestión de importaciones de vehículos por encargo de terceros, con un texto lo bastante largo para que se vea la sangría francesa en la segunda línea del numeral."),
      p("1.2 El Mandante desea adquirir el vehículo descrito en el Anexo A."),
      h2("Segunda: Objeto"),
      p("2.1 El Mandante otorga a LUXCARS un mandato con representación para realizar los siguientes actos:"),
      lista(["a) Buscar y verificar el vehículo.", "b) Pagar al vendedor con los fondos del Mandante.", "c) Contratar el transporte internacional."]),
      numerada(["Primer paso numerado.", "Segundo paso numerado con un texto algo más largo para ver cómo se parte la línea con la sangría."]),
      vinetas(["Viñeta uno.", "Viñeta dos."]),
      casillas(["Casilla por marcar.", "Otra casilla."]),
      h3("Subtítulo de nivel tres"),
      tabla(
        ["Hito", "Cuándo", "Qué cubre", "USD"],
        [
          ["H1", "Firma del Anexo A", "30 % de los honorarios (fijo)", "1,500.00"],
          ["H2", "Inspección aprobada", "Precio, transporte interno, flete y seguro", "**62,400.00**"],
          ["H3", "Antes del arribo", "Tributos y gastos de aduana", "18,250.00"],
        ],
        [0.8, 2, 3, 1.4],
      ),
      nota("*Nota de uso, no imprimir: la firma del cliente se legaliza ante notario.*"),
      salto(),
      h2("Tercera: Después del salto de página"),
      p("3.1 Este párrafo está en la segunda página."),
      centrado("Texto centrado de cierre."),
      p("Firmado en dos ejemplares de igual valor, en Lima, el 28 de noviembre de 2026."),
      firmas(
        ["LUX CARS IMPORT S.A.C.", "Representante Legal", "Gerente general, DNI 00000000", "Firma legalizada ante notario"],
        ["Prueba & Cía S.A.C.", "Ana Pérez", "Gerente general, DNI 12345678", "Firma legalizada ante notario"],
        ["Testigo", "Nombre del testigo", "DNI 11111111"],
      ),
    ],
    ...cambios,
  };
}

/** Anexo de presupuesto: tablas largas con filas de subtotal en negrita. */
export function fixtureAnexoB(): Estructura {
  const filas: string[][] = [
    ["1", "Precio del vehículo", "USD 60,000.00 al tipo de cambio del día de la cotización", "60,000.00"],
    ["2", "Transporte interno en origen", "Del vendedor al almacén del forwarder", "450.00"],
    ["3", "Flete marítimo y gastos del contenedor", "Contenedor de 40 pies compartido, Miami a Callao", "3,228.00"],
    ["4", "Seguro de transporte", "0.5 % sobre el 110 % del precio del vehículo", "330.00"],
    ["", "**Valor CIF estimado**", "Líneas 1 a 4", "**64,008.00**"],
    ["5", "Ad valorem", "6 % del CIF", "3,840.48"],
    ["6", "Impuesto selectivo al consumo", "10 % sobre CIF más ad valorem", "6,784.85"],
    ["7", "IGV e IPM", "18 % sobre CIF más ad valorem más ISC", "13,433.00"],
    ["", "**Total estimado puesto en Lima**", "Líneas 1 a 7", "**88,066.33**"],
  ];
  return {
    titulo: "Anexo B · Presupuesto estimado y calendario de pagos",
    subtitulo: "Expediente LC-2026-099 · Anexo B del contrato de mandato",
    tituloCorto: "Anexo B",
    idioma: "es",
    codigoExpediente: "LC-2026-099",
    bloques: [
      p("Estimación en dólares americanos con las tasas vigentes a la fecha. Las cifras definitivas resultan de la factura del vendedor, del flete real y de la liquidación de SUNAT."),
      h2("1. Costo estimado puesto en Lima"),
      tabla(["#", "Concepto", "Base de cálculo", "USD estimado"], filas, [0.6, 3, 4, 1.8]),
      h2("2. Calendario de pagos"),
      tabla(
        ["Hito", "Cuándo", "Qué cubre", "USD", "Cuenta de destino"],
        [
          ["H1", "Firma del Anexo A", "30 % de los honorarios (fijo)", "2,692.45", "Operaciones"],
          ["H2", "Inspección aprobada", "Líneas 1 a 4 (estimado)", "64,008.00", "Fondos de Clientes"],
          ["H3", "Antes del arribo", "Líneas 5 a 7 más margen del 3 %", "24,778.97", "Fondos de Clientes"],
          ["H4", "Entrega con placas", "70 % de los honorarios (fijo)", "6,282.37", "Operaciones"],
        ],
        [0.8, 3, 3, 1.6, 2.6],
      ),
      p("Lima, 28 de noviembre de 2026"),
      firmas(["LUX CARS IMPORT S.A.C.", "Representante Legal", "DNI 00000000"], ["Prueba & Cía S.A.C.", "Ana Pérez", "DNI 12345678"]),
    ],
  };
}

/** Carta de autorización en inglés: rótulos de cabecera y pie en inglés. */
export function fixtureLoa(): Estructura {
  return {
    titulo: "Letter of authorization",
    subtitulo: "*File LC-2026-099 · Purchase and export of one vehicle*",
    lugarFecha: "Lima, Peru, November 28, 2026",
    idioma: "en",
    codigoExpediente: "LC-2026-099",
    bloques: [
      p("To whom it may concern:"),
      p("1.1 **Prueba & Cía S.A.C.**, a company organized under the laws of the Republic of Peru (the *Principal*), hereby authorizes LUX CARS IMPORT S.A.C. (the *Agent*) to act on its behalf in the purchase of the vehicle described below."),
      tabla(null, [["Make and model", "Ford Bronco 2026"], ["VIN", "1FMEE5DP0PLA00000"], ["Valid until", "February 28, 2027"]], [1, 2]),
      p("1.2 The Agent may sign the bill of sale, pay the seller with the Principal's funds, and instruct the forwarder."),
      p("This authorization is governed by the laws of the Republic of Peru."),
      firmas(
        ["For the Principal", "Prueba & Cía S.A.C.", "Ana Pérez, General Manager", "DNI No. 12345678"],
        ["Accepted by the Agent", "LUX CARS IMPORT S.A.C.", "Legal Representative", "DNI No. 00000000"],
      ),
    ],
  };
}

/** Constancia de recepción de fondos: documento de una página. */
export function fixtureConstancia(): Estructura {
  return {
    titulo: "Constancia de recepción de fondos",
    subtitulo: "Expediente LC-2026-099 · Hito H2",
    lugarFecha: "Lima, 5 de diciembre de 2026",
    idioma: "es",
    codigoExpediente: "LC-2026-099",
    bloques: [
      p("LUX CARS IMPORT S.A.C. deja constancia de haber recibido del Mandante el depósito siguiente, acreditado en la cuenta Fondos de Clientes:"),
      tabla(["Concepto", "Detalle"], [["Fecha de acreditación", "5 de diciembre de 2026"], ["Monto", "**USD 64,008.00**"], ["Operación", "000123456"], ["Saldo del expediente", "USD 66,700.45"]], [1, 2]),
      p("Los fondos pertenecen al Mandante y se aplican solo a los conceptos del contrato y de sus anexos."),
      firmas(["LUX CARS IMPORT S.A.C.", "Representante Legal, DNI 00000000", "Lima, 5 de diciembre de 2026"]),
    ],
  };
}

/** Acta de entrega: casillas, tabla y firmas. */
export function fixtureActa(): Estructura {
  return {
    titulo: "Acta de entrega del vehículo",
    subtitulo: "Expediente LC-2026-099",
    lugarFecha: "Lima, 5 de marzo de 2027",
    idioma: "es",
    codigoExpediente: "LC-2026-099",
    bloques: [
      p("En la fecha, LUX CARS IMPORT S.A.C. entrega al Mandante el vehículo siguiente, que lo recibe a su conformidad:"),
      tabla(null, [["Vehículo", "Ford Bronco 2026"], ["VIN", "1FMEE5DP0PLA00000"], ["Placa", "ABC-123"], ["Kilometraje", "48 km"]], [1, 2]),
      h2("Se entregan"),
      casillas(["Tarjeta de identificación vehicular", "Placas", "Dos llaves", "Manual del propietario", "SOAT vigente"]),
      nota("*Las observaciones se anotan antes de firmar.*"),
      firmas(["Entrega: LUX CARS IMPORT S.A.C.", "Representante Legal", "DNI 00000000"], ["Recibe: Prueba & Cía S.A.C.", "Ana Pérez", "DNI 12345678"]),
    ],
  };
}
