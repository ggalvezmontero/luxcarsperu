import Link from "next/link";
import { LUXCARS_CONFIG } from "@/lib/config";

/* ---------------------------------------------------------------------------
   LÍNEAS DE NEGOCIO
   ---------------------------------------------------------------------------
   La web hoy solo habla de importación: tres de las cuatro líneas del negocio
   son invisibles. Esta sección las expone con jerarquía real.

   Decisiones de composición (deliberadamente distintas al resto del sitio):
   · NO es una retícula de tarjetas con icono. Es un índice: filas amplias
     separadas por filete, numeración a gran escala y titulares tipográficos.
   · Asimetría: encabezado en columna angosta a la izquierda, contenido a la
     derecha; el bloque destacado rompe la rejilla y ocupa todo el ancho.
   · Consignación sin exclusividad recibe el mayor peso visual (titular más
     grande + tabla densa de condiciones) porque es el diferenciador comercial.
   · Sin oro: la home ya tiene sus dos acentos dorados asignados. Aquí el
     énfasis se consigue con escala, aire y plata.
   · Sin fotos: no hay imágenes verificadas de vehículos, así que el peso
     gráfico lo cargan la tipografía, los filetes y el aire.
   ------------------------------------------------------------------------- */

type LineMeta = {
  href: string;
  /** Etiqueta corta del enlace de cada fila. */
  action: string;
  /** Contexto operativo, distinto de la descripción de marca. */
  meta: string;
};

const LINE_META: Record<string, LineMeta> = {
  "compra-venta": {
    href: "/comprar",
    action: "Ver stock disponible",
    meta: "Unidades verificadas, disponibles hoy en Lima",
  },
  importacion: {
    href: "/importar",
    action: "Cotizar importación",
    meta: "Búsqueda, inspección y nacionalización puerta a puerta",
  },
  tasacion: {
    href: "/vender",
    action: "Tasar mi vehículo",
    meta: "Sin contrato de exclusividad",
  },
  documentaria: {
    href: "/#contact",
    action: "Consultar un trámite",
    meta: "También para vehículos que no compraste con nosotros",
  },
};

/** Condiciones de la consignación: tabla densa en vez de otro párrafo. */
const CONSIGNACION_TERMS: { term: string; value: string }[] = [
  { term: "Contrato de exclusividad", value: "No" },
  { term: "Sigues usando tu auto", value: "Sí" },
  { term: "Entregas la unidad", value: "Solo para visitas" },
  { term: "Si lo vendes por tu cuenta", value: "0% comisión" },
];

const FEATURED_ID = "tasacion";

type LineasNegocioSectionProps = {
  /**
   * Cuando la página ya dedica una sección entera a la consignación —como la
   * home, que monta `ConsignacionSection` más abajo— este índice se presenta
   * completo y sin bloque destacado: repetir aquí las mismas condiciones sería
   * contar dos veces el mismo argumento. Por defecto el destacado sí aparece,
   * para páginas donde esta sección es la única que habla del tema.
   */
  destacarConsignacion?: boolean;
};

type LineRowProps = {
  number: number;
  label: string;
  description: string;
  meta: LineMeta;
  /** La última fila cierra el índice con su propio filete inferior. */
  closing?: boolean;
};

