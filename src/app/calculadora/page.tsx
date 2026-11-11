/**
 * Calculadora de importación en su propia página (/calculadora).
 *
 * POR QUÉ EXISTE: la calculadora es el activo del sitio y solo vivía como un
 * ancla de la portada (`/#calculator`). Un ancla no es una URL: la búsqueda
 * "calculadora importación de autos Perú" no tenía página que la respondiera,
 * y en Google esa búsqueda la ocupan simuladores de otros países porque no hay
 * ninguna peruana (estudio del 2026-11-10, docs/marketing).
 *
 * Es la MISMA calculadora de la portada (`CalculatorSection`), no una copia:
 * mismo motor, mismos presets, mismo estimado compartido. La portada la
 * conserva; esta página le suma lo que una búsqueda necesita: un H1 con la
 * búsqueda, qué calcula, con qué tasas y un ejemplo resuelto.
 *
 * Ningún número se escribe a mano: las tasas salen de `src/core/pricing` y el
 * ejemplo se recalcula con el motor cada vez que la página se regenera.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { CalculatorSection } from "@/components/CalculatorSection";
import { CtaBand } from "@/components/CtaBand";
import { GuiasDestacadas } from "@/components/guias/GuiasDestacadas";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { PRICING_CONFIG, oldestImportableModelYear } from "@/core/pricing/pricingConfig";
import {
  USED_ISC_RATE,
  VEHICLE_CATEGORIES,
  gasolineNewIscRate,
} from "@/core/pricing/vehicleCategories";
import { simulationPresets } from "@/data/trendingVehicles";
import { LUXCARS_CONFIG } from "@/lib/config";
import { cotizarEjemplo, rutaModelo, tienePaginaPropia } from "@/lib/importExamples/modelo";
import { getImportExamplesForIsr } from "@/lib/importExamples/servidor";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";
import { ORGANIZATION_ID, breadcrumbSchema } from "@/lib/structuredData";
import { formatCurrency, formatPercentage, formatRate } from "@/lib/utils";

const { contact, brandName } = LUXCARS_CONFIG;

const RUTA = "/calculadora";
const TITLE = "Calculadora de importación de autos a Perú";
const DESCRIPTION =
  "Calcula gratis cuánto cuesta importar y nacionalizar un auto de Estados Unidos a Perú: flete, seguro, ad valorem, ISC, IGV y servicio. Resultado al instante, sin dejar tu correo.";
const OG_TITLE = `${TITLE} | ${brandName}`;

/** Igual que /importar: el portal pide regenerar al guardar un ejemplo. */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: RUTA },
  openGraph: {
    ...OG_DEFAULTS,
    type: "website",
    url: `${contact.website}${RUTA}`,
    title: OG_TITLE,
    description: DESCRIPTION,
  },
  twitter: twitterCard(OG_TITLE, DESCRIPTION),
};

