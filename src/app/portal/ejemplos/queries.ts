/**
 * Ejemplos de importación a pedido (`public.ejemplos_importacion`, migración
 * 20261106100000). DESDE EL NAVEGADOR con la sesión de un administrador: las
 * políticas "el equipo lee todo / inserta / actualiza / borra" exigen
 * `es_admin()`. Sin rol admin, cero filas y cero escrituras.
 *
 * `datos` es el `TrendingVehicle` completo que pinta la web. NUNCA se escribe
 * un objeto que no haya salido de `validarEjemplo` como `vehiculo`: por eso
 * las funciones de escritura reciben `TrendingVehicle` y no un formulario.
 *
 * Después de CADA escritura que sale bien la pantalla llama a
 * `revalidarWeb()`: la home y /importar son páginas generadas y sin ese aviso
 * seguirían mostrando la lista anterior.
 *
 * NINGUNA FUNCIÓN LANZA.
 */

import type { TrendingVehicle } from "@/data/trendingVehicles";
import { validarEjemplo } from "@/lib/importExamples/validacion";
import type { PortalAuthSession, PortalClient } from "@/lib/portal/portalClient";

const TABLA = "ejemplos_importacion";
const COLUMNAS = "id, orden, activo, datos, updated_at";

/** Separación entre posiciones al reordenar: 10, 20, 30… */
export const PASO_ORDEN = 10;

type FilaEjemplo = {
  id: string;
  orden: number | null;
  activo: boolean | null;
  datos: unknown;
  updated_at: string | null;
};

export type Ejemplo = {
  id: string;
  orden: number;
  activo: boolean;
  /** `datos` tal como está en la base, para precargar el formulario aunque no valide. */
  datos: Record<string, unknown>;
  /** El objeto normalizado si cumple las reglas; `null` si la web lo descarta. */
  vehiculo: TrendingVehicle | null;
  /** Por qué la web lo descarta (mensaje de `validarEjemplo`); `null` si es válido. */
  problema: string | null;
  updatedAt: string | null;
};

export type EjemplosQueryResult = { ejemplos: Ejemplo[]; error: string | null };
export type EjemploMutationResult = { ok: boolean; message: string; campo?: string };

function mapear(fila: FilaEjemplo): Ejemplo {
  const datos =
    fila.datos && typeof fila.datos === "object" && !Array.isArray(fila.datos)
      ? (fila.datos as Record<string, unknown>)
      : {};
  // La web valida otra vez al leer y descarta lo que no cumple: el portal hace
  // lo mismo para que "En la portada" diga la verdad.
  const v = validarEjemplo(datos);
  return {
    id: fila.id,
    orden: typeof fila.orden === "number" ? fila.orden : 0,
    activo: fila.activo !== false,
    datos,
    vehiculo: v.ok ? v.vehiculo : null,
    problema: v.ok ? null : v.error,
    updatedAt: fila.updated_at,
  };
}

