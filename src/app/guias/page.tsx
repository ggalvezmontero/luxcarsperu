import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";
import { LUXCARS_CONFIG } from "@/lib/config";
import { GUIAS, rutaGuia, tituloGuia } from "@/lib/guias";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";
import { breadcrumbSchema } from "@/lib/structuredData";
import { currentYearInLima } from "@/core/pricing/pricingConfig";

// SEO (2026-11-23): "importación de autos a Perú" a secas no tenía página
// dueña (posición 57 en Search Console). Esta portada reúne las guías y lleva
// la frase en el título, el h1 y el primer párrafo; /importar sigue siendo la
// del servicio "a pedido".
const TITLE = "Importación de autos a Perú: costos, requisitos e impuestos";
const DESCRIPTION =
  "Todo sobre la importación de autos a Perú: cuánto cuesta de verdad, qué vehículos pueden entrar, ad valorem, ISC y cómo nacionalizarlos, con las tasas vigentes y ejemplos en cifras.";
const OG_TITLE = `${TITLE} | ${LUXCARS_CONFIG.brandName}`;

export const revalidate = 86400;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guias" },
  openGraph: {
    ...OG_DEFAULTS,
    type: "website",
    url: `${LUXCARS_CONFIG.contact.website}/guias`,
    title: OG_TITLE,
    description: DESCRIPTION,
  },
  twitter: twitterCard(OG_TITLE, DESCRIPTION),
};

export default function GuiasPage() {
  const anio = currentYearInLima();
  const jsonLd = breadcrumbSchema([
    { nombre: "Inicio", ruta: "/" },
    { nombre: "Guías", ruta: "/guias" },
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main id="contenido" className="w-full flex-1 pt-[var(--lux-nav-h)]">
        <Section tone="bg">
          <div className="max-w-3xl">
            <p className="eyebrow">Guías de importación</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
              {TITLE}
            </h1>
            <p className="mt-4 text-pretty text-base leading-relaxed text-ink-2 sm:text-lg">
              Lo que hay que saber sobre la importación de autos a Perú antes de traer uno de Estados Unidos: cuánto cuesta de verdad, qué se puede importar y qué impuestos se pagan. Todas las cifras salen del mismo motor que la calculadora.
            </p>
            <p className="mt-3 text-pretty text-base leading-relaxed text-ink-2">
              Si prefieres que lo hagamos por ti, mira la{" "}
              <Link href="/importar" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                importación de autos a pedido
              </Link>{" "}
              o el{" "}
              <Link href="/como-funciona" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                proceso paso a paso
              </Link>
              .
            </p>
            <Button href="/calculadora" variant="accent" size="lg" className="mt-8">
              <Icon name="calculator" size={18} />
              Ir a la calculadora
            </Button>
          </div>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {GUIAS.map((g) => (
              <li key={g.slug}>
                <Link
                  href={rutaGuia(g.slug)}
                  className="group flex h-full flex-col justify-between gap-6 panel-lux p-6 transition-colors hover:border-line-strong sm:p-7"
                >
                  <span>
                    <h2 className="text-xl font-semibold leading-snug tracking-tight text-ink">{tituloGuia(g, anio)}</h2>
                    <span className="mt-3 block text-sm leading-relaxed text-ink-3">{g.descripcion}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-silver transition-colors group-hover:text-ink">
                    Leer la guía
                    <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section tone="void" padding="tight">
          <CtaBand />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
