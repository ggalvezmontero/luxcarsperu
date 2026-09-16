import Image from "next/image";

import { PRICING_CONFIG } from "@/core/pricing/pricingConfig";
import { LUXCARS_CONFIG } from "@/lib/config";
import { formatPercentage } from "@/lib/utils";

/* ===========================================================================
   CONFIANZA — pruebas, no adjetivos.
   ---------------------------------------------------------------------------
   Sustituye a WhyUsSection. Aquella listaba virtudes ("transparencia total",
   "somos tu broker"): afirmaciones que cualquier competidor puede copiar en
   diez minutos. Esta sección solo muestra cosas que el comprador puede
   verificar por su cuenta: la razón social y el RUC (consultables en SUNAT),
   una oficina con dirección exacta, los informes que se entregan y —el activo
   real— el cálculo tributario completo, línea por línea, publicado antes de
   que nadie lo pida.

   Decisiones de composición, deliberadamente distintas al resto del sitio:
     · sin tarjeta contenedora: la sección respira sobre el fondo de página;
     · titular a escala gráfica (hasta text-7xl) y rejilla de 12 columnas
       asimétrica, con el cuerpo desplazado a la derecha;
     · banda de identidad a sangre del ancho de la sección, sobre bg-void,
       con el isotipo como marca de agua recortada;
     · tabla de datos densa (el recurso de RM Sotheby's), que no existe hoy en
       ninguna otra sección;
     · filetes finos y numeración a gran escala en lugar de tarjetas.

   CROMÁTICA: cero oro. La home ya tiene sus dos únicos acentos dorados y aquí
   no se añade un tercero. Todo el acento es plata.

   CIFRAS: ninguna inventada. Las tasas se leen de PRICING_CONFIG, que es la
   misma fuente que alimenta la calculadora pública; si allí cambian, aquí
   cambian. No hay testimonios, ni volumen de ventas, ni años de experiencia:
   nada de eso está confirmado.
   =========================================================================== */

const { contact, legalName, ruc } = LUXCARS_CONFIG;

const IDENTITY_ROWS: ReadonlyArray<{
  label: string;
  value: string;
  /** Solo el RUC va en monoespaciada: es un dato para copiar y verificar. */
  mono?: boolean;
}> = [
  { label: "Razón social", value: legalName },
  { label: "RUC", value: ruc, mono: true },
  { label: "Oficina", value: `${contact.address} — ${contact.city}` },
  { label: "Atención directa", value: `${contact.phone} · ${contact.email}` },
];

const pct = (value: number, digits = 0) =>
  formatPercentage(value, "es-PE", digits);

const AD_VALOREM_NEW = pct(PRICING_CONFIG.adValoremByOrigin["originario-usa"]);
const AD_VALOREM_OTHER = pct(PRICING_CONFIG.adValoremByOrigin.otro);

/**
 * El desglose que publica la calculadora. Tercera columna = tasa o base, nunca
 * un monto: los montos dependen del vehículo y prometerlos aquí sería el mismo
 * error que inflar un precio de catálogo.
 */
const LEDGER_ROWS: ReadonlyArray<{
  concept: string;
  base: string;
  rate: string;
  emphasis?: boolean;
}> = [
  {
    concept: "Flete internacional",
    base: "Miami → Callao",
    rate: "Según categoría de vehículo",
  },
  {
    concept: "Seguro internacional",
    base: `${pct(PRICING_CONFIG.insuredValueFactor)} del FOB + flete`,
    rate: `${pct(PRICING_CONFIG.insuranceRate, 2)} · mínimo USD ${PRICING_CONFIG.insuranceMinimum}`,
  },
  {
    concept: "CIF",
    base: "Vehículo + flete + seguro",
    rate: "Base imponible de todo lo que sigue",
  },
  {
    concept: "Ad Valorem",
    base: "Sobre CIF",
    rate: `${AD_VALOREM_NEW} nuevo originario EE.UU. (APC) · ${AD_VALOREM_OTHER} usado o no originario`,
  },
  {
    concept: "ISC",
    base: "Sobre CIF + Ad Valorem",
    rate: "Según cilindrada, combustible y condición",
  },
  {
    concept: "IGV",
    base: "Sobre CIF + Ad Valorem + ISC",
    rate: pct(PRICING_CONFIG.igvRate, 1),
  },
  {
    concept: "IPM",
    base: "Sobre CIF + Ad Valorem + ISC",
    rate: pct(PRICING_CONFIG.ipmRate, 1),
  },
  {
    concept: "Percepción del IGV",
    base: "Sobre la base imponible",
    rate: `${pct(PRICING_CONFIG.percepcionRates.primeraImportacion)} · ${pct(PRICING_CONFIG.percepcionRates.usado)} · ${pct(PRICING_CONFIG.percepcionRates.recurrenteNuevo, 1)} — adelanto recuperable, no es costo`,
  },
  {
    concept: "State Compliance Fee",
    base: "Sobre el valor del vehículo",
    rate: pct(PRICING_CONFIG.stateComplianceRate),
  },
  {
    concept: "Honorario LuxCars",
    base: "Sobre el valor del vehículo",
    rate: pct(PRICING_CONFIG.brokerFeeRate),
    emphasis: true,
  },
];

