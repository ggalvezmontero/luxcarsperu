import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Icon, WhatsAppIcon, type IconName } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { LUXCARS_CONFIG } from "@/lib/config";
import { FOTOS_PROCESO } from "@/lib/fotosProceso";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";
import { ORGANIZATION_ID, breadcrumbSchema } from "@/lib/structuredData";

const { contact, brandName } = LUXCARS_CONFIG;
const URL_PAGINA = `${contact.website}/escaneo`;

/**
 * Precios del servicio, en soles. Salen del plan comercial del dueño
 * (docs/marketing): un solo lugar para cambiarlos, porque se repiten en el
 * texto, en las tarjetas y en los datos estructurados, y Google penaliza que
 * el JSON-LD diga un precio distinto al de la página.
 */
const PRECIO = { limaModerna: 349, restoDeLima: 449 } as const;
const soles = (monto: number) => `S/ ${monto}`;

/* SEO (2026-11-10, pedido del dueño): la página responde a "escaneo de autos
   en Lima" y sus variantes ("scanner automotriz", "revisión de auto usado antes
   de comprar", "inspección precompra a domicilio", "peritaje vehicular",
   "revisión mecánica", "kilometraje real"). La frase principal va en el título
   y el h1; las variantes, en la descripción y el primer párrafo. */
