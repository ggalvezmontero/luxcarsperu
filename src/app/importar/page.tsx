import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { GuiasDestacadas } from "@/components/guias/GuiasDestacadas";
import { MostSoughtVehiclesSection } from "@/components/MostSoughtVehiclesSection";
import { Navbar } from "@/components/Navbar";
import { IMPORT_STEPS, StepsRow } from "@/components/home/StepsSection";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { LUXCARS_CONFIG } from "@/lib/config";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";
import { ORGANIZATION_ID } from "@/lib/structuredData";

const { contact, brandName } = LUXCARS_CONFIG;
const antiguedad = LUXCARS_CONFIG.hardFacts.find(
  (fact) => fact.id === "antiguedad",
);

// Mismo texto para Open Graph y Twitter Card: una sola fuente, sin copy nuevo.
const OG_TITLE = `Importar auto de Estados Unidos a Perú | ${brandName}`;
const OG_DESCRIPTION =
  "Normativa clara, tributos explicados y una calculadora pública para saber el costo real.";

/**
 * Los ejemplos de "más pedidos" salen de la base y se editan en el portal. Al
 * guardar, el portal pide regenerar esta página; esto es solo la red de
 * seguridad por si ese aviso se pierde: una vez al día se vuelve a generar.
 * Si la base falla en ese momento, se conserva la última página buena.
 */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Importar auto de Estados Unidos a Perú",
  description:
    "Importa tu auto desde EE.UU. a Perú con LuxCars: qué permite la ley, qué tributos se pagan y cuánto cuesta puesto en Lima. Calculadora pública.",
  alternates: { canonical: "/importar" },
  openGraph: {
    ...OG_DEFAULTS,
    type: "article",
    url: `${contact.website}/importar`,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
  twitter: twitterCard(OG_TITLE, OG_DESCRIPTION),
};

const REGLAS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "calendar",
    title: `Hasta ${antiguedad?.value ?? "2 años"}`,
    text: antiguedad?.detail ?? "Contados desde el año modelo, incluyendo el año en curso.",
  },
  { icon: "ban", title: "Diésel usado: no", text: "Prohibido en autos y camionetas. Diésel nuevo sí." },
  { icon: "steering", title: "Timón izquierdo", text: "De fábrica. No se aceptan conversiones." },
  { icon: "gauge", title: "Tope de kilómetros", text: "Se contrasta el odómetro con el historial CarFax." },
];

const TRIBUTOS: { cifra: string; nombre: string; base: string }[] = [
  { cifra: "0–6%", nombre: "Ad valorem", base: "Sobre CIF. 0% solo para nuevos originarios de EE.UU." },
  { cifra: "40%", nombre: "ISC usados", base: "Sobre CIF + ad valorem. Nuevos: 0–20% según motor." },
  { cifra: "18%", nombre: "IGV + IPM", base: "Sobre CIF + ad valorem + ISC." },
  { cifra: "3.5–10%", nombre: "Percepción", base: "Adelanto del IGV. Se recupera como crédito fiscal." },
];

const HONESTIDAD = [
  { title: "Precios inflados", text: "Hemos visto catálogos hasta 48% por encima del precio real de fábrica. Contrastamos contra el mercado real." },
  { title: "Cybertruck sin homologación", text: "No está homologado fuera de Norteamérica: la matriculación en Perú no está garantizada." },
  { title: "Autos que no conviene traer", text: "Changan CS55 Plus o Geely Coolray se venden nuevos en Perú por menos. Te lo decimos." },
];

