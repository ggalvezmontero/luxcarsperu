import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { CtaBand } from "@/components/CtaBand";
import { Section } from "@/components/ui/Section";
import type { Metadata } from "next";
import { LUXCARS_CONFIG } from "@/lib/config";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";

// El <title> sale de la plantilla del layout ("%s | marca"); Open Graph y
// Twitter repiten exactamente ese texto y la misma descripción. Sin `openGraph`
// propio la página heredaba og:url y og:title de la home.
const TITLE = "Preguntas frecuentes";
const DESCRIPTION =
  "Dudas comunes sobre comprar, importar y vender autos con LuxCars: impuestos SUNAT, plazos, antigüedad permitida y consignación sin exclusividad.";
const OG_TITLE = `${TITLE} | ${LUXCARS_CONFIG.brandName}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/faq" },
  openGraph: {
    ...OG_DEFAULTS,
    type: "website",
    url: `${LUXCARS_CONFIG.contact.website}/faq`,
    title: OG_TITLE,
    description: DESCRIPTION,
  },
  twitter: twitterCard(OG_TITLE, DESCRIPTION),
};

export default function FAQPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1 pt-[var(--lux-nav-h)]">
        <FAQSection titulo="Todas las preguntas frecuentes" tituloComo="h1" />
        <Section tone="void" padding="tight">
          <CtaBand title="¿Tu duda no está aquí?" text="Escríbenos y te respondemos el mismo día." message="Hola LuxCars, tengo una consulta." />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
