import { Button } from "@/components/Button";
import { LUXCARS_CONFIG } from "@/lib/config";
import { cn, formatNumber } from "@/lib/utils";

/* ===========================================================================
   STOCK PREVIEW — adelanto del stock propio en la home.
   ---------------------------------------------------------------------------
   Línea de negocio 1 de 4: COMPRA Y VENTA. Hasta hoy la home solo hablaba de
   importación; esta sección existe para anunciar que también hay autos
   físicos, en Lima, disponibles ahora.

   Reglas que condicionan el diseño:

   1. HOY NO HAY INVENTARIO NI FOTOS PROPIAS. La sección tiene que verse digna
      con `unidades = []`. Por eso el peso visual lo carga la tipografía y el
      filete, no una foto: cualquier imagen de banco sería una mentira sobre
      un auto concreto (las de src/data/trendingVehicles.json no corresponden
      al modelo que dicen representar).
   2. NO SE INVENTAN CIFRAS. Los precios son siempre "referenciales" y
      `null` significa "a consultar": la fila se ve igual de digna sin cifra.
   3. CONTENCIÓN CROMÁTICA. Cero oro aquí: la home ya tiene sus dos únicos
      elementos dorados. Todo el acento es plata.
   4. Nada de retícula de tarjetas: numeral a gran escala, titular grande como
      elemento gráfico y un libro mayor de filetes finos.
   =========================================================================== */

export type EstadoStock = "disponible" | "reservado" | "en-transito";

/**
 * Unidad de stock propio. Deliberadamente mínimo: es lo que necesita un
 * adelanto en la home. La ficha completa vive en /comprar.
 */
export type VehiculoStock = {
  id: string;
  marca: string;
  modelo: string;
  /** Año-modelo. */
  anio: number;
  /** Kilometraje real. `null` cuando aún no está verificado. */
  km: number | null;
  /** Dónde se puede ver físicamente la unidad. */
  ubicacion: string;
  estado: EstadoStock;
  /**
   * Precio REFERENCIAL en USD. `null` = "a consultar". Nunca se muestra una
   * cifra que no venga verificada con documentos a la vista.
   */
  precioReferencialUsd: number | null;
};

type StockPreviewSectionProps = {
  /** Inventario real. Vacío por defecto: hoy no hay unidades cargadas. */
  unidades?: VehiculoStock[];
  /** Cuántas filas se muestran en el adelanto antes de mandar a /comprar. */
  maxFilas?: number;
  className?: string;
};

const ESTADO_LABEL: Record<EstadoStock, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  "en-transito": "En tránsito",
};

/* Monocromo a propósito: el estado se lee por jerarquía, no por color. */
const ESTADO_STYLES: Record<EstadoStock, { dot: string; text: string }> = {
  disponible: { dot: "bg-silver-bright", text: "text-ink" },
  reservado: { dot: "bg-silver-dim", text: "text-ink-3" },
  "en-transito": { dot: "bg-line-strong", text: "text-ink-3" },
};

/**
 * Qué buscamos y traemos mientras el piso se llena. Son segmentos, no
 * modelos: no se destaca ningún auto concreto como oportunidad sin tener la
 * unidad delante.
 */
const SEGMENTOS = [
  {
    titulo: "SUV premium",
    detalle: "El segmento que más nos piden en Lima.",
    nota: "En búsqueda",
  },
  {
    titulo: "Sedán ejecutivo",
    detalle: "Uso ciudad, mantenimiento en red oficial.",
    nota: "En búsqueda",
  },
  {
    titulo: "Pickup 4x4",
    detalle: "Trabajo y off-road, con historial verificable.",
    nota: "A pedido",
  },
  {
    titulo: "Deportivo y coupé",
    detalle: "Unidades puntuales, casi siempre por encargo.",
    nota: "A pedido",
  },
];

