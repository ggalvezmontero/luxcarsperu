import { CONFIG_ENVIOS } from "@/core/envios/configEnvios";
import type { EntradaCotizacionEnvio, RegimenEnvio, UnidadRecorrido } from "@/core/envios/tipos";
import type { VehicleCondition } from "@/core/pricing/pricingConfig";
import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";

/**
 * Estado del formulario del cotizador: todo texto, tal como lo escribe la
 * persona. La conversión a `EntradaCotizacionEnvio` (números, fechas) vive en
 * `aEntrada()`, y el camino inverso, para reabrir una cotización guardada, en
 * `desdeEntrada()`.
 */
export type Formulario = {
  nombre: string;
  whatsapp: string;
  marca: string;
  modelo: string;
  anioModelo: string;
  condicion: VehicleCondition;
  recorrido: string;
  unidadRecorrido: UnidadRecorrido;
  combustible: VehicleCategoryId;
  paisFabricacion: string;
  valorFactura: string;
  valorReferencia: string;
  cilindrada: string;
  ciudad: string;
  estado: string;
  puertoSalida: string;
  regimen: RegimenEnvio;
  aniosFuera: string;
  fechaRetorno: string;
  prestamoVigente: boolean;
  fechaImportacion: string;
  transporteInterno: string;
  flete: string;
  gastosAduana: string;
  servicioTipo: "fijo" | "porcentaje";
  servicioMonto: string;
  /** En porcentaje (5 = 5%). */
  servicioTasa: string;
};

export const PAISES_FABRICACION = [
  "Estados Unidos",
  "Japón",
  "Alemania",
  "Corea del Sur",
  "México",
  "Canadá",
  "Reino Unido",
  "Italia",
  "Suecia",
  "China",
] as const;

export const ESTADOS_EEUU = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawái", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Luisiana", "Maine", "Maryland", "Massachusetts", "Míchigan", "Minnesota", "Misisipi", "Misuri",
  "Montana", "Nebraska", "Nevada", "Nuevo Hampshire", "Nueva Jersey", "Nuevo México", "Nueva York",
  "Carolina del Norte", "Dakota del Norte", "Ohio", "Oklahoma", "Oregón", "Pensilvania",
  "Rhode Island", "Carolina del Sur", "Dakota del Sur", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "Virginia Occidental", "Wisconsin", "Wyoming",
] as const;

export const PUERTOS_SALIDA = ["Miami", "Houston", "Los Ángeles", "Nueva York / Newark", "Savannah"] as const;

export function formularioInicial(anioActual: number): Formulario {
  return {
    nombre: "",
    whatsapp: "",
    marca: "",
    modelo: "",
    anioModelo: String(anioActual),
    condicion: "usado",
    recorrido: "",
    unidadRecorrido: "millas",
    combustible: "gasolina",
    paisFabricacion: "",
    valorFactura: "",
    valorReferencia: "",
    cilindrada: "",
    ciudad: "",
    estado: "",
    puertoSalida: CONFIG_ENVIOS.puertoSalidaPorDefecto,
    regimen: "ley-retorno",
    aniosFuera: "",
    fechaRetorno: "",
    prestamoVigente: false,
    fechaImportacion: "",
    transporteInterno: "",
    flete: String(Math.round(CONFIG_ENVIOS.fleteMiamiCallaoUsd)),
    gastosAduana: String(CONFIG_ENVIOS.gastosAduanaUsd),
    servicioTipo: "fijo",
    servicioMonto: String(
      CONFIG_ENVIOS.servicioPorDefecto.tipo === "fijo" ? CONFIG_ENVIOS.servicioPorDefecto.montoUsd : 3000,
    ),
    servicioTasa: String(CONFIG_ENVIOS.servicioPorcentajePorDefecto * 100),
  };
}

