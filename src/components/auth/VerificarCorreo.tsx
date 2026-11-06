"use client";

/**
 * Paso "escribe el código que te enviamos", compartido por el ingreso de
 * clientes (/cuenta/login) y el del portal (/portal/login).
 *
 * Se muestra cuando Neon Auth dice que el correo todavía no está verificado:
 * justo después de registrarse, o al entrar con una cuenta sin verificar. La
 * pantalla que lo usa ya pidió el primer código; desde acá se puede pedir otro.
 *
 * `variante` solo cambia la ropa (cada pantalla tiene su estilo de campos y
 * botones); la lógica es una sola, en `lib/auth/verificacion.ts`.
 */

import { useState, type FormEvent } from "react";
import {
  LARGO_DEL_CODIGO,
  VIGENCIA_DEL_CODIGO,
  confirmarCodigoDeVerificacion,
  describirErrorDeVerificacion,
  enviarCodigoDeVerificacion,
} from "@/lib/auth/verificacion";
import { cn } from "@/lib/utils";

type Props = {
  email: string;
  variante: "cuenta" | "portal";
  /** ¿Salió bien el primer envío? Si no, se dice y se ofrece reenviar. */
  envioInicialOk: boolean;
  /** El código fue correcto y la sesión quedó abierta. */
  onVerificado: () => void | Promise<void>;
  /** Volver al formulario (correo mal escrito, por ejemplo). */
  onCancelar: () => void;
};

const ESTILOS = {
  cuenta: {
    titulo: "text-xl font-semibold text-ink",
    texto: "mt-1.5 text-sm leading-relaxed text-ink-3",
    etiqueta: "block text-sm text-ink-2",
    campo: "field-lux mt-1.5 text-center text-xl tracking-[0.4em] tabular-nums",
    boton:
      "mt-6 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,#FFFFFF_0%,#D9D9DE_45%,#A9A9B1_100%)] px-7 text-[15px] font-semibold text-void ring-1 ring-inset ring-white/60 transition-all hover:bg-[linear-gradient(180deg,#FFFFFF_0%,#E8E8EC_45%,#BEBEC6_100%)] disabled:pointer-events-none disabled:opacity-45",
    aviso: "mt-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger",
    nota: "mt-4 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ink",
    enlaces: "mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-3",
  },
  portal: {
    titulo: "text-base font-medium text-ink",
    texto: "mt-1 text-xs leading-relaxed text-ink-3",
    etiqueta: "block text-[0.62rem] uppercase tracking-[0.18em] text-ink-3",
    campo:
      "mt-2 w-full rounded-lux border border-line bg-surface-2 px-3 py-2.5 text-center text-lg tracking-[0.4em] tabular-nums text-ink placeholder:text-ink-4 focus:border-line-strong",
    boton:
      "mt-6 w-full rounded-lux bg-ink px-4 py-3 text-sm font-medium text-void transition-colors hover:bg-silver-bright disabled:opacity-60",
    aviso: "mt-4 rounded-lux border border-danger/40 bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2",
    nota: "mt-4 rounded-lux border border-line bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2",
    enlaces: "mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3",
  },
} as const;

export function VerificarCorreo({
  email,
  variante,
  envioInicialOk,
  onVerificado,
  onCancelar,
}: Props) {
  const estilos = ESTILOS[variante];
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(
    envioInicialOk
      ? null
      : "No pudimos enviarte el código. Pulsa «Enviar otro código» para intentarlo de nuevo.",
  );
  const [nota, setNota] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function confirmar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNota(null);

    if (codigo.length !== LARGO_DEL_CODIGO) {
      setError(`Escribe los ${LARGO_DEL_CODIGO} dígitos del código.`);
      return;
    }

    setOcupado(true);
    const resultado = await confirmarCodigoDeVerificacion(email, codigo);
    if (!resultado.ok) {
      setOcupado(false);
      setError(describirErrorDeVerificacion(resultado.codigo));
      return;
    }
    try {
      await onVerificado();
    } finally {
      setOcupado(false);
    }
  }

  async function reenviar() {
    setError(null);
    setNota(null);
    setOcupado(true);
    const resultado = await enviarCodigoDeVerificacion(email);
    setOcupado(false);
    if (!resultado.ok) {
      setError(describirErrorDeVerificacion(resultado.codigo));
      return;
    }
    setCodigo("");
    setNota("Te enviamos un código nuevo. El anterior ya no sirve.");
  }

  return (
    <form onSubmit={confirmar} noValidate>
      <h1 className={estilos.titulo}>Confirma tu correo</h1>
      <p className={estilos.texto}>
        Te enviamos un código de {LARGO_DEL_CODIGO} dígitos a{" "}
        <span className="break-all font-semibold text-ink-2">{email}</span>. Vence en{" "}
        {VIGENCIA_DEL_CODIGO}; si no lo ves, revisa la carpeta de spam.
      </p>

      <div className="mt-6">
        <label htmlFor="verificar-codigo" className={estilos.etiqueta}>
          Código
        </label>
        <input
          id="verificar-codigo"
          name="one-time-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={LARGO_DEL_CODIGO}
          required
          value={codigo}
          onChange={(event) =>
            setCodigo(event.target.value.replace(/\D/g, "").slice(0, LARGO_DEL_CODIGO))
          }
          className={estilos.campo}
          placeholder={"·".repeat(LARGO_DEL_CODIGO)}
        />
      </div>

      {error ? (
        <p role="alert" className={estilos.aviso}>
          {error}
        </p>
      ) : null}
      {nota ? (
        <p role="status" className={estilos.nota}>
          {nota}
        </p>
      ) : null}

      <button type="submit" disabled={ocupado} className={estilos.boton}>
        {ocupado ? "Un momento…" : "Confirmar"}
      </button>

      <div className={estilos.enlaces}>
        <button
          type="button"
          onClick={reenviar}
          disabled={ocupado}
          className={cn("underline underline-offset-4 transition-colors hover:text-ink", ocupado && "opacity-50")}
        >
          Enviar otro código
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={ocupado}
          className="underline underline-offset-4 transition-colors hover:text-ink"
        >
          Usar otro correo
        </button>
      </div>
    </form>
  );
}
