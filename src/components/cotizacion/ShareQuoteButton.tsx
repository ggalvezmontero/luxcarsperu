"use client";

/**
 * Botón "Compartir" de un estimado.
 *
 * En el celular abre la hoja de compartir del sistema (WhatsApp, Instagram,
 * Mensajes…). Donde no existe, copia el enlace y lo dice. Si ni siquiera se
 * puede copiar (navegador viejo, permiso negado), deja el enlace a la vista
 * para copiarlo a mano: compartir nunca falla en silencio.
 *
 * El enlace se arma con el dominio que el cliente tiene abierto, así también
 * funciona en una vista previa o en local.
 */

import { GA_EVENTS, trackEvent } from "@/lib/analytics";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { sharedQuotePath } from "@/lib/cotizacionCompartida";
import { cn } from "@/lib/utils";

type Props = {
  /** Código del estimado (ver `lib/cotizacionCompartida.ts`). */
  code: string;
  /** Título para la hoja de compartir: "Chevrolet Corvette 2026". */
  title: string;
  /** Frase que acompaña al enlace. */
  text: string;
  label?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
};

type Estado = "reposo" | "copiado" | "manual";

export function ShareQuoteButton({
  code,
  title,
  text,
  label = "Compartir",
  variant = "secondary",
  size = "md",
  className,
}: Props) {
  // El aviso vale solo para el estimado con el que se mostró: si el código
  // cambia (otro auto, otro precio), "copiado" ya no corresponde.
  const [aviso, setAviso] = useState<{ code: string; estado: Estado }>({ code, estado: "reposo" });
  const estado = aviso.code === code ? aviso.estado : "reposo";
  const setEstado = (siguiente: Estado) => setAviso({ code, estado: siguiente });
  const [enlace, setEnlace] = useState("");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  async function compartir() {
    const url = `${window.location.origin}${sharedQuotePath(code)}`;
    setEnlace(url);
    trackEvent(GA_EVENTS.calculatorShare, { share_code: code });

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        // El cliente cerró la hoja: no es un error y no hay nada que avisar.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Cualquier otro fallo: se intenta copiar.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setEstado("copiado");
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setEstado("reposo"), 2500);
    } catch {
      setEstado("manual");
    }
  }

  return (
    <div className={cn("min-w-0", className)}>
      <Button onClick={compartir} variant={variant} size={size} className="w-full">
        <Icon name={estado === "copiado" ? "check" : "share"} size={16} />
        {estado === "copiado" ? "Enlace copiado" : label}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {estado === "copiado" ? "Enlace copiado al portapapeles." : ""}
      </span>
      {estado === "manual" ? (
        <label className="mt-2 block text-xs text-ink-4">
          Copia este enlace:
          <input
            readOnly
            value={enlace}
            onFocus={(event) => event.currentTarget.select()}
            className="field-lux mt-1 !min-h-10 !py-2 text-xs"
          />
        </label>
      ) : null}
    </div>
  );
}