/** Lee un número escrito a mano; acepta coma decimal y separadores de miles. `0` si no es número. */
export function leerNumero(raw: string): number {
  const limpio = raw.trim().replace(/\s/g, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!limpio) return 0;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

function numeroOpcional(raw: string): number | null {
  const n = leerNumero(raw);
  return n > 0 ? n : null;
}

function fechaOpcional(raw: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? raw.trim() : null;
}

/** Entrada para el motor. Tolerante: lo vacío queda en cero o `null`, nunca lanza. */
export function aEntrada(f: Formulario): EntradaCotizacionEnvio {
  return {
    cliente: { nombre: f.nombre.trim(), whatsapp: f.whatsapp.trim() },
    vehiculo: {
      marca: f.marca.trim(),
      modelo: f.modelo.trim(),
      anioModelo: Math.trunc(leerNumero(f.anioModelo)),
      condicion: f.condicion,
      recorrido: leerNumero(f.recorrido),
      unidadRecorrido: f.unidadRecorrido,
      combustible: f.combustible,
      paisFabricacion: f.paisFabricacion.trim(),
      valorFacturaUsd: leerNumero(f.valorFactura),
      valorReferenciaUsadoUsd: f.condicion === "usado" ? numeroOpcional(f.valorReferencia) : null,
      cilindradaCc: numeroOpcional(f.cilindrada),
    },
    origen: {
      ciudad: f.ciudad.trim(),
      estado: f.estado.trim(),
      puertoSalida: f.puertoSalida.trim() || CONFIG_ENVIOS.puertoSalidaPorDefecto,
    },
    regimen: f.regimen,
    retorno:
      f.regimen === "ley-retorno"
        ? { aniosFuera: leerNumero(f.aniosFuera), fechaRetorno: fechaOpcional(f.fechaRetorno) }
        : null,
    prestamoVigente: f.prestamoVigente,
    fechaImportacion: fechaOpcional(f.fechaImportacion),
    costos: {
      transporteInternoUsd: leerNumero(f.transporteInterno),
      fleteUsd: leerNumero(f.flete),
      gastosAduanaUsd: leerNumero(f.gastosAduana),
      servicio:
        f.servicioTipo === "porcentaje"
          ? { tipo: "porcentaje", tasa: leerNumero(f.servicioTasa) / 100 }
          : { tipo: "fijo", montoUsd: leerNumero(f.servicioMonto) },
    },
  };
}

/** Rellena el formulario con una cotización guardada. */
export function desdeEntrada(e: EntradaCotizacionEnvio): Formulario {
  const txt = (n: number | null | undefined) => (n == null || n === 0 ? "" : String(n));
  return {
    nombre: e.cliente.nombre,
    whatsapp: e.cliente.whatsapp,
    marca: e.vehiculo.marca,
    modelo: e.vehiculo.modelo,
    anioModelo: String(e.vehiculo.anioModelo),
    condicion: e.vehiculo.condicion,
    recorrido: txt(e.vehiculo.recorrido),
    unidadRecorrido: e.vehiculo.unidadRecorrido,
    combustible: e.vehiculo.combustible,
    paisFabricacion: e.vehiculo.paisFabricacion,
    valorFactura: txt(e.vehiculo.valorFacturaUsd),
    valorReferencia: txt(e.vehiculo.valorReferenciaUsadoUsd),
    cilindrada: txt(e.vehiculo.cilindradaCc),
    ciudad: e.origen.ciudad,
    estado: e.origen.estado,
    puertoSalida: e.origen.puertoSalida,
    regimen: e.regimen,
    aniosFuera: txt(e.retorno?.aniosFuera),
    fechaRetorno: e.retorno?.fechaRetorno ?? "",
    prestamoVigente: e.prestamoVigente,
    fechaImportacion: e.fechaImportacion ?? "",
    transporteInterno: txt(e.costos.transporteInternoUsd),
    flete: String(e.costos.fleteUsd),
    gastosAduana: String(e.costos.gastosAduanaUsd),
    servicioTipo: e.costos.servicio.tipo,
    servicioMonto: e.costos.servicio.tipo === "fijo" ? String(e.costos.servicio.montoUsd) : String(3000),
    servicioTasa:
      e.costos.servicio.tipo === "porcentaje"
        ? String(Math.round(e.costos.servicio.tasa * 10000) / 100)
        : String(CONFIG_ENVIOS.servicioPorcentajePorDefecto * 100),
  };
}

/** Qué falta para poder GUARDAR (cotizar en pantalla no exige nada). */
export function faltantes(f: Formulario): string[] {
  const faltan: string[] = [];
  if (!f.nombre.trim()) faltan.push("nombre del cliente");
  if (!f.marca.trim()) faltan.push("marca");
  if (!f.modelo.trim()) faltan.push("modelo");
  const anio = leerNumero(f.anioModelo);
  if (anio < 1980 || anio > 2100) faltan.push("año modelo");
  if (leerNumero(f.valorFactura) <= 0) faltan.push("valor de factura");
  return faltan;
}
