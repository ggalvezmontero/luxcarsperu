"use client";

/**
 * Crear o recuperar la contraseña del portal.
 *
 * Es el único camino para tener contraseña: el administrador da de alta a cada
 * persona solo con su correo (consola de Neon → Auth → Users) y nadie le dicta
 * una clave a nadie. La misma pantalla sirve el día que alguien la olvida.
 *
 * Dos pasos, los dos resueltos por Neon Auth (ver `lib/auth/recuperacion.ts`):
 *   1. Sin `token`: se pide el correo y Neon envía un enlace.
 *   2. Con `token` (se llega desde el enlace): se define la contraseña nueva.
 *
 * El cliente del sitio tiene su propia pantalla, `/cuenta/recuperar`, con la
 * misma lógica.
 */

import { useState } from "react";
import Link from "next/link";

import {
  LARGO_MINIMO_CONTRASENA as LARGO_MINIMO,
  VIGENCIA_DEL_ENLACE,
  describirErrorDeRecuperacion as describir,
  guardarContrasenaNueva,
  pedirEnlaceDeRecuperacion,
} from "@/lib/auth/recuperacion";

/** Pantalla a la que vuelve el enlace del correo. */
const RUTA_DE_RETORNO = "/portal/recuperar";

const CLASE_CAMPO =
  "mt-2 w-full rounded-lux border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-4 focus:border-line-strong";
const CLASE_ETIQUETA =
  "block text-[0.62rem] uppercase tracking-[0.18em] text-ink-3";

export function PortalRecoveryForm({
  token,
  enlaceInvalido,
}: {
  /** Token del enlace del correo. Sin él se muestra el paso de pedir el enlace. */
  token: string | null;
  /** El enlace del correo ya no sirve (vencido o usado). */
  enlaceInvalido: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(
    enlaceInvalido ? describir("invalid_token") : null,
  );
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<"enlace" | "contrasena" | null>(null);

  async function pedirEnlace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const correo = email.trim();
    if (!correo) {
      setError("Escribe tu correo.");
      return;
    }

    setEnviando(true);
    const resultado = await pedirEnlaceDeRecuperacion(correo, RUTA_DE_RETORNO);
    setEnviando(false);

    if (!resultado.ok) {
      setError(describir(resultado.codigo));
      return;
    }
    setListo("enlace");
  }

  async function guardarContrasena(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < LARGO_MINIMO) {
      setError(`La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`);
      return;
    }
    if (password !== confirmacion) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    const resultado = await guardarContrasenaNueva(token ?? "", password);
    setEnviando(false);

    if (!resultado.ok) {
      setError(describir(resultado.codigo));
      return;
    }
    // La contraseña no queda en memoria más de lo necesario.
    setPassword("");
    setConfirmacion("");
    setListo("contrasena");
  }

  const pideContrasena = token !== null && !enlaceInvalido;

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

      <div className="rounded-lux-lg border border-line bg-surface px-6 py-7">
        <h1 className="text-base font-medium text-ink">
          {pideContrasena ? "Define tu contraseña" : "Crear o recuperar contraseña"}
        </h1>

        {listo === "enlace" ? (
          <p role="status" className="mt-3 text-sm leading-relaxed text-ink-2">
            Si ese correo es de alguien del equipo, en un momento llega un
            enlace para definir la contraseña. Vence en {VIGENCIA_DEL_ENLACE};
            revisa también la carpeta de spam.
          </p>
        ) : listo === "contrasena" ? (
          <>
            <p role="status" className="mt-3 text-sm leading-relaxed text-ink-2">
              Contraseña guardada. Ya puedes entrar al portal con ella.
            </p>
            <Link
              href="/portal/login"
              className="mt-6 block w-full rounded-lux bg-ink px-4 py-3 text-center text-sm font-medium text-void transition-colors hover:bg-silver-bright"
            >
              Ir al acceso
            </Link>
          </>
        ) : pideContrasena ? (
          <form onSubmit={guardarContrasena} noValidate>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              Mínimo {LARGO_MINIMO} caracteres. No la compartas: cada persona
              del equipo tiene la suya.
            </p>
            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="portal-nueva" className={CLASE_ETIQUETA}>
                  Contraseña nueva
                </label>
                <input
                  id="portal-nueva"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={LARGO_MINIMO}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={CLASE_CAMPO}
                />
              </div>
              <div>
                <label htmlFor="portal-confirmacion" className={CLASE_ETIQUETA}>
                  Repite la contraseña
                </label>
                <input
                  id="portal-confirmacion"
                  name="password-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={LARGO_MINIMO}
                  value={confirmacion}
                  onChange={(event) => setConfirmacion(event.target.value)}
                  className={CLASE_CAMPO}
                />
              </div>
            </div>

            {error ? <Aviso>{error}</Aviso> : null}

            <button
              type="submit"
              disabled={enviando}
              className="mt-6 w-full rounded-lux bg-ink px-4 py-3 text-sm font-medium text-void transition-colors hover:bg-silver-bright disabled:opacity-60"
            >
              {enviando ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        ) : (
          <form onSubmit={pedirEnlace} noValidate>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              Escribe el correo con el que el administrador te dio de alta. Te
              enviamos un enlace para definir tu contraseña.
            </p>
            <div className="mt-6">
              <label htmlFor="portal-correo" className={CLASE_ETIQUETA}>
                Correo
              </label>
              <input
                id="portal-correo"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={CLASE_CAMPO}
                placeholder="nombre@luxcars.pe"
              />
            </div>

            {error ? <Aviso>{error}</Aviso> : null}

            <button
              type="submit"
              disabled={enviando}
              className="mt-6 w-full rounded-lux bg-ink px-4 py-3 text-sm font-medium text-void transition-colors hover:bg-silver-bright disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Enviar enlace"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-ink-4">
        <Link
          href="/portal/login"
          className="underline underline-offset-4 transition-colors hover:text-silver"
        >
          Volver al acceso
        </Link>
      </p>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-lux border border-danger/40 bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2"
    >
      {children}
    </p>
  );
}