function whatsappStockLink() {
  const mensaje = [
    "Hola LUX CARS, quiero saber qué unidades tienen disponibles.",
    "Estoy buscando: (marca / modelo / año)",
    "Presupuesto aproximado:",
    "¿Me avisan cuando entre algo así?",
  ].join("\n");

  return `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;
}

export function StockPreviewSection({
  unidades = [],
  maxFilas = 4,
  className,
}: StockPreviewSectionProps) {
  const total = unidades.length;
  const hayStock = total > 0;
  const disponibles = unidades.filter((u) => u.estado === "disponible").length;
  const enTransito = unidades.filter((u) => u.estado === "en-transito").length;
  const visibles = unidades.slice(0, maxFilas);
  const restantes = Math.max(0, total - visibles.length);

  /* Contador a dos dígitos: "00" también es una respuesta honesta. */
  const contador = String(total).padStart(2, "0");

  return (
    <section
      id="stock"
      aria-labelledby="stock-title"
      className={cn("w-full", className)}
    >
      {/* ---------------------------------------------------------------
          BANDA SUPERIOR. Va a sangre del ancho de la sección, sin radio y
          sin caja: solo dos filetes horizontales. El isotipo se superpone
          detrás del numeral, recortado por overflow-hidden — nunca genera
          scroll horizontal.
          --------------------------------------------------------------- */}
      <div className="relative overflow-hidden border-y border-line bg-void">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 top-1/2 h-64 w-64 -translate-y-1/2 bg-contain bg-right bg-no-repeat opacity-[0.06] sm:-right-10 sm:h-80 sm:w-80 lg:right-8 lg:h-96 lg:w-96"
          style={{ backgroundImage: "url(/brand/isotipo-blanco.svg)" }}
        />

        <div className="relative flex flex-col gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:flex-row lg:items-end lg:justify-between lg:gap-16 lg:px-12 lg:py-20">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-silver sm:text-xs">
              Compra y venta · Stock propio
            </span>

            <div className="mt-6 flex items-end gap-5 sm:gap-7">
              <span className="text-6xl font-semibold leading-[0.8] tracking-tight text-silver-bright tabular-nums sm:text-7xl lg:text-8xl">
                {contador}
              </span>
              <span className="min-w-0 max-w-[16rem] pb-1 text-sm leading-snug text-ink-3 sm:text-base">
                {hayStock
                  ? "unidades verificadas en piso, en Lima"
                  : "unidades publicadas hoy. Estamos recibiendo."}
              </span>
            </div>
          </div>

          {/* Fila de datos densa, separada por filetes verticales. */}
          <dl className="flex flex-wrap items-start gap-x-8 gap-y-6 sm:gap-x-12">
            <div className="min-w-0">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-ink-4">
                Disponibles
              </dt>
              <dd className="mt-2 text-xl font-medium tabular-nums text-ink sm:text-2xl">
                {String(disponibles).padStart(2, "0")}
              </dd>
            </div>
            <div className="min-w-0 sm:border-l sm:border-line sm:pl-12">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-ink-4">
                En tránsito
              </dt>
              <dd className="mt-2 text-xl font-medium tabular-nums text-ink sm:text-2xl">
                {String(enTransito).padStart(2, "0")}
              </dd>
            </div>
            <div className="min-w-0 sm:border-l sm:border-line sm:pl-12">
              <dt className="text-[11px] uppercase tracking-[0.2em] text-ink-4">
                Showroom
              </dt>
              <dd className="mt-2 text-sm leading-snug text-ink-2 sm:text-base">
                San Isidro
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* ---------------------------------------------------------------
          TITULAR ASIMÉTRICO. El título ocupa siete columnas, el cuerpo se
          descuelga a la derecha. Nada centrado.
          --------------------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-8 px-5 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-12 lg:gap-12 lg:px-12 lg:pt-28">
        <h2
          id="stock-title"
          className="text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-ink sm:text-5xl lg:col-span-7 lg:text-6xl"
        >
          {hayStock ? (
            <>
              Autos verificados,
              <br className="hidden sm:block" /> en Lima, listos hoy.
            </>
          ) : (
            <>
              Estamos recibiendo
              <br className="hidden sm:block" /> unidades. Dinos qué buscas.
            </>
          )}
        </h2>

        <p className="max-w-prose text-base leading-relaxed text-ink-2 lg:col-span-4 lg:col-start-9 lg:pt-3 sm:text-lg">
          {hayStock
            ? "Stock propio: cada unidad se revisa, se documenta y se entrega con la transferencia lista. Se puede ver físicamente en San Isidro antes de decidir nada."
            : "Todavía no publicamos unidades en la web. Si nos dices marca, modelo y presupuesto, te avisamos apenas entre algo que calce — o lo traemos a pedido desde Miami."}
        </p>
      </div>

      {/* ---------------------------------------------------------------
          LIBRO MAYOR. Filetes finos, cero tarjetas, cero bordes de caja.
          Con stock: la tabla de unidades. Sin stock: los segmentos que
          buscamos, numerados a gran escala.
          --------------------------------------------------------------- */}
      <div className="px-5 pt-12 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
        {hayStock ? (
          <>
            <div
              aria-hidden
              className="hidden grid-cols-12 gap-6 border-b border-line pb-3 text-[11px] uppercase tracking-[0.2em] text-ink-4 sm:grid"
            >
              <span className="col-span-5">Unidad</span>
              <span className="col-span-3">Año · Kilometraje</span>
              <span className="col-span-2">Ubicación</span>
              <span className="col-span-2 text-right">Estado</span>
            </div>

            <ul className="border-b border-line sm:border-b-0">
              {visibles.map((unidad) => {
                const estado = ESTADO_STYLES[unidad.estado];
                return (
                  <li
                    key={unidad.id}
                    className="grid grid-cols-2 items-baseline gap-x-6 gap-y-2 border-t border-line py-6 sm:grid-cols-12 sm:py-7"
                  >
                    <span className="col-span-2 min-w-0 text-lg font-medium leading-snug text-ink sm:col-span-5 sm:text-xl">
                      {unidad.marca}{" "}
                      <span className="font-normal text-ink-2">
                        {unidad.modelo}
                      </span>
                    </span>

                    <span className="min-w-0 text-sm tabular-nums text-ink-3 sm:col-span-3">
                      {unidad.anio}
                      {unidad.km !== null
                        ? ` · ${formatNumber(unidad.km)} km`
                        : " · km por verificar"}
                    </span>

                    <span className="hidden min-w-0 text-sm text-ink-3 sm:col-span-2 sm:block">
                      {unidad.ubicacion}
                    </span>

                    <span
                      className={cn(
                        "flex min-w-0 items-center justify-end gap-2 text-[11px] uppercase tracking-[0.2em] sm:col-span-2",
                        estado.text,
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          estado.dot,
                        )}
                      />
                      {ESTADO_LABEL[unidad.estado]}
                    </span>

                    <span className="col-span-2 text-sm text-ink-4 sm:hidden">
                      {unidad.ubicacion}
                    </span>
                  </li>
                );
              })}
            </ul>

            {restantes > 0 ? (
              <p className="pt-6 text-sm text-ink-3">
                {restantes === 1
                  ? "Hay 1 unidad más en el listado completo."
                  : `Hay ${restantes} unidades más en el listado completo.`}
              </p>
            ) : null}
          </>
        ) : (
          <ul>
            {SEGMENTOS.map((segmento, index) => (
              <li
                key={segmento.titulo}
                className="grid grid-cols-[auto_1fr] items-start gap-x-5 gap-y-2 border-t border-line py-7 last:border-b sm:grid-cols-12 sm:gap-x-6 sm:py-9"
              >
                <span className="text-2xl font-semibold leading-none tabular-nums text-line-strong sm:col-span-1 sm:text-3xl">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="min-w-0 text-xl font-medium leading-snug text-ink sm:col-span-5 sm:text-2xl">
                  {segmento.titulo}
                </span>

                <span className="col-start-2 min-w-0 text-sm leading-relaxed text-ink-3 sm:col-span-4 sm:col-start-7 sm:text-base">
                  {segmento.detalle}
                </span>

                <span className="col-start-2 text-[11px] uppercase tracking-[0.2em] text-ink-4 sm:col-span-2 sm:text-right">
                  {segmento.nota}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------------------------------------------------------------
          CIERRE. Dos salidas: ver el stock o pedir el auto a medida.
          Plata, nunca oro: el oro de la home ya está asignado.
          --------------------------------------------------------------- */}
      <div className="flex flex-col gap-8 px-5 pt-12 sm:px-8 sm:pt-16 lg:flex-row lg:items-end lg:justify-between lg:gap-16 lg:px-12 lg:pt-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button href="/comprar" size="lg">
            {hayStock ? "Ver el stock" : "Ver cómo compramos"}
          </Button>
          <Button
            href={whatsappStockLink()}
            variant="secondary"
            size="lg"
            target="_blank"
            rel="noopener noreferrer"
          >
            Dinos qué buscas
          </Button>
        </div>

        <p className="max-w-md text-xs leading-relaxed text-ink-4 sm:text-sm">
          Precios siempre referenciales: la cifra final se confirma con la
          unidad y los documentos a la vista. Sin exclusividad y sin
          compromiso — también tasamos y vendemos el auto que ya tienes.
        </p>
      </div>
    </section>
  );
}
