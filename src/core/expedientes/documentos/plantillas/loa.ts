/** 2 · Letter of Authorization and Limited Power of Attorney (inglés). Transcrito del paquete; broker como Seller y dealer como emisor de factura y MSO (27 nov 2026). */

import type { Campos } from "../../campos";
import { firmas, h2, nota, numerada, p, tabla, vinetas, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  return {
    titulo: "Letter of Authorization and Limited Power of Attorney",
    subtitulo: `**File ${c.EXPEDIENTE} · Date: ${c.FECHA_FIRMA}**`,
    idioma: "en",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`**${c.CLIENTE_RAZON_SOCIAL}**, a company organized and existing under the laws of the Republic of Peru, Peruvian Tax ID (RUC) No. ${c.CLIENTE_RUC}, with registered address at ${c.CLIENTE_DOMICILIO}, Lima, Peru (the "Principal"), acting through its ${c.CLIENTE_REP_CARGO}, ${c.CLIENTE_REPRESENTANTE}, holder of Peruvian National ID (DNI) No. ${c.CLIENTE_REP_DNI}, duly empowered,`),
      p(`hereby authorizes and appoints **LUX CARS IMPORT S.A.C.**, a company organized under the laws of the Republic of Peru, RUC No. ${c.LUXCARS_RUC}, with registered address at ${c.LUXCARS_DOMICILIO}, Lima, Peru, acting through ${c.LUXCARS_REPRESENTANTE}, DNI No. ${c.LUXCARS_REP_DNI} (the "Agent"), to act in the Principal's name and on its behalf as its agent and attorney-in-fact, limited to the acts listed below in connection with the vehicle described in Section 1 (the "Vehicle").`),

      h2("1. Vehicle"),
      tabla(["Field", "Detail"], [
        ["Make", c.VEH_MARCA],
        ["Model and trim", `${c.VEH_MODELO} ${c.VEH_VERSION}`],
        ["Model year", c.VEH_ANIO],
        ["VIN", c.VEH_VIN],
        ["Color", c.VEH_COLOR],
        ["Odometer", c.VEH_KM],
        ["Seller (broker receiving payment)", `${c.VENDEDOR_NOMBRE}, ${c.VENDEDOR_DIRECCION}`],
        ["Dealer issuing the invoice and the ownership document", `${c.DEALER_NOMBRE}, ${c.DEALER_DIRECCION}`],
      ], [2, 3]),

      h2("2. Authorized acts"),
      numerada([
        `Complete the purchase of the Vehicle, already selected and approved by the Principal, with the Seller and the Dealer, and sign on the Principal's behalf the purchase agreement, bill of sale, odometer statement and any related purchase documents, up to a maximum price of ${c.MONEDA_COMPRA} ${c.PRECIO_TOPE}.`,
        "Pay the full purchase price to the Seller (broker) on the Principal's behalf, who in turn pays the Dealer. The funds originate from the Principal and are remitted through the Agent's client funds account. Payment by the Agent does not make the Agent the buyer or the owner of the Vehicle.",
        "Receive from the Dealer or the Seller the original ownership documents (Manufacturer's Statement of Origin, New Vehicle Information Statement, provincial registration or ownership, or certificate of title, as applicable), issued in the Principal's name, the bill of sale, keys and manuals, and hold them for the Principal.",
        "Arrange and sign for the pickup, storage, consolidation, loading, marine insurance and ocean shipment of the Vehicle to Callao, Peru, acting as shipper or exporter of record where the freight forwarder requires it, always naming the Principal as consignee.",
        `Complete and sign the export documentation and declarations required by the authorities of ${c.PAIS_ORIGEN}, and provide the information required by the Seller, the Dealer, the carrier or the forwarder.`,
        "Request and receive confirmations, invoices and receipts, all of which shall be issued in the Principal's name.",
      ]),

      h2("3. Limits"),
      vinetas([
        "The Agent is not authorized to take title to the Vehicle, to register, license or plate it in its own name or in any jurisdiction, to encumber it or to resell it.",
        `The buyer of record on the bill of sale and the owner on any ownership document must be the Principal, written exactly as follows: **${c.CLIENTE_RAZON_SOCIAL}, RUC ${c.CLIENTE_RUC}, ${c.CLIENTE_DOMICILIO}, Lima, Peru.**`,
        "This authorization covers no other vehicle or transaction.",
      ]),

      h2("4. Term"),
      p(`This authorization is valid from the date above until ${c.LOA_VENCIMIENTO} or until the Vehicle is delivered to the ocean carrier for export, whichever comes first, unless revoked earlier in writing.`),

      h2("5. Reliance"),
      p(`The Seller, the Dealer, the freight forwarder, the carrier and any other third party may rely on this authorization and on the Agent's instructions given within its scope. Questions about this authorization may be directed to the Principal at ${c.CLIENTE_CORREO} or ${c.CLIENTE_TELEFONO}.`),
      p(`This authorization is governed by the laws of the Republic of Peru. Signed in ${c.CIUDAD_FIRMA}, Peru, on ${c.FECHA_FIRMA}.`),
      firmas(
        ["For the Principal", c.CLIENTE_RAZON_SOCIAL, `${c.CLIENTE_REPRESENTANTE}, ${c.CLIENTE_REP_CARGO}`, `DNI No. ${c.CLIENTE_REP_DNI}`, "Signature certified by a Peruvian notary public"],
        ["Accepted by the Agent", "LUX CARS IMPORT S.A.C.", `${c.LUXCARS_REPRESENTANTE}, General Manager`, `DNI No. ${c.LUXCARS_REP_DNI}`],
      ),
      nota("*Nota de uso, no imprimir: la firma del cliente se legaliza ante notario en la misma visita en que firma el contrato y el poder para la inmatriculación. La apostilla (Ministerio de Relaciones Exteriores) solo se tramita si el broker, el dealer o el forwarder la exigen; la mayoría acepta la carta notarizada con copia del DNI y de la vigencia de poder.*"),
    ],
  };
}

export const loa: Plantilla = {
  tipo: "loa",
  version: "loa@2026-11-27",
  nombre: "Letter of Authorization (EN)",
  idioma: "en",
  tarea: "luxcars.generar_contrato",
  seFirma: true,
  construir,
};