/** Id de quien tiene la sesión, para `updated_by`. El SDK deja `client.auth` sin tipo. */
async function usuarioActual(client: PortalClient): Promise<string | null> {
  try {
    const { data } = (await client.auth.getSession()) as { data: { session: PortalAuthSession } };
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

function describirError(error: { message: string; code?: string }, accion: string): string {
  const texto = error.message.toLowerCase();
  if (error.code === "23505" || texto.includes("duplicate key")) {
    return "Ya existe un ejemplo con ese identificador. Elige otro.";
  }
  if (error.code === "42501" || texto.includes("row-level security") || texto.includes("permission denied")) {
    return "Tu sesión no tiene permiso para esto o caducó. Cierra sesión y vuelve a entrar.";
  }
  if (texto.includes("jwt") || texto.includes("expired")) {
    return "La sesión caducó. Vuelve a iniciar sesión.";
  }
  if (error.code === "42P01" || texto.includes("does not exist")) {
    return "Falta la tabla de ejemplos: aplica la migración 20261106100000_ejemplos_importacion.sql.";
  }
  // Los mensajes de los triggers ya vienen en español (ej. el id fijo).
  if (/[áéíóñ]|identificador|ejemplo/i.test(error.message)) return error.message;
  return `La base de datos rechazó ${accion}. ${error.message}`;
}

export async function fetchEjemplos(client: PortalClient): Promise<EjemplosQueryResult> {
  try {
    const { data, error } = await client
      .from(TABLA)
      .select(COLUMNAS)
      // Mismo orden que el índice `ejemplos_importacion_orden_idx` y que la web.
      .order("orden", { ascending: true })
      .order("id", { ascending: true })
      .limit(200);
    if (error) {
      return { ejemplos: [], error: describirError(error, "la lectura") };
    }
    return { ejemplos: ((data ?? []) as unknown as FilaEjemplo[]).map(mapear), error: null };
  } catch {
    return { ejemplos: [], error: "No se pudieron leer los ejemplos. Revisa tu conexión." };
  }
}

/** Crea un ejemplo nuevo, visible, en la posición `orden` (normalmente al final). */
export async function crearEjemplo(
  client: PortalClient,
  input: { vehiculo: TrendingVehicle; orden: number },
): Promise<EjemploMutationResult> {
  try {
    const updatedBy = await usuarioActual(client);
    const { error } = await client.from(TABLA).insert({
      id: input.vehiculo.id,
      orden: input.orden,
      activo: true,
      datos: input.vehiculo,
      ...(updatedBy ? { updated_by: updatedBy } : {}),
    });
    if (error) {
      const message = describirError(error, "el ejemplo");
      return { ok: false, message, campo: message.startsWith("Ya existe") ? "id" : undefined };
    }
    return { ok: true, message: `"${input.vehiculo.name}" se agregó al final de la lista.` };
  } catch {
    return { ok: false, message: "No se pudo crear el ejemplo. Revisa tu conexión." };
  }
}

/**
 * Guarda los cambios de un ejemplo. Solo viaja `datos` (y `updated_by`): el
 * `id` es parte del enlace público y el trigger `tg_ejemplo_id_fijo` rechaza
 * cambiarlo; `orden` y `activo` tienen sus propias acciones.
 */
export async function guardarEjemplo(
  client: PortalClient,
  input: { id: string; vehiculo: TrendingVehicle },
): Promise<EjemploMutationResult> {
  // La base exige `datos->>'id' = id`: se corta acá con un mensaje claro.
  if (input.vehiculo.id !== input.id) {
    return { ok: false, message: "El identificador no se puede cambiar.", campo: "id" };
  }
  try {
    const updatedBy = await usuarioActual(client);
    const { data, error } = await client
      .from(TABLA)
      .update({ datos: input.vehiculo, ...(updatedBy ? { updated_by: updatedBy } : {}) })
      .eq("id", input.id)
      .select("id");
    if (error) return { ok: false, message: describirError(error, "los cambios") };
    // Sin fila devuelta no se guardó nada: lo borró otra persona o RLS lo filtró.
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, message: "No se encontró el ejemplo: puede que lo hayan eliminado. Recarga la lista." };
    }
    return { ok: true, message: `Cambios de "${input.vehiculo.name}" guardados.` };
  } catch {
    return { ok: false, message: "No se pudieron guardar los cambios. Revisa tu conexión." };
  }
}

/** Muestra u oculta un ejemplo en la web. Se conserva para volver a usarlo. */
export async function cambiarVisibilidad(
  client: PortalClient,
  input: { id: string; activo: boolean; nombre: string },
): Promise<EjemploMutationResult> {
  try {
    const updatedBy = await usuarioActual(client);
    const { data, error } = await client
      .from(TABLA)
      .update({ activo: input.activo, ...(updatedBy ? { updated_by: updatedBy } : {}) })
      .eq("id", input.id)
      .select("id");
    if (error) return { ok: false, message: describirError(error, "el cambio") };
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, message: "No se encontró el ejemplo. Recarga la lista." };
    }
    return {
      ok: true,
      message: input.activo
        ? `"${input.nombre}" vuelve a mostrarse en la web.`
        : `"${input.nombre}" quedó oculto. No se borró: puedes volver a mostrarlo cuando quieras.`,
    };
  } catch {
    return { ok: false, message: "No se pudo cambiar la visibilidad. Revisa tu conexión." };
  }
}