export default function ImportarPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Importación de vehículos desde Estados Unidos a Perú",
    name: "Importación de autos a pedido",
    url: `${contact.website}/importar`,
    areaServed: { "@type": "Country", name: "Perú" },
    // La organización ya está descrita completa en el JSON-LD del layout
    // (autoDealerSchema). Se la referencia por su @id en vez de repetirla:
    // dos AutoDealer con datos distintos confunden a Google sobre cuál vale.
    provider: { "@id": ORGANIZATION_ID },
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main id="contenido" className="w-full flex-1">
        {/* Portada con foto */}
        <section className="relative isolate flex min-h-[70svh] w-full items-end overflow-hidden bg-void pt-[var(--lux-nav-h)]">
          <Image
            src="/images/portadas/importar-terminal-contenedores.webp"
            alt="Vista aérea de un terminal portuario con contenedores y grúas"
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-void via-void/75 to-void/20" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-48 bg-gradient-to-b from-void/80 to-transparent"
          />
          <div className="container-lux relative pb-12 pt-20 sm:pb-16">
            {/* El h1 abarca la etiqueta y el titular: la etiqueta lleva la búsqueda y
                el titular, la frase de marca. Se ve igual; Google lee las dos. */}
            <h1>
              <span className="eyebrow">Importar auto de Estados Unidos a Perú</span>{" "}
              <span className="mt-3 block max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                El auto exacto que quieres, puesto en Lima
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base text-ink-2 sm:text-lg">
              Lo buscamos en Estados Unidos, lo inspeccionamos antes de pagar y lo entregamos nacionalizado. Sin letra chica.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/calculadora" variant="accent" size="lg" data-ga-cta="importar_portada_calculadora">
                <Icon name="calculator" size={18} />
                Calcular mi importación
              </Button>
              <Button href="/como-funciona" variant="secondary" size="lg" data-ga-cta="importar_portada_proceso">
                Ver el proceso
              </Button>
            </div>
            <ul className="mt-8 grid max-w-2xl grid-cols-3 gap-3 text-center sm:text-left">
              {[
                ["30–60", "días de entrega"],
                ["USD 30k", "inversión mínima"],
                ["150", "puntos de inspección"],
              ].map(([n, l]) => (
                <li key={l} className="rounded-2xl border border-line/80 bg-void/60 p-3 backdrop-blur sm:p-4">
                  <p className="text-xl font-semibold tabular-nums text-ink sm:text-2xl">{n}</p>
                  <p className="text-xs text-ink-3">{l}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Section tone="bg">
          <SectionHeader eyebrow="Cómo funciona" title="Cuatro pasos, una sola cifra" description="Del pedido a la entrega, con seguimiento semanal por WhatsApp." />
          <div className="mt-10"><StepsRow steps={IMPORT_STEPS} /></div>
        </Section>

        <Section tone="void">
          <SectionHeader eyebrow="Lo que permite la ley" title="Cuatro reglas deciden si tu auto puede entrar" description="Las revisamos antes de cotizar. Si no cumple, te lo decimos en la primera conversación." />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REGLAS.map((r) => (
              <li key={r.title} className="rounded-[22px] border border-line bg-surface p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-silver-bright">
                  <Icon name={r.icon} size={24} />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{r.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{r.text}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section tone="bg">
          <SectionHeader eyebrow="Tributos" title="Qué se paga y sobre qué base" description="Los impuestos se aplican en cascada, cada uno sobre la base que dejó el anterior." />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRIBUTOS.map((t) => (
              <li key={t.nombre} className="rounded-[22px] border border-line bg-surface p-6">
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-silver-bright">{t.cifra}</p>
                <h3 className="mt-2 text-base font-semibold text-ink">{t.nombre}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{t.base}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col items-start gap-4 rounded-[22px] border border-line-strong bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-2 sm:text-base">
              La calculadora aplica exactamente estas tasas. Es la misma herramienta que usamos internamente.
            </p>
            <Button href="/calculadora" variant="accent" data-ga-cta="importar_tasas_calculadora">Ir a la calculadora</Button>
          </div>
        </Section>

        <Section tone="void">
          <SectionHeader eyebrow="Transparencia" title="Tres cosas que te decimos aunque nos cuesten la venta" />
          <ul className="mt-10 grid gap-4 lg:grid-cols-3">
            {HONESTIDAD.map((h, i) => (
              <li key={h.title} className="rounded-[22px] border border-line bg-surface p-6">
                <span className="text-sm font-semibold tabular-nums text-ink-4">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-lg font-semibold text-ink">{h.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-3">{h.text}</p>
              </li>
            ))}
          </ul>
        </Section>

        <MostSoughtVehiclesSection tone="bg" destino="pagina" />

        <GuiasDestacadas tone="void" />

        <Section tone="bg" padding="tight">
          <CtaBand />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
