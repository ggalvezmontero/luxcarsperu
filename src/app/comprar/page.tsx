import type { Metadata } from "next";
import Image from "next/image";
import { CreditoFoto } from "@/components/CreditoFoto";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { CtaBand } from "@/components/CtaBand";
import { Section } from "@/components/ui/Section";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LUXCARS_CONFIG } from "@/lib/config";
import { getStock } from "@/lib/stock";
import { StockExplorer } from "./StockExplorer";

export const metadata: Metadata = {
  title: "Comprar auto de lujo en Lima · Stock disponible",
  description:
    "Autos premium en Lima, verificados y listos para entregar. Stock propio de LuxCars y autos de clientes en consignación, siempre identificados: documentos en orden y entrega en días.",
  alternates: { canonical: "/comprar" },
  openGraph: {
    type: "website",
    url: `${LUXCARS_CONFIG.contact.website}/comprar`,
    title: "Comprar auto de lujo en Lima | Stock disponible",
    description:
      "Unidades premium verificadas, en Lima y listas para entregar.",
  },
};

const PROMESAS: { icon: IconName; title: string; text: string }[] = [
  { icon: "mapPin", title: "Está en Lima", text: "Lo ves y lo manejas con cita, sin esperar un barco." },
  { icon: "fileCheck", title: "Papeles listos", text: "Nacionalizado, con placa y transferencia incluida." },
  { icon: "clock", title: "Entrega en días", text: "Sin tránsito marítimo ni aduanas." },
];

export default async function ComprarPage() {
  const stock = await getStock(48);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1">
        {/* Portada con foto de Lima (CC BY 2.0, crédito obligatorio abajo) */}
        <section className="relative isolate w-full overflow-hidden bg-void pt-[calc(var(--lux-nav-h)+3rem)] pb-10 sm:pt-[calc(var(--lux-nav-h)+4rem)] sm:pb-14">
          <Image
            src="/images/lima/miraflores-atardecer.jpg"
            alt="Avenida de Miraflores, Lima, al atardecer con luces de autos en movimiento y el mar al fondo"
            fill
            priority
            sizes="100vw"
            className="-z-20 object-cover object-[center_60%]"
          />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-void/85 via-void/60 to-void" />
          <div className="container-lux relative">
            <p className="eyebrow">Disponibles en Lima</p>
            <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Autos disponibles hoy en Lima
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base text-ink-2 sm:text-lg">
              Stock propio y autos de clientes en consignación, siempre identificados. Verificados, con documentos en regla y listos para entregar.
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
            <CreditoFoto
              credito="geezaweezer"
              licencia="CC BY 2.0"
              fuenteUrl="https://commons.wikimedia.org/wiki/File:Miraflores_-_Lima,_Peru_at_Night.jpg"
              className="mt-6"
            />
          </div>
        </section>

        <StockExplorer stock={stock} />

        <Section tone="void" padding="tight">
          <CtaBand
            title="¿No está el que buscas?"
            text="Lo traemos a pedido desde Estados Unidos o tasamos el tuyo como parte de pago."
            message="Hola LuxCars, busco un auto que no vi en su stock. ¿Pueden ayudarme a conseguirlo?"
          />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
