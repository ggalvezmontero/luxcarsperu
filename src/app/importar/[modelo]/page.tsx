/**
 * Página de un modelo (/importar/<id>): cuánto cuesta importar ESE vehículo a
 * Perú, con el número ya calculado y el desglose a la vista.
 *
 * CÓMO SE RELACIONA CON EL SEO DEL SITIO — leer antes de tocar:
 *   · Es la página que responde las búsquedas de modelo concreto ("cuánto
 *     cuesta importar una Tundra a Perú", "Bronco Raptor Perú precio"). Antes
 *     esas búsquedas solo tenían `/?simular=<id>`, que es la portada con un
 *     parámetro y canoniza a "/": ver `lib/importExamples/modelo.ts`.
 *   · Hay una por cada ejemplo que se puede cotizar. Los ejemplos salen de la
 *     base (se editan en /portal/ejemplos) con el archivo del repositorio como
 *     respaldo, igual que en la home y en /importar.
 *   · Canónica propia, entra al sitemap y se enlaza desde /importar, desde la
 *     home y desde las demás páginas de modelo.
 *   · SIN FAQPage propio: el layout ya emite el del sitio en todas las páginas
 *     y dos FAQPage en una URL es un error en Search Console. Las preguntas de
 *     abajo son contenido visible, que es lo que posiciona.
 *   · SIN precio en los datos estructurados: la cifra es un estimado
 *     referencial, no una oferta. Publicarla como `Offer` sería prometerla.
 *
 * El número se recalcula con las tasas vigentes cada vez que la página se
 * regenera; no se guarda en ningún sitio.
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/Button";
import { CreditoFoto } from "@/components/CreditoFoto";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import {
  QuoteBreakdown,
  QuoteChips,
  describeOrigin,
  quoteTaxes,
} from "@/components/cotizacion/QuoteBreakdown";
import { Badge } from "@/components/ui/Badge";
import { Icon, WhatsAppIcon } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { PRICING_CONFIG, currentYearInLima, oldestImportableModelYear } from "@/core/pricing/pricingConfig";
import { getVehicleCategory, resolveIscRate } from "@/core/pricing/vehicleCategories";
import type { ImportableTrendingVehicle } from "@/data/trendingVehicles";
import { LUXCARS_CONFIG } from "@/lib/config";
import {
  articuloDe,
  conArticulo,
  cotizarEjemplo,
  rutaCalculadora,
  rutaModelo,
  tienePaginaPropia,
} from "@/lib/importExamples/modelo";
import { marcaPorNombre, rutaMarca } from "@/lib/importExamples/marca";
import { getImportExamples, getImportExamplesForIsr } from "@/lib/importExamples/servidor";
import { OG_DEFAULTS, OG_IMAGE, twitterCard } from "@/lib/seo";
import { ORGANIZATION_ID, breadcrumbSchema } from "@/lib/structuredData";
import { formatCurrency, formatPercentage, formatRate } from "@/lib/utils";
import { buildBlockedCalculatorWhatsappLink, buildWhatsappLink } from "@/lib/whatsapp";

type Props = { params: Promise<{ modelo: string }> };

const { contact, brandName } = LUXCARS_CONFIG;

/**
 * Misma red de seguridad que /importar: el portal pide regenerar al guardar un
 * ejemplo y, si ese aviso se pierde, la página se rehace una vez al día (que
 * además es lo que mantiene al día el año en curso y las tasas).
 */
export const revalidate = 86400;

/**
 * Las páginas de los ejemplos actuales se generan al compilar. Un ejemplo que
 * el dueño cree después en el portal se genera en su primera visita.
 * `getImportExamples` nunca lanza: sin base, compila con el respaldo.
 */
export async function generateStaticParams() {
  const { vehiculos } = await getImportExamples();
  return vehiculos.filter(tienePaginaPropia).map((v) => ({ modelo: v.id }));
}

/** El ejemplo de esta URL, o `null` si no existe o no se puede cotizar. */
async function leerModelo(id: string): Promise<{
  vehiculo: ImportableTrendingVehicle;
  otros: ImportableTrendingVehicle[];
} | null> {
  const { vehiculos } = await getImportExamplesForIsr();
  const cotizables = vehiculos.filter(tienePaginaPropia);
  const vehiculo = cotizables.find((v) => v.id === id);
  if (!vehiculo) return null;
  return { vehiculo, otros: cotizables.filter((v) => v.id !== id) };
}

