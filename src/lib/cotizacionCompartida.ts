/**
 * Enlace corto para compartir un estimado de la calculadora: luxcars.pe/c/<código>
 *
 * EL CÓDIGO **ES** LA COTIZACIÓN. No hay tabla, ni fila, ni llamada al
 * servidor para crearlo: los datos que el cliente llenó (condición, motor,
 * auto, año, precio, entrega) van empaquetados en ~15 caracteres. Se eligió
 * así, y no guardando cada estimado en la base, por tres razones:
 *
 *   1. Un enlace puesto en una publicación tiene que abrir dentro de un año.
 *      Así no depende de que la base esté arriba ni de que la fila exista.
 *   2. Sin ruta pública que escriba en la base no hay nada que un robot pueda
 *      llenar de basura, ni nada que limitar por IP.
 *   3. No se guarda qué cotizó nadie.
 *
 * La contracara: el enlace no congela el número. Al abrirlo se recalcula con
 * el motor y las tasas de ese día, y la página lo dice con su fecha.
 *
 * FORMATO (versión 1) — bits, del más significativo al menos:
 *
 *   3  versión (= 1)
 *   1  condición        0 nuevo · 1 usado
 *   3  motor            índice en CATEGORIAS
 *   1  entrega          0 fast · 1 standard
 *   2  origen forzado   índice en ORIGENES (0 = el que infiere el motor)
 *   7  año − 1990
 *   27 precio en USD, entero
 *   1  cómo va el nombre
 *        0 → 32 bits: huella de "marca + modelo" del catálogo curado
 *        1 → 6 bits largo de marca + 6 bits largo de modelo + bytes UTF-8
 *   …  relleno con ceros hasta completar el byte
 *   8  verificación (un dígito cambiado al copiar no abre otro auto)
 *
 * Todo eso se escribe en base 62 (solo letras y números): un enlace que
 * termina en "-" o "_" se corta al pegarlo en algunas redes.
 *
 * NO REORDENAR `CATEGORIAS` NI `ORIGENES`, y no cambiar el significado de la
 * versión 1: los enlaces ya publicados dejarían de decir lo que decían. Un
 * formato nuevo es una versión nueva.
 */

import type {
  PlanKey,
  VehicleCondition,
  VehicleOrigin,
} from "@/core/pricing/pricingConfig";
import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import {
  VEHICLE_CATALOG,
  findCatalogBrand,
  findCatalogModel,
} from "@/data/vehicleCatalog";

export type SharedQuote = {
  condition: VehicleCondition;
  vehicleType: VehicleCategoryId;
  /**
   * Vacíos si el enlace apunta a un modelo que ya no está en el catálogo: el
   * resto del estimado sigue siendo válido y se muestra sin nombre.
   */
  brand: string;
  model: string;
  year: number;
  /** Precio en EE.UU., USD enteros. */
  price: number;
  plan: PlanKey;
  /** `null`: el origen (0% o 6% de ad valorem) lo infiere el motor. */
  origin: VehicleOrigin | null;
};

/** Ruta pública del estimado compartido. */
export const SHARED_QUOTE_PATH = "/c";

/** Parámetro que precarga la calculadora con un estimado: /?c=<código>#calculator */
export const SHARED_QUOTE_PARAM = "c";

const VERSION = 1;
const CATEGORIAS: readonly VehicleCategoryId[] = ["gasolina", "hev", "phev", "ev", "diesel"];
const ORIGENES: readonly (VehicleOrigin | null)[] = [null, "originario-usa", "otro"];

const ANIO_BASE = 1990;
const ANIO_MAXIMO = ANIO_BASE + 127;
const PRECIO_MAXIMO = 2 ** 27 - 1;
const BYTES_MARCA_MAXIMO = 40;
const BYTES_MODELO_MAXIMO = 60;

const ALFABETO = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = BigInt(ALFABETO.length);
const CODIGO_VALIDO = /^[1-9A-Za-z][0-9A-Za-z]{9,159}$/;

/* --- Piezas ---------------------------------------------------------------- */

/** FNV-1a de 32 bits. No es criptografía: es una huella corta y estable. */
function huella(bytes: ArrayLike<number>): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const aBytes = (texto: string) => new TextEncoder().encode(texto);

function huellaDeNombre(brand: string, model: string): number {
  return huella(aBytes(`${brand}\u0000${model}`.toLowerCase()));
}

type NombreDeCatalogo = { brand: string; model: string };
let indiceDeCatalogo: Map<number, NombreDeCatalogo | null> | null = null;

