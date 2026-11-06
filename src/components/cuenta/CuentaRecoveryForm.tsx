"use client";

/**
 * Recuperar la contraseña de la cuenta del cliente, sin pedirle ayuda a nadie.
 *
 * Misma lógica que la pantalla del portal (`lib/auth/recuperacion.ts`), con la
 * cara del sitio público: el cliente escribe su correo, recibe un enlace y
 * define la contraseña nueva acá mismo.
 */

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import {
  LARGO_MINIMO_CONTRASENA,
  VIGENCIA_DEL_ENLACE,
  describirErrorDeRecuperacion,
  guardarContrasenaNueva,
  pedirEnlaceDeRecuperacion,
} from "@/lib/auth/recuperacion";
import { LUXCARS_CONFIG } from "@/lib/config";

/** Pantalla a la que vuelve el enlace del correo. */
const RUTA_DE_RETORNO = "/cuenta/recuperar";

export function CuentaRecoveryForm({
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
    enlaceInvalido ? describirErrorDeRecuperacion("invalid_token") : null,
  );
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<"enlace" | "contrasena" | null>(null);

  async function pedirEnlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const correo = email.trim();
    if (!correo) {
      setError("Escribe el correo de tu cuenta.");
      return;
    }

    setEnviando(true);
    const resultado = await pedirEnlaceDeRecuperacion(correo, RUTA_DE_RETORNO);
    setEnviando(false);

    if (!resultado.ok) {
      setError(describirErrorDeRecuperacion(resultado.codigo));
      return;
    }
    setListo("enlace");
  }

  async function guardarContrasena(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < LARGO_MINIMO_CONTRASENA) {
      setError(`La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`);
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
      setError(describirErrorDeRecuperacion(resultado.codigo));
      return;
    }
    // La contraseña no queda en memoria más de lo necesario.
    setPassword("");
    setConfirmacion("");
    setListo("contrasena");
  }

  const pideContrasena = token !== null && !enlaceInvalido;
  const wa = `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`;

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="rounded-[22px] border border-line bg-surface p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-ink">
          {pideContrasena ? "Define tu contraseña nueva" : "Recupera tu contraseña"}
        </h1>

        {listo === "enlace" ? (
          <p role="status" className="mt-4 flex items-start gap-2 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm leading-relaxed text-ink">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-ok" />
            <span>
              Si ese correo tiene cuenta, en un momento te llega un enlace para
              definir la contraseña. Vence en {VIGENCIA_DEL_ENLACE}; revisa
              también la carpeta de spam.
            </span>
          </p>
        ) : listo === "contrasena" ? (
          <>
            <p role="status" className="mt-4 flex items-start gap-2 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm leading-relaxed text-ink">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-ok" />
              <span>Contraseña guardada. Ya puedes entrar a tu cuenta con ella.</span>
            </p>
            <Button href="/cuenta/login" variant="accent" size="lg" className="mt-6 w-full">
              Ingresar
            </Button>
          </>
        ) : pideContrasena ? (
          <form onSubmit={guardarContrasena} noValidate>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
              Mínimo {LARGO_MINIMO_CONTRASENA} caracteres.
            </p>
            <div className="mt-6 grid gap-4">
              <Field label="Contraseña nueva" htmlFor="cuenta-nueva">
                <input
                  id="cuenta-nueva"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={LARGO_MINIMO_CONTRASENA}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-lux"
                />
              </Field>
              <Field label="Repite la contraseña" htmlFor="cuenta-confirmacion">
                <input
                  id="cuenta-confirmacion"
                  name="password-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={LARGO_MINIMO_CONTRASENA}
                  value={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.value)}
                  className="field-lux"
                />
              </Field>
            </div>

            {error ? <Aviso>{error}</Aviso> : null}

            <Button type="submit" variant="accent" size="lg" disabled={enviando} className="mt-6 w-full">
              {enviando ? "Guardando…" : "Guardar contraseña"}
            </Button>
          </form>
        ) : (
          <form onSubmit={pedirEnlace} noValidate>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
              Escribe el correo con el que creaste tu cuenta y te enviamos un
              enlace para definir una contraseña nueva.
            </p>
            <div className="mt-6">
              <Field label="Correo" htmlFor="cuenta-recuperar-email">
                <input
                  id="cuenta-recuperar-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-lux"
                  placeholder="tu@correo.com"
                />
              </Field>
            </div>

            {error ? <Aviso>{error}</Aviso> : null}

            <Button type="submit" variant="accent" size="lg" disabled={enviando} className="mt-6 w-full">
              {enviando ? "Enviando…" : "Enviar enlace"}
            </Button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-3">
        <Link href="/cuenta/login" className="font-semibold text-ink underline underline-offset-4">
          Volver a ingresar
        </Link>
        {" · "}
        <a href={wa} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ink">
          ¿No te llega el correo? Escríbenos
        </a>
      </p>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm text-ink-2">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
