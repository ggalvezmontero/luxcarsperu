"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../ui/Icon";
import { cn } from "@/lib/utils";

export type FotoFicha = { id: string; url: string; alt: string };

/**
 * Galería de la ficha del vehículo.
 *
 * Escritorio: mosaico de una foto grande y hasta cuatro pequeñas, como los
 * portales de autos que la gente ya conoce; "Ver las N fotos" abre el visor.
 * Móvil: carrusel con desplazamiento lateral y contador. En ambos, tocar una
 * foto abre el visor a pantalla completa con flechas y teclado.
 *
 * Las insignias (estado, consignación) las pinta el servidor y llegan como
 * `children`: se superponen a la foto principal.
 */
export function GaleriaFicha({
  fotos,
  titulo,
  children,
}: {
  fotos: FotoFicha[];
  titulo: string;
  children?: ReactNode;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const [actual, setActual] = useState(0);
  const pista = useRef<HTMLUListElement>(null);

  const principal = fotos[0];
  const laterales = fotos.slice(1, 5);
  const ocultas = Math.max(0, fotos.length - 5);

  // Contador del carrusel móvil: la foto más centrada en la pista.
  const alDesplazar = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setActual(Math.min(fotos.length - 1, Math.max(0, i)));
  }, [fotos.length]);

  return (
    <div>
      {/* ---------- Móvil: carrusel ---------- */}
      <div className="relative lg:hidden">
        <ul
          ref={pista}
          onScroll={alDesplazar}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden rounded-[22px] border border-white/[0.07]"
          aria-label={`Fotos de ${titulo}`}
        >
          {fotos.map((f, i) => (
            <li key={f.id} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-surface-2">
              <button
                type="button"
                onClick={() => setAbierta(i)}
                className="absolute inset-0 block h-full w-full"
                aria-label={`Ampliar foto ${i + 1} de ${fotos.length}`}
              >
                <Image
                  src={f.url}
                  alt={f.alt || titulo}
                  fill
                  priority={i === 0}
                  sizes="100vw"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
        <div className="pointer-events-none absolute left-4 right-4 top-4 flex flex-wrap gap-2">{children}</div>
        {fotos.length > 1 ? (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-void/70 px-2.5 py-1 text-[11px] font-medium tabular-nums text-silver-bright backdrop-blur">
            <Icon name="images" size={14} />
            {actual + 1} / {fotos.length}
          </span>
        ) : null}
      </div>

      {/* ---------- Escritorio: mosaico ---------- */}
      <div
        className={cn(
          "relative hidden gap-2 overflow-hidden rounded-[22px] border border-white/[0.07] lg:grid",
          laterales.length >= 2 ? "lg:grid-cols-4 lg:grid-rows-2" : "lg:grid-cols-1",
        )}
      >
        <button
          type="button"
          onClick={() => setAbierta(0)}
          className={cn(
            "group relative block aspect-[4/3] w-full bg-surface-2",
            laterales.length >= 2 && "col-span-2 row-span-2",
          )}
          aria-label="Ampliar la foto principal"
        >
          <Image
            src={principal.url}
            alt={principal.alt || titulo}
            fill
            priority
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
          />
        </button>
        {laterales.length >= 2
          ? laterales.map((f, i) => {
              const ultima = i === laterales.length - 1 && ocultas > 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAbierta(i + 1)}
                  className="group relative block aspect-[4/3] w-full bg-surface-2"
                  aria-label={ultima ? `Ver las ${fotos.length} fotos` : `Ampliar foto ${i + 2} de ${fotos.length}`}
                >
                  <Image
                    src={f.url}
                    alt={f.alt || ""}
                    fill
                    sizes="20vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                  {ultima ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-void/60 text-base font-semibold text-ink backdrop-blur-[2px]">
                      +{ocultas}
                    </span>
                  ) : null}
                </button>
              );
            })
          : null}
        <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">{children}</div>
        {fotos.length > 1 ? (
          <button
            type="button"
            onClick={() => setAbierta(0)}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-void/70 px-4 py-2 text-sm font-medium text-ink backdrop-blur transition-colors hover:bg-void/90"
          >
            <Icon name="images" size={16} />
            Ver las {fotos.length} fotos
          </button>
        ) : null}
      </div>

      {abierta !== null ? (
        <Visor fotos={fotos} inicial={abierta} titulo={titulo} onCerrar={() => setAbierta(null)} />
      ) : null}
    </div>
  );
}

/* ---------- Visor a pantalla completa ---------- */

function Visor({
  fotos,
  inicial,
  titulo,
  onCerrar,
}: {
  fotos: FotoFicha[];
  inicial: number;
  titulo: string;
  onCerrar: () => void;
}) {
  const [i, setI] = useState(inicial);
  const dialogo = useRef<HTMLDialogElement>(null);
  const n = fotos.length;

  const ir = useCallback((d: number) => setI((v) => (v + d + n) % n), [n]);

  useEffect(() => {
    const el = dialogo.current;
    if (!el) return;
    if (!el.open) el.showModal();
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") ir(1);
      if (e.key === "ArrowLeft") ir(-1);
    };
    window.addEventListener("keydown", teclas);
    // Sin desplazamiento de la página detrás del visor.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", teclas);
      document.body.style.overflow = previo;
    };
  }, [ir]);

  const f = fotos[i];

  return (
    <dialog
      ref={dialogo}
      onClose={onCerrar}
      onClick={(e) => {
        // Clic en el fondo (el propio <dialog>), no en su contenido.
        if (e.target === e.currentTarget) onCerrar();
      }}
      aria-label={`Fotos de ${titulo}`}
      className="fixed inset-0 m-0 h-full w-full max-h-none max-w-none bg-black/95 p-0 text-ink backdrop:bg-black/80"
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <p className="text-sm text-ink-3">
            <span className="font-medium text-ink">{titulo}</span>
            <span className="mx-2 text-ink-4">·</span>
            <span className="tabular-nums">
              {i + 1} / {n}
            </span>
          </p>
          <button
            type="button"
            onClick={onCerrar}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-ink transition-colors hover:bg-white/10"
            aria-label="Cerrar"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <Image
            key={f.id}
            src={f.url}
            alt={f.alt || titulo}
            fill
            sizes="100vw"
            className="object-contain"
          />
          {n > 1 ? (
            <>
              <button
                type="button"
                onClick={() => ir(-1)}
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-void/70 text-ink backdrop-blur transition-colors hover:bg-void sm:left-6"
                aria-label="Foto anterior"
              >
                <Icon name="chevronRight" size={20} className="rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => ir(1)}
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-void/70 text-ink backdrop-blur transition-colors hover:bg-void sm:right-6"
                aria-label="Foto siguiente"
              >
                <Icon name="chevronRight" size={20} />
              </button>
            </>
          ) : null}
        </div>

        {n > 1 ? (
          <ul className="no-scrollbar hidden gap-2 overflow-x-auto px-6 py-4 sm:flex">
            {fotos.map((m, k) => (
              <li key={m.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setI(k)}
                  className={cn(
                    "relative block h-14 w-[4.666rem] overflow-hidden rounded-lg border transition-opacity",
                    k === i ? "border-silver-bright opacity-100" : "border-transparent opacity-50 hover:opacity-90",
                  )}
                  aria-label={`Ir a la foto ${k + 1}`}
                  aria-current={k === i ? "true" : undefined}
                >
                  <Image src={m.url} alt="" fill sizes="80px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </dialog>
  );
}
