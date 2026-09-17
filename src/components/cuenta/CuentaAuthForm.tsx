"use client";

/**
 * Ingreso y registro del cliente. Todo delegado a Supabase Auth:
 * `signInWithPassword` y `signUp`. Nombre y teléfono viajan en
 * `options.data` y el trigger `on_auth_user_created` los copia al perfil.
 *
 * Si el proyecto exige confirmar el correo, `signUp` devuelve sesión nula:
 * se le dice al cliente que revise su bandeja en vez de fingir un error.
 */

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { useCuentaSession } from "@/components/cuenta/cuentaSession";
import {
  describeAuthError,
  getPortalAuthMissingEnv,
} from "@/lib/portal/supabaseBrowser";
import { LUXCARS_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";

type Mode = "ingresar" | "registro";

const SAFE_NEXT = /^\/cuenta(\/[a-z-]*)?$/;

export function CuentaAuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, client } = useCuentaSession();

  const requestedNext = params.get("next") ?? "/cuenta";
  const next = SAFE_NEXT.test(requestedNext) ? requestedNext : "/cuenta";
  const initialMode: Mode = params.get("modo") === "registro" ? "registro" : "ingresar";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Ya con sesión, no tiene sentido ver el formulario.
  useEffect(() => {
    if (status === "autenticado") router.replace(next);
  }, [status, next, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const correo = email.trim();
    if (!correo || !password) {
      setError("Completa el correo y la contraseña.");
      return;
    }
    if (mode === "registro") {
      if (nombre.trim().length < 2) {
        setError("Dinos tu nombre para poder atenderte.");
        return;
      }
      if (telefono.trim().length < 6) {
        setError("Necesitamos un WhatsApp para responderte.");
        return;
      }
      if (password.length < 8) {
        setError("La contraseña debe tener al menos 8 caracteres.");
        return;
      }
    }

    if (!client) {
      const missing = getPortalAuthMissingEnv();
      setError(
        `Las cuentas todavía no están activas en este sitio (falta ${missing.join(" y ") || "configurar Supabase"}). Escríbenos por WhatsApp y te atendemos igual.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "ingresar") {
        const { error: authError } = await client.auth.signInWithPassword({
          email: correo,
          password,
        });
        if (authError) {
          setError(describeAuthError(authError.message));
          return;
        }
        setPassword("");
        router.replace(next);
        return;
      }

      const { data, error: signUpError } = await client.auth.signUp({
        email: correo,
        password,
        options: {
          data: { nombre: nombre.trim().slice(0, 160), telefono: telefono.trim().slice(0, 40) },
        },
      });
      if (signUpError) {
        setError(describeSignUpError(signUpError.message));
        return;
      }
      setPassword("");
      if (!data.session) {
        setNotice(
          "Te enviamos un correo para confirmar la cuenta. Ábrelo y vuelve a ingresar.",
        );
        setMode("ingresar");
        return;
      }
      router.replace(next);
    } catch (caught) {
      setError(describeAuthError(caught instanceof Error ? caught.message : String(caught)));
    } finally {
      setSubmitting(false);
    }
  }

  const wa = `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`;

  return (
    <div className="mx-auto w-full max-w-md">
      <div role="tablist" aria-label="Ingresar o crear cuenta" className="grid grid-cols-2 rounded-full border border-line bg-surface p-1">
        {(
          [
            ["ingresar", "Ingresar"],
            ["registro", "Crear cuenta"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            onClick={() => {
              setMode(id);
              setError(null);
            }}
            className={cn(
              "rounded-full px-4 py-2.5 text-sm font-semibold transition-colors",
              mode === id ? "bg-ink text-void" : "text-ink-3 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-5 rounded-[22px] border border-line bg-surface p-6 sm:p-8"
      >
        <h1 className="text-xl font-semibold text-ink">
          {mode === "ingresar" ? "Entra a tu cuenta" : "Crea tu cuenta"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
          {mode === "ingresar"
            ? "Para ver el estado de tus solicitudes."
            : "Para pedirnos un auto o publicar el tuyo. Un minuto."}
        </p>

        <div className="mt-6 grid gap-4">
          {mode === "registro" ? (
            <>
              <Field label="Nombre" htmlFor="cuenta-nombre">
                <input
                  id="cuenta-nombre"
                  autoComplete="name"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="field-lux"
                  placeholder="Nombre y apellido"
                />
              </Field>
              <Field label="WhatsApp" htmlFor="cuenta-telefono">
                <input
                  id="cuenta-telefono"
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="field-lux"
                  placeholder="+51 9…"
                />
              </Field>
            </>
          ) : null}
          <Field label="Correo" htmlFor="cuenta-email">
            <input
              id="cuenta-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-lux"
              placeholder="tu@correo.com"
            />
          </Field>
          <Field label="Contraseña" htmlFor="cuenta-password">
            <input
              id="cuenta-password"
              type="password"
              autoComplete={mode === "registro" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-lux"
              placeholder={mode === "registro" ? "Mínimo 8 caracteres" : "••••••••"}
            />
          </Field>
        </div>

        {error ? (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-4 flex items-start gap-2 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ink">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-ok" />
            <span>{notice}</span>
          </p>
        ) : null}

        <Button type="submit" variant="accent" size="lg" disabled={submitting} className="mt-6 w-full">
          {submitting ? "Un momento…" : mode === "ingresar" ? "Entrar" : "Crear cuenta"}
        </Button>

        <p className="mt-5 text-xs leading-relaxed text-ink-4">
          {mode === "registro"
            ? "Usamos tu nombre y WhatsApp solo para responderte sobre tus solicitudes. "
            : "¿Olvidaste la contraseña? Escríbenos por WhatsApp y te ayudamos. "}
          <Link href="/privacidad" className="underline underline-offset-4 hover:text-ink">
            Política de privacidad
          </Link>
          .
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-ink-3">
        ¿Prefieres no crear cuenta?{" "}
        <a href={wa} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-4">
          Escríbenos por WhatsApp
        </a>
        .
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

function describeSignUpError(message: string): string {
  const raw = message.toLowerCase();
  if (raw.includes("already registered") || raw.includes("already exists")) {
    return "Ese correo ya tiene cuenta. Prueba ingresar.";
  }
  if (raw.includes("password")) {
    return "La contraseña no cumple los requisitos. Usa al menos 8 caracteres.";
  }
  if (raw.includes("signups not allowed") || raw.includes("signup is disabled")) {
    return "El registro está desactivado en este momento. Escríbenos por WhatsApp.";
  }
  return describeAuthError(message);
}
