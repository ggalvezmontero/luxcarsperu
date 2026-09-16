/**
 * Compresión de fotos en el NAVEGADOR, antes de subir. Solo cliente.
 *
 * POR QUÉ: una foto de celular moderno pesa entre 4 y 12 MB y mide 4000 px de
 * lado. La ficha de un auto la muestra, como mucho, a 1600 px. Subir el
 * original desde el 4G del estacionamiento significa un minuto por foto, ocho
 * fotos por auto, y una cuota de Storage quemada en la primera semana. Bajarla
 * a ~2200 px y recomprimirla deja archivos de 300 a 900 KB — indistinguibles
 * en pantalla y entre diez y veinte veces más livianos.
 *
 * TAMBIÉN EVITA UN LÍMITE DURO: las funciones de Vercel aceptan cuerpos de
 * hasta ~4.5 MB. Sin esta compresión, media docena de fotos de iPhone fallarían
 * con un 413 que nadie sabría interpretar.
 *
 * ORIENTACIÓN EXIF: se pide `imageOrientation: "from-image"` para que las
 * fotos verticales de celular no lleguen acostadas. El canvas descarta el EXIF
 * al exportar, así que la rotación tiene que aplicarse al decodificar.
 *
 * NUNCA LANZA POR UN FORMATO QUE NO ENTIENDE: si el navegador no sabe decodificar
 * el archivo (el caso típico es un HEIC de iPhone abierto en Chrome de
 * escritorio), devuelve el original marcado como `comprimida: false` para que
 * la subida siga adelante. Perder una foto por no poder encogerla sería peor
 * que subirla pesada.
 */

/** Resultado de comprimir un archivo. El original nunca se modifica. */
export type FotoComprimida = {
  blob: Blob;
  contentType: string;
  /** Extensión sugerida para el nombre en Storage, sin punto. */
  extension: string;
  anchoPx: number | null;
  altoPx: number | null;
  bytes: number;
  bytesOriginal: number;
  /** `false` si se devolvió el archivo original tal cual. */
  comprimida: boolean;
  /** Explicación legible cuando no se pudo comprimir. */
  nota?: string;
};

export type OpcionesCompresion = {
  /** Lado mayor máximo, en píxeles. 2200 cubre una ficha a pantalla completa en retina. */
  ladoMaximo?: number;
  /** Tamaño objetivo. Se baja la calidad por pasos hasta alcanzarlo. */
  bytesObjetivo?: number;
  /** Calidades a intentar, de mejor a peor. */
  calidades?: readonly number[];
};

const LADO_MAXIMO = 2200;
const BYTES_OBJETIVO = 900 * 1024;
const CALIDADES = [0.86, 0.8, 0.72, 0.64, 0.56] as const;

/** Tope del bucket `vehiculos` (ver migración 20260915090300). */
export const BYTES_MAXIMOS_SUBIDA = 15 * 1024 * 1024;

/** MIME aceptados por el bucket. Cualquier otro se rechaza antes de tocar la red. */
export const TIPOS_ACEPTADOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
] as const;

const EXTENSION_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heic",
};

/**
 * ¿El archivo parece una foto que podemos subir?
 *
 * Se mira el MIME y, como respaldo, la extensión: iOS a veces entrega HEIC con
 * el tipo vacío, y descartar la foto del cliente por un `type` en blanco sería
 * absurdo.
 */
export function esArchivoDeFotoValido(file: File): boolean {
  const tipo = (file.type || "").toLowerCase();
  if ((TIPOS_ACEPTADOS as readonly string[]).includes(tipo)) return true;
  if (tipo.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|avif|heic|heif)$/i.test(file.name);
}

export function formatearBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionDe(contentType: string, nombre: string): string {
  const porTipo = EXTENSION_POR_TIPO[contentType.toLowerCase()];
  if (porTipo) return porTipo;
  const match = /\.([a-z0-9]{2,5})$/i.exec(nombre);
  return match ? match[1].toLowerCase() : "jpg";
}

type Decodificada = {
  fuente: CanvasImageSource;
  ancho: number;
  alto: number;
  liberar: () => void;
};

/**
 * Decodifica respetando la orientación EXIF.
 *
 * `createImageBitmap` es el camino rápido y el único que aplica la orientación
 * sin leer el EXIF a mano. El respaldo con `<img>` existe para navegadores que
 * no soportan la opción; ahí la orientación ya viene aplicada por el propio
 * navegador al renderizar.
 */
