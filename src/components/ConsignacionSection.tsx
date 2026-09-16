import Image from "next/image";
import { Button } from "./Button";

/* ---------------------------------------------------------------------------
   CONSIGNACIÓN SIN EXCLUSIVIDAD
   ---------------------------------------------------------------------------
   Es el diferenciador comercial más fuerte de la casa, así que la sección no
   se construye como las demás: nada de retícula de tarjetas con icono. Aquí
   manda la tipografía grande, el filete fino y la contraposición en dos
   mitades entre "lo normal del mercado" y "cómo trabajamos".

   Cromática contenida a propósito: negro, plata y grises. Ni un elemento en
   oro — la home ya tiene sus dos acentos dorados y esos no se tocan.

   Sin fotos: no hay imagen real del servicio y las del catálogo no
   corresponden al vehículo que dicen representar. El peso gráfico lo pone el
   isotipo de marca como marca de agua y la escala del número.
   ------------------------------------------------------------------------- */

/** Lo que el dueño suele encontrar al vender. Nada caricaturizado. */
const LO_HABITUAL = [
  "Firmas exclusividad y una permanencia mínima.",
  "Entregas el auto y lo dejas parado en un patio.",
  "Si el comprador lo traes tú, depende de lo que firmaste.",
  "La compra directa paga por debajo del mercado para revender con margen.",
];

/** Cómo opera LuxCars. Cada línea es una condición verificable por escrito. */
const COMO_TRABAJAMOS = [
  "Sin contrato de exclusividad y sin permanencia mínima.",
  "El auto se queda contigo. Lo sigues manejando todos los días.",
  "Si la venta la cierras tú, no nos pagas comisión.",
  "Precio de salida acordado contigo y comisión por escrito antes de publicar.",
];

/** Tres ceros, un solo mensaje. Ninguna cifra inventada. */
const CEROS = [
  {
    valor: "0",
    titulo: "contratos de exclusividad",
    detalle: "Puedes retirarlo o seguir ofreciéndolo por tu cuenta cuando quieras.",
  },
  {
    valor: "0",
    titulo: "de comisión si lo vendes tú",
    detalle: "Solo cobramos cuando la operación la cerramos nosotros.",
  },
  {
    valor: "0",
    titulo: "días sin tu auto",
    detalle: "Se queda en tu cochera hasta el día del cierre.",
  },
];

export function ConsignacionSection() {
  return (
    <section
      id="consignacion"
      aria-labelledby="consignacion-titulo"
      className="relative isolate overflow-hidden rounded-lux-xl border border-line bg-void px-5 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-36"
    >
      {/* Marca de agua: isotipo de arcos, desbordado y recortado por la sección. */}
      <Image
        src="/brand/isotipo-blanco.svg"
        alt=""
        aria-hidden="true"
        width={760}
        height={760}
        className="pointer-events-none absolute -right-32 -top-52 -z-10 hidden w-[520px] max-w-none select-none opacity-5 sm:block lg:-top-40 lg:w-[760px]"
      />

      {/* ── Entrada: etiqueta, filete y titular a gran escala ─────────────── */}
      <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-silver-dim">
        Tasación y consignación
      </p>
      <span aria-hidden="true" className="mt-6 block h-px w-full bg-line" />

      <div className="mt-10 lg:grid lg:grid-cols-12 lg:gap-12">
        <h2
          id="consignacion-titulo"
          className="text-4xl font-semibold leading-[0.95] tracking-tight text-balance text-ink sm:text-6xl lg:col-span-8 lg:text-7xl"
        >
          Déjalo en venta.
          <span className="mt-3 block text-ink-3">Sigue manejándolo.</span>
        </h2>

        <p className="mt-8 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg lg:col-span-4 lg:mt-2 lg:self-end">
          Tu auto se queda contigo mientras nosotros lo publicamos, filtramos a
          los interesados y cerramos la operación. No firmas exclusividad con
          nadie.
        </p>
      </div>

      {/* ── Contraposición en dos mitades, separadas por un filete ────────── */}
      <div className="mt-20 grid gap-y-14 sm:mt-24 lg:grid-cols-[0.85fr_1.15fr] lg:gap-x-14 xl:gap-x-20">
        <div>
          <h3 className="text-[11px] font-medium uppercase tracking-[0.3em] text-ink-4">
            Lo normal en el mercado
          </h3>
          <ul className="mt-6">
            {LO_HABITUAL.map((linea) => (
              <li
                key={linea}
                className="border-t border-line py-5 text-sm leading-relaxed text-ink-4 sm:text-base"
              >
                {linea}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:border-l lg:border-line lg:pl-14 xl:pl-20">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.3em] text-silver">
            Cómo trabajamos nosotros
          </h3>
          <ul className="mt-6">
            {COMO_TRABAJAMOS.map((linea) => (
              <li
                key={linea}
                className="relative border-t border-line-strong py-5 pl-6 text-base leading-relaxed text-ink sm:text-lg"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-[1.65rem] h-px w-3 bg-silver"
                />
                {linea}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── El dato contundente: tres ceros a escala tipográfica ──────────── */}
      <div className="mt-24 border-t border-line pt-4 sm:mt-32">
        <div className="grid gap-y-12 sm:grid-cols-3 sm:gap-x-10 lg:gap-x-16">
          {CEROS.map((cero) => (
            <div
              key={cero.titulo}
              className="sm:border-l sm:border-line sm:pl-8 sm:first:border-l-0 sm:first:pl-0"
            >
              <p
                aria-hidden="true"
                className="text-6xl font-semibold leading-none tracking-tighter tabular-nums text-silver-bright sm:text-7xl lg:text-8xl"
              >
                {cero.valor}
              </p>
              <p className="mt-5 text-sm font-semibold leading-snug tracking-tight text-ink sm:text-base">
                <span className="sr-only">{cero.valor} </span>
                {cero.titulo}
              </p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-3">
                {cero.detalle}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cierre: un solo camino, /vender ───────────────────────────────── */}
      <div className="mt-24 flex flex-col gap-8 border-t border-line pt-12 sm:mt-28 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
        <p className="max-w-xl text-lg leading-snug tracking-tight text-balance text-ink sm:text-2xl">
          Te damos un rango referencial de cuánto vale tu auto hoy. Sin
          compromiso y sin que tengas que dejarlo en ningún lado.
        </p>

        <div className="shrink-0">
          <Button href="/vender" size="lg">
            Tasar mi auto
          </Button>
          <p className="mt-4 text-xs leading-relaxed text-ink-4 lg:text-right">
            Tasación referencial · Lima y Callao
          </p>
        </div>
      </div>
    </section>
  );
}