export default async function CalculadoraPage() {
  const { vehiculos } = await getImportExamplesForIsr();
  const cotizables = vehiculos.filter(tienePaginaPropia);
  const anioActual = new Date().getFullYear();
  const { igvRate, ipmRate, percepcionRates, adValoremByOrigin, usedMaxAgeYears } = PRICING_CONFIG;
  const variacion = formatPercentage(LUXCARS_CONFIG.services.finalRangeVariance, "es-PE", 1);

  // Ejemplo resuelto: el primer ejemplo cotizable de la lista del dueño.
  const ejemplo = cotizables
    .map((v) => ({ v, r: cotizarEjemplo(v, anioActual) }))
    .flatMap(({ v, r }) => (r.kind === "ready" ? [{ v, e: r.estimate }] : []))[0];

  const pasos = ejemplo
    ? [
        {
          n: "1",
          titulo: "Valor CIF",
          formula: "Precio + flete + seguro",
          monto: ejemplo.e.cif,
          nota: `${formatCurrency(ejemplo.e.input.priceMiami)} + ${formatCurrency(ejemplo.e.freight)} + ${formatCurrency(ejemplo.e.insurance)}. Es la base de todos los tributos.`,
        },
        {
          n: "2",
          titulo: `Ad valorem ${formatPercentage(ejemplo.e.adValoremRate)}`,
          formula: "Sobre el CIF",
          monto: ejemplo.e.adValorem,
          nota: "0% solo si el vehículo es nuevo, originario de Estados Unidos y llega con certificado de origen. En cualquier otro caso, 6%.",
        },
        {
          n: "3",
          titulo: `ISC ${formatPercentage(ejemplo.e.iscRate)}`,
          formula: "Sobre CIF + ad valorem",
          monto: ejemplo.e.isc,
          nota: "Depende del motor y de si el vehículo es nuevo o usado. La tabla está más abajo.",
        },
        {
          n: "4",
          titulo: `IGV ${formatRate(igvRate)} + IPM ${formatRate(ipmRate)}`,
          formula: "Sobre CIF + ad valorem + ISC",
          monto: ejemplo.e.igv + ejemplo.e.ipm,
          nota: "El 18% de siempre, con su composición legal vigente.",
        },
        {
          n: "5",
          titulo: "Costos de aduana",
          formula: "Monto fijo por vehículo",
          monto: ejemplo.e.customsFee,
          nota: "El despacho en el Callao. No entra en la base de ningún tributo.",
        },
        {
          n: "6",
          titulo: "Servicio LuxCars",
          formula: "Inspección, compra, logística y trámite",
          monto: ejemplo.e.brokerFee + ejemplo.e.documentHandlingFee,
          nota: "Ya está dentro del estimado: no aparece como cargo nuevo al final.",
        },
      ]
    : [];

  const filasIsc = VEHICLE_CATEGORIES.map((c) => ({
    motor: c.label,
    nuevo:
      c.newIscRate !== null
        ? formatRate(c.newIscRate)
        : `${formatRate(gasolineNewIscRate(1400))} hasta 1,400 cc · ${formatRate(gasolineNewIscRate(1500))} hasta 1,500 cc · ${formatRate(gasolineNewIscRate(2000))} por encima`,
    usado: c.usedImportAllowed ? formatRate(USED_ISC_RATE) : "Importación prohibida",
  }));

  const preguntas: { pregunta: string; respuesta: string }[] = [
    {
      pregunta: "¿Cuánto cuesta nacionalizar un auto en Perú?",
      respuesta: `Depende de tres cosas: el precio del vehículo, dónde se ensambló y qué motor tiene. Un vehículo nuevo paga ad valorem de 0% o ${formatRate(adValoremByOrigin.otro)}, ISC de 0% a 20% según el motor, y ${formatRate(igvRate + ipmRate)} entre IGV e IPM, cada uno sobre la base que dejó el anterior. La calculadora aplica esa cascada con tus datos y te da la cifra exacta.`,
    },
    {
      pregunta: "¿La calculadora es gratis? ¿Tengo que dejar mis datos?",
      respuesta:
        "Es gratis y no pide correo ni teléfono. El resultado completo, con el desglose línea por línea, sale en pantalla. Puedes descargarlo en PDF o compartirlo con un enlace.",
    },
    {
      pregunta: "¿Qué tan exacto es el resultado?",
      respuesta: `El rango final se mueve ±${variacion}. Los tributos son tasas fijas y no cambian. Lo que varía es el tipo de cambio del día, el flete del mes y el valor que SUNAT acepte como base imponible.`,
    },
    {
      pregunta: "¿Sirve para carros usados?",
      respuesta: `Sí. Marca "Usado" y la calculadora aplica ISC de ${formatRate(USED_ISC_RATE)} y ad valorem de ${formatRate(adValoremByOrigin.otro)}. También te avisa si el vehículo no puede entrar: un usado no puede tener más de ${usedMaxAgeYears} años desde su año modelo (en ${anioActual}, del ${oldestImportableModelYear(anioActual)} en adelante) y el diésel usado está prohibido.`,
    },
    {
      pregunta: "¿Qué es la percepción del IGV y por qué sale aparte?",
      respuesta: `Es un adelanto del IGV que SUNAT cobra al importar y que luego se recupera como crédito fiscal. No es un costo, pero sí es efectivo que hay que tener el día del despacho: ${formatRate(percepcionRates.recurrenteNuevo)} para un importador recurrente con vehículo nuevo, ${formatRate(percepcionRates.usado)} en usados y ${formatRate(percepcionRates.primeraImportacion)} en una primera importación. Por eso la calculadora muestra dos cifras: el costo real y el efectivo necesario.`,
    },
    {
      pregunta: "¿El resultado incluye placas?",
      respuesta:
        "Sí. La cifra es el vehículo puesto en Lima: comprado, inspeccionado, embarcado, nacionalizado y con placas.",
    },
    {
      pregunta: "¿Desde qué precio importan?",
      respuesta: `Desde ${formatCurrency(LUXCARS_CONFIG.services.minimumVehiclePrice)} de precio en Estados Unidos. Por debajo de ese monto los costos fijos del proceso pesan demasiado sobre el valor del vehículo y la calculadora lo indica.`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "@id": `${contact.website}${RUTA}#calculadora`,
      name: TITLE,
      url: `${contact.website}${RUTA}`,
      description: DESCRIPTION,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      inLanguage: "es-PE",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
      provider: { "@id": ORGANIZATION_ID },
    },
    breadcrumbSchema([
      { nombre: "Inicio", ruta: "/" },
      { nombre: "Calculadora de importación", ruta: RUTA },
    ]),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Navbar />
      <main id="contenido" className="w-full flex-1 pt-[var(--lux-nav-h)]">
        <CalculatorSection
          presets={simulationPresets(vehiculos)}
          basePath={RUTA}
          titulo={TITLE}
          tituloComo="h1"
        />

        <Section tone="bg">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionHeader
                eyebrow="Cómo se calcula"
                title="Los impuestos van en cascada, no en un porcentaje plano"
              />
              <div className="mt-6 space-y-4 text-pretty text-base leading-relaxed text-ink-2">
                <p>
                  Importar un auto a Perú no cuesta un porcentaje fijo sobre el precio. Cada tributo se calcula sobre el valor en aduana más los tributos anteriores, así que el orden importa y el resultado cambia mucho de un vehículo a otro.
                </p>
                <p>
                  La calculadora aplica esa cascada tal como la liquida un agente de aduana, con las tasas vigentes de SUNAT. Es la misma herramienta con la que cotizamos internamente.
                </p>
                {ejemplo ? (
                  <p>
                    A la derecha, el cálculo resuelto para{" "}
                    <Link href={rutaModelo(ejemplo.v.id)} className="font-semibold text-ink underline underline-offset-4">
                      {ejemplo.v.name}
                    </Link>
                    , con un precio de compra de {formatCurrency(ejemplo.e.input.priceMiami)}.
                  </p>
                ) : null}
              </div>
            </div>

            {ejemplo ? (
              <div className="lg:col-span-7">
                <ol className="divide-y divide-line rounded-[22px] border border-line bg-surface">
                  {pasos.map((p) => (
                    <li key={p.n} className="flex gap-4 p-5 sm:p-6">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold tabular-nums text-ink-3">
                        {p.n}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className="text-base font-semibold text-ink">{p.titulo}</h3>
                          <p className="text-base font-semibold tabular-nums text-ink">{formatCurrency(p.monto)}</p>
                        </div>
                        <p className="mt-0.5 text-xs uppercase tracking-[0.12em] text-ink-4">{p.formula}</p>
                        <p className="mt-2 text-sm leading-relaxed text-ink-3">{p.nota}</p>
                      </div>
                    </li>
                  ))}
                  <li className="flex items-center justify-between gap-4 p-5 sm:p-6">
                    <p className="text-base font-semibold text-ink">Costo final puesto en Lima, con placas</p>
                    <p className="text-xl font-semibold tabular-nums text-ink">{formatCurrency(ejemplo.e.finalEstimate)}</p>
                  </li>
                </ol>
                <p className="mt-3 px-1 text-xs leading-relaxed text-ink-4">
                  Aparte, la percepción del IGV ({formatRate(ejemplo.e.percepcionRate)}, {formatCurrency(ejemplo.e.percepcion)}): un adelanto recuperable que se paga el día del despacho.
                </p>
              </div>
            ) : null}
          </div>
        </Section>

        <Section tone="void">
          <SectionHeader
            eyebrow="ISC por tipo de motor"
            title="El motor decide el impuesto más variable"
            description="El Impuesto Selectivo al Consumo va de 0% a 40% según la propulsión y la condición del vehículo. Es lo que más mueve el resultado."
          />
          <div className="mt-10 overflow-x-auto rounded-[22px] border border-line bg-surface">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-ink-4">
                  <th scope="col" className="px-5 py-4 font-semibold">Motor</th>
                  <th scope="col" className="px-5 py-4 font-semibold">ISC si es nuevo</th>
                  <th scope="col" className="px-5 py-4 font-semibold">ISC si es usado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filasIsc.map((f) => (
                  <tr key={f.motor}>
                    <th scope="row" className="px-5 py-4 font-medium text-ink">{f.motor}</th>
                    <td className="px-5 py-4 tabular-nums text-ink-2">{f.nuevo}</td>
                    <td className="px-5 py-4 tabular-nums text-ink-2">{f.usado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-3">
            Un híbrido suave de 48 V no cuenta como híbrido para el ISC: tributa como gasolina. Antes de comprar confirmamos la versión exacta con el VIN de la unidad.
          </p>
        </Section>

        <Section tone="bg">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHeader eyebrow="Dudas comunes" title="Preguntas sobre la calculadora" />
              <Button href="/importar" variant="secondary" className="mt-6">
                Cómo importamos
                <Icon name="arrowRight" size={16} />
              </Button>
            </div>
            <div className="lg:col-span-8">
              <div className="divide-y divide-line rounded-[22px] border border-line bg-surface">
                {preguntas.map((item, i) => (
                  <details key={item.pregunta} className="group px-5 sm:px-6" open={i === 0}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-medium text-ink [&::-webkit-details-marker]:hidden">
                      <h3 className="text-base font-medium">{item.pregunta}</h3>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-3 transition-transform duration-300 group-open:rotate-45 group-open:border-silver group-open:text-ink">
                        <Icon name="close" size={16} className="rotate-45" />
                      </span>
                    </summary>
                    <p className="pb-6 pr-12 text-sm leading-relaxed text-ink-2 sm:text-[15px]">{item.respuesta}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {cotizables.length > 0 ? (
          <Section tone="void">
            <SectionHeader
              eyebrow="Ya calculados"
              title="Cuánto cuesta importar los modelos más pedidos"
              description="Cada uno con su precio en Estados Unidos, sus tributos y el costo final puesto en Lima."
            />
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cotizables.map((o) => (
                <li key={o.id}>
                  <Link
                    href={rutaModelo(o.id)}
                    className="group flex h-full items-center justify-between gap-4 rounded-[22px] border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                  >
                    <span>
                      <span className="block text-base font-semibold leading-snug text-ink">{o.name}</span>
                      <span className="mt-1 block text-sm text-ink-3">{o.segment}</span>
                    </span>
                    <Icon name="arrowRight" size={18} className="shrink-0 text-silver transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <GuiasDestacadas tone="bg" titulo="Entiende cada línea del cálculo" />

        <Section tone="void" padding="tight">
          <CtaBand
            title="¿Ya tienes el número?"
            text="Mándanos el modelo y la versión. Te devolvemos unidades reales en dealers de Estados Unidos con el costo final por escrito."
            message="Hola LuxCars, usé la calculadora y quiero una cotización por escrito."
          />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
