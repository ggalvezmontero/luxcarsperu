/**
 * Página de una marca (/importar/marca/<marca>): qué modelos de esa marca
 * califican al 0% de ad valorem, cuánto cuesta traer los que ya están
 * calculados y qué hay de esa marca en el stock de Lima.
 *
 * Ver `lib/importExamples/marca.ts` para el porqué. Mismas reglas que la
 * página de modelo: canónica propia, sin FAQPage (el layout ya emite uno), sin
 * precio en los datos estructurados y ningún número escrito a mano.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { VehicleCard } from "@/components/VehicleCard";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { PRICING_CONFIG, currentYearInLima } from "@/core/pricing/pricingConfig";
import { USED_ISC_RATE } from "@/core/pricing/vehicleCategories";
import { LUXCARS_CONFIG } from "@/lib/config";
import { rutaGuia } from "@/lib/guias";
import {
  MARCAS_IMPORTABLES,
  marcaPorSlug,
  mismaMarca,
  rutaMarca,
  type GrupoDeOrigen,
  type MarcaImportable,
} from "@/lib/importExamples/marca";
import { cotizarEjemplo, rutaModelo, tienePaginaPropia } from "@/lib/importExamples/modelo";
import { getImportExamplesForIsr } from "@/lib/importExamples/servidor";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";
import { getStockForIsr } from "@/lib/stock";
import { ORGANIZATION_ID, breadcrumbSchema } from "@/lib/structuredData";
import { formatCurrency, formatRate } from "@/lib/utils";

type Props = { params: Promise<{ marca: string }> };

const { contact, brandName } = LUXCARS_CONFIG;

/** Como /comprar: muestra stock, que cambia cuando el dueño publica un auto. */
export const revalidate = 300;