/** Huella → marca y modelo. `null` donde dos modelos comparten huella. */
function catalogoPorHuella(): Map<number, NombreDeCatalogo | null> {
  if (indiceDeCatalogo) return indiceDeCatalogo;
  const indice = new Map<number, NombreDeCatalogo | null>();
  for (const marca of VEHICLE_CATALOG) {
    for (const modelo of marca.models) {
      const clave = huellaDeNombre(marca.name, modelo);
      indice.set(clave, indice.has(clave) ? null : { brand: marca.name, model: modelo });
    }
  }
  indiceDeCatalogo = indice;
  return indice;
}

/** Recorta un texto para que no pase de `maximo` bytes, sin partir un carácter. */
function recortar(texto: string, maximo: number): Uint8Array {
  let recortado = texto;
  let bytes = aBytes(recortado);
  while (bytes.length > maximo) {
    recortado = Array.from(recortado).slice(0, -1).join("");
    bytes = aBytes(recortado);
  }
  return bytes;
}

class Escritor {
  private readonly bits: number[] = [];

  escribir(valor: number, cantidad: number): void {
    for (let i = cantidad - 1; i >= 0; i -= 1) {
      this.bits.push(Math.floor(valor / 2 ** i) % 2);
    }
  }

  /** Bytes completos; el último se rellena con ceros. */
  bytes(): number[] {
    const salida: number[] = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j += 1) byte = byte * 2 + (this.bits[i + j] ?? 0);
      salida.push(byte);
    }
    return salida;
  }
}

class Lector {
  private posicion = 0;

  constructor(private readonly datos: number[]) {}

  /** `null` si no quedan bits suficientes. */
  leer(cantidad: number): number | null {
    if (this.posicion + cantidad > this.datos.length * 8) return null;
    let valor = 0;
    for (let i = 0; i < cantidad; i += 1) {
      const byte = this.datos[Math.floor(this.posicion / 8)];
      valor = valor * 2 + ((byte >> (7 - (this.posicion % 8))) & 1);
      this.posicion += 1;
    }
    return valor;
  }

  /** Lo que queda tiene que ser solo relleno: menos de un byte, todo en cero. */
  soloQuedaRelleno(): boolean {
    const restantes = this.datos.length * 8 - this.posicion;
    if (restantes >= 8) return false;
    return restantes === 0 || this.leer(restantes) === 0;
  }
}

/* --- Codificar ------------------------------------------------------------- */

/** Código del estimado, o `null` si los datos no se pueden representar. */
export function encodeSharedQuote(quote: SharedQuote): string | null {
  const categoria = CATEGORIAS.indexOf(quote.vehicleType);
  const origen = ORIGENES.indexOf(quote.origin);
  const brand = quote.brand.trim();
  const model = quote.model.trim();
  if (categoria < 0 || origen < 0) return null;
  if (!Number.isInteger(quote.year) || quote.year < ANIO_BASE || quote.year > ANIO_MAXIMO) return null;
  if (!Number.isInteger(quote.price) || quote.price < 1 || quote.price > PRECIO_MAXIMO) return null;
  if (!brand || !model) return null;

  const escritor = new Escritor();
  escritor.escribir(VERSION, 3);
  escritor.escribir(quote.condition === "usado" ? 1 : 0, 1);
  escritor.escribir(categoria, 3);
  escritor.escribir(quote.plan === "standard" ? 1 : 0, 1);
  escritor.escribir(origen, 2);
  escritor.escribir(quote.year - ANIO_BASE, 7);
  escritor.escribir(quote.price, 27);

  // Si el auto está en el catálogo (y su huella no choca con otra), va la
  // huella: es lo que deja el enlace en 15 caracteres.
  const marcaDeCatalogo = findCatalogBrand(brand);
  const modeloDeCatalogo = marcaDeCatalogo ? findCatalogModel(marcaDeCatalogo, model) : null;
  const clave =
    marcaDeCatalogo && modeloDeCatalogo
      ? huellaDeNombre(marcaDeCatalogo.name, modeloDeCatalogo)
      : null;

  if (clave !== null && catalogoPorHuella().get(clave)) {
    escritor.escribir(0, 1);
    escritor.escribir(clave, 32);
  } else {
    const bytesMarca = recortar(brand, BYTES_MARCA_MAXIMO);
    const bytesModelo = recortar(model, BYTES_MODELO_MAXIMO);
    escritor.escribir(1, 1);
    escritor.escribir(bytesMarca.length, 6);
    escritor.escribir(bytesModelo.length, 6);
    for (const byte of bytesMarca) escritor.escribir(byte, 8);
    for (const byte of bytesModelo) escritor.escribir(byte, 8);
  }

  const cuerpo = escritor.bytes();
  const completo = [...cuerpo, huella(cuerpo) & 0xff];

  let numero = BigInt(0);
  for (const byte of completo) numero = numero * BigInt(256) + BigInt(byte);
  let codigo = "";
  while (numero > BigInt(0)) {
    codigo = ALFABETO[Number(numero % BASE)] + codigo;
    numero /= BASE;
  }
  return codigo;
}

