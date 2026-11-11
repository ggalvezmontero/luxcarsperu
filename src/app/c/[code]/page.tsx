/**
 * Estimado compartido (/c/<código>).
 *
 * Es a donde llega quien abre un enlace de la calculadora pegado en WhatsApp,
 * en una historia o en una publicación: el desglose completo de ese auto, ya
 * abierto, sin tener que llenar nada.
 *
 * CÓMO SE RELACIONA CON EL SEO DEL SITIO — leer antes de tocar:
 *   · `noindex, follow`. Hay un enlace distinto por cada combinación de auto,
 *     año y precio: indexarlos sería llenar el índice de páginas casi iguales
 *     que compiten con la home y con /importar, que son las que posicionan.
 *   · No entra al sitemap ni se enlaza desde las páginas públicas. Solo se
 *     llega por un enlace compartido.
 *   · NO se bloquea en robots.txt: Google tiene que poder leer el `noindex`, y
 *     WhatsApp y Facebook tienen que poder leer el título y la imagen.
 *   · El título, la descripción y la imagen (`opengraph-image.tsx`) son
 *     propios de cada estimado: es lo que se ve en la vista previa.
 *
 * Se genera en cada visita y no se guarda nada: el código trae los datos y el
 * número se recalcula con las tasas del día (ver `lib/cotizacionCompartida.ts`).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import {
  QuoteBreakdown,
  QuoteChips,
  describeOrigin,
  quoteTaxes,
} from "@/components/cotizacion/QuoteBreakdown";
import { ShareQuoteButton } from "@/components/cotizacion/ShareQuoteButton";
import { Icon } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";
import { LUXCARS_CONFIG } from "@/lib/config";
import { sharedQuoteCalculatorPath, sharedQuotePath } from "@/lib/cotizacionCompartida";
import { formatCurrency, formatPercentage, formatRate } from "@/lib/utils";
import { buildBlockedCalculatorWhatsappLink, buildWhatsappLink } from "@/lib/whatsapp";
import { resolveSharedEstimate } from "./estimado";

type Props = { params: Promise<{ code: string }> };

const { contact, brandName } = LUXCARS_CONFIG;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const shared = resolveSharedEstimate(code);
  // El 404 lo pinta la página; acá basta con no anunciar nada.
  if (!shared) return { title: "Estimado no disponible", robots: { index: false, follow: true } };

  const { vehicleName, evaluation, quote } = shared;
  const url = `${contact.website}${sharedQuotePath(code)}`;
  const title =
    evaluation.kind === "ready"
      ? `${vehicleName} puesto en Lima: ${formatCurrency(evaluation.estimate.finalEstimate)}`
      : `${vehicleName}: estimado de importación`;
  const description =
    evaluation.kind === "ready"
      ? `Costo estimado de importar un ${vehicleName} desde Estados Unidos: precio ${formatCurrency(quote.price)}, más flete, seguro, tributos SUNAT y servicio. Mira el desglose completo.`
      : `Estimado de importación de un ${vehicleName} desde Estados Unidos a Perú, calculado con LuxCars.`;

  return {
    title,
    description,
    alternates: { canonical: sharedQuotePath(code) },
    robots: { index: false, follow: true },
    openGraph: {
      type: "website",
      url,
      siteName: brandName,
      locale: "es_PE",
      title: `${title} | ${brandName}`,
      description,
      // La imagen sale de `opengraph-image.tsx`, en esta misma carpeta.
    },
    twitter: { card: "summary_large_image", title: `${title} | ${brandName}`, description },
  };
}

export default async function SharedQuotePage({ params }: Props) {
  const { code } = await params;
  const shared = resolveSharedEstimate(code);
  if (!shared) notFound();

  const { vehicleName, evaluation, quote } = shared;
  const calculatorHref = sharedQuoteCalculatorPath(code);
  const shareUrl = `${contact.website}${sharedQuotePath(code)}`;
  const hoy = new Intl.DateTimeFormat("es-PE", {
    dateStyle: "long",
    timeZone: "America/Lima",
  }).format(new Date());

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1 pt-[var(--lux-nav-h)]">
        <Section tone="bg" padding="tight">
          <div className="mx-auto w-full max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-4">
              Estimado de importación
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">
              {vehicleName}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-3">
              Importado a pedido desde Estados Unidos y entregado en Lima, con placas.
            </p>

            {evaluation.kind === "ready" ? (
              <div className="glow-lux mt-8 rounded-[22px] border border-line p-6 sm:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-4">
                  Puesto en Lima, con placas
                </p>
                <p className="mt-2 break-words text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums text-ink sm:text-5xl">
                  {formatCurrency(evaluation.estimate.finalEstimate)}
                </p>
                <p className="mt-2 text-sm text-ink-3">
                  Rango {formatCurrency(evaluation.estimate.finalRange.min)} –{" "}
                  {formatCurrency(evaluation.estimate.finalRange.max)}
                </p>

                <div className="mt-4">
                  <QuoteChips estimate={evaluation.estimate} />
                </div>

                <div className="mt-6 rounded-2xl border border-line bg-void/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                    Efectivo el día del despacho
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
                    {formatCurrency(evaluation.estimate.cashRequired)}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-4">
                    Suma la percepción del IGV ({formatRate(evaluation.estimate.percepcionRate)}): un adelanto que SUNAT devuelve o que descuentas de tu IGV. No es costo.
                  </p>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3 py-1">
                    <h2 className="text-sm font-semibold text-ink">Desglose</h2>
                    <span className="text-xs text-ink-4">
                      Tributos: {formatCurrency(quoteTaxes(evaluation.estimate))}
                    </span>
                  </div>
                  <QuoteBreakdown estimate={evaluation.estimate} className="mt-2" />
                </div>

                <div className="mt-5 rounded-2xl border border-line bg-surface/60 p-4">
                  <p className="text-xs leading-relaxed text-ink-3">
                    {describeOrigin(evaluation.originInfo, evaluation.estimate)}
                  </p>
                </div>

                <div className="mt-6 grid gap-3">
                  <Button
                    href={buildWhatsappLink(evaluation.estimate, {
                      preferredPlan: evaluation.estimate.planKey,
                      detailUrl: shareUrl,
                    })}
                    variant="whatsapp"
                    size="lg"
                    className="w-full"
                  >
                    Quiero importar este auto
                  </Button>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* nofollow: es la home con un parámetro, no una página nueva que rastrear. */}
                    <Button href={calculatorHref} rel="nofollow" variant="secondary" className="w-full">
                      <Icon name="calculator" size={16} />
                      Ajustar el cálculo
                    </Button>
                    <ShareQuoteButton
                      code={code}
                      title={`${vehicleName} puesto en Lima`}
                      text={`${vehicleName} importado, puesto en Lima con placas: ${formatCurrency(evaluation.estimate.finalEstimate)}. Mira el desglose:`}
                    />
                  </div>
                </div>

                <p className="mt-5 text-xs leading-relaxed text-ink-4">
                  Estimado referencial con rango ±{formatPercentage(LUXCARS_CONFIG.services.finalRangeVariance, "es-PE", 1)}, calculado el {hoy} con las tasas vigentes. Los tributos son tasas fijas; varían el tipo de cambio y el flete del mes.
                </p>
              </div>
            ) : (
              <div className="glow-lux mt-8 rounded-[22px] border border-line p-6 sm:p-8">
                <div className="flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm leading-relaxed text-ink">
                  <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-warn" />
                  <span>{evaluation.reason}</span>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Button
                    href={buildBlockedCalculatorWhatsappLink({
                      conditionLabel: quote.condition === "usado" ? "Usado" : "Nuevo",
                      brand: quote.brand,
                      model: quote.model,
                      year: String(quote.year),
                      priceUsd: quote.price,
                      reason: evaluation.reason,
                    })}
                    variant="whatsapp"
                    className="w-full"
                  >
                    Consultar por WhatsApp
                  </Button>
                  <Button href={calculatorHref} rel="nofollow" variant="secondary" className="w-full">
                    <Icon name="calculator" size={16} />
                    Ajustar el cálculo
                  </Button>
                </div>
              </div>
            )}

            <p className="mt-8 text-center text-sm text-ink-3">
              ¿Otro auto en mente?{" "}
              <Link href="/calculadora" className="font-semibold text-ink underline underline-offset-4">
                Calcula el tuyo
              </Link>{" "}
              o mira{" "}
              <Link href="/importar" className="font-semibold text-ink underline underline-offset-4">
                cómo importamos
              </Link>
              .
            </p>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
