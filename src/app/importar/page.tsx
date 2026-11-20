import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { GuiasDestacadas } from "@/components/guias/GuiasDestacadas";
import { MostSoughtVehiclesSection } from "@/components/MostSoughtVehiclesSection";
import { Navbar } from "@/components/Navbar";
import { ImportBand } from "@/components/home/ImportBand";
import { EjemploReal } from "@/components/importar/EjemploReal";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import Link from "next/link";
import { LUXCARS_CONFIG } from "@/lib/config";
import { rutaGuia } from "@/lib/guias";
import { MARCAS_IMPORTABLES, rutaMarca } from "@/lib/importExamples/marca";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";
import { ORGANIZATION_ID } from "@/lib/structuredData";
import { formatCurrency } from "@/lib/utils";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";

const { contact, brandName } = LUXCARS_CONFIG;
const antiguedad = LUXCARS_CONFIG.hardFacts.find(
  (fact) => fact.id === "antiguedad",
);

/* ---------------------------------------------------------------------------
   SEO (2026-11-10, pedido del dueño): esta página responde a la búsqueda
   "importación de autos a pedido" y sus variantes ("importar auto/carro de
   Estados Unidos/USA/Miami a Perú", "traer un auto de Estados Unidos",
   "camioneta", "a pedido", "puesto en Lima"). La frase principal va al frente
   del título y del h1; las demás se reparten en la descripción, el primer
   párrafo y las preguntas frecuentes de abajo. Una página solo puede tener un
   título, así que las intenciones distintas tienen página propia: /calculadora
   (costo), /guias/* (requisitos, tributos) e /importar/<modelo> (modelos).
   ------------------------------------------------------------------------- */
const TITULO_SEO = "Importación de autos a pedido desde Estados Unidos a Perú";

// Mismo texto para Open Graph y Twitter Card: una sola fuente, sin copy nuevo.
const OG_TITLE = `${TITULO_SEO} | ${brandName}`;
const OG_DESCRIPTION =
  "Elige el auto y nosotros lo importamos: normativa clara, tributos explicados y calculadora pública del costo puesto en Lima.";

/**
 * Los ejemplos de "más pedidos" salen de la base y se editan en el portal. Al
 * guardar, el portal pide regenerar esta página; esto es solo la red de
 * seguridad por si ese aviso se pierde: una vez al día se vuelve a generar.
 * Si la base falla en ese momento, se conserva la última página buena.
 */
export const revalidate = 86400;

