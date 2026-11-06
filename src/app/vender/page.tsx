import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Icon, WhatsAppIcon, type IconName } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { LUXCARS_CONFIG } from "@/lib/config";
import { FormularioTasacion } from "./FormularioTasacion";

export const metadata: Metadata = {
  title: "Vender mi auto en Lima · Consignación sin exclusividad",
  description:
    "Tasamos y vendemos tu auto en Lima sin contrato de exclusividad: lo sigues manejando mientras se vende y si lo vendes tú no pagas comisión.",
  alternates: { canonical: "/vender" },
  openGraph: {
    type: "website",
    url: `${LUXCARS_CONFIG.contact.website}/vender`,
    title: "Vender mi auto en Lima · Consignación sin exclusividad",
    description: "Dejas tu auto en venta con LuxCars y lo sigues manejando. Sin exclusividad.",
  },
};

const WA = `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(
  "Hola LuxCars, quiero tasar mi auto y conocer la consignación sin exclusividad.",
)}`;

const PROMESAS: { icon: IconName; title: string; text: string }[] = [
  { icon: "fileCheck", title: "Sin exclusividad", text: "Puedes retirarlo o venderlo por tu cuenta cuando quieras." },
  { icon: "key", title: "Lo sigues manejando", text: "El auto se queda contigo. Solo coordinamos las visitas." },
  { icon: "wallet", title: "Comisión solo si vendemos", text: "Si el comprador lo traes tú, no nos pagas nada." },
];

/** Comparativa reducida a lo que decide: tres criterios, tres caminos. */
const COMPARATIVA: { criterio: string; lux: string; solo: string; dealer: string }[] = [
  { criterio: "Precio que obtienes", lux: "De mercado, menos comisión acordada", solo: "El más alto si sabes esperar", dealer: "Por debajo del mercado" },
  { criterio: "Tu esfuerzo", lux: "Bajo: publicamos y filtramos", solo: "Alto: avisos, llamadas y citas", dealer: "Mínimo" },
  { criterio: "Usas el auto mientras tanto", lux: "Sí", solo: "Sí", dealer: "No" },
  { criterio: "Trámites y transferencia", lux: "Los hacemos nosotros", solo: "A tu cargo", dealer: "Los hace el dealer" },
];

const PASOS: { icon: IconName; title: string; text: string }[] = [
  { icon: "calculator", title: "Tasación", text: "Seis datos y te damos un rango referencial." },
  { icon: "scan", title: "Inspección", text: "Vemos el auto y acordamos el precio de salida." },
  { icon: "camera", title: "Publicación", text: "Fotos, ficha y difusión en el segmento premium." },
  { icon: "handshake", title: "Cierre", text: "Negociamos, acompañamos el pago y transferimos." },
];

export default function VenderPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1">
        {/* Portada */}
        <section className="relative isolate flex min-h-[70svh] w-full items-end overflow-hidden bg-void pt-[var(--lux-nav-h)]">
          <Image
            src="/images/timeline/journey.jpg"
            alt="Mercedes-AMG GT amarillo circulando sobre una carretera despejada"
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-[center_60%]"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-void via-void/75 to-void/20" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-48 bg-gradient-to-b from-void/80 to-transparent"
          />
          <div className="container-lux relative pb-12 pt-20 sm:pb-16">
            <p className="eyebrow">Tasación y consignación</p>
            <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Vende tu auto sin dejar de usarlo
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base text-ink-2 sm:text-lg">
              Lo publicamos, filtramos compradores y cerramos la venta. Sin contrato de exclusividad.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/cuenta/vender" variant="accent" size="lg">Publicar mi auto</Button>
              <Button href="#tasacion" variant="secondary" size="lg">Tasar mi auto gratis</Button>
              <Button href={WA} variant="whatsapp" size="lg">
                <WhatsAppIcon size={18} />
                WhatsApp
              </Button>
            </div>
          </div>
        </section>

        <Section tone="bg" padding="tight">
          <ul className="grid gap-4 sm:grid-cols-3">
            {PROMESAS.map((p) => (
              <li key={p.title} className="flex gap-4 rounded-[22px] border border-line bg-surface p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-silver-bright">
                  <Icon name={p.icon} size={22} />
                </span>
                <span>
                  <span className="block font-semibold text-ink">{p.title}</span>
                  <span className="mt-1 block text-sm text-ink-3">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Tasación (arriba: es la acción principal) */}
        <Section id="tasacion" tone="void">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionHeader eyebrow="Tasación gratuita" title="¿Cuánto vale hoy tu auto?" description="Seis datos y te devolvemos un rango de mercado. Sin compromiso." />
              <ul className="mt-8 space-y-3 text-sm text-ink-3">
                <li className="flex items-center gap-2"><Icon name="check" size={16} className="text-ok" />Respuesta por WhatsApp el mismo día</li>
                <li className="flex items-center gap-2"><Icon name="check" size={16} className="text-ok" />Basada en precios de cierre reales en Lima</li>
                <li className="flex items-center gap-2"><Icon name="check" size={16} className="text-ok" />Sin costo, sin exclusividad</li>
              </ul>
            </div>
            <div className="lg:col-span-7">
              <FormularioTasacion />
            </div>
          </div>
        </Section>

        <Section tone="bg">
          <SectionHeader eyebrow="Cómo funciona" title="De la tasación a la transferencia" />
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
                <p className="mt-1.5 text-sm text-ink-3">{s.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section tone="void">
          <SectionHeader eyebrow="Comparativa" title="Consignar, vender solo o ir al concesionario" description="Ninguna opción gana en todo. Esta es la comparación sin adornos." />
          <div className="mt-10 overflow-x-auto rounded-[22px] border border-line bg-surface">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  <th scope="col" className="px-5 py-4 font-semibold">Criterio</th>
                  <th scope="col" className="bg-surface-2 px-5 py-4 text-silver-bright">Con LuxCars</th>
                  <th scope="col" className="px-5 py-4">Por tu cuenta</th>
                  <th scope="col" className="px-5 py-4">Concesionario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {COMPARATIVA.map((f) => (
                  <tr key={f.criterio}>
                    <th scope="row" className="px-5 py-4 font-medium text-ink">{f.criterio}</th>
                    <td className="bg-surface-2 px-5 py-4 text-ink">{f.lux}</td>
                    <td className="px-5 py-4 text-ink-3">{f.solo}</td>
                    <td className="px-5 py-4 text-ink-3">{f.dealer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-ink-4">
            La comisión se acuerda por escrito antes de publicar. Trabajamos solo con vehículos en regla.
          </p>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
