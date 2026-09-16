import { LUXCARS_CONFIG } from "@/lib/config";

/* ===========================================================================
   PROCESO — reemplaza a TimelineSection.
   ---------------------------------------------------------------------------
   No es una línea vertical con puntos y tarjetas. Es una pieza editorial:

     1. Un dato tipográfico enorme: 30—40 días.
     2. Una escala proporcional (banda de datos) donde cada etapa ocupa el
        ancho real de los días que toma. Se entiende de un vistazo que el
        tránsito marítimo y la aduana son los tramos largos.
     3. Una lista densa de filetes finos con numeración a gran escala.
        Sin tarjetas, sin bordes por etapa, sin iconos.

   Cromática contenida: negro, grises y plata. Cero oro (la home ya tiene
   sus dos únicos elementos dorados y no se tocan). Cero fotos: no hay
   imágenes reales del proceso, así que el peso gráfico lo carga la
   tipografía y la escala.
   =========================================================================== */

/** Escala de referencia de la banda, en días. Coincide con el techo del Fast Track. */
const ESCALA_DIAS = 40;

/** Marcas de la regla inferior. */
const MARCAS = [0, 10, 20, 30, 40];

type EtapaMeta = {
  /** Día en que arranca la etapa dentro de la escala de 40 días. */
  desde: number;
  /** Día en que cierra la etapa. El ancho del bloque es (hasta - desde). */
  hasta: number;
  detalle: string;
};

/**
 * Metadatos por índice de LUXCARS_CONFIG.timeline. El día y el título vienen
 * siempre del config (fuente de verdad); aquí solo viven la proporción en la
 * escala y el detalle largo.
 */
const ETAPAS_META: EtapaMeta[] = [
  {
    desde: 0,
    hasta: 1,
    detalle:
      "Rastreamos inventario en más de 10 portales de Miami, comparamos precio real de mercado y negociamos directo con el dealer.",
  },
  {
    desde: 1,
    hasta: 4,
    detalle:
      "Inspección presencial con técnicos certificados, informe de 150 puntos, CarFax, AutoCheck y verificación de título limpio.",
  },
  {
    desde: 4,
    hasta: 5,
    detalle:
      "Reserva confirmada, transporte interno hasta el puerto, seguro de carga y evidencia fotográfica del embarque.",
  },
  {
    desde: 5,
    hasta: 20,
    detalle:
      "El tramo más largo y el menos negociable: depende del calendario de naves. Seguimiento semanal y control documentario.",
  },
  {
    desde: 20,
    hasta: 28,
    detalle:
      "Agente de aduanas gestiona la declaración ante SUNAT, liquidación de tributos y levante del vehículo en Callao.",
  },
  {
    desde: 28,
    hasta: 35,
    detalle:
      "Homologación, revisión técnica, inscripción registral y emisión de placas a nombre del propietario final.",
  },
  {
    desde: 35,
    hasta: 40,
    detalle:
      "Entrega en Lima con carpeta documentaria completa, tarjeta de propiedad, placas y detailing de recepción.",
  },
];

const META_POR_DEFECTO: EtapaMeta = {
  desde: 0,
  hasta: ESCALA_DIAS,
  detalle:
    "Coordinación personalizada con reporte de avance y documentación digital en cada hito.",
};

