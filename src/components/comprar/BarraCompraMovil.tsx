"use client";

import { useEffect, useState } from "react";
import { WhatsAppIcon } from "../ui/Icon";
import { cn } from "@/lib/utils";

/**
 * Barra fija al pie en móvil con el precio y el botón de WhatsApp de la ficha.
 *
 * En móvil la ficha de compra queda debajo de la galería y, al leer las
 * especificaciones, el botón se pierde arriba. La barra lo mantiene a la
 * mano. Se esconde mientras el botón original está en pantalla (`objetivoId`)
 * para no mostrar dos veces lo mismo.
 */
export function BarraCompraMovil({
  precio,
  detalle,
  href,
  etiqueta,
  objetivoId,
}: {
  precio: string;
  detalle: string;
  href: string;
  etiqueta: string;
  /** id del bloque de botones de la ficha: con él visible, la barra se oculta. */
  objetivoId: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const objetivo = document.getElementById(objetivoId);
    if (!objetivo || typeof IntersectionObserver === "undefined") {
      // Sin nada que observar, la barra se muestra siempre (fuera del render).
      const t = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(t);
    }
    const obs = new IntersectionObserver(([e]) => setVisible(!e.isIntersecting), { threshold: 0 });
    obs.observe(objetivo);
    return () => obs.disconnect();
  }, [objetivoId]);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-void/90 backdrop-blur-xl transition-transform duration-300 lg:hidden",
        "pb-[env(safe-area-inset-bottom)]",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      aria-hidden={!visible}
    >
      <div className="container-lux flex items-center justify-between gap-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold tabular-nums tracking-tight text-ink">{precio}</p>
          <p className="truncate text-xs text-ink-4">{detalle}</p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          data-ga-cta="vehiculo_whatsapp_barra"
          tabIndex={visible ? 0 : -1}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-whatsapp px-5 py-3 text-sm font-semibold text-void transition-colors hover:bg-[#1fb857]"
        >
          <WhatsAppIcon size={18} />
          {etiqueta}
        </a>
      </div>
    </div>
  );
}
