"use client";

/**
 * Acceso al portal.
 *
 * Autenticación 100% delegada a Neon Auth (`signInWithPassword`):
 *   - No se guarda ninguna contraseña, ni en claro ni con hash.
 *   - No se emite ningún token propio.
 *   - La sesión la persiste y la refresca el SDK de Neon, con una cookie que
 *     deja el puente `/api/auth` en este mismo dominio.
 *
 * El registro público vive en /cuenta/login (clientes). Acá no hay registro:
 * una cuenta entra al portal solo si su perfil tiene rol `admin`, y ese rol
 * lo asigna otro administrador desde /portal/usuarios. Si la sesión es de un
 * cliente, se cierra en el acto y se explica.
 *
 * La contraseña la define o la restablece cada quien en /portal/recuperar,
 * con un enlace que Neon Auth manda a su correo.
 *
 * Neon Auth exige el correo verificado. Una cuenta que el dueño dio de alta
 * desde la consola nace sin verificar: la primera vez que entra se le envía
 * un código de seis dígitos y se le pide acá mismo (`VerificarCorreo`).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VerificarCorreo } from "@/components/auth/VerificarCorreo";
import { enviarCodigoDeVerificacion, esCorreoSinVerificar } from "@/lib/auth/verificacion";
import { fetchOwnProfileResult } from "@/lib/auth/perfil";
import {
  avisarCambioDeSesion,
  describeAuthError,
  getPortalAuthMissingEnv,
  getPortalClient,
  isPortalAuthConfigured,
} from "@/lib/portal/portalClient";

export function PortalLoginForm() {
  const router = useRouter();
  const configured = isPortalAuthConfigured();
  const missing = getPortalAuthMissingEnv();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Cuenta que está esperando el código de verificación del correo. */
  const [porVerificar, setPorVerificar] = useState<{ email: string; envioOk: boolean } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const correo = email.trim();
    if (!correo || !password) {
      setError("Completa el correo y la contraseña.");
      return;
    }

    // Sin configuración no hay a quién preguntarle. Se dice exactamente eso,
    // en vez de fingir un error de credenciales.
    const client = getPortalClient();
    if (!client) {
      setError(
        `El acceso no está configurado en este despliegue. Falta definir ${
          missing.join(" y ") || "las variables de Neon"
        } en Vercel → Environment Variables (ver .env.example) y volver a desplegar.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error: authError } = await client.auth.signInWithPassword({
        email: correo,
        password,
      });

      if (authError) {
        // Cuenta sin verificar: se le manda el código y se le pide acá.
        if (esCorreoSinVerificar(authError)) {
          setPassword("");
          const envio = await enviarCodigoDeVerificacion(correo);
          setPorVerificar({ email: correo, envioOk: envio.ok });
          return;
        }
        setError(describeAuthError(authError.message));
        return;
      }

      await entrarAlPortal(client);
    } catch (caught) {
      setError(
        describeAuthError(
          caught instanceof Error ? caught.message : String(caught),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Con la sesión ya abierta (por contraseña o por haber confirmado el código),
   * decide si esta cuenta entra al portal.
   */
  async function entrarAlPortal(client: NonNullable<ReturnType<typeof getPortalClient>>) {
    // Solo entra un administrador. Un cliente con sesión válida vería un
    // portal vacío (RLS), así que se le cierra la sesión y se le explica.
    // Pero si la LECTURA del perfil falla (token, base dormida, red) no se
    // sabe qué rol tiene: ahí no se cierra la sesión ni se dice "no es del
    // equipo", se pide reintentar. La contraseña se conserva para ese caso:
    // reintentar es volver a pulsar «Entrar».
    const result = await fetchOwnProfileResult(client);
    if (result.status === "error") {
      setError(
        "Tu contraseña es correcta, pero no pudimos verificar tu cuenta en este momento. Revisa la conexión y vuelve a pulsar «Entrar».",
      );
      return;
    }

    // La contraseña no queda en memoria más de lo necesario.
    setPassword("");

    const profile = result.status === "ok" ? result.profile : null;
    if (!profile || profile.role !== "admin" || !profile.active) {
      // `signOut()` puede devolver `{ error }` sin lanzar; igual se avisa
      // para que las pantallas relean el estado real de la sesión.
      await client.auth.signOut();
      await avisarCambioDeSesion();
      setError(
        "Esta cuenta no es del equipo. Si eres cliente, tus solicitudes están en luxcars.pe/cuenta. Si eres del equipo, pide a un administrador que te asigne el rol.",
      );
      return;
    }
    await avisarCambioDeSesion();
    router.replace("/portal");
  }

  /** El código fue correcto: Neon Auth ya abrió la sesión. */
  async function alVerificar() {
    const client = getPortalClient();
    if (!client) return;
    setPorVerificar(null);
    try {
      // El código se confirmó sin pasar por el SDK: se le hace releer la sesión.
      await client.auth.getSession({ forceFetch: true }).catch(() => null);
      await entrarAlPortal(client);
    } catch (caught) {
      setError(
        describeAuthError(
          caught instanceof Error ? caught.message : String(caught),
        ),
      );
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <p className="flex items-baseline justify-center gap-2">
          <span className="text-lg font-semibold tracking-[0.34em] text-ink">
            LUX
          </span>
          <span className="text-lg font-light tracking-[0.34em] text-silver">
            CARS
          </span>
        </p>
        <p className="mt-3 text-[0.62rem] uppercase tracking-[0.22em] text-ink-4">
          Portal interno
        </p>
      </div>

      {porVerificar ? (
        <div className="rounded-lux-lg border border-line bg-surface px-6 py-7">
          <VerificarCorreo
            email={porVerificar.email}
            variante="portal"
            envioInicialOk={porVerificar.envioOk}
            onVerificado={alVerificar}
            onCancelar={() => setPorVerificar(null)}
          />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-lux-lg border border-line bg-surface px-6 py-7"
          noValidate
        >
          <h1 className="text-base font-medium text-ink">Acceso del equipo</h1>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            Uso exclusivo de LUX CARS IMPORT S.A.C. Si eres cliente, entra por{" "}
            <Link href="/cuenta/login" className="text-silver underline underline-offset-4">
              luxcars.pe/cuenta
            </Link>
            .
          </p>

          {!configured ? (
            <p
              role="status"
              className="mt-5 rounded-lux border border-warn/40 bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-2"
            >
              <span className="text-warn">Falta configurar Neon.</span> El
              formulario funciona, pero no hay servidor de autenticación al que
              preguntar. Define{" "}
              {missing.map((key, index) => (
                <span key={key}>
                  {index > 0 ? ", " : ""}
                  <code className="text-silver">{key}</code>
                </span>
              ))}{" "}
              en Vercel → Environment Variables y vuelve a desplegar. Detalle en{" "}
              <code className="text-silver">.env.example</code>.
            </p>
          ) : null}

          {/* Los dos campos tenían `focus:outline-none`. En la pantalla de acceso
              eso es especialmente grave: sin anillo de foco no se sabe en qué
              campo se está escribiendo, y el único indicio que quedaba era el
              borde pasando de `line` a `line-strong`, 1 px de diferencia de gris
              (WCAG 2.4.7). Ahora manda el anillo global de globals.css. */}
          <div className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="portal-email"
                className="block text-[0.62rem] uppercase tracking-[0.18em] text-ink-3"
              >
                Correo
              </label>
              <input
                id="portal-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-lux border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-line-strong"
                placeholder="nombre@luxcars.pe"
              />
            </div>

            <div>
              <label
                htmlFor="portal-password"
                className="block text-[0.62rem] uppercase tracking-[0.18em] text-ink-3"
              >
                Contraseña
              </label>
              <input
                id="portal-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lux border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-line-strong"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-lux border border-danger/40 bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2"
            >
              {error}
            </p>
          ) : null}

          {/* Único elemento dorado de la pantalla: la acción que convierte. */}
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-lux bg-ink px-4 py-3 text-sm font-medium text-void transition-colors hover:bg-silver-bright disabled:opacity-60"
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>

          <p className="mt-5 text-[0.68rem] leading-relaxed text-ink-4">
            Solo entran cuentas con rol de administrador, asignado desde
            Usuarios en el portal. Si es tu primera vez o la olvidaste,{" "}
            <Link
              href="/portal/recuperar"
              className="text-ink-3 underline underline-offset-4 transition-colors hover:text-silver"
            >
              crea o recupera tu contraseña
            </Link>
            .
          </p>
        </form>
      )}

      <p className="mt-6 text-center text-xs text-ink-4">
        <Link
          href="/"
          className="underline underline-offset-4 transition-colors hover:text-silver"
        >
          Volver al sitio público
        </Link>
      </p>
    </div>
  );
}