export function ProcesoSection() {
  const etapas = LUXCARS_CONFIG.timeline;
  const { fastTrack, standard } = LUXCARS_CONFIG.deliveryWindows;
  const total = etapas.length;

  return (
    <section
      id="timeline"
      aria-labelledby="proceso-titulo"
      className="scroll-mt-32 overflow-hidden border-t border-line pt-14 md:pt-24 lg:pt-28"
    >
      {/* ---------------------------------------------------------------
          CABECERA ASIMÉTRICA
          Titular a la izquierda, ficha de datos alineada abajo a la derecha.
          --------------------------------------------------------------- */}
      <header className="grid gap-10 md:grid-cols-12 md:items-end md:gap-8">
        <div className="md:col-span-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-silver-dim">
            Proceso de importación
          </p>

          <h2
            id="proceso-titulo"
            className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl"
          >
            Siete etapas
            <span className="block text-ink-4">de Miami a tu cochera.</span>
          </h2>

          <p className="mt-6 max-w-xl text-sm leading-relaxed text-ink-3 md:text-[15px]">
            Cada etapa tiene responsable, plazo y evidencia. Los días son
            referenciales: se cuentan desde la reserva confirmada y dependen del
            calendario de naves y de los tiempos de SUNAT.
          </p>
        </div>

        {/* Dato protagonista + ficha de plazos */}
        <div className="w-full md:col-span-5 md:ml-auto md:max-w-sm md:text-right">
          <p className="font-mono text-6xl leading-none tabular-nums text-silver-bright sm:text-7xl">
            {fastTrack.days[0]}
            <span className="text-ink-4">—</span>
            {fastTrack.days[1]}
          </p>
          <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.3em] text-silver-dim">
            Días · {fastTrack.label}
          </p>

          <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
            <div className="flex items-baseline justify-between gap-6 py-3">
              <dt className="text-ink-4">{standard.label}</dt>
              <dd className="font-mono tabular-nums text-ink-2">
                {standard.days[0]}–{standard.days[1]} días
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 py-3">
              <dt className="text-ink-4">Etapas</dt>
              <dd className="font-mono tabular-nums text-ink-2">
                {String(total).padStart(2, "0")}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-6 py-3">
              <dt className="text-ink-4">Origen</dt>
              <dd className="font-mono uppercase tracking-[0.2em] text-ink-2">
                Miami → Callao
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {/* ---------------------------------------------------------------
          BANDA DE ESCALA
          Cada bloque ocupa el ancho proporcional a los días que dura.
          Es gráfico puro: las etiquetas viven en la lista de abajo.
          --------------------------------------------------------------- */}
      <div className="mt-14 md:mt-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-4">
          Duración relativa de cada etapa
        </p>

        <div
          className="mt-5 flex w-full gap-px"
          role="img"
          aria-label={`Escala proporcional de ${total} etapas repartidas en ${ESCALA_DIAS} días.`}
        >
          {etapas.map((etapa, index) => {
            const meta = ETAPAS_META[index] ?? META_POR_DEFECTO;
            const peso = Math.max(meta.hasta - meta.desde, 0.5);
            const esUltima = index === total - 1;

            return (
              <div
                key={etapa.day}
                style={{ flexGrow: peso, flexBasis: 0 }}
                className={[
                  "h-14 min-w-0 md:h-20 lg:h-24",
                  esUltima ? "bg-surface-3" : "bg-surface-2",
                ].join(" ")}
              >
                {/* Filete superior: marca el inicio de cada etapa. */}
                <span
                  aria-hidden="true"
                  className={[
                    "block h-px w-full",
                    esUltima ? "bg-silver" : "bg-line-strong",
                  ].join(" ")}
                />
              </div>
            );
          })}
        </div>

        {/* Regla de días */}
        <div className="mt-3 flex justify-between font-mono text-[10px] tabular-nums text-ink-4 md:text-[11px]">
          {MARCAS.map((marca) => (
            <span key={marca}>{marca === ESCALA_DIAS ? `${marca} días` : marca}</span>
          ))}
        </div>
      </div>

      {/* ---------------------------------------------------------------
          LISTA DENSA
          Filetes finos, numeración a gran escala, sin tarjetas.
          --------------------------------------------------------------- */}
      <ol className="mt-16 md:mt-24">
        {etapas.map((etapa, index) => {
          const meta = ETAPAS_META[index] ?? META_POR_DEFECTO;
          const esUltima = index === total - 1;
          const numero = String(index + 1).padStart(2, "0");

          return (
            <li
              key={etapa.day}
              className="group grid gap-x-8 gap-y-4 border-t border-line py-8 last:border-b md:grid-cols-12 md:py-12"
            >
              {/* Numeración + día */}
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 md:col-span-3 md:block">
                <span
                  aria-hidden="true"
                  className={[
                    "font-mono text-4xl leading-none tabular-nums transition-colors duration-300 md:text-5xl lg:text-6xl",
                    esUltima
                      ? "text-silver-bright"
                      : "text-ink-4 group-hover:text-silver",
                  ].join(" ")}
                >
                  {numero}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-silver md:mt-5 md:block">
                  {etapa.day}
                </span>
              </div>

              {/* Título de la etapa */}
              <h3 className="min-w-0 text-xl font-medium tracking-tight text-ink md:col-span-4 md:text-2xl">
                {etapa.title}
              </h3>

              {/* Detalle */}
              <p className="min-w-0 text-sm leading-relaxed text-ink-3 md:col-span-5 md:text-[15px]">
                {meta.detalle}
              </p>
            </li>
          );
        })}
      </ol>

      {/* ---------------------------------------------------------------
          NOTA DE CIERRE
          --------------------------------------------------------------- */}
      <p className="mt-10 max-w-3xl text-xs leading-relaxed text-ink-4 md:mt-14 md:text-sm">
        Plazos referenciales. El conteo arranca con la reserva confirmada y
        puede variar por disponibilidad de naves, aforo de SUNAT o requisitos de
        homologación del modelo. Antes de reservar te entregamos el cronograma
        con las fechas concretas de tu unidad.
      </p>
    </section>
  );
}
