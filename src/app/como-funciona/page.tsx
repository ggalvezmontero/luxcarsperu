import type { Metadata } from "next";
import Image from "next/image";
import { BrandsMarquee } from "@/components/BrandsMarquee";
import { Button } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { LUXCARS_CONFIG } from "@/lib/config";

export const metadata: Metadata = {
  title: "Cómo funciona la importación paso a paso",
  description:
    "De la búsqueda en EE.UU. a la entrega en Lima: inspección, embarque, nacionalización SUNAT, homologación y placas. El proceso completo.",
  alternates: { canonical: "/como-funciona" },
};

type Paso = {
  icon: IconName;
  title: string;
  text: string;
  day: string;
  foto?: { src: string; alt: string };
};

const PASOS: Paso[] = [
  { icon: "search", title: "Búsqueda", day: "Día 1", text: "Comparamos dealers y portales verificados y te enviamos una comparativa clara." },
  { icon: "scan", title: "Inspección", day: "Día 2–4", text: "CarFax, AutoCheck, título limpio e inspección presencial de 150 puntos." },
  { icon: "handshake", title: "Compra", day: "Día 5", text: "Negociamos y cerramos a tu nombre. El informe llega antes de transferir dinero.", foto: { src: "/images/how/purchase.jpg", alt: "Dos personas cierran un acuerdo con un apretón de manos" } },
  { icon: "ship", title: "Embarque", day: "Día 6–20", text: "Flete marítimo asegurado hasta el Callao con seguimiento semanal.", foto: { src: "/images/how/shipping.jpg", alt: "Terminal portuario con contenedores y grúas" } },
  { icon: "fileCheck", title: "Aduanas", day: "Día 21–28", text: "Despacho ante SUNAT, pago de tributos y nacionalización.", foto: { src: "/images/how/customs.jpg", alt: "Firma de documentos sobre un escritorio" } },
  { icon: "key", title: "Entrega", day: "Día 29–35", text: "Homologación, placas y entrega en tu cochera, listo para circular.", foto: { src: "/images/how/delivery.jpg", alt: "Camioneta plateada recién lavada, estacionada al aire libre" } },
];

const PLANES = [
  { key: "fastTrack" as const, text: "Prioridad en inspección, booking de nave y liberación en Callao.", destacado: true },
  { key: "standard" as const, text: "Proceso regular con ahorro logístico y reportes semanales.", destacado: false },
];

const INCLUYE: { icon: IconName; text: string }[] = [
  { icon: "shield", text: "Inspección antes de pagar" },
  { icon: "fileCheck", text: "CarFax + AutoCheck + título limpio" },
  { icon: "ship", text: "Flete y seguro internacional" },
  { icon: "building", text: "Gestión ante SUNAT, MTC y SUNARP" },
  { icon: "key", text: "Placas y tarjeta de propiedad" },
  { icon: "phone", text: "Seguimiento semanal por WhatsApp" },
];

export default function ComoFuncionaPage() {
  const { deliveryWindows } = LUXCARS_CONFIG;
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1">
        <section className="relative isolate w-full overflow-hidden bg-void pt-[calc(var(--lux-nav-h)+3rem)] pb-12 sm:pt-[calc(var(--lux-nav-h)+4rem)] sm:pb-16">
          <Image
            src="/images/vehiculos/ford-bronco-raptor.webp"
            alt="Ford Bronco Raptor negro en el patio de un concesionario de Estados Unidos, imagen referencial"
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-center"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-void/85 via-void/65 to-void" />
          <div className="container-lux relative">
            <p className="eyebrow">Cómo funciona</p>
            <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              De Miami a tu cochera en seis pasos
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base text-ink-2 sm:text-lg">
              Cada hito queda documentado y lo recibes por WhatsApp. Sin sorpresas al final.
            </p>
          </div>
        </section>

        <Section tone="bg">
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PASOS.map((p, i) => (
              <li key={p.title} className="group flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface">
                <div className="relative aspect-[16/10] w-full bg-surface-2">
                  {p.foto ? (
                    <Image src={p.foto.src} alt={p.foto.alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(70%_60%_at_50%_40%,#2a2a2f_0%,#121214_100%)] text-silver-bright">
                      <Icon name={p.icon} size={48} strokeWidth={1.25} />
                    </div>
                  )}
                  <span className="absolute left-3 top-3 rounded-full bg-void/70 px-2.5 py-1 text-[11px] font-semibold text-silver-bright backdrop-blur">
                    {p.day}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-ink-4">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="text-lg font-semibold text-ink">{p.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-3">{p.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section tone="void">
          <SectionHeader eyebrow="Plazos" title="Dos planes de entrega" description="El tramo marítimo depende del calendario de naves; por eso damos un rango, no una fecha." />
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {PLANES.map((p) => {
              const w = deliveryWindows[p.key];
              return (
                <article key={p.key} className={`rounded-[22px] border p-6 sm:p-8 ${p.destacado ? "border-silver/50 bg-surface-2" : "border-line bg-surface"}`}>
                  <div className="flex items-center justify-between">
                    <p className="eyebrow">{w.label}</p>
                    {p.destacado ? <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-void">Recomendado</span> : null}
                  </div>
                  <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-ink">
                    {w.days[0]}–{w.days[1]} <span className="text-lg font-medium text-ink-3">días</span>
                  </p>
                  <p className="mt-3 text-sm text-ink-3">{p.text}</p>
                </article>
              );
            })}
          </div>
        </Section>

        <Section tone="bg">
          <SectionHeader eyebrow="Incluido" title="Todo lo que cubre el servicio" />
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUYE.map((i) => (
              <li key={i.text} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm text-ink-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-silver-bright"><Icon name={i.icon} size={18} /></span>
                {i.text}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Button href="/#calculator" variant="accent" size="lg">
              <Icon name="calculator" size={18} />
              Calcular mi importación
            </Button>
          </div>
        </Section>

        <BrandsMarquee />
        <FAQSection limite={6} tone="void" />
        <Section tone="bg" padding="tight">
          <CtaBand />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
