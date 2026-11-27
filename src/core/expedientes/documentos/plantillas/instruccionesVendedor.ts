/** 3 · Purchase and Export Instructions to the Seller and the Dealer (inglés). Transcrito del paquete; broker y dealer, inspección solo en usados (27 nov 2026). */

import type { Campos } from "../../campos";
import { firmas, h2, p, tabla, vinetas, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  const usado = c.VEH_CONDICION.toLowerCase().startsWith("usado");
  return {
    titulo: "Purchase and Export Instructions to the Seller",
    subtitulo: `**File ${c.EXPEDIENTE} · Date: ______________**`,
    idioma: "en",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`**To (Seller / broker):** ${c.VENDEDOR_NOMBRE}, ${c.VENDEDOR_DIRECCION}. Attn: ${c.VENDEDOR_CONTACTO}`),
      p(`**Copy (Dealer issuing the invoice and the MSO):** ${c.DEALER_NOMBRE}, ${c.DEALER_DIRECCION}. Attn: ${c.DEALER_CONTACTO}`),
      p("**From:** Lux Cars Import S.A.C., Lima, Peru, acting as agent for the buyer under the attached Letter of Authorization"),
      p(`**Re:** Purchase and export to Peru of the ${c.VEH_ANIO} ${c.VEH_MARCA} ${c.VEH_MODELO} ${c.VEH_VERSION}, VIN ${c.VEH_VIN}`),
      p("Thank you for working with us. Please read these instructions before preparing any document. In Peru, a wrong buyer name or an unintended registration costs the buyer weeks and thousands of dollars, so we need the paperwork exactly as described below. The Seller receives the full payment and settles with the Dealer; the Dealer issues the invoice and the ownership document in the buyer's name."),

      h2("1. Buyer of record (write it exactly like this on every document)"),
      tabla(["Field", "Detail"], [
        ["Legal name", c.CLIENTE_RAZON_SOCIAL],
        ["Tax ID", `RUC ${c.CLIENTE_RUC}`],
        ["Address", `${c.CLIENTE_DOMICILIO}, Lima, Peru`],
        ["Email", c.CLIENTE_CORREO],
      ], [1, 3]),
      p('Lux Cars Import S.A.C. is the buyer\'s agent and must not appear as buyer or owner on any document. We may appear as "agent" or as the party to contact.'),

      h2("2. Bill of sale / invoice"),
      p("The pro forma issued to the buyer of record is the basis of our client's first payment. Pickup and transport to the port are arranged and paid separately through our freight forwarder. The final bill of sale, issued by the Dealer, must show:"),
      vinetas([
        "Buyer of record as in Section 1",
        "Your legal name, address and tax number",
        "Vehicle: year, make, model, trim, VIN, color, odometer reading in kilometres at delivery, fuel type, engine displacement, and whether new or used",
        `Price in ${c.MONEDA_COMPRA}, itemized: vehicle price, fees, taxes or the tax-exemption line, total`,
        'The statement "Sold for export to Peru. Vehicle to be exported within 60 days."',
        "Date and signature of an authorized person",
        '"Paid in full" with the payment reference once funds are received',
      ]),

      h2("3. Payment"),
      vinetas([
        `The full price, ${c.MONEDA_COMPRA} ${c.PRECIO_COMPRA}, is wired in one transfer from Lux Cars Import S.A.C. (client funds account) on behalf of the buyer to the Seller (broker), with the reference "${c.EXPEDIENTE} on behalf of ${c.CLIENTE_RAZON_SOCIAL}". The Seller pays the Dealer.`,
        `Send your banking details on company letterhead, signed. Before wiring, we will call your published number (${c.VENDEDOR_TELEFONO}) to confirm them. We do not accept changes to banking details by email. If your details change, call us.`,
        "Our bank's wire fees are on us. Please tell us in advance about any intermediary or receiving bank fees so the net amount matches the bill of sale.",
        "Release the Vehicle only after funds are received. We will send the wire confirmation the same day.",
      ]),

      h2("4. Ownership documents"),
      ...(usado ? [] : [p("**New vehicle.** Original Manufacturer's Statement of Origin (MSO) or New Vehicle Information Statement, unregistered, assigned by the Dealer to the buyer of record. **Do not register, license or plate the vehicle in any state or province.** A registered vehicle is treated as used by Peruvian customs and the buyer's import taxes rise from 10 % to 40 % on one line alone. We check open recalls by VIN before payment; please confirm none are pending.")]),
      ...(usado ? [p("**Used vehicle.** Original certificate of title (or provincial registration or ownership) with the transfer portion completed to the buyer of record; a lien release or a signed statement that the vehicle is free of liens; an odometer statement. The vehicle was inspected by our inspector before our client approved it: please deliver it in the same condition, with every item listed in the inspection report.")] : []),
      p(`**Both.** Two keys, owner's manual, printout showing no open recalls, service records if available, factory warranty documents if any. Hand the originals to our carrier at pickup against a signed receipt, or courier them to ${c.FORWARDER_NOMBRE.replace(/\.+$/, "")}. Never leave documents or keys inside the vehicle.`),

      h2("5. Taxes"),
      vinetas([
        "Export sale: we understand this sale qualifies as a zero-rated export sale to a non-resident (GST/HST, and provincial tax where applicable). Please confirm in writing and tell us what proof of export you need. We will provide the bill of lading and the export declaration.",
        "If the vehicle price exceeds CAD 100,000, confirm in writing whether the federal luxury tax applies and what documentation the export exemption requires.",
        "Any tax that cannot be exempted must appear as a separate line on the pro forma before payment.",
      ]),

      h2("6. Vehicle preparation and release"),
      vinetas([
        `Release to ${c.FORWARDER_NOMBRE} or its contracted carrier on ${c.FECHA_RELEASE}. The driver will show ID and our release confirmation.`,
        "Fuel at or below one quarter of the tank; battery connected and charged; no personal items, loose parts or accessories inside; dealer plates and temporary permits removed.",
        "Please take dated photos of all sides, the odometer and the VIN plate at release and send them to us. Our carrier will sign a condition report.",
        "Dealer pre-delivery check completed, tire pressures set, alarm and immobilizer instructions and second-key programming provided.",
      ]),

      h2("7. Contacts"),
      tabla(["Who", "Contact"], [
        ["Lux Cars Import S.A.C. (buyer's agent)", `${c.LUXCARS_REPRESENTANTE}, ${c.LUXCARS_CORREO}, ${c.LUXCARS_TELEFONO} (WhatsApp)`],
        ["Freight forwarder", `${c.FORWARDER_NOMBRE}, ${c.FORWARDER_CONTACTO}`],
        ["Dealer", `${c.DEALER_NOMBRE}, ${c.DEALER_CONTACTO}`],
      ], [2, 3]),
      firmas(
        ["Issued by Lux Cars Import S.A.C.", c.LUXCARS_REPRESENTANTE, "Date: ______________"],
        ["Acknowledged by the Seller", "Name: ______________", "Date: ______________"],
      ),
    ],
  };
}

export const instruccionesVendedor: Plantilla = {
  tipo: "instrucciones_vendedor",
  version: "instrucciones_vendedor@2026-11-27c",
  nombre: "Purchase and Export Instructions (EN)",
  idioma: "en",
  tarea: "luxcars.instrucciones_vendedor",
  seFirma: false,
  construir,
};