function LineRow({ number, label, description, meta, closing }: LineRowProps) {
  return (
    <Link
      href={meta.href}
      className={`group block border-t border-line py-9 transition-colors duration-300 hover:border-line-strong sm:py-12 lg:py-14 ${
        closing ? "border-b" : ""
      }`}
    >
      <div className="grid gap-y-5 lg:grid-cols-12 lg:items-baseline lg:gap-x-12">
        <span
          aria-hidden="true"
          className="block text-4xl font-medium leading-none tracking-tight tabular-nums text-ink-4 transition-colors duration-300 group-hover:text-silver sm:text-5xl lg:col-span-4 lg:text-6xl"
        >
          {String(number).padStart(2, "0")}
        </span>

        <div className="min-w-0 lg:col-span-6">
          <h3 className="text-2xl font-semibold leading-tight tracking-tight text-ink transition-colors duration-300 group-hover:text-silver-bright sm:text-3xl lg:text-4xl">
            {label}
          </h3>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-3">
            {description}
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-4">
            {meta.meta}
          </p>
        </div>

        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-silver-dim transition-colors duration-300 group-hover:text-silver-bright lg:col-span-2 lg:justify-end">
          {meta.action}
          <span
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

export function LineasNegocioSection({
  destacarConsignacion = true,
}: LineasNegocioSectionProps = {}) {
  const lines = LUXCARS_CONFIG.businessLines;
  const featuredIndex = destacarConsignacion
    ? lines.findIndex((line) => line.id === FEATURED_ID)
    : -1;
  const featured = featuredIndex >= 0 ? lines[featuredIndex] : undefined;
  const featuredMeta = featured ? LINE_META[featured.id] : undefined;

  // El índice superior lleva las líneas previas al destacado; las posteriores
  // cierran la sección. Si el destacado no existiera en config, todas caen
  // en el índice superior y la composición sigue siendo válida.
  const leadingLines = featured ? lines.slice(0, featuredIndex) : lines;
  const trailingLines = featured ? lines.slice(featuredIndex + 1) : [];

  return (
    <section
      id="lineas-negocio"
      aria-labelledby="lineas-negocio-title"
      className="scroll-mt-32 py-4 sm:py-10 lg:py-16"
    >
      {/* Encabezado asimétrico: etiqueta angosta a la izquierda, titular grande. */}
      <div className="grid gap-y-8 lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-4">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-silver-dim">
            Qué hacemos
          </p>
          <span
            aria-hidden="true"
            className="mt-6 block h-px w-16 bg-line-strong"
          />
        </div>

        <div className="min-w-0 lg:col-span-8">
          <h2
            id="lineas-negocio-title"
            className="text-3xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-4xl lg:text-6xl"
          >
            Cuatro líneas de negocio.{" "}
            <span className="text-ink-3">Una sola operación.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink-3 sm:text-base">
            No solo importamos. Vendemos stock propio verificado, traemos desde
            Miami el vehículo exacto que pides, tasamos y vendemos el tuyo sin
            inmovilizarlo, y resolvemos la parte documentaria que a casi nadie
            le gusta hacer.
          </p>
        </div>
      </div>

      {/* Índice: filas amplias con filete y numeración a gran escala. */}
      {leadingLines.length > 0 ? (
        <ul className="mt-14 sm:mt-20 lg:mt-24">
          {leadingLines.map((line, index) => {
            const meta = LINE_META[line.id];
            if (!meta) return null;

            return (
              <li key={line.id}>
                <LineRow
                  number={lines.indexOf(line) + 1}
                  label={line.label}
                  description={line.description}
                  meta={meta}
                  /* Sin bloque destacado, este índice es toda la sección: la
                     última fila cierra con su propio filete. */
                  closing={!featured && index === leadingLines.length - 1}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Bloque destacado: rompe la rejilla del índice porque es el argumento
          que ninguna otra importadora de Lima ofrece. */}
      {featured && featuredMeta ? (
        <div className="mt-14 bg-surface px-5 py-12 sm:mt-20 sm:px-10 sm:py-16 lg:mt-24 lg:px-16 lg:py-20">
          <div className="grid gap-y-10 lg:grid-cols-12 lg:gap-x-12">
            <div className="min-w-0 lg:col-span-7">
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
                <span
                  aria-hidden="true"
                  className="text-4xl font-medium leading-none tracking-tight tabular-nums text-silver sm:text-5xl lg:text-6xl"
                >
                  {String(featuredIndex + 1).padStart(2, "0")}
                </span>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-silver-dim">
                  El diferenciador
                </p>
              </div>

              <h3 className="mt-7 text-3xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-4xl lg:text-5xl">
                Consignación sin contrato de exclusividad
              </h3>

              <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-2 sm:text-base">
                Valorizamos tu vehículo y lo vendemos por ti mientras tú lo
                sigues manejando con normalidad. Solo lo coordinamos para las
                visitas de compradores interesados. Si lo vendes por tu cuenta,
                no nos debes nada.
              </p>

              <Link
                href={featuredMeta.href}
                className="group mt-10 inline-flex items-center gap-3 border border-silver px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-silver-bright transition-colors duration-300 hover:bg-silver hover:text-void"
              >
                {featuredMeta.action}
                <span
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>

            {/* Tabla densa de condiciones: datos, no otra tarjeta. */}
            <dl className="min-w-0 self-end border-t border-line-strong lg:col-span-5">
              {CONSIGNACION_TERMS.map((row) => (
                <div
                  key={row.term}
                  className="flex items-baseline justify-between gap-6 border-b border-line py-4"
                >
                  <dt className="min-w-0 text-xs uppercase tracking-[0.16em] text-ink-4">
                    {row.term}
                  </dt>
                  <dd className="shrink-0 text-sm font-medium tracking-tight text-silver-bright">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      ) : null}

      {/* Cierre del índice, ya fuera del bloque destacado. */}
      {trailingLines.length > 0 ? (
        <ul className="mt-14 sm:mt-20 lg:mt-24">
          {trailingLines.map((line, index) => {
            const meta = LINE_META[line.id];
            if (!meta) return null;

            return (
              <li key={line.id}>
                <LineRow
                  number={lines.indexOf(line) + 1}
                  label={line.label}
                  description={line.description}
                  meta={meta}
                  closing={index === trailingLines.length - 1}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
