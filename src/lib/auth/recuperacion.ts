/**
 * Crear o recuperar la contraseña, para el portal y para la cuenta del cliente.
 *
 * Las dos pantallas (`/portal/recuperar` y `/cuenta/recuperar`) hacen lo mismo
 * contra Neon Auth, a través del puente `/api/auth`:
 *
 *   1. Se pide un enlace por correo. La respuesta es la misma exista o no la
 *      cuenta, a propósito: no se le confirma a un extraño qué correos tienen
 *      cuenta.
 *   2. El enlace vuelve a la pantalla que lo pidió con `?token=…` (o con
 *      `?error=…` si venció o ya se usó) y ahí se define la contraseña nueva.
 *
 * Acá no se guarda ni se compara ninguna contraseña.
 */

import { llamarAuth, type ResultadoAuth } from "@/lib/auth/puente";

/** Mínimo que acepta Neon Auth. */
export const LARGO_MINIMO_CONTRASENA = 8;

/** Cuánto dura el enlace del correo, para decirlo en pantalla. */
export const VIGENCIA_DEL_ENLACE = "una hora";

export type ResultadoRecuperacion = ResultadoAuth;

/**
 * Pide el enlace. `rutaDeRetorno` es la pantalla de este sitio a la que debe
 * volver el enlace del correo (`/portal/recuperar` o `/cuenta/recuperar`).
 */
export function pedirEnlaceDeRecuperacion(
  email: string,
  rutaDeRetorno: string,
): Promise<ResultadoRecuperacion> {
  return llamarAuth("/request-password-reset", {
    email,
    redirectTo: `${window.location.origin}${rutaDeRetorno}`,
  });
}

/** Define la contraseña nueva con el token que trajo el enlace del correo. */
export function guardarContrasenaNueva(
  token: string,
  password: string,
): Promise<ResultadoRecuperacion> {
  return llamarAuth("/reset-password", { newPassword: password, token });
}

export function describirErrorDeRecuperacion(codigo: string): string {
  const raw = codigo.toLowerCase();
  if (raw.includes("invalid_token")) {
    return `El enlace venció o ya se usó. Pide uno nuevo: dura ${VIGENCIA_DEL_ENLACE}.`;
  }
  if (raw.includes("password_too_short")) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`;
  }
  if (raw.includes("password_too_long")) {
    return "La contraseña es demasiado larga.";
  }
  if (raw.includes("portal_sin_configurar") || raw === "503") {
    return "El acceso no está configurado en este despliegue. Avísale al administrador.";
  }
  if (raw === "429" || raw.includes("too_many")) {
    return "Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.";
  }
  if (raw === "red") {
    return "No se pudo contactar al servicio de acceso. Revisa la conexión y vuelve a intentar.";
  }
  return "No se pudo completar la operación. Intenta de nuevo.";
}