/**
 * Guarda el orden de la lista. `ids` va en el orden final que se ve en
 * pantalla; cada uno queda en 10, 20, 30… para que los valores no se
 * amontonen con el tiempo. Solo se escriben las filas cuyo número cambia.
 *
 * Son varios UPDATE seguidos (la Data API no tiene transacción desde el
 * navegador). Si uno falla a mitad, la lista queda con un orden parcial pero
 * coherente —ningún ejemplo se pierde— y la pantalla recarga lo que quedó.
 */
export async function guardarOrden(
  client: PortalClient,
  input: { ids: string[]; ordenActual: Record<string, number> },
): Promise<EjemploMutationResult> {
  try {
    const updatedBy = await usuarioActual(client);
    for (let i = 0; i < input.ids.length; i += 1) {
      const id = input.ids[i];
      const orden = (i + 1) * PASO_ORDEN;
      if (input.ordenActual[id] === orden) continue;
      const { error } = await client
        .from(TABLA)
        .update({ orden, ...(updatedBy ? { updated_by: updatedBy } : {}) })
        .eq("id", id);
      if (error) {
        return { ok: false, message: `${describirError(error, "el orden")} El orden quedó a medias: revisa la lista.` };
      }
    }
    return { ok: true, message: "Orden guardado." };
  } catch {
    return { ok: false, message: "No se pudo guardar el orden. Revisa tu conexión y la lista." };
  }
}

/** Elimina un ejemplo para siempre. Su enlace `/?simular=<id>` deja de funcionar. */
export async function eliminarEjemplo(
  client: PortalClient,
  input: { id: string; nombre: string },
): Promise<EjemploMutationResult> {
  try {
    const { data, error } = await client.from(TABLA).delete().eq("id", input.id).select("id");
    if (error) return { ok: false, message: describirError(error, "el borrado") };
    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, message: "No se encontró el ejemplo: puede que ya lo hayan eliminado. Recarga la lista." };
    }
    return { ok: true, message: `"${input.nombre}" se eliminó.` };
  } catch {
    return { ok: false, message: "No se pudo eliminar. Revisa tu conexión." };
  }
}

/**
 * ¿Algún ejemplo usa todavía esta foto? Antes de borrar un archivo del bucket
 * se pregunta: si la respuesta es "sí" o no se puede preguntar, el archivo se
 * deja. Un archivo huérfano cuesta centavos; una tarjeta con la foto rota en
 * la home cuesta confianza.
 */
export async function fotoEnUso(client: PortalClient, src: string): Promise<boolean> {
  try {
    const { data, error } = await client.from(TABLA).select("id").eq("datos->>imageSrc", src).limit(1);
    if (error) return true;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return true;
  }
}

/**
 * Pide a la web que regenere las páginas que muestran los ejemplos (home,
 * /importar). Si falla, lo guardado sigue guardado: la web se pone al día
 * sola cuando vence su caché.
 */
export async function revalidarWeb(): Promise<{ ok: boolean; mensaje?: string }> {
  try {
    const respuesta = await fetch("/api/portal/ejemplos/revalidar", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    let cuerpo: { ok?: unknown; mensaje?: unknown } = {};
    try {
      cuerpo = (await respuesta.json()) as typeof cuerpo;
    } catch {
      // Sin cuerpo JSON: decide el código HTTP.
    }
    const mensaje = typeof cuerpo.mensaje === "string" ? cuerpo.mensaje : undefined;
    return { ok: respuesta.ok && cuerpo.ok !== false, mensaje };
  } catch {
    return { ok: false };
  }
}
