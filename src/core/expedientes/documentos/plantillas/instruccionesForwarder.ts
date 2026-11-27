/** 4 · Shipping Instructions to the Freight Forwarder (inglés). Transcrito del paquete. */

import type { Campos } from "../../campos";
import { casillas, firmas, h2, p, tabla, vinetas, type Estructura } from "../estructura";
import type { Plantilla } from "./tipos";

function construir(c: Campos): Estructura {
  return {
    titulo: "Shipping Instructions to the Freight Forwarder",
    subtitulo: `**File ${c.EXPEDIENTE} · Date: ______________**`,
    idioma: "en",
    codigoExpediente: c.EXPEDIENTE,
    bloques: [
      p(`**To:** ${c.FORWARDER_NOMBRE}. Attn: ${c.FORWARDER_CONTACTO}`),
      p("**From:** Lux Cars Import S.A.C., Lima, Peru, acting as agent for the consignee under the attached Letter of Authorization"),
      p(`**Re:** Ocean shipment of one vehicle, VIN ${c.VEH_VIN}, ${c.PUERTO_ORIGEN} to ${c.PUERTO_DESTINO}`),

      h2("1. Parties for the bill of lading"),
      tabla(["Role", "Exactly as it must appear"], [
        ["Shipper / exporter", `Lux Cars Import S.A.C., as agent on behalf of ${c.CLIENTE_RAZON_SOCIAL} (if you require a local exporter of record, tell us before booking)`],
        ['Consignee (straight B/L, not "to order")', `${c.CLIENTE_RAZON_SOCIAL}, RUC ${c.CLIENTE_RUC}, ${c.CLIENTE_DOMICILIO}, Lima, Peru`],
        ["Notify party", `${c.AGENTE_ADUANA}, RUC ${c.AGENTE_ADUANA_RUC}, ${c.AGENTE_ADUANA_CONTACTO}`],
        ["Second notify", `Lux Cars Import S.A.C., ${c.LUXCARS_CORREO}, ${c.LUXCARS_TELEFONO}`],
      ], [1.5, 3.5]),

      h2("2. Cargo"),
      tabla(["Field", "Detail"], [
        ["Vehicle", `${c.VEH_ANIO} ${c.VEH_MARCA} ${c.VEH_MODELO} ${c.VEH_VERSION}, ${c.VEH_COLOR}`],
        ["VIN", c.VEH_VIN],
        ["Condition", `${c.VEH_CONDICION}, running, odometer ${c.VEH_KM}`],
        ["Fuel / engine", `${c.VEH_COMBUSTIBLE}, ${c.VEH_CILINDRADA}`],
        ["Gross weight", c.VEH_PESO],
        ["Dimensions (L × W × H)", c.VEH_MEDIDAS],
        ["Ownership documents", "Travel by courier with the keys, never inside the vehicle"],
      ], [1.5, 3.5]),

      h2("3. Shipment mode (tick one)"),
      casillas([
        `**Exclusive container ${c.TIPO_CONTENEDOR}**: one vehicle, one house B/L.`,
        `**Consolidated**: this vehicle shares a ${c.TIPO_CONTENEDOR} with VIN ${c.VIN_OTRA_UNIDAD}, which has a different consignee. Required: one house B/L per vehicle, each with its own consignee; freight and container charges split ${c.PROPORCION_FLETE} to this vehicle and shown on each house B/L; a separate invoice per consignee for its share plus its own charges (never one invoice for both vehicles); a loading plan with both vehicles' dimensions approved by us before booking; a loading report with photos of both vehicles lashed, both odometer readings and the seal number.`,
        "**Ro-Ro**.",
      ]),

      h2("4. Routing and dates"),
      tabla(["Item", "Detail"], [
        ["Pickup", `${c.DEALER_DIRECCION} (dealer: ${c.DEALER_NOMBRE}), on ${c.FECHA_RELEASE}. Coordinate with ${c.DEALER_CONTACTO}; broker: ${c.VENDEDOR_CONTACTO}, ${c.VENDEDOR_TELEFONO}`],
        ["Consolidation warehouse", c.ALMACEN_CONSOLIDACION],
        ["Port of loading", c.PUERTO_ORIGEN],
        ["Port of discharge", `${c.PUERTO_DESTINO} (Callao, Peru)`],
        ["Target sailing", c.FECHA_EST_EMBARQUE],
        ["Quote", "One freight figure covering pickup at the dealer and transport to the port, warehouse handling, loading and lashing, export documentation and ocean freight, with destination charges as separate lines"],
      ], [1.5, 3.5]),

      h2("5. Bill of lading requirements"),
      vinetas([
        'Straight, nominative B/L with the consignee exactly as in Section 1. Not "to order".',
        'For each vehicle: year, make, model, VIN, color, engine displacement, odometer in km, new or used, gross weight, "1 unit motor vehicle", HS heading as applicable (8703 or 8704).',
        "Freight prepaid, with the freight amount for this house B/L shown on it. Peruvian customs values the import on the CIF and needs the freight per B/L.",
        `Send the draft B/L to ${c.LUXCARS_CORREO} for approval before release. Corrections after arrival in Peru are slow and expensive.`,
        "Originals: three originals by courier to Lux Cars Import S.A.C., or telex release. We will confirm which one the customs broker needs.",
        "If you issue a master B/L to your Callao agent, give us the agent's name, contact and destination charges before sailing.",
      ]),

      h2("6. Export formalities and intake"),
      vinetas([
        `File the export declaration required by the authorities of ${c.PAIS_ORIGEN} and send us the declaration number. Confirm who acts as exporter of record.`,
        "At intake, issue a warehouse or dock receipt with condition photos of all sides, the odometer and the VIN plate.",
        "Packing list per vehicle.",
      ]),

      h2("7. Loading and lashing"),
      vinetas([
        "Block and brace or lash at four points with soft straps over the tires; wheel chocks; no contact between vehicles or with the container walls.",
        "Fuel at or below one quarter; battery disconnected after positioning; alarm off; windows closed.",
        "Keys in a labelled envelope with the documents, not in the vehicle. No personal effects or loose parts inside: Peruvian customs treats them as separate cargo.",
        "Photos of the loaded container before closing and the seal number, sent to us the same day.",
      ]),

      h2("8. Insurance"),
      casillas([
        "Arranged by Lux Cars Import S.A.C. We will send you the certificate.",
        `Arranged by the forwarder: Institute Cargo Clauses (A), warehouse to warehouse, 110 % of the CIF value, insured and beneficiary ${c.CLIENTE_RAZON_SOCIAL}, one certificate per vehicle. Declared value: USD ______________.`,
      ]),

      h2("9. Invoicing"),
      p(`Invoice all charges for this vehicle to **${c.CLIENTE_RAZON_SOCIAL}, RUC ${c.CLIENTE_RUC}, ${c.CLIENTE_DOMICILIO}, Lima, Peru**, care of Lux Cars Import S.A.C. Payment is remitted by Lux Cars Import S.A.C. on the consignee's behalf with the reference ${c.EXPEDIENTE}. Send banking details on letterhead; we confirm them by phone before paying.`),

      h2("10. Contacts"),
      tabla(["Who", "Contact"], [
        ["Lux Cars Import S.A.C.", `${c.LUXCARS_REPRESENTANTE}, ${c.LUXCARS_CORREO}, ${c.LUXCARS_TELEFONO} (WhatsApp)`],
        ["Customs broker in Callao", `${c.AGENTE_ADUANA}, ${c.AGENTE_ADUANA_CONTACTO}`],
        ["Seller (broker)", `${c.VENDEDOR_NOMBRE}, ${c.VENDEDOR_CONTACTO}, ${c.VENDEDOR_TELEFONO}`],
        ["Dealer (pickup)", `${c.DEALER_NOMBRE}, ${c.DEALER_CONTACTO}`],
      ], [2, 3]),
      firmas(
        ["Issued by Lux Cars Import S.A.C.", c.LUXCARS_REPRESENTANTE, "Date: ______________"],
        ["Acknowledged by the forwarder", "Name: ______________", "Date: ______________"],
      ),
    ],
  };
}

export const instruccionesForwarder: Plantilla = {
  tipo: "instrucciones_forwarder",
  version: "instrucciones_forwarder@2026-11-27",
  nombre: "Shipping Instructions (EN)",
  idioma: "en",
  tarea: "luxcars.instrucciones_forwarder",
  seFirma: false,
  construir,
};