export const metadata: Metadata = {
  title: TITULO_SEO,
  description:
    "Importación de autos a pedido desde Estados Unidos a Perú: elige el auto o camioneta, lo compramos, inspeccionamos, nacionalizamos y entregamos en Lima con placas.",
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


/**
 * Preguntas con las palabras exactas con las que la gente busca este servicio.
 * Sin FAQPage propio: el layout raíz ya emite uno y dos en la misma página
 * confunden a Google. Las cifras salen de la configuración, no van a mano.
 */
const minimo = formatCurrency(LUXCARS_CONFIG.services.minimumVehiclePrice);
const PREGUNTAS: { pregunta: string; respuesta: React.ReactNode }[] = [
  {
    pregunta: "¿Cómo funciona la importación de autos a pedido?",
    respuesta: (
      <>
        Nos dices qué auto o camioneta quieres (marca, modelo, año y presupuesto) y lo buscamos en
        Estados Unidos: en Miami o en cualquier otro estado. Lo inspeccionamos antes de pagar, lo
        embarcamos al Callao, lo nacionalizamos ante SUNAT y te lo entregamos en Lima con placas.
        Todo el proceso, paso a paso, está en{" "}
        <Link href="/como-funciona" className="font-medium text-ink underline underline-offset-4">
          cómo funciona
        </Link>
        .
      </>
    ),
  },
  {
    pregunta: "¿Cuánto cuesta importar un auto de Estados Unidos a Perú?",
    respuesta: (
      <>
        Depende del precio del auto en EE.UU., de si es nuevo o usado y del tipo de motor: sobre el
        valor CIF se pagan ad valorem, ISC, IGV e IPM, más flete, seguro y nuestros honorarios. La{" "}
        <Link href="/calculadora" className="font-medium text-ink underline underline-offset-4">
          calculadora de importación
        </Link>{" "}
        te da la cifra puesta en Lima al instante, y la{" "}
        <Link href={rutaGuia("cuanto-cuesta-importar-un-auto-a-peru")} className="font-medium text-ink underline underline-offset-4">
          guía de costos
        </Link>{" "}
        explica cada tributo. Trabajamos importaciones desde {minimo}.
      </>
    ),
  },
  {
    pregunta: "¿Qué autos se pueden importar a Perú desde USA?",
    respuesta: (
      <>
        Nuevos sin restricción de marca, y usados con hasta {antiguedad?.value ?? "2 años"} de
        antigüedad contados desde el año modelo, a gasolina, híbridos o eléctricos, con timón a la
        izquierda de fábrica. Los usados diésel no se pueden importar. Los requisitos completos
        están en la{" "}
        <Link href={rutaGuia("requisitos-para-importar-un-auto-a-peru")} className="font-medium text-ink underline underline-offset-4">
          guía de requisitos
        </Link>
        .
      </>
    ),
  },
  {
    pregunta: "¿Conviene traer un carro de Estados Unidos o comprarlo en Lima?",
    respuesta: (
      <>
        Conviene cuando el modelo no se vende en Perú, cuando la versión o el equipamiento que
        quieres no llega al país, o cuando la diferencia de precio cubre con holgura los tributos
        y la logística. Si el auto se consigue en Lima por menos, te lo decimos antes de cotizar;
        también puedes ver nuestro{" "}
        <Link href="/comprar" className="font-medium text-ink underline underline-offset-4">
          stock disponible en Lima
        </Link>
        .
      </>
    ),
  },
  {
    // Quien ya tiene el auto y vuelve de vivir fuera es otro caso, con su guía.
    pregunta: "¿Puedo traer a Perú el auto que ya tengo en Estados Unidos?",
    respuesta: (
      <>
        Sí, si cumple los mismos requisitos que cualquier usado: hasta {antiguedad?.value ?? "2 años"}{" "}
        de antigüedad, sin diésel y dentro del tope de recorrido. Si además eres peruano y viviste
        fuera tres años o más, la Ley del Retorno te libera de los tributos de importación. En la
        guía para{" "}
        <Link href={rutaGuia("traer-tu-auto-de-estados-unidos-a-peru")} className="font-medium text-ink underline underline-offset-4">
          traer tu auto de Estados Unidos a Perú
        </Link>{" "}
        compruebas en un minuto si el tuyo puede entrar.
      </>
    ),
  },
  {
    // Búsquedas "importar auto de Europa/Japón/Canadá a Perú": se responden
    // sin diluir el foco en EE.UU., que es donde el servicio es más fuerte.
    pregunta: "¿Solo importan autos desde Estados Unidos?",
    respuesta: (
      <>
        Es el origen habitual y el único que cotiza la calculadora: mayor oferta de modelos que no
        llegan a Perú, salida directa al Callao y 0% de ad valorem en los nuevos originarios. Pero
        si el auto que quieres está en Canadá, México, Europa, Japón o Corea, evaluamos el caso
        aparte: cambian el flete, el tránsito y el arancel, y verificamos que la unidad cumpla las
        normas peruanas antes de cotizar. Lo que se paga en SUNAT al llegar está en la guía de{" "}
        <Link href={rutaGuia("cuanto-cuesta-nacionalizar-un-auto-en-peru")} className="font-medium text-ink underline underline-offset-4">
          cuánto cuesta nacionalizar un auto
        </Link>
        .
      </>
    ),
  },
];

/** Por qué Estados Unidos es el origen por defecto, y qué pasa con los demás. */
const ORIGENES: { icon: IconName; title: string; text: string }[] = [
  { icon: "mapPin", title: "Estados Unidos, el habitual", text: "Más oferta de modelos que no llegan a Perú, salida marítima directa al Callao y 0% de ad valorem en vehículos nuevos originarios. Es lo que cotiza la calculadora." },
  { icon: "ship", title: "Canadá y México", text: "Mismo continente y modelos parecidos. El arancel depende de la planta y del acuerdo comercial; lo verificamos con el VIN antes de cotizar." },
  { icon: "globe", title: "Europa, Japón y Corea", text: "Posible a pedido. Cambian el flete y el tiempo de tránsito, y hay que comprobar emisiones, timón y antigüedad. Te decimos si conviene antes de empezar." },
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
      <BreadcrumbJsonLd items={[{ nombre: "Importar", ruta: "/importar" }]} />
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
              <span className="eyebrow">{TITULO_SEO}</span>{" "}
              <span className="mt-3 block max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                El auto exacto que quieres, <span className="display-accent">puesto en Lima</span>
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base text-ink-2 sm:text-lg">
              Elige el auto o la camioneta, nuevo o seminuevo, en cualquier estado de EE.UU. Lo inspeccionamos antes de pagar y te lo entregamos en Lima con placas.
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
                  <p className="whitespace-nowrap text-lg font-semibold tabular-nums text-ink sm:text-2xl">{n}</p>
                  <p className="text-[11px] text-ink-3 sm:text-xs">{l}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Un auto concreto antes que cualquier explicación: de qué se compone el costo. */}
        <EjemploReal />

        <MostSoughtVehiclesSection tone="void" destino="pagina" />

        {/* Los cuatro pasos con foto, los mismos de la portada y de /como-funciona. */}
        <ImportBand />

        <Section tone="void">
          <SectionHeader eyebrow="Lo que permite la ley" title="Cuatro reglas deciden si tu auto puede entrar" description="Las revisamos antes de cotizar. Si no cumple, te lo decimos en la primera conversación." />
          <ul className="mt-10 grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {REGLAS.map((r) => (
              <li key={r.title} className="flex items-start gap-4 bg-surface p-6">
                <span className="icon-lux">
                  <Icon name={r.icon} size={22} />
                </span>
                <span>
                  <h3 className="text-base font-semibold text-ink">{r.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-3">{r.text}</p>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section tone="bg">
          <SectionHeader
            eyebrow="Desde dónde importamos"
            title="Estados Unidos primero, cualquier origen a pedido"
            description="Importamos autos a Perú desde el país donde esté el modelo que quieres. Estados Unidos es el origen que más conviene en precio, oferta y arancel; los demás se evalúan caso por caso."
          />
          <ul className="mt-10 grid gap-4 lg:grid-cols-3">
            {ORIGENES.map((o) => (
              <li key={o.title} className="panel-lux flex items-start gap-4 p-6">
                <span className="icon-lux">
                  <Icon name={o.icon} size={22} />
                </span>
                <span>
                  <h3 className="text-base font-semibold text-ink">{o.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-3">{o.text}</p>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Transparencia sobre foto: rompe la secuencia de tarjetas y le da peso a lo que decimos aunque cueste la venta. */}
        <section className="relative isolate overflow-hidden py-20 sm:py-24 lg:py-28">
          <Image
            src="/images/lima/costa-verde-noche.webp"
            alt=""
            fill
            sizes="100vw"
            className="-z-20 object-cover"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-void/85" />
          <div className="container-lux">
            <SectionHeader eyebrow="Transparencia" title="Tres cosas que te decimos aunque nos cuesten la venta" />
            <ol className="mt-10 grid gap-4 lg:grid-cols-3">
              {HONESTIDAD.map((h, i) => (
                <li key={h.title} className="rounded-[22px] border border-line/80 bg-void/60 p-6 backdrop-blur">
                  <span className="font-mono text-sm text-silver">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-lg font-semibold text-ink">{h.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{h.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Section tone="bg">
          <SectionHeader
            eyebrow="Preguntas frecuentes"
            title="Lo que más nos preguntan sobre importar a pedido"
            description="Respuestas cortas; el detalle está en las guías y en la calculadora."
          />
          <div className="mt-10 divide-y divide-line panel-lux">
            {PREGUNTAS.map((item) => (
              <details key={item.pregunta} className="group px-5 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-medium text-ink [&::-webkit-details-marker]:hidden">
                  <h3 className="text-base font-medium">{item.pregunta}</h3>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-3 transition-transform duration-300 group-open:rotate-45 group-open:border-silver group-open:text-ink">
                    <Icon name="close" size={16} className="rotate-45" />
                  </span>
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-ink-3">{item.respuesta}</p>
              </details>
            ))}
          </div>
        </Section>

        <Section tone="void" padding="tight">
          <SectionHeader
            eyebrow="Por marca"
            title="Importar por marca"
            description="Qué modelos de cada marca se ensamblan en Estados Unidos y cuáles pagan ad valorem."
          />
          <ul className="mt-8 flex flex-wrap gap-2">
            {MARCAS_IMPORTABLES.map((m) => (
              <li key={m.slug}>
                <Link
                  href={rutaMarca(m.nombre)}
                  className="inline-flex rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                >
                  {m.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <GuiasDestacadas tone="bg" />

        <Section tone="void" padding="tight">
          <CtaBand />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
