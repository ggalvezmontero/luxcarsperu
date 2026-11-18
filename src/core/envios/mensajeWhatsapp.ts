import { CONFIG_ENVIOS } from "./configEnvios";
import type { DesgloseRegimen, EntradaCotizacionEnvio, ResultadoCotizacionEnvio } from "./tipos";

/**
 * Mensaje de WhatsApp para el cliente: texto plano, sin markdown, de usted,
 * con el desglose y el total "referencial". Lo pega el administrador; no se
 * envía solo.
 */

const usd = (n: number) =>
  `USD ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n))}`;

export const NOMBRE_REGIMEN: Record<DesgloseRegimen["regimen"], string> = {
  "ley-retorno": "la Ley del Retorno",
  "importacion-regular": "importación regular",
};

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? "";
}

function lineasDesglose(d: DesgloseRegimen): string[] {
  const lineas = [
    `Transporte interno en EE.UU.: ${usd(d.transporteInternoUsd)}`,
    `Flete marítimo Miami–Callao: ${usd(d.fleteUsd)}`,
    `Seguro internacional: ${usd(d.seguroUsd)}`,
  ];
  if (d.regimen === "ley-retorno") {
    lineas.push("Tributos de importación: USD 0 (exonerados por la Ley del Retorno)");
  } else if (d.tributos) {
    lineas.push(
      `Ad valorem: ${usd(d.tributos.adValorem)}`,
      `ISC: ${usd(d.tributos.isc)}`,
      `IGV e IPM: ${usd(d.tributos.igv + d.tributos.ipm)}`,
    );
  } else {
    lineas.push("Tributos de importación: no aplica (el vehículo no puede nacionalizarse por esta vía)");
  }
  lineas.push(
    `Gastos de aduana y puerto: ${usd(d.gastosAduanaUsd)}`,
    `Servicio Luxcars: ${usd(d.servicioUsd)}`,
  );
  return lineas;
}

export function generarMensajeWhatsapp(
  entrada: EntradaCotizacionEnvio,
  resultado: ResultadoCotizacionEnvio,
): string {
  const { vehiculo, origen } = entrada;
  const d = resultado.elegido;
  const nombre = primerNombre(entrada.cliente.nombre);
  const saludo = nombre ? `Hola ${nombre}, ` : "Hola, ";
  const auto = [vehiculo.marca, vehiculo.modelo, vehiculo.anioModelo].filter(Boolean).join(" ").trim();
  const desde = [origen.ciudad, origen.estado].filter((s) => s.trim()).join(", ");

  const bloques: string[] = [];

  bloques.push(
    `${saludo}le comparto el estimado referencial para traer su ${auto}` +
      (desde ? ` desde ${desde}` : "") +
      ` hasta Lima, saliendo por ${origen.puertoSalida || CONFIG_ENVIOS.puertoSalidaPorDefecto}, bajo ${NOMBRE_REGIMEN[d.regimen]}.`,
  );

  bloques.push([...lineasDesglose(d), `Total referencial: ${usd(d.totalUsd)}`].join("\n"));

  if (d.regimen === "importacion-regular" && d.tributos && d.tributos.percepcion > 0) {
    bloques.push(
      `Aparte, SUNAT cobra una percepción del IGV de ${usd(d.tributos.percepcion)} al nacionalizar. No es un costo: es un adelanto que se recupera como crédito fiscal, pero hay que tenerlo disponible.`,
    );
  }

  const avisos = resultado.alertas.filter((a) => a.paraCliente && a.nivel !== "info");
  const fechaLimite = resultado.alertas.find((a) => a.clave === "antiguedad" && a.nivel === "info");
  const puntos = [...avisos, ...(fechaLimite ? [fechaLimite] : [])];
  if (puntos.length > 0) {
    bloques.push(["Puntos a tener en cuenta:", ...puntos.map((a) => `- ${a.titulo}. ${a.detalle}`)].join("\n"));
  }

  bloques.push(resultado.nota);
  bloques.push("Quedo atento a sus consultas.\nLuxcars");

  return bloques.join("\n\n");
}
