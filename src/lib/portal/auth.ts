/**
 * Puerta para Route Handlers del portal que necesiten `service_role`. SOLO SERVIDOR.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * QUÉ NO USA ESTE ARCHIVO, Y POR QUÉ
 * ────────────────────────────────────────────────────────────────────────────
 * La carga de fotos NO pasa por acá. Escribe desde el navegador con la sesión
 * de Supabase Auth del equipo (`src/lib/portal/vehiclePhotos.ts`), porque las
 * políticas de `vehicle_photos` y del bucket `vehiculos` ya otorgan escritura
 * al rol `authenticated`: RLS es el candado y no hace falta saltárselo.
 *
 * Este guard existe para el OTRO caso, el que sí es peligroso: un Route Handler
 * o un componente de servidor que lea o escriba con `SUPABASE_SERVICE_ROLE_KEY`.
 * Esa llave salta TODAS las políticas, así que una ruta así sin control de
 * acceso es el inventario y los leads del dueño abiertos a un `curl`. Hoy leen
 * con `service_role` `src/app/portal/leads/data.ts` y
 * `src/app/portal/vehiculos/data.ts` (ver la nota del layout del portal).
 *
 * DECISIÓN DELIBERADA: sin `PORTAL_ADMIN_TOKEN` configurado, en producción esto
 * NIEGA (503) en vez de dejar pasar. Un portal que no funciona hasta definir una
 * variable es un problema de diez segundos; un portal abierto es un incidente.
 * En `next dev` se permite para no estorbar el desarrollo local.
 *
 * TODO (vía oficial, decisión del dueño porque agrega dependencia): instalar
 * `@supabase/ssr` y validar la sesión real en un `middleware.ts`. Ahí este token
 * compartido se puede borrar. La firma `Promise<ResultadoAcceso>` ya está
 * pensada para ese reemplazo: ningún consumidor tendrá que cambiar.
 */

import { timingSafeEqual } from "node:crypto";

/** Cabecera que envía el portal. Una cabecera propia no viaja en un CSRF. */
export const CABECERA_TOKEN_PORTAL = "x-portal-token";

/** Largo mínimo aceptable del secreto. Un token corto no es un token. */
const LARGO_MINIMO_TOKEN = 16;

export type ResultadoAcceso =
  | { ok: true; modo: "token" | "desarrollo" }
  | {
      ok: false;
      /** 401: falta o no coincide la llave. 503: el portal no está configurado. */
      status: 401 | 503;
      codigo: "sin_token" | "token_invalido" | "portal_sin_configurar";
      mensaje: string;
    };

function tokenConfigurado(): string {
  const valor = (process.env.PORTAL_ADMIN_TOKEN ?? "").trim();
  return valor.length >= LARGO_MINIMO_TOKEN ? valor : "";
}

/** Comparación en tiempo constante: `===` filtra el token carácter a carácter. */
function coincide(entregado: string, esperado: string): boolean {
  const a = Buffer.from(entregado, "utf8");
  const b = Buffer.from(esperado, "utf8");
  // `timingSafeEqual` exige largos iguales; el largo en sí no es secreto.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * ¿Esta petición puede usar una ruta del portal con privilegios de servidor?
 *
 * Nunca lanza: devuelve el motivo para que la ruta conteste algo entendible.
 */
export async function verificarAccesoPortal(
  request: Request,
): Promise<ResultadoAcceso> {
  const esperado = tokenConfigurado();

  if (!esperado) {
    if (process.env.NODE_ENV === "development") {
      return { ok: true, modo: "desarrollo" };
    }
    return {
      ok: false,
      status: 503,
      codigo: "portal_sin_configurar",
      mensaje:
        `Ruta cerrada: falta la variable PORTAL_ADMIN_TOKEN (mínimo ${LARGO_MINIMO_TOKEN} caracteres). ` +
        "Defínela en Vercel → Project Settings → Environment Variables y vuelve a desplegar.",
    };
  }

  const entregado = (request.headers.get(CABECERA_TOKEN_PORTAL) ?? "").trim();

  if (!entregado) {
    return {
      ok: false,
      status: 401,
      codigo: "sin_token",
      mensaje: "Falta la llave del portal.",
    };
  }

  if (!coincide(entregado, esperado)) {
    return {
      ok: false,
      status: 401,
      codigo: "token_invalido",
      mensaje: "La llave del portal no es correcta.",
    };
  }

  return { ok: true, modo: "token" };
}

/** Diagnóstico para la interfaz: dice si hace falta pedir la llave. No la expone. */
export function estadoPuertaPortal(): {
  exigeToken: boolean;
  configurado: boolean;
} {
  const configurado = tokenConfigurado().length > 0;
  return {
    configurado,
    exigeToken: configurado || process.env.NODE_ENV !== "development",
  };
}