async function decodificar(file: File): Promise<Decodificada> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        fuente: bitmap,
        ancho: bitmap.width,
        alto: bitmap.height,
        liberar: () => bitmap.close(),
      };
    } catch {
      // Sigue al respaldo: puede ser un HEIC que este navegador no decodifica.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("formato-no-soportado"));
      el.src = url;
    });
    return {
      fuente: img,
      ancho: img.naturalWidth,
      alto: img.naturalHeight,
      liberar: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function aBlob(
  canvas: HTMLCanvasElement,
  tipo: string,
  calidad: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, tipo, calidad));
}

/**
 * ¿El navegador sabe exportar WebP? Safari viejo dice que sí y devuelve PNG,
 * así que no se pregunta: se exporta y se mira el `type` del blob resultante.
 * WebP pesa ~30% menos que JPEG a la misma calidad percibida.
 */
async function elegirFormatoSalida(
  canvas: HTMLCanvasElement,
): Promise<"image/webp" | "image/jpeg"> {
  const prueba = await aBlob(canvas, "image/webp", 0.8);
  return prueba && prueba.type === "image/webp" ? "image/webp" : "image/jpeg";
}

/**
 * Reduce y recomprime una foto. Devuelve el original (sin lanzar) cuando
 * comprimir no aporta o no es posible.
 */
export async function comprimirFoto(
  file: File,
  opciones: OpcionesCompresion = {},
): Promise<FotoComprimida> {
  const ladoMaximo = opciones.ladoMaximo ?? LADO_MAXIMO;
  const bytesObjetivo = opciones.bytesObjetivo ?? BYTES_OBJETIVO;
  const calidades = opciones.calidades ?? CALIDADES;

  const original = (): FotoComprimida => ({
    blob: file,
    contentType: file.type || "image/jpeg",
    extension: extensionDe(file.type || "", file.name),
    anchoPx: null,
    altoPx: null,
    bytes: file.size,
    bytesOriginal: file.size,
    comprimida: false,
  });

  let decodificada: Decodificada;
  try {
    decodificada = await decodificar(file);
  } catch {
    return {
      ...original(),
      nota:
        "Este navegador no puede procesar el formato (suele pasar con HEIC fuera de iPhone). Se sube el archivo original, sin comprimir.",
    };
  }

  try {
    const { fuente, ancho, alto } = decodificada;
    if (!ancho || !alto) return original();

    const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto));
    const anchoFinal = Math.max(1, Math.round(ancho * escala));
    const altoFinal = Math.max(1, Math.round(alto * escala));

    const canvas = document.createElement("canvas");
    canvas.width = anchoFinal;
    canvas.height = altoFinal;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return original();

    // `imageSmoothingQuality` cambia de verdad el resultado al reducir mucho:
    // sin él, una foto de 4000 px bajada a 2200 sale con bordes dentados.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(fuente, 0, 0, anchoFinal, altoFinal);

    const tipoSalida = await elegirFormatoSalida(canvas);

    let mejor: Blob | null = null;
    for (const calidad of calidades) {
      const blob = await aBlob(canvas, tipoSalida, calidad);
      if (!blob) continue;
      mejor = blob;
      if (blob.size <= bytesObjetivo) break;
    }

    if (!mejor) return original();

    // Si recomprimir no ganó nada (foto ya optimizada, o PNG de pantalla que
    // engorda al pasar a JPEG), se queda el original: menos pérdida, menos peso.
    if (mejor.size >= file.size && escala === 1) {
      return {
        ...original(),
        anchoPx: ancho,
        altoPx: alto,
        nota: "La foto ya estaba optimizada: se sube tal cual.",
      };
    }

    return {
      blob: mejor,
      contentType: tipoSalida,
      extension: tipoSalida === "image/webp" ? "webp" : "jpg",
      anchoPx: anchoFinal,
      altoPx: altoFinal,
      bytes: mejor.size,
      bytesOriginal: file.size,
      comprimida: true,
    };
  } catch {
    return {
      ...original(),
      nota: "No se pudo comprimir en este dispositivo. Se sube el original.",
    };
  } finally {
    decodificada.liberar();
  }
}
