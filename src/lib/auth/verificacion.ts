/**
 * Verificación del correo con un código de seis dígitos.
 *
 * Neon Auth está configurado para exigir el correo verificado antes de dejar
 * entrar. Quien se registra (o quien entra con una cuenta todavía sin
 * verificar) recibe un código por correo y lo escribe acá mismo; al
 * confirmarlo, Neon Auth abre la sesión.
 *
 * Por qué importa más allá de la molestia: sin verificación, cualquiera podía
 * crear una cuenta con el correo de otra persona. Con ella, tener una cuenta
 * con un correo prueba que se lee ese buzón.
 *
 * El código lo envía y lo comprueba Neon Auth; acá no se genera ni se guarda.
 */

import { llamarAuth, type ResultadoAuth } from "@/lib/auth/puente";

/** Cuántos dígitos trae el código. */
export const LARGO_DEL_CODIGO = 6;

/** Cuánto dura el código, para decirlo en pantalla. */
export const VIGENCIA_DEL_CODIGO = "10 minutos";

/** Pide que se envíe (o reenvíe) el código al correo. */
export function enviarCodigoDeVerificacion(email: string): Promise<ResultadoAuth> {
  return llamarAuth("/email-otp/send-verification-otp", {
    email,
    type: "email-verification",
  });
}

/** Confirma el código. Si es correcto, Neon Auth deja la sesión abierta. */
export function confirmarCodigoDeVerificacion(
  email: string,
  codigo: string,
): Promise<ResultadoAuth> {
  return llamarAuth("/email-otp/verify-email", { email, otp: codigo });
}

/**
 * ¿Este error de inicio de sesión es "todavía no verificaste tu correo"?
 *
 * Se mira el código antes que el texto: el SDK lo entrega como
 * `email_not_confirmed` con el mensaje "Email verification required", y Neon
 * Auth, sin SDK de por medio, como `EMAIL_NOT_VERIFIED` / "Email not verified".
 */
export function esCorreoSinVerificar(error: { message?: unknown; code?: unknown }): boolean {
  const codigo = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (codigo === "email_not_confirmed" || codigo === "email_not_verified") return true;
  const mensaje = typeof error.message === "string" ? error.message : "";
  return /verification required|not[ _]verified|not[ _]confirmed/i.test(mensaje);
}

export function describirErrorDeVerificacion(codigo: string): string {
  const raw = codigo.toLowerCase();
  if (raw.includes("invalid_otp")) {
    return "Ese código no es correcto. Revisa el correo más reciente: cada código nuevo anula el anterior.";
  }
  if (raw.includes("expired")) {
    return `El código venció (dura ${VIGENCIA_DEL_CODIGO}). Pide uno nuevo.`;
  }
  if (raw.includes("too_many") || raw === "429") {
    return "Demasiados intentos. Pide un código nuevo y vuelve a intentar.";
  }
  if (raw.includes("portal_sin_configurar") || raw === "503") {
    return "El acceso no está configurado en este despliegue. Avísale al administrador.";
  }
  if (raw === "red") {
    return "No se pudo contactar al servicio de acceso. Revisa la conexión y vuelve a intentar.";
  }
  return "No se pudo confirmar el código. Intenta de nuevo.";
}
