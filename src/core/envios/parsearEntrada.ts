import { VEHICLE_CATEGORIES } from "../pricing/vehicleCategories";
import type { ServicioEnvio } from "./configEnvios";
import type { EntradaCotizacionEnvio, RegimenEnvio, UnidadRecorrido } from "./tipos";

/**
 * Convierte un JSON desconocido (el cuerpo de una petición) en una
 * `EntradaCotizacionEnvio` saneada, o devuelve `null` si no tiene la forma
 * mínima. El servidor NUNCA confía en los números que manda el navegador:
 * recalcula con esta entrada y guarda su propio resultado.
 *
 * Es permisivo con lo opcional (lo vacía o lo pone en cero) y estricto con lo
 * que no puede faltar: cliente, marca, modelo, año, régimen.
 */

const CATEGORIAS = new Set<string>(VEHICLE_CATEGORIES.map((c) => c.id));
const REGIMENES: readonly RegimenEnvio[] = ["ley-retorno", "importacion-regular"];
const UNIDADES: readonly UnidadRecorrido[] = ["millas", "km"];
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
}

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function numero(v: unknown, porDefecto = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : porDefecto;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : porDefecto;
  }
  return porDefecto;
}

function numeroOpcional(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = numero(v, Number.NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fecha(v: unknown): string | null {
  const s = texto(v, 10);
  return RE_FECHA.test(s) && Number.isFinite(new Date(`${s}T00:00:00Z`).getTime()) ? s : null;
}

function servicio(v: unknown): ServicioEnvio {
  const s = obj(v);
  if (s.tipo === "porcentaje") {
    return { tipo: "porcentaje", tasa: Math.max(0, Math.min(1, numero(s.tasa))) };
  }
  return { tipo: "fijo", montoUsd: Math.max(0, numero(s.montoUsd)) };
}

export function parsearEntradaEnvio(raw: unknown): EntradaCotizacionEnvio | null {
  const e = obj(raw);
  const cliente = obj(e.cliente);
  const vehiculo = obj(e.vehiculo);
  const origen = obj(e.origen);
  const costos = obj(e.costos);

  const nombre = texto(cliente.nombre, 160);
  const marca = texto(vehiculo.marca, 80);
  const modelo = texto(vehiculo.modelo, 120);
  const anioModelo = Math.trunc(numero(vehiculo.anioModelo, Number.NaN));
  const regimen = e.regimen;
  const combustible = texto(vehiculo.combustible, 20);
  const unidad = texto(vehiculo.unidadRecorrido, 10);

  if (!nombre || !marca || !modelo) return null;
  if (!Number.isFinite(anioModelo) || anioModelo < 1980 || anioModelo > 2100) return null;
  if (!REGIMENES.includes(regimen as RegimenEnvio)) return null;
  if (!CATEGORIAS.has(combustible)) return null;

  const retornoRaw = e.retorno === null || e.retorno === undefined ? null : obj(e.retorno);
  const retorno =
    regimen === "ley-retorno"
      ? {
          aniosFuera: Math.max(0, numero(retornoRaw?.aniosFuera)),
          fechaRetorno: fecha(retornoRaw?.fechaRetorno),
        }
      : null;

  return {
    cliente: { nombre, whatsapp: texto(cliente.whatsapp, 40) },
    vehiculo: {
      marca,
      modelo,
      anioModelo,
      condicion: vehiculo.condicion === "nuevo" ? "nuevo" : "usado",
      recorrido: Math.max(0, numero(vehiculo.recorrido)),
      unidadRecorrido: UNIDADES.includes(unidad as UnidadRecorrido) ? (unidad as UnidadRecorrido) : "millas",
      combustible: combustible as EntradaCotizacionEnvio["vehiculo"]["combustible"],
      paisFabricacion: texto(vehiculo.paisFabricacion, 80),
      valorFacturaUsd: Math.max(0, numero(vehiculo.valorFacturaUsd)),
      valorReferenciaUsadoUsd: numeroOpcional(vehiculo.valorReferenciaUsadoUsd),
      cilindradaCc: numeroOpcional(vehiculo.cilindradaCc),
    },
    origen: {
      ciudad: texto(origen.ciudad, 80),
      estado: texto(origen.estado, 80),
      puertoSalida: texto(origen.puertoSalida, 80) || "Miami",
    },
    regimen: regimen as RegimenEnvio,
    retorno,
    prestamoVigente: e.prestamoVigente === true,
    fechaImportacion: fecha(e.fechaImportacion),
    costos: {
      transporteInternoUsd: Math.max(0, numero(costos.transporteInternoUsd)),
      fleteUsd: Math.max(0, numero(costos.fleteUsd)),
      gastosAduanaUsd: Math.max(0, numero(costos.gastosAduanaUsd)),
      servicio: servicio(costos.servicio),
    },
  };
}