const PROOFS = [
  {
    title: "CarFax y AutoCheck",
    body:
      "Los dos informes de historial, completos, antes de que transfieras un dólar. Accidentes reportados, lecturas de odómetro, número de dueños y estado del título. Si el reporte tiene algo feo, lo verás tú, no te lo contaremos nosotros.",
  },
  {
    title: "Inspección presencial ASE + escáner",
    body:
      "Un técnico certificado ASE revisa la unidad en Miami y conecta el escáner de diagnóstico. Códigos almacenados, testigos pendientes y estado mecánico real: lo que una galería de fotos no puede mostrar.",
  },
  {
    title: "Consignación sin exclusividad",
    body:
      "Si nos dejas tu auto en venta, sigues manejándolo y no firmas exclusividad. Lo coordinamos solo para las visitas. Y si terminas vendiéndolo por tu cuenta, no nos debes comisión. Es la única forma honesta de pedirte que nos pruebes.",
  },
] as const;

export function ConfianzaSection() {
  return (
    <section
      id="confianza"
      aria-labelledby="confianza-title"
      className="scroll-mt-32 py-16 sm:py-24 lg:py-32"
    >
      {/* ---------------------------------------------------------------
          1. Declaración. Titular a escala gráfica, cuerpo desplazado.
          --------------------------------------------------------------- */}
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <p className="flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.3em] text-silver-dim">
            <span aria-hidden="true" className="h-px w-8 bg-silver-dim" />
            Confianza verificable
          </p>
          <h2
            id="confianza-title"
            className="mt-8 text-4xl font-semibold leading-[1.02] tracking-[-0.02em] text-balance text-ink sm:text-5xl lg:text-7xl"
          >
            Nada de lo que decimos depende de que nos creas.
          </h2>
        </div>

        <div className="self-end lg:col-span-4 lg:col-start-9">
          <p className="max-w-prose text-base leading-relaxed text-ink-2">
            Comprar un auto de seis cifras a diez mil kilómetros de distancia es
            un acto de confianza incómodo. Así que no te pedimos confianza: te
            dejamos comprobarlo todo. Empezando por el cálculo completo, que
            publicamos antes de que lo pidas.
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------------
          2. Identidad. Banda a sangre del ancho de la sección, sobre el
             negro más profundo del sistema, con el isotipo de marca de agua.
          --------------------------------------------------------------- */}
      <div className="relative mt-16 overflow-hidden rounded-lux-lg bg-void sm:mt-24 lg:mt-32">
        <Image
          src="/brand/isotipo-blanco.svg"
          alt=""
          aria-hidden="true"
          width={720}
          height={540}
          className="pointer-events-none absolute -right-12 -bottom-16 h-52 w-auto select-none opacity-[0.05] sm:h-64 lg:h-80"
        />

        <div className="relative px-6 py-12 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-silver-dim">
            Quién factura
          </p>

          <dl className="mt-10 divide-y divide-line border-t border-line">
            {IDENTITY_ROWS.map((row) => (
              <div
                key={row.label}
                className="grid gap-1 py-5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-8 sm:py-6"
              >
                <dt className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-4">
                  {row.label}
                </dt>
                <dd
                  className={`text-sm leading-relaxed text-silver-bright sm:text-base ${
                    row.mono ? "font-mono tracking-[0.08em] tabular-nums" : ""
                  }`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-ink-3">
            El RUC es público: búscalo en SUNAT antes de escribirnos. La oficina
            existe y se puede visitar — no somos un número de WhatsApp y un
            catálogo de fotos prestadas.
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------------
          3. El cálculo. Tabla densa: el recurso que ninguna otra sección
             del sitio usa, y el argumento que ningún competidor publica.
          --------------------------------------------------------------- */}
      <div className="mt-16 sm:mt-24 lg:mt-32">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-silver-dim">
              El cálculo, línea por línea
            </p>
            <h3 className="mt-6 text-2xl font-semibold leading-tight tracking-[-0.01em] text-ink sm:text-3xl lg:text-4xl">
              Esta es la tabla que el resto del mercado prefiere explicarte por
              teléfono.
            </h3>
          </div>
          <p className="max-w-prose text-sm leading-relaxed text-ink-3 lg:col-span-5 lg:col-start-8">
            Cada concepto que toca tu dinero entre Miami y Lima, con su base de
            cálculo y su tasa. Incluido nuestro honorario, que aparece en la
            misma tabla que los impuestos y no escondido dentro del precio.
          </p>
        </div>

        {/* La tabla desborda en móvil y tablet: el scroll vive AQUÍ dentro,
            sin márgenes negativos, para que la página nunca desborde en
            horizontal a 360px ni a 768px. */}
        <div className="mt-10 max-w-full overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <caption className="sr-only">
              Desglose de conceptos tributarios y honorarios aplicados a la
              importación de un vehículo desde Estados Unidos.
            </caption>
            <thead>
              <tr className="border-b border-line-strong">
                <th
                  scope="col"
                  className="w-[28%] pb-4 pr-6 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-4"
                >
                  Concepto
                </th>
                <th
                  scope="col"
                  className="w-[30%] pb-4 pr-6 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-4"
                >
                  Base de cálculo
                </th>
                <th
                  scope="col"
                  className="pb-4 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-4"
                >
                  Tasa aplicada
                </th>
              </tr>
            </thead>
            <tbody>
              {LEDGER_ROWS.map((row) => (
                <tr
                  key={row.concept}
                  className="border-b border-line align-top transition-colors duration-200 hover:bg-surface/60"
                >
                  <th
                    scope="row"
                    className={`py-5 pr-6 text-sm font-medium leading-snug ${
                      row.emphasis ? "text-silver-bright" : "text-ink"
                    }`}
                  >
                    {row.concept}
                  </th>
                  <td className="py-5 pr-6 text-sm leading-relaxed text-ink-3">
                    {row.base}
                  </td>
                  <td
                    className={`py-5 text-sm leading-relaxed ${
                      row.emphasis ? "text-silver-bright" : "text-ink-2"
                    }`}
                  >
                    {row.rate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-8">
          <p className="text-xs leading-relaxed text-ink-4 lg:col-span-6">
            Cifras referenciales. El monto final depende de la partida
            arancelaria que determine SUNAT y de la valorización en aduana. Un
            vehículo usado solo puede nacionalizarse dentro de los{" "}
            {PRICING_CONFIG.usedMaxAgeYears} años posteriores a su año modelo.
          </p>
          <p className="text-xs leading-relaxed text-ink-4 lg:col-span-5 lg:col-start-8">
            La percepción del IGV no es un costo: es un adelanto que se recupera
            como crédito fiscal. Sí es caja que hay que poner, y por eso la
            declaramos por separado en vez de diluirla en el total.
          </p>
        </div>

        <p className="mt-10">
          <a
            href="#calculator"
            className="group inline-flex items-center gap-3 text-sm font-medium uppercase tracking-[0.18em] text-silver transition-colors duration-200 hover:text-silver-bright"
          >
            Correr el cálculo con tu auto
            <span
              aria-hidden="true"
              className="h-px w-10 bg-silver-dim transition-all duration-300 group-hover:w-16 group-hover:bg-silver-bright"
            />
          </a>
        </p>
      </div>

      {/* ---------------------------------------------------------------
          4. Verificación. Filetes finos y numeración a gran escala:
             cero tarjetas, cero bordes cerrados.
          --------------------------------------------------------------- */}
      <div className="mt-16 sm:mt-24 lg:mt-32">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-silver-dim">
          Lo que revisamos antes de que pagues
        </p>

        <ol className="mt-10 border-b border-line">
          {PROOFS.map((proof, index) => (
            <li
              key={proof.title}
              className="grid gap-4 border-t border-line py-10 sm:gap-6 lg:grid-cols-12 lg:gap-8 lg:py-14"
            >
              <span
                aria-hidden="true"
                className="text-5xl font-semibold leading-none tracking-tight tabular-nums text-ink-4/35 sm:text-6xl lg:col-span-2 lg:text-7xl"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-xl font-semibold leading-snug tracking-tight text-ink sm:text-2xl lg:col-span-4">
                {proof.title}
              </h3>
              <p className="max-w-prose text-sm leading-relaxed text-ink-2 lg:col-span-5 lg:col-start-8">
                {proof.body}
              </p>
            </li>
          ))}
        </ol>
      </div>

      {/* ---------------------------------------------------------------
          5. Cierre desplazado. Sin caja, sin CTA en botón: una línea.
          --------------------------------------------------------------- */}
      <div className="mt-16 sm:mt-24 lg:mt-32 lg:ml-[33.333%] lg:pl-8">
        <p className="text-2xl font-semibold leading-snug tracking-[-0.01em] text-balance text-ink sm:text-3xl">
          Si un importador no puede mostrarte esto, la pregunta no es cuánto
          cobra. Es qué prefiere que no revises.
        </p>
        <p className="mt-6 max-w-prose text-sm leading-relaxed text-ink-3">
          {legalName} · RUC {ruc} · {contact.address}, {contact.city}. Puedes
          venir a la oficina antes de decidir nada.
        </p>
      </div>
    </section>
  );
}