/* --- Decodificar ----------------------------------------------------------- */

/** Estimado que hay dentro del código, o `null` si el código no es válido. */
export function decodeSharedQuote(codigo: string): SharedQuote | null {
  if (typeof codigo !== "string" || !CODIGO_VALIDO.test(codigo)) return null;

  let numero = BigInt(0);
  for (const caracter of codigo) {
    numero = numero * BASE + BigInt(ALFABETO.indexOf(caracter));
  }
  const completo: number[] = [];
  while (numero > BigInt(0)) {
    completo.unshift(Number(numero % BigInt(256)));
    numero /= BigInt(256);
  }
  if (completo.length < 2) return null;

  const cuerpo = completo.slice(0, -1);
  if ((huella(cuerpo) & 0xff) !== completo[completo.length - 1]) return null;

  const lector = new Lector(cuerpo);
  const version = lector.leer(3);
  const usado = lector.leer(1);
  const categoria = lector.leer(3);
  const estandar = lector.leer(1);
  const origen = lector.leer(2);
  const anio = lector.leer(7);
  const precio = lector.leer(27);
  const nombreComoTexto = lector.leer(1);
  if (
    version !== VERSION ||
    usado === null ||
    categoria === null ||
    estandar === null ||
    origen === null ||
    anio === null ||
    precio === null ||
    nombreComoTexto === null
  ) {
    return null;
  }
  if (categoria >= CATEGORIAS.length || origen >= ORIGENES.length || precio < 1) return null;

  let brand = "";
  let model = "";
  if (nombreComoTexto === 0) {
    const clave = lector.leer(32);
    if (clave === null) return null;
    // Un modelo que salió del catálogo deja el nombre vacío, no rompe el enlace.
    const nombre = catalogoPorHuella().get(clave);
    brand = nombre?.brand ?? "";
    model = nombre?.model ?? "";
  } else {
    const largoMarca = lector.leer(6);
    const largoModelo = lector.leer(6);
    if (!largoMarca || !largoModelo) return null;
    if (largoMarca > BYTES_MARCA_MAXIMO || largoModelo > BYTES_MODELO_MAXIMO) return null;
    const bytes: number[] = [];
    for (let i = 0; i < largoMarca + largoModelo; i += 1) {
      const byte = lector.leer(8);
      if (byte === null) return null;
      bytes.push(byte);
    }
    try {
      const texto = new TextDecoder("utf-8", { fatal: true });
      brand = limpiar(texto.decode(new Uint8Array(bytes.slice(0, largoMarca))));
      model = limpiar(texto.decode(new Uint8Array(bytes.slice(largoMarca))));
    } catch {
      return null;
    }
    if (!brand || !model) return null;
  }
  if (!lector.soloQuedaRelleno()) return null;

  return {
    condition: usado === 1 ? "usado" : "nuevo",
    vehicleType: CATEGORIAS[categoria],
    brand,
    model,
    year: ANIO_BASE + anio,
    price: precio,
    plan: estandar === 1 ? "standard" : "fast",
    origin: ORIGENES[origen],
  };
}

/**
 * El nombre viene de un enlace que cualquiera pudo armar: se le quitan los
 * caracteres de control y se colapsan los espacios antes de mostrarlo.
 */
function limpiar(texto: string): string {
  return texto.replace(/[\u0000-\u001f\u007f-\u009f]/g, "").replace(/\s+/g, " ").trim();
}

/** Ruta del estimado compartido: `/c/<código>`. */
export function sharedQuotePath(codigo: string): string {
  return `${SHARED_QUOTE_PATH}/${codigo}`;
}

/** Ruta que abre la calculadora precargada con ese estimado. */
export function sharedQuoteCalculatorPath(codigo: string): string {
  return `/?${SHARED_QUOTE_PARAM}=${codigo}#calculator`;
}
