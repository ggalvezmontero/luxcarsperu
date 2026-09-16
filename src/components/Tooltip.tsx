'use client';

import { useCallback, useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { InfoIcon } from "./Icons";

type TooltipProps = {
  content: string;
  label?: string;
  className?: string;
  placement?: "top" | "bottom";
};

/**
 * NOTAS DE ACCESIBILIDAD (auditoría 2026-09-15)
 *
 * 1. FUERA `aria-expanded`. Estaba en el botón, y es el atributo equivocado:
 *    `aria-expanded` describe un widget de divulgación (un acordeón, un
 *    desplegable) que revela contenido que forma parte del flujo. Un tooltip
 *    no lo es. Un lector de pantalla anunciaba "contraído/expandido" sobre un
 *    control que no expande nada.
 *
 * 2. ENTRA `aria-describedby`. Es el patrón correcto (APG, patrón Tooltip): el
 *    texto del tooltip queda asociado como DESCRIPCIÓN del botón, así que se
 *    lee después del nombre. Antes el contenido no estaba enlazado de ninguna
 *    forma con el disparador.
 *
 * 3. EL NOMBRE ACCESIBLE YA NO ES EL PÁRRAFO ENTERO. `aria-label={content}`
 *    convertía todo el texto explicativo en el nombre del botón: en una lista
 *    de controles aparecía un párrafo de tres líneas como si fuese la etiqueta
 *    del botón. Ahora el nombre es corto y el párrafo va de descripción.
 *
 * 4. SE CIERRA CON ESCAPE y se abre con foco de teclado (WCAG 1.4.13): eso ya
 *    estaba bien y se conserva.
 */
export function Tooltip({
  content,
  label,
  className,
  placement = "top",
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("keydown", handleEscape);
    }
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-xs text-ink-3 transition-colors hover:border-silver hover:text-silver-bright"
        aria-label={label ?? "Más información"}
        aria-describedby={tooltipId}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        onClick={() => setOpen((value) => !value)}
      >
        <InfoIcon size={14} />
      </button>

      {/* La descripción vive SIEMPRE en el DOM, no solo cuando el tooltip está
          abierto. Si solo existiera al abrirse, el lector de pantalla ya habría
          calculado la descripción del botón al recibir el foco y se quedaría
          sin ella: la asociación llegaría un render tarde. Como esta copia es
          la que se lee, el panel visible se marca `aria-hidden` para que el
          texto no se anuncie dos veces. */}
      <span id={tooltipId} className="sr-only">
        {content}
      </span>

      {open ? (
        <div
          aria-hidden="true"
          className={cn(
            "absolute z-20 w-56 max-w-[calc(100vw-2rem)] rounded-lux-lg border border-line-strong bg-surface-2 p-4 text-left shadow-2xl backdrop-blur sm:w-64",
            placement === "top" ? "bottom-full mb-3" : "top-full mt-3",
          )}
        >
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-silver-dim">
            Nota
          </p>
          <p className="mt-2 text-sm text-ink-2">{content}</p>
        </div>
      ) : null}
    </span>
  );
}
