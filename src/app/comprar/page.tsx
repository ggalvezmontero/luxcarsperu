import type { Metadata } from "next";
import Image from "next/image";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { ScanBand } from "@/components/home/ScanBand";
import { CtaBand } from "@/components/CtaBand";
import { Section } from "@/components/ui/Section";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LUXCARS_CONFIG } from "@/lib/config";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";
import { getStockForIsr } from "@/lib/stock";
import { StockExplorer } from "./StockExplorer";

/* SEO (2026-11-10, pedido del dueño): la página responde a "comprar autos de
   lujo en Lima" y sus variantes ("carros de lujo", "autos de alta gama",
   "camionetas de lujo", "seminuevos premium", "en venta", "Perú"). La frase
   principal va en el título y en el h1; las variantes, en la descripción y el
   primer párrafo. */
const TITULO_SEO = "Comprar autos de lujo en Lima · Stock de alta gama disponible";

// Mismo texto para Open Graph y Twitter Card: una sola fuente, sin copy nuevo.
const OG_TITLE = `${TITULO_SEO} | ${LUXCARS_CONFIG.brandName}`;
const OG_DESCRIPTION =
  "Autos, camionetas y deportivos de lujo seminuevos en Lima, verificados y listos para entregar.";

export const metadata: Metadata = {
  title: TITULO_SEO,
  description:
    "Autos de lujo y alta gama en venta en Lima: carros, camionetas y deportivos seminuevos verificados, con documentos en regla y entrega en días. Stock propio y consignación en San Isidro.",
  alternates: { canonical: "/comprar" },
  openGraph: {
    ...OG_DEFAULTS,
    type: "website",
    url: `${LUXCARS_CONFIG.contact.website}/comprar`,
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  },
  twitter: twitterCard(OG_TITLE, OG_DESCRIPTION),
};

/**
 * El stock sale de la base. Sin esto la página se congela con lo que había al
 * momento del build y un auto recién publicado no aparece hasta el siguiente
 * despliegue. Cinco minutos: lo publicado se ve casi enseguida y la base no
 * recibe una consulta por visita.
 *
 * Por eso el stock se lee con `getStockForIsr()`: si la base falla durante una
 * revalidación, la página LANZA y Next sigue sirviendo la última versión buena
 * en vez de cachear un listado vacío (ver lib/stock.ts).
 */
export const revalidate = 300;

const PROMESAS: { icon: IconName; title: string; text: string }[] = [
  { icon: "mapPin", title: "Está en Lima", text: "Lo ves y lo manejas con cita, sin esperar un barco." },
  { icon: "fileCheck", title: "Papeles listos", text: "Nacionalizado, con placa y transferencia incluida." },
  { icon: "clock", title: "Entrega en días", text: "Sin tránsito marítimo ni aduanas." },
];

export default async function ComprarPage() {
  const stock = await getStockForIsr(48);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1">
        {/* Portada con foto de Lima (Licencia Unsplash; procedencia en docs/FOTOS.md) */}
        <section className="relative isolate w-full overflow-hidden bg-void pt-[calc(var(--lux-nav-h)+3rem)] pb-10 sm:pt-[calc(var(--lux-nav-h)+4rem)] sm:pb-14">
          <Image
            src="/images/lima/costa-verde-noche.webp"
            alt="La Costa Verde de Lima de noche, con las estelas de luz de los autos junto al mar y el muelle de La Rosa Náutica"
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-[center_60%]"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-void/75 via-void/35 to-void" />
          <div className="container-lux relative">
            {/* El h1 abarca la etiqueta y el titular: la etiqueta lleva la búsqueda y
                el titular, la frase de marca. Se ve igual; Google lee las dos. */}
            <h1>
              <span className="eyebrow">Comprar autos de lujo en Lima</span>{" "}
              <span className="mt-3 block max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                Autos de alta gama disponibles hoy en Lima
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base text-ink-2 sm:text-lg">
              Carros, camionetas y deportivos de lujo seminuevos en venta en San Isidro: stock propio y autos de clientes en consignación, siempre identificados. Verificados, con documentos en regla y listos para entregar.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-3">
              {PROMESAS.map((p) => (
                <li key={p.title} className="flex items-center gap-3 rounded-2xl border border-line/80 bg-void/60 p-4 backdrop-blur">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-silver-bright">
                    <Icon name={p.icon} size={20} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">{p.title}</span>
                    <span className="block text-xs text-ink-3">{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <StockExplorer stock={stock} />

        <ScanBand />

        <Section tone="void" padding="tight">
          <CtaBand
            title="¿No está el que buscas?"
            text="Dinos cuál y lo buscamos en Estados Unidos o en Lima. Sigues el avance desde tu cuenta."
            message="Hola LuxCars, busco un auto que no vi en su stock. ¿Pueden ayudarme a conseguirlo?"
            secondaryHref="/cuenta/comprar"
            secondaryLabel="Pedir que lo busquen"
          />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
