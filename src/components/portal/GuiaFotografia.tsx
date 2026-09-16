/**
 * Guía de fotografía, dentro de la pantalla de carga.
 *
 * NO es documentación: es parte de la herramienta. El equipo la lee parado al
 * lado del auto, con el celular en la mano, justo antes de disparar. Por eso
 * usa `<details>` nativo (abre y cierra sin JavaScript, funciona en cualquier
 * celular y es accesible por teclado) y por eso las reglas van ARRIBA del
 * checklist: la altura de cámara y la luz deciden si la foto sirve; la lista de
 * 8 tomas solo dice cuántas faltan.
 *
 * Componente de servidor: no tiene estado ni interactividad propia.
 */

import {
  ANTES_DE_DISPARAR,
  AVISO_ORIGEN_FOTOS,
  ERRORES_COMUNES,
  REGLAS_FOTO,
  TOMAS_MINIMAS,
} from "@/lib/portal/photoGuide";

const etiqueta =
  "text-[11px] font-medium uppercase tracking-[0.28em] text-ink-3";

export function GuiaFotografia({ className }: { className?: string }) {
  return (
    <section
      className={className}
      aria-labelledby="guia-fotografia-titulo"
    >
      <div className="rounded-lux-lg border border-line bg-surface">
        <div className="border-b border-line px-5 py-6 sm:px-7">
          <p className={etiqueta}>Antes de subir</p>
          <h2
            id="guia-fotografia-titulo"
            className="mt-3 text-2xl font-medium tracking-tight text-ink sm:text-3xl"
          >
            Cómo fotografiar un auto para que se vea caro
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">
            Cuatro reglas y ocho tomas. El mismo auto, fotografiado bien, se
            vende más rápido y soporta un precio más alto. Ninguna edición
            arregla una foto tomada desde la altura de los ojos, al mediodía y
            contra un fondo de tachos.
          </p>
        </div>

        {/* ── Las cuatro reglas ─────────────────────────────────────────── */}
        <div className="grid gap-px bg-line sm:grid-cols-2">
          {REGLAS_FOTO.map((regla) => (
            <article key={regla.id} className="bg-surface px-5 py-6 sm:px-7">
              <h3 className="text-base font-medium text-ink">{regla.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                {regla.detalle}
              </p>
              <p className="mt-3 flex gap-2 text-sm leading-relaxed text-ink-3">
                <span
                  aria-hidden="true"
                  className="mt-[0.45rem] h-px w-4 shrink-0 bg-line-strong"
                />
                <span>
                  <span className="text-ink-4">Error típico: </span>
                  {regla.error}
                </span>
              </p>
            </article>
          ))}
        </div>

        {/* ── Las ocho tomas ────────────────────────────────────────────── */}
        <div className="border-t border-line px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={etiqueta}>Las 8 tomas mínimas</p>
            <p className="text-xs text-ink-4">
              Menos de 8 y la ficha parece que esconde algo
            </p>
          </div>

          <ol className="mt-5 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {TOMAS_MINIMAS.map((toma, indice) => (
              <li key={toma.id} className="bg-surface p-4">
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-silver-dim"
                  >
                    {String(indice + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-sm font-medium text-ink">{toma.nombre}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  {toma.que}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-ink-3">
                  {toma.como}
                </p>
              </li>
            ))}
          </ol>

          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            La 3/4 delantera es la portada: es la única toma que muestra frente
            y costado a la vez, que es como el ojo reconoce un auto.
          </p>
        </div>

        {/* ── Preparación y errores, plegados ───────────────────────────── */}
        <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
          <details className="group bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm text-ink transition-colors hover:bg-surface-2 sm:px-7">
              <span className="font-medium">Preparar el auto (2 minutos)</span>
              <span
                aria-hidden="true"
                className="text-ink-3 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <ul className="space-y-2 px-5 pb-6 text-sm leading-relaxed text-ink-2 sm:px-7">
              {ANTES_DE_DISPARAR.map((paso) => (
                <li key={paso} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[0.6rem] h-px w-3 shrink-0 bg-line-strong"
                  />
                  <span>{paso}</span>
                </li>
              ))}
            </ul>
          </details>

          <details className="group bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm text-ink transition-colors hover:bg-surface-2 sm:px-7">
              <span className="font-medium">Lo que obliga a repetir la foto</span>
              <span
                aria-hidden="true"
                className="text-ink-3 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <ul className="space-y-2 px-5 pb-6 text-sm leading-relaxed text-ink-2 sm:px-7">
              {ERRORES_COMUNES.map((error) => (
                <li key={error} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[0.6rem] h-px w-3 shrink-0 bg-line-strong"
                  />
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>

        {/* ── Aviso de origen: contractual, no decorativo ───────────────── */}
        <div className="border-t border-line bg-surface-2 px-5 py-5 sm:px-7">
          <p className={etiqueta}>Origen de las fotos</p>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
            {AVISO_ORIGEN_FOTOS}
          </p>
        </div>
      </div>
    </section>
  );
}