function precioEnOrigen(v: ImportableTrendingVehicle): string {
  return v.priceMinUsd === v.priceMaxUsd
    ? formatCurrency(v.priceMinUsd)
    : `${formatCurrency(v.priceMinUsd)} – ${formatCurrency(v.priceMaxUsd)}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { modelo } = await params;
  const datos = await leerModelo(modelo);
  // El 404 lo pinta la página; acá basta con no anunciar nada.
  if (!datos) return { title: "Modelo no disponible", robots: { index: false, follow: true } };

  const v = datos.vehiculo;
  const evaluacion = cotizarEjemplo(v, currentYearInLima());
  const ruta = rutaModelo(v.id);
  const title = `Importar ${v.name} a Perú: precio puesto en Lima`;
  const description =
    evaluacion.kind === "ready"
      ? `¿Cuánto cuesta importar ${conArticulo(v)} a Perú? ${formatCurrency(v.calculator.priceUsd)} en Estados Unidos y cerca de ${formatCurrency(evaluacion.estimate.finalEstimate)} puesto en Lima con placas. Desglose de flete, tributos SUNAT y servicio.`
      : `Qué hace falta para importar ${conArticulo(v)} desde Estados Unidos a Perú: precio de referencia, tributos SUNAT y condiciones.`;
  const ogTitle = `${title} | ${brandName}`;
  const imagen = v.imageSrc ? { url: v.imageSrc, alt: v.imageAlt } : OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: ruta },
    openGraph: {
      ...OG_DEFAULTS,
      type: "article",
      url: `${contact.website}${ruta}`,
      title: ogTitle,
      description,
      images: [imagen],
    },
    twitter: twitterCard(ogTitle, description, [imagen.url]),
  };
}

const AVISO_ICONO = {
  homologacion: "shield",
  normativa: "fileCheck",
  origen: "globe",
  disponibilidad: "clock",
  precio: "tag",
} as const;

export default async function ModeloPage({ params }: Props) {
  const { modelo } = await params;
  const datos = await leerModelo(modelo);
  if (!datos) notFound();

  const { vehiculo: v, otros } = datos;
  const anioActual = currentYearInLima();
  const evaluacion = cotizarEjemplo(v, anioActual);
  const ruta = rutaModelo(v.id);
  const urlPagina = `${contact.website}${ruta}`;
  const nombreConArticulo = conArticulo(v);
  // La página de su marca, si la marca tiene una (ver lib/importExamples/marca.ts).
  const marca = marcaPorNombre(v.calculator.brand);
  const categoria = getVehicleCategory(v.calculator.vehicleType);
  const esRango = v.priceMinUsd !== v.priceMaxUsd;
  const hoy = new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeZone: "America/Lima",
  }).format(new Date());

  // Los tres precios de compra del rango referencial, cada uno con su total.
  // Un extremo que no se puede cotizar (por debajo del mínimo) no se muestra.
  const escenarios = esRango
    ? [
        { etiqueta: "Precio bajo del rango", precio: v.priceMinUsd },
        { etiqueta: "Precio de referencia", precio: v.calculator.priceUsd },
        { etiqueta: "Precio alto del rango", precio: v.priceMaxUsd },
      ].flatMap((e) => {
        const r = cotizarEjemplo(v, anioActual, e.precio);
        return r.kind === "ready" ? [{ ...e, estimate: r.estimate }] : [];
      })
    : [];

  const planes = PRICING_CONFIG.planConfigs;
  const iscUsado = resolveIscRate({ category: categoria, condition: "usado" });
  const masAntiguo = oldestImportableModelYear(anioActual);

  const preguntas: { pregunta: string; respuesta: string }[] = [];
  if (evaluacion.kind === "ready") {
    const e = evaluacion.estimate;
    preguntas.push({
      pregunta: `¿Cuánto cuesta importar ${nombreConArticulo} a Perú?`,
      respuesta: `Con un precio de compra de ${formatCurrency(e.input.priceMiami)} en Estados Unidos, queda en alrededor de ${formatCurrency(e.finalEstimate)} puesto en Lima con placas (rango ${formatCurrency(e.finalRange.min)} – ${formatCurrency(e.finalRange.max)}). Incluye flete marítimo, seguro, tributos SUNAT y el servicio de Luxcars.`,
    });
    preguntas.push({
      pregunta: "¿Cuánto se paga de impuestos?",
      respuesta: `${formatCurrency(quoteTaxes(e))} en tributos: ad valorem ${formatPercentage(e.adValoremRate)}, ISC ${formatPercentage(e.iscRate)} e IGV más IPM 18%. Se aplican en cascada, cada uno sobre la base que dejó el anterior, y representan el ${formatPercentage(quoteTaxes(e) / e.finalEstimate)} del costo final.`,
    });
  }
  preguntas.push({
    // "¿Dónde es fabricada la …?" es una de las preguntas que Google muestra
    // junto a las búsquedas de modelo.
    pregunta: `¿Dónde se fabrica ${articuloDe(v) === "una" ? "la" : "el"} ${v.name}?`,
    respuesta: `Se ensambla en ${v.assemblyCountry}${v.assemblyPlant ? ` (${v.assemblyPlant})` : ""}. El país de ensamblaje, no la marca ni el lugar donde se compra, es lo que decide si paga ad valorem al entrar al Perú.`,
  });
  preguntas.push({
    pregunta: "¿Paga ad valorem o entra con 0%?",
    respuesta: v.adValoremNote,
  });
  preguntas.push({
    pregunta: "¿Cuánto demora en llegar a Lima?",
    respuesta: `Con ${planes.fast.label}, ${planes.fast.timelineLabel} desde la compra. Con el plan ${planes.standard.label}, ${planes.standard.timelineLabel}. El plazo cuenta inspección, embarque en Miami, tránsito al Callao, despacho aduanero y placas.`,
  });
  preguntas.push({
    pregunta: "¿Se puede importar usado?",
    respuesta:
      iscUsado === null
        ? "No. El Perú prohíbe importar vehículos usados a diésel en autos, SUVs y camionetas (D. Leg. 843). Solo se puede traer nuevo."
        : `Sí, mientras no tenga más de ${PRICING_CONFIG.usedMaxAgeYears} años desde su año modelo, contando el año en curso: en ${anioActual}, del ${masAntiguo} en adelante. Un usado paga ISC de ${formatPercentage(iscUsado)} y ad valorem de 6% aunque se haya ensamblado en Estados Unidos, así que casi siempre conviene traerlo nuevo.`,
  });
  if (evaluacion.kind === "ready") {
    const e = evaluacion.estimate;
    preguntas.push({
      pregunta: "¿Cuánto efectivo necesito el día del despacho?",
      respuesta: `${formatCurrency(e.cashRequired)}. Es el costo final más la percepción del IGV (${formatRate(e.percepcionRate)}, ${formatCurrency(e.percepcion)}), un adelanto que SUNAT devuelve o que se descuenta del IGV. No es costo, pero sí es caja.`,
    });
  }

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${urlPagina}#servicio`,
      serviceType: "Importación de vehículos desde Estados Unidos a Perú",
      name: `Importación de ${v.name} a Perú`,
      description: v.detail,
      url: urlPagina,
      areaServed: { "@type": "Country", name: "Perú" },
      // La organización está descrita completa en el layout: se referencia.
      provider: { "@id": ORGANIZATION_ID },
    },
    breadcrumbSchema([
      { nombre: "Inicio", ruta: "/" },
      { nombre: "Importar", ruta: "/importar" },
      ...(marca ? [{ nombre: marca.nombre, ruta: rutaMarca(marca.nombre) }] : []),
      { nombre: v.name, ruta },
    ]),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* `<` escapado: el texto viene del portal y un "</script>" en él
          cerraría la etiqueta. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Navbar />
      <main id="contenido" className="w-full flex-1 pt-[var(--lux-nav-h)]">
        <div className="container-lux py-6 sm:py-8">
          <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-2 text-sm text-ink-4">
            <Link href="/importar" className="hover:text-ink">Importar</Link>
            <Icon name="chevronRight" size={14} />
            {marca ? (
              <>
                <Link href={rutaMarca(marca.nombre)} className="hover:text-ink">{marca.nombre}</Link>
                <Icon name="chevronRight" size={14} />
              </>
            ) : null}
            <span className="text-ink-2">{v.name}</span>
          </nav>

          <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <p className="eyebrow">Importación a pedido</p>
              <h1 className="mt-3 text-balance text-3xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-4xl lg:text-5xl">
                Importar {nombreConArticulo} a Perú
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-ink-2 sm:text-lg">
                Precio en Estados Unidos, tributos SUNAT y costo final puesto en Lima con placas. {v.detail}
              </p>

              <div className="relative mt-8 aspect-[4/3] overflow-hidden rounded-[22px] border border-line bg-surface-2">
                {v.imageSrc ? (
                  <Image
                    src={v.imageSrc}
                    alt={v.imageAlt}
                    fill
                    priority
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(70%_60%_at_50%_40%,#2a2a2f_0%,#121214_100%)] text-ink-4">
                    <Icon name="camera" size={30} />
                    <span className="text-sm">Fotos de la unidad por WhatsApp</span>
                  </div>
                )}
                <div className="absolute left-4 right-4 top-4 flex flex-wrap gap-2">
                  <Badge>{v.segment}</Badge>
                  {v.importViability === "importable-con-advertencia" ? <Badge tone="warn">Con aviso</Badge> : null}
                </div>
              </div>
              <CreditoFoto
                credito={v.imageCredit}
                licencia={v.imageLicense}
                fuenteUrl={v.imageSourceUrl}
                className="mt-2 px-1"
              />
              {v.imageSrc ? (
                <p className="mt-2 px-1 text-xs text-ink-4">
                  Imagen referencial del modelo. Importamos a pedido: la unidad se elige contigo en Estados Unidos.
                </p>
              ) : null}
            </div>

            <aside className="lg:col-span-5">
              <div className="glow-lux rounded-[22px] border border-line p-6 sm:p-7 lg:sticky lg:top-[calc(var(--lux-nav-h)+1.5rem)]">
                {evaluacion.kind === "ready" ? (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-4">
                      Puesto en Lima, con placas
                    </p>
                    <p className="mt-2 break-words text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums text-ink sm:text-5xl">
                      {formatCurrency(evaluacion.estimate.finalEstimate)}
                    </p>
                    <p className="mt-2 text-sm text-ink-3">
                      Rango {formatCurrency(evaluacion.estimate.finalRange.min)} –{" "}
                      {formatCurrency(evaluacion.estimate.finalRange.max)}
                    </p>
                    <div className="mt-4">
                      <QuoteChips estimate={evaluacion.estimate} />
                    </div>

                    <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
                      <div className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-ink-3">
                          {v.priceBasis === "msrp-oficial" ? "Precio de fábrica (MSRP)" : "Precio en EE.UU. (ref.)"}
                        </dt>
                        <dd className="font-semibold tabular-nums text-ink">{precioEnOrigen(v)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-ink-3">Ensamblado en</dt>
                        <dd className="text-right font-semibold text-ink">{v.assemblyCountry}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-ink-3">Ad valorem</dt>
                        <dd className="font-semibold tabular-nums text-ink">
                          {formatPercentage(evaluacion.estimate.adValoremRate)}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-6 grid gap-3">
                      <Button
                        href={buildWhatsappLink(evaluacion.estimate, {
                          preferredPlan: evaluacion.estimate.planKey,
                          detailUrl: urlPagina,
                        })}
                        variant="whatsapp"
                        size="lg"
                        className="w-full"
                      >
                        <WhatsAppIcon size={20} />
                        Quiero importar este auto
                      </Button>
                      {/* nofollow: es /calculadora con un parámetro, no una página nueva que rastrear. */}
                      <Button href={rutaCalculadora(v.id, "/calculadora")} rel="nofollow" variant="secondary" size="lg" className="w-full">
                        <Icon name="calculator" size={18} />
                        Ajustar en la calculadora
                      </Button>
                    </div>
                    <p className="mt-5 text-xs leading-relaxed text-ink-4">
                      Estimado referencial con rango ±{formatPercentage(LUXCARS_CONFIG.services.finalRangeVariance, "es-PE", 1)}, calculado el {hoy} con las tasas vigentes. El precio final se confirma por escrito antes de cualquier depósito.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm leading-relaxed text-ink">
                      <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-warn" />
                      <span>{evaluacion.reason}</span>
                    </div>
                    <div className="mt-6 grid gap-3">
                      <Button
                        href={buildBlockedCalculatorWhatsappLink({
                          conditionLabel: "Nuevo",
                          brand: v.calculator.brand,
                          model: v.calculator.model,
                          year: "",
                          priceUsd: v.calculator.priceUsd,
                          reason: evaluacion.reason,
                        })}
                        variant="whatsapp"
                        size="lg"
                        className="w-full"
                      >
                        <WhatsAppIcon size={20} />
                        Consultar por WhatsApp
                      </Button>
                      <Button href={rutaCalculadora(v.id, "/calculadora")} rel="nofollow" variant="secondary" size="lg" className="w-full">
                        <Icon name="calculator" size={18} />
                        Ajustar en la calculadora
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>

        {evaluacion.kind === "ready" ? (
          <Section tone="void">
            <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <SectionHeader
                  eyebrow="El número completo"
                  title={`¿Cuánto cuesta importar ${nombreConArticulo} a Perú?`}
                />
                <div className="mt-6 space-y-4 text-pretty text-base leading-relaxed text-ink-2">
                  <p>
                    Con un precio de compra de <strong className="font-semibold text-ink">{formatCurrency(evaluacion.estimate.input.priceMiami)}</strong> en Estados Unidos, queda en alrededor de <strong className="font-semibold text-ink">{formatCurrency(evaluacion.estimate.finalEstimate)}</strong> puesto en Lima, nacionalizado y con placas.
                  </p>
                  <p>
                    De ese total, {formatCurrency(quoteTaxes(evaluacion.estimate))} son tributos SUNAT ({formatPercentage(quoteTaxes(evaluacion.estimate) / evaluacion.estimate.finalEstimate)} del costo), {formatCurrency(evaluacion.estimate.freight + evaluacion.estimate.insurance)} son flete marítimo y seguro de Miami al Callao, {formatCurrency(evaluacion.estimate.customsFee)} son costos de aduana, y el resto es el servicio: inspección de la unidad, compra, logística y trámite hasta la entrega.
                  </p>
                  <p className="text-sm text-ink-3">{v.priceNote}</p>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="rounded-[22px] border border-line bg-surface p-6 sm:p-8">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-ink">Desglose</h3>
                    <span className="text-xs text-ink-4">Montos en dólares</span>
                  </div>
                  <QuoteBreakdown estimate={evaluacion.estimate} className="mt-3" />
                  <div className="mt-4 flex items-center justify-between gap-4 border-t border-line-strong pt-4">
                    <p className="text-sm font-semibold text-ink">Costo final puesto en Lima</p>
                    <p className="text-lg font-semibold tabular-nums text-ink">
                      {formatCurrency(evaluacion.estimate.finalEstimate)}
                    </p>
                  </div>
                  <div className="mt-5 rounded-2xl border border-line bg-void/40 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                      Efectivo el día del despacho
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
                      {formatCurrency(evaluacion.estimate.cashRequired)}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-4">
                      Suma la percepción del IGV ({formatRate(evaluacion.estimate.percepcionRate)}): un adelanto que SUNAT devuelve o que descuentas de tu IGV. No es costo.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {escenarios.length > 1 ? (
              <div className="mt-12">
                <h3 className="text-xl font-semibold tracking-tight text-ink">
                  El total según el precio de compra
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-3">
                  El precio en Estados Unidos cambia con la versión y el equipamiento. Así se mueve el costo final.
                </p>
                <div className="mt-5 overflow-x-auto rounded-[22px] border border-line bg-surface">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-ink-4">
                        <th scope="col" className="px-5 py-4 font-semibold">Escenario</th>
                        <th scope="col" className="px-5 py-4 text-right font-semibold">Precio EE.UU.</th>
                        <th scope="col" className="px-5 py-4 text-right font-semibold">Tributos</th>
                        <th scope="col" className="px-5 py-4 text-right font-semibold">Puesto en Lima</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {escenarios.map((e) => (
                        <tr key={e.etiqueta}>
                          <th scope="row" className="px-5 py-4 font-medium text-ink-2">{e.etiqueta}</th>
                          <td className="px-5 py-4 text-right tabular-nums text-ink-2">{formatCurrency(e.precio)}</td>
                          <td className="px-5 py-4 text-right tabular-nums text-ink-2">{formatCurrency(quoteTaxes(e.estimate))}</td>
                          <td className="px-5 py-4 text-right font-semibold tabular-nums text-ink">{formatCurrency(e.estimate.finalEstimate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </Section>
        ) : null}

        <Section tone="bg">
          <SectionHeader
            eyebrow="Origen y arancel"
            title="Dónde se fabrica decide cuánto paga"
            description="El 0% de ad valorem no se gana por comprar en Miami: exige que el vehículo sea nuevo, originario de Estados Unidos y que llegue con certificado de origen."
          />
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[22px] border border-line bg-surface p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-silver-bright">
                <Icon name="building" size={24} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-ink">Ensamblado en {v.assemblyCountry}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
                {v.assemblyPlant ? `Planta: ${v.assemblyPlant}.` : "La planta depende de la unidad concreta."}
              </p>
            </div>
            <div className="rounded-[22px] border border-line bg-surface p-6 lg:col-span-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-silver-bright">
                <Icon name="percent" size={24} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-ink">
                {v.adValorem === "candidato-0"
                  ? "Candidato a 0% de ad valorem"
                  : v.adValorem === "depende-vin"
                    ? "Ad valorem según el VIN de la unidad"
                    : "Paga 6% de ad valorem"}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{v.adValoremNote}</p>
              {evaluacion.kind === "ready" ? (
                <p className="mt-3 text-sm leading-relaxed text-ink-2">
                  {describeOrigin(evaluacion.originInfo, evaluacion.estimate)}
                </p>
              ) : null}
            </div>
          </div>

          {v.warnings.length > 0 ? (
            <div className="mt-12">
              <h3 className="text-xl font-semibold tracking-tight text-ink">
                Lo que debes saber antes de pedirlo
              </h3>
              <ul className="mt-5 grid gap-4 lg:grid-cols-2">
                {v.warnings.map((w) => (
                  <li key={w.title} className="flex gap-4 rounded-[22px] border border-line bg-surface p-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warn/10 text-warn">
                      <Icon name={AVISO_ICONO[w.kind] ?? "info"} size={20} />
                    </span>
                    <div>
                      <h4 className="text-base font-semibold text-ink">{w.title}</h4>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{w.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Section>

        <Section tone="void">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHeader
                eyebrow="Dudas comunes"
                title={`Preguntas sobre importar ${nombreConArticulo}`}
              />
              <Button href="/como-funciona" variant="secondary" className="mt-6">
                Ver el proceso paso a paso
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
                    <p className="pb-6 pr-12 text-sm leading-relaxed text-ink-2 sm:text-[15px]">
                      {item.respuesta}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {otros.length > 0 ? (
          <Section tone="bg">
            <SectionHeader
              eyebrow="Otros modelos"
              title="Cuánto cuesta importar otros modelos"
              description="Cada uno con su precio en Estados Unidos y el costo final puesto en Lima."
              action={
                <Button href="/importar" variant="secondary">
                  Cómo importamos
                  <Icon name="arrowRight" size={16} />
                </Button>
              }
            />
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {otros.map((o) => (
                <li key={o.id}>
                  <Link
                    href={rutaModelo(o.id)}
                    className="group flex h-full items-center justify-between gap-4 rounded-[22px] border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                  >
                    <span>
                      <span className="block text-base font-semibold leading-snug text-ink">{o.name}</span>
                      <span className="mt-1 block text-sm tabular-nums text-ink-3">
                        {precioEnOrigen(o)} en EE.UU.
                      </span>
                    </span>
                    <Icon name="arrowRight" size={18} className="shrink-0 text-silver transition-transform group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section tone="void" padding="tight">
          <CtaBand
            title={`¿Buscas ${nombreConArticulo}?`}
            text="Dinos la versión y el color. Te mandamos unidades reales en dealers de Estados Unidos con el costo final por escrito."
            message={`Hola Luxcars, quiero importar ${nombreConArticulo}. ¿Me ayudan con unidades disponibles y el costo final?`}
          />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