/** Solo existen las marcas de la lista: cualquier otra URL es un 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return MARCAS_IMPORTABLES.map((m) => ({ marca: m.slug }));
}

const GENERAL = formatRate(PRICING_CONFIG.adValoremByOrigin.otro);

const COTIZACION: Record<GrupoDeOrigen["cotizacion"], string> = {
  cero: "0% con certificado de origen",
  "seis-puede-bajar": `${GENERAL}; puede bajar a 0% según el VIN y el certificado`,
  seis: GENERAL,
};

/** La respuesta en una o dos frases, armada con lo que dice el motor de origen. */
function resumen(m: MarcaImportable): string {
  const n = m.reconocidos;
  if (m.conCero === n) {
    return `Los ${n} modelos de ${m.nombre} que cotizamos se ensamblan en Estados Unidos: son candidatos a 0% de ad valorem si la unidad es nueva y llega con certificado de origen.`;
  }
  if (m.conCero > 0) {
    return `De los ${n} modelos de ${m.nombre} que cotizamos, ${m.conCero} se ensamblan en Estados Unidos y son candidatos a 0% de ad valorem si la unidad es nueva y llega con certificado de origen. Los demás se cotizan con ${GENERAL}.`;
  }
  if (m.puedenBajar > 0) {
    return `Hoy cotizamos todos los modelos de ${m.nombre} con ${GENERAL} de ad valorem. En ${m.puedenBajar} de ellos la tasa puede bajar a 0% según la planta de la unidad, que se confirma con el VIN, y si el vendedor emite el certificado de origen.`;
  }
  return `Ninguno de los ${n} modelos de ${m.nombre} que cotizamos se ensambla en Estados Unidos, así que todos pagan ${GENERAL} de ad valorem al entrar a Perú, aunque se compren en Miami.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { marca } = await params;
  const m = marcaPorSlug(marca);
  if (!m) return { title: "Marca no disponible", robots: { index: false, follow: true } };

  const title = `Importar ${m.nombre} de Estados Unidos a Perú: modelos y arancel`;
  const description = `${resumen(m)} Mira el detalle por modelo y calcula el costo puesto en Lima.`;
  const ogTitle = `${title} | ${brandName}`;
  return {
    title,
    description,
    alternates: { canonical: rutaMarca(m.nombre) },
    openGraph: {
      ...OG_DEFAULTS,
      type: "article",
      url: `${contact.website}${rutaMarca(m.nombre)}`,
      title: ogTitle,
      description,
    },
    twitter: twitterCard(ogTitle, description),
  };
}

export default async function MarcaPage({ params }: Props) {
  const { marca } = await params;
  const m = marcaPorSlug(marca);
  if (!m) notFound();

  const anio = currentYearInLima();
  const ruta = rutaMarca(m.nombre);
  const url = `${contact.website}${ruta}`;
  const planes = PRICING_CONFIG.planConfigs;

  // Los ejemplos del dueño que son de esta marca, con su costo ya calculado.
  const { vehiculos } = await getImportExamplesForIsr();
  const calculados = vehiculos
    .filter(tienePaginaPropia)
    .filter((v) => mismaMarca(v.calculator.brand, m.nombre))
    .flatMap((v) => {
      const r = cotizarEjemplo(v, anio);
      return r.kind === "ready" ? [{ v, e: r.estimate }] : [];
    });

  // Lo que hay de la marca en Lima. Las unidades de demostración son ficticias
  // y las vendidas ya no se ofrecen: ninguna cuenta como stock.
  const stock = (await getStockForIsr(48)).filter(
    (v) => !v.isDemo && v.status !== "vendido" && mismaMarca(v.brand, m.nombre),
  );

  const otras = MARCAS_IMPORTABLES.filter((o) => o.slug !== m.slug);
  const textoResumen = resumen(m);

  const preguntas: { pregunta: string; respuesta: string }[] = [
    {
      pregunta: `¿Un ${m.nombre} comprado en Estados Unidos paga arancel en Perú?`,
      respuesta: `${textoResumen} Comprarlo en Miami no cambia nada: lo que decide es dónde se ensambló la unidad.`,
    },
    ...(calculados[0]
      ? [
          {
            pregunta: `¿Cuánto cuesta importar un ${m.nombre} a Perú?`,
            respuesta: `Depende del modelo y de su precio. Como referencia, ${calculados[0].v.name} con un precio de compra de ${formatCurrency(calculados[0].e.input.priceMiami)} queda en alrededor de ${formatCurrency(calculados[0].e.finalEstimate)} puesto en Lima con placas, con flete, seguro, tributos, aduana y servicio incluidos.`,
          },
        ]
      : [
          {
            pregunta: `¿Cuánto cuesta importar un ${m.nombre} a Perú?`,
            respuesta: `Depende del modelo, de su precio y de su motor. La calculadora te da el costo puesto en Lima con placas en un minuto, con flete, seguro, tributos, aduana y servicio incluidos.`,
          },
        ]),
    {
      pregunta: `¿Cuánto demora en llegar un ${m.nombre} importado?`,
      respuesta: `Con ${planes.fast.label}, ${planes.fast.timelineLabel} desde la compra. Con el plan ${planes.standard.label}, ${planes.standard.timelineLabel}.`,
    },
    {
      pregunta: `¿Puedo importar un ${m.nombre} usado?`,
      respuesta: `Sí, si es del año modelo en curso o del anterior (en ${anio}, modelos ${anio - 1} y ${anio}), tiene timón izquierdo de fábrica, no supera el tope de kilometraje y no es diésel. Un usado paga ${GENERAL} de ad valorem y ${formatRate(USED_ISC_RATE)} de ISC, así que casi siempre conviene traerlo nuevo.`,
    },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${url}#servicio`,
      serviceType: "Importación de vehículos desde Estados Unidos a Perú",
      name: `Importación de ${m.nombre} a Perú`,
      description: textoResumen,
      url,
      areaServed: { "@type": "Country", name: "Perú" },
      provider: { "@id": ORGANIZATION_ID },
    },
    breadcrumbSchema([
      { nombre: "Inicio", ruta: "/" },
      { nombre: "Importar", ruta: "/importar" },
      { nombre: m.nombre, ruta },
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
        <Section tone="bg" padding="tight">
          <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-2 text-sm text-ink-4">
            <Link href="/importar" className="hover:text-ink">Importar</Link>
            <Icon name="chevronRight" size={14} />
            <span className="text-ink-2">{m.nombre}</span>
          </nav>
          <div className="mt-6 max-w-3xl">
            <h1>
              <span className="eyebrow">Importación a pedido por marca</span>{" "}
              <span className="mt-3 block text-balance text-3xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-4xl lg:text-5xl">
                Importar {m.nombre} de Estados Unidos a Perú
              </span>
            </h1>
            <p className="mt-4 text-pretty text-base leading-relaxed text-ink-2 sm:text-lg">{textoResumen}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/calculadora" variant="accent" size="lg">
                <Icon name="calculator" size={18} />
                Calcular mi {m.nombre}
              </Button>
              <Button href="/como-funciona" variant="secondary" size="lg">
                Ver el proceso
              </Button>
            </div>
          </div>
        </Section>

        <Section tone="void">
          <SectionHeader
            eyebrow="Origen y arancel"
            title={`Qué modelos de ${m.nombre} pagan ad valorem`}
            description="El 0% no se gana por comprar en Miami: exige que el vehículo sea nuevo, originario de Estados Unidos y que llegue con certificado de origen."
          />
          <div className="mt-10 overflow-x-auto rounded-[22px] border border-line bg-surface">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-ink-4">
                  <th scope="col" className="px-5 py-4 font-semibold">Modelos</th>
                  <th scope="col" className="px-5 py-4 font-semibold">Se ensamblan en</th>
                  <th scope="col" className="px-5 py-4 font-semibold">Ad valorem que cotizamos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {m.grupos.map((g) => (
                  <tr key={`${g.cotizacion}-${g.pais}`}>
                    <th scope="row" className="px-5 py-4 font-medium leading-relaxed text-ink">{g.modelos.join(" · ")}</th>
                    <td className="px-5 py-4 text-ink-2">{g.pais}</td>
                    <td className="px-5 py-4 text-ink-2">{COTIZACION[g.cotizacion]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-3">
            Es lo que cotizamos hoy, con la regla prudente: ante la duda, {GENERAL}. Varios modelos cambian de planta de un año a otro, así que antes de comprar lo confirmamos con el VIN de la unidad. La regla completa está en la guía de{" "}
            <Link href={rutaGuia("ad-valorem-0-autos-estados-unidos")} className="font-semibold text-ink underline underline-offset-4">
              ad valorem 0%
            </Link>
            .
          </p>
        </Section>

        <Section tone="bg">
          <SectionHeader
            eyebrow="Costo puesto en Lima"
            title={`Cuánto cuesta importar un ${m.nombre}`}
            description={
              calculados.length > 0
                ? "Modelos ya calculados, con flete, seguro, tributos, aduana y servicio. Toca uno para ver su desglose."
                : "Depende del modelo, de su precio y de su motor. La calculadora te da la cifra con tus datos."
            }
          />
          {calculados.length > 0 ? (
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {calculados.map(({ v, e }) => (
                <li key={v.id}>
                  <Link
                    href={rutaModelo(v.id)}
                    className="group flex h-full flex-col justify-between gap-5 rounded-[22px] border border-line bg-surface p-6 transition-colors hover:border-line-strong"
                  >
                    <span>
                      <span className="block text-base font-semibold leading-snug text-ink">{v.name}</span>
                      <span className="mt-1 block text-sm tabular-nums text-ink-3">
                        {formatCurrency(e.input.priceMiami)} en EE.UU.
                      </span>
                    </span>
                    <span className="flex items-end justify-between gap-3 border-t border-line pt-4">
                      <span>
                        <span className="block text-[11px] uppercase tracking-[0.12em] text-ink-4">Puesto en Lima</span>
                        <span className="mt-0.5 block text-xl font-semibold tabular-nums tracking-tight text-ink">
                          {formatCurrency(e.finalEstimate)}
                        </span>
                      </span>
                      <Icon name="arrowRight" size={18} className="shrink-0 text-silver transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-8">
            <Button href="/calculadora" variant={calculados.length > 0 ? "secondary" : "accent"}>
              <Icon name="calculator" size={16} />
              Calcular otro modelo de {m.nombre}
            </Button>
          </div>
        </Section>

        <Section tone="void">
          <SectionHeader
            eyebrow="Stock en Lima"
            title={`${m.nombre} disponibles hoy en Lima`}
            description={
              stock.length > 0
                ? "Ya nacionalizados y con placas. Se ven y se manejan con cita."
                : `Hoy no tenemos ${m.nombre} publicados en Lima. Lo importamos a pedido o lo buscamos por ti.`
            }
          />
          {stock.length > 0 ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stock.map((v) => (
                <VehicleCard key={v.id} vehicle={v} />
              ))}
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/comprar" variant="secondary">Ver el stock disponible</Button>
              <Button href="/cuenta/comprar" variant="secondary">Pedir que lo busquen</Button>
            </div>
          )}
        </Section>

        <Section tone="bg">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHeader eyebrow="Dudas comunes" title={`Preguntas sobre importar ${m.nombre}`} />
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

        <Section tone="void">
          <SectionHeader eyebrow="Otras marcas" title="Importar otras marcas a Perú" />
          <ul className="mt-8 flex flex-wrap gap-2">
            {otras.map((o) => (
              <li key={o.slug}>
                <Link
                  href={rutaMarca(o.nombre)}
                  className="inline-flex rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                >
                  {o.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section tone="bg" padding="tight">
          <CtaBand
            title={`¿Buscas un ${m.nombre}?`}
            text="Dinos el modelo, la versión y el color. Te mandamos unidades reales en dealers de Estados Unidos con el costo final por escrito."
            message={`Hola Luxcars, quiero importar un ${m.nombre}. ¿Me ayudan con unidades disponibles y el costo final?`}
          />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