const TITLE = "Escaneo de autos usados en Lima antes de comprar · Inspección precompra";
const DESCRIPTION = `Revisión de autos usados antes de comprar en Lima: vamos a donde está el auto con un escáner automotriz profesional y en una hora sabes si conviene: fallas ocultas, códigos borrados y kilometraje real. Desde ${soles(PRECIO.limaModerna)}.`;
const OG_TITLE = `${TITLE} | ${brandName}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/escaneo" },
  openGraph: {
    ...OG_DEFAULTS,
    type: "website",
    url: URL_PAGINA,
    title: OG_TITLE,
    description: DESCRIPTION,
  },
  twitter: twitterCard(OG_TITLE, DESCRIPTION),
};

const WA = `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(
  "Hola LuxCars, quiero agendar un escaneo pre-compra. Este es el auto que quiero revisar: ",
)}`;

const REVISION: { icon: IconName; title: string; text: string }[] = [
  { icon: "scan", title: "Fallas en todos los módulos", text: "Motor, caja, ABS, airbag, carrocería, climatización y asistencias de manejo." },
  { icon: "refresh", title: "Códigos borrados", text: "Si alguien limpió las fallas antes de tu visita, los monitores del auto lo delatan." },
  { icon: "gauge", title: "Kilometraje real", text: "Comparamos el odómetro con el kilometraje que guardan los módulos." },
  { icon: "activity", title: "Datos en vivo", text: "Temperatura, presiones, adaptaciones de la caja y batería de 12 V con el motor encendido." },
  { icon: "battery", title: "Batería de híbridos y eléctricos", text: "Estado de salud (SOH) de la batería de alta tensión, el repuesto más caro del auto." },
  { icon: "shield", title: "Registro de colisión", text: "Lectura del módulo de airbag, cuando el vehículo lo permite." },
  { icon: "steering", title: "Prueba de ruta y carrocería", text: "Quince minutos de manejo, revisión visual de paneles y fotos de lo que encontremos." },
  { icon: "fileCheck", title: "VIN y papeles", text: "Decodificamos el VIN y revisamos que coincida con la tarjeta de propiedad." },
];

const PASOS: { icon: IconName; title: string; text: string }[] = [
  { icon: "share", title: "Mándanos el aviso", text: "El enlace o las fotos del auto, por WhatsApp. Confirmamos que sea compatible con el escáner." },
  { icon: "calendar", title: "Agendamos", text: "Coordinamos con el vendedor. Turnos a las 10:00 y a las 16:00." },
  { icon: "scan", title: "Escaneamos el auto", text: "Donde esté, en Lima. Toma alrededor de una hora y puedes estar presente." },
  { icon: "fileCheck", title: "Informe el mismo día", text: "PDF con los hallazgos y nuestra recomendación: comprar, negociar o retirarte." },
];

const GRATIS: { title: string; text: string }[] = [
  {
    title: "Nos dejas grabar el escaneo",
    text: "Si el auto que vas a comprar cuesta USD 15,000 o más y aceptas que publiquemos el video en nuestras redes, no pagas. Cubrimos placas y rostros, y nunca nombramos al vendedor.",
  },
  {
    title: "Nos encargas buscar el auto",
    text: "Si lo buscamos nosotros en Lima, el escaneo es parte del servicio.",
  },
  {
    title: "Consignas tu auto con nosotros",
    text: "Lo escaneamos al recibirlo y el informe se publica junto a la ficha.",
  },
];

const PREGUNTAS: { question: string; answer: string }[] = [
  {
    question: "¿Cuánto demora el escaneo?",
    answer:
      "Alrededor de una hora en el lugar, incluida la prueba de ruta. El informe en PDF te llega el mismo día por WhatsApp.",
  },
  {
    question: "¿Hay que llevar el auto a un taller?",
    answer:
      "No. Vamos a donde está el auto: la casa del vendedor, una cochera o una tienda de autos, en cualquier distrito de Lima.",
  },
  {
    question: "¿Qué pasa si el vendedor no deja escanear el auto?",
    answer:
      "Coordinamos con el vendedor antes de ir, para que no pierdas el viaje. Si se niega a que conecten un escáner, esa respuesta ya es información: suele haber algo que no quiere que veas.",
  },
  {
    question: "¿El escaneo reemplaza la revisión de un mecánico?",
    answer:
      "No. Es un diagnóstico electrónico y visual con fines informativos, no una inspección mecánica completa de taller ni una garantía. Sirve para saber qué preguntar, cuánto negociar y cuándo conviene no comprar.",
  },
  {
    question: "¿Sirve para híbridos y eléctricos?",
    answer:
      "Sí. Además de las fallas, leemos el estado de salud de la batería de alta tensión cuando el vehículo lo reporta. Antes de agendar confirmamos que tu modelo sea compatible.",
  },
  {
    question: "¿Cómo se descuenta lo que pagué por el escaneo?",
    answer: `Si después contratas con LuxCars la búsqueda de un auto, una consignación, una importación o un trámite documentario, los ${soles(PRECIO.limaModerna)} del escaneo se restan del precio de ese servicio.`,
  },
];

/** Filas del informe de ejemplo de la portada. `estado` define color e icono. */
const INFORME: { label: string; valor: string; estado: "ok" | "alerta" | "falla" }[] = [
  { label: "Módulos leídos", valor: "14 de 14", estado: "ok" },
  { label: "Fallas activas", valor: "Ninguna", estado: "ok" },
  { label: "Códigos borrados", valor: "Hace 38 km", estado: "alerta" },
  { label: "Odómetro del tablero", valor: "61,200 km", estado: "ok" },
  { label: "Kilometraje en módulos", valor: "86,410 km", estado: "falla" },
  { label: "Batería de 12 V", valor: "12.4 V", estado: "ok" },
];

const ESTADO = {
  ok: { icon: "check", clase: "bg-ok/15 text-ok" },
  alerta: { icon: "alert", clase: "bg-warn/15 text-warn" },
  falla: { icon: "close", clase: "bg-danger/15 text-danger" },
} as const satisfies Record<string, { icon: IconName; clase: string }>;

/**
 * Informe de ejemplo de la portada: lo que el cliente recibe. Está rotulado
 * como ejemplo y es decorativo (`aria-hidden`): el mismo contenido está escrito
 * en la sección "Qué revisamos".
 */
function InformeDeEjemplo() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md">
      <div className="rounded-[26px] border border-line bg-surface p-6 shadow-[var(--lux-shadow-lg)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-4">Informe de escaneo</p>
            <p className="mt-1.5 text-lg font-semibold text-ink">SUV híbrida 2021</p>
          </div>
          <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            Ejemplo
          </span>
        </div>
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {INFORME.map((fila) => {
            const estado = ESTADO[fila.estado];
            return (
              <li key={fila.label} className="flex items-center justify-between gap-4 py-3">
                <span className="flex items-center gap-3 text-sm text-ink-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${estado.clase}`}>
                    <Icon name={estado.icon} size={13} strokeWidth={2.5} />
                  </span>
                  {fila.label}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{fila.valor}</span>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 rounded-2xl bg-danger/10 px-4 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-danger">Recomendación</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            No comprar a este precio: 25,000 km de diferencia entre el tablero y los módulos.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function EscaneoPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${URL_PAGINA}#servicio`,
      name: "Escaneo pre-compra de autos usados",
      serviceType: "Diagnóstico electrónico de vehículos usados a domicilio",
      description: DESCRIPTION,
      url: URL_PAGINA,
      areaServed: { "@type": "City", name: "Lima" },
      // La organización ya está descrita completa en el JSON-LD del layout
      // (autoDealerSchema): se la referencia por su @id en vez de repetirla.
      provider: { "@id": ORGANIZATION_ID },
      offers: [
        { "@type": "Offer", name: "Lima Moderna", price: PRECIO.limaModerna, priceCurrency: "PEN", url: URL_PAGINA },
        { "@type": "Offer", name: "Resto de Lima", price: PRECIO.restoDeLima, priceCurrency: "PEN", url: URL_PAGINA },
      ],
    },
    // Sin FAQPage propio: el layout ya emite el del sitio en todas las páginas
    // y dos FAQPage en una misma URL es un error en Search Console. Las
    // preguntas del escaneo quedan como contenido visible, que es lo que posiciona.
    breadcrumbSchema([
      { nombre: "Inicio", ruta: "/" },
      { nombre: "Escaneo pre-compra", ruta: "/escaneo" },
    ]),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar />
      <main id="contenido" className="w-full flex-1">
        {/* Portada */}
        <section className="relative isolate w-full overflow-hidden bg-void pt-[calc(var(--lux-nav-h)+3rem)] pb-14 sm:pt-[calc(var(--lux-nav-h)+4rem)] sm:pb-20">
          <Image
            src={FOTOS_PROCESO.escaneo.src}
            alt={FOTOS_PROCESO.escaneo.alt}
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-center"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-void/90 via-void/80 to-void" />
          <div className="container-lux relative grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-7">
              {/* El h1 abarca la etiqueta y el titular: la etiqueta lleva la búsqueda y
                  el titular, la frase de marca. Se ve igual; Google lee las dos. */}
              <h1>
                <span className="eyebrow">Escaneo pre-compra de autos usados en Lima</span>{" "}
                <span className="mt-3 block max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                  Escanea el auto usado antes de comprarlo
                </span>
              </h1>
              <p className="mt-4 max-w-xl text-pretty text-base text-ink-2 sm:text-lg">
                Vamos a donde está el auto con un escáner (scanner) automotriz profesional. Es una inspección
                precompra a domicilio, un peritaje mecánico y electrónico en una hora: sabes lo que el aviso
                no dice, con fallas guardadas, códigos borrados y kilometraje real, antes de pagar.
              </p>
              <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-3xl font-semibold tabular-nums tracking-tight text-ink">{soles(PRECIO.limaModerna)}</span>
                <span className="text-sm text-ink-3">y se descuenta si luego compras, importas o consignas con nosotros</span>
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button href={WA} variant="whatsapp" size="lg" data-ga-cta="escaneo_portada_agendar_whatsapp">
                  <WhatsAppIcon size={18} />
                  Agendar por WhatsApp
                </Button>
                <Button href="#incluye" variant="secondary" size="lg" data-ga-cta="escaneo_portada_que_revisamos">
                  Ver qué revisamos
                </Button>
              </div>
            </div>
            <div className="lg:col-span-5">
              <InformeDeEjemplo />
            </div>
          </div>
        </section>

        <Section id="incluye" tone="bg">
          <SectionHeader
            eyebrow="Qué revisamos"
            title="Lo que el escáner ve y tú no"
            description="Un auto puede verse impecable y guardar fallas en su memoria. Esto es lo que leemos y probamos en cada visita."
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REVISION.map((r) => (
              <li key={r.title} className="rounded-[22px] border border-line bg-surface p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-silver-bright">
                  <Icon name={r.icon} size={24} />
                </span>
                <h3 className="mt-5 text-lg font-semibold leading-snug text-ink">{r.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{r.text}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section tone="void">
          <SectionHeader eyebrow="Cómo funciona" title="Del aviso al informe, el mismo día" />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((s, i) => (
              <li key={s.title} className="rounded-[22px] border border-line bg-surface p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-silver-bright">
                    <Icon name={s.icon} size={24} />
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-ink-4">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{s.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="precio" tone="bg">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionHeader
                eyebrow="Precio"
                title="Un precio fijo, y te lo devolvemos"
                description="Incluye el traslado, el escaneo, la prueba de ruta y el informe. Lo que pagas se descuenta por completo de cualquier servicio que contrates después con LuxCars."
              />
              <dl className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[22px] border border-silver/50 bg-surface-2 p-6">
                  <dt className="text-sm text-ink-3">Lima Moderna</dt>
                  <dd className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-ink">{soles(PRECIO.limaModerna)}</dd>
                  <dd className="mt-2 text-xs leading-relaxed text-ink-4">San Isidro, Miraflores, Surco, San Borja, La Molina y distritos vecinos.</dd>
                </div>
                <div className="rounded-[22px] border border-line bg-surface p-6">
                  <dt className="text-sm text-ink-3">Resto de Lima</dt>
                  <dd className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-ink">{soles(PRECIO.restoDeLima)}</dd>
                  <dd className="mt-2 text-xs leading-relaxed text-ink-4">Lima Norte, Este, Sur y Callao.</dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-[22px] border border-line bg-surface p-6 sm:p-8">
                <h3 className="text-xl font-semibold text-ink">Gratis en tres casos</h3>
                <ol className="mt-6 space-y-5">
                  {GRATIS.map((g, i) => (
                    <li key={g.title} className="flex gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ok/15 text-sm font-semibold tabular-nums text-ok">
                        {i + 1}
                      </span>
                      <span>
                        <span className="block font-semibold text-ink">{g.title}</span>
                        <span className="mt-1 block text-sm leading-relaxed text-ink-3">{g.text}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-7 border-t border-line pt-5 text-sm leading-relaxed text-ink-3">
                  Además, todos los sábados hacemos el <span className="font-semibold text-ink-2">Sábado de Escaneo</span>: diez
                  cupos sin costo en formato express de 20 minutos. Reserva el tuyo por WhatsApp con el modelo de tu auto y te
                  confirmamos la hora el viernes.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Section tone="void" padding="tight">
          <div className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-6 sm:flex-row sm:items-start sm:gap-5 sm:p-8">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-silver-bright">
              <Icon name="info" size={22} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink">Lo que el escaneo no es</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-3">
                No es una inspección mecánica completa de taller ni una garantía. Es un diagnóstico electrónico y visual
                con fines informativos: te dice qué preguntar, cuánto negociar y cuándo conviene no comprar.
              </p>
            </div>
          </div>
        </Section>

        <Section id="preguntas" tone="bg">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHeader
                eyebrow="Dudas comunes"
                title="Preguntas sobre el escaneo"
                description="Si tu duda no está aquí, escríbenos y te respondemos el mismo día."
              />
            </div>
            <div className="lg:col-span-8">
              <div className="divide-y divide-line rounded-[22px] border border-line bg-surface">
                {PREGUNTAS.map((item) => (
                  <details key={item.question} className="group px-5 sm:px-6">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-medium text-ink [&::-webkit-details-marker]:hidden">
                      {item.question}
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-3 transition-transform duration-300 group-open:rotate-45 group-open:border-silver group-open:text-ink">
                        <Icon name="close" size={16} className="rotate-45" />
                      </span>
                    </summary>
                    <p className="pb-6 pr-12 text-sm leading-relaxed text-ink-2 sm:text-[15px]">{item.answer}</p>
                  </details>
                ))}
              </div>
              <p className="mt-6 text-sm leading-relaxed text-ink-3">
                ¿Prefieres no buscar? Mira los{" "}
                <Link href="/comprar" className="font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-silver">
                  autos disponibles en Lima
                </Link>{" "}
                o{" "}
                <Link href="/importar" className="font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-silver">
                  importa uno a pedido
                </Link>{" "}
                desde Estados Unidos.
              </p>
            </div>
          </div>
        </Section>

        <Section tone="void" padding="tight">
          <CtaBand
            title="¿Ya viste un auto que te gusta?"
            text="Mándanos el aviso y te decimos cuándo podemos escanearlo. Antes de pagar, que hable el auto."
            message="Hola LuxCars, quiero agendar un escaneo pre-compra. Este es el auto que quiero revisar: "
            secondaryHref="/#contact"
            secondaryLabel="Dejar mis datos"
          />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
