import Image from "next/image";
import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

// Diferenciador destacado: es el único argumento realmente excluyente frente
// a la competencia, por eso recibe el único acento dorado de la sección.
const FEATURED_DIFFERENTIATOR = "Consignación sin exclusividad";

export function WhyUsSection() {
  return (
    <section
      id="why-us"
      className="scroll-mt-32 overflow-hidden rounded-lux-xl border border-line bg-surface px-5 py-16 sm:px-8 lg:px-14 lg:py-24"
    >
      <SectionHeading
        eyebrow="Por qué LuxCars"
        title="Un broker boutique que protege tu inversión en cada etapa"
        description="Nuestro equipo opera como tu departamento de compras internacional. Transparencia total, gestión personalizada y acceso a inventario que no se publica abiertamente."
      />

      <div className="mt-14 grid gap-x-10 gap-y-px sm:grid-cols-2 xl:grid-cols-3">
        {LUXCARS_CONFIG.differentiators.map((item, index) => {
          const isFeatured = item.title === FEATURED_DIFFERENTIATOR;

          return (
            <article
              key={item.title}
              className="group relative border-t border-line pt-6 pb-8 transition-colors duration-300 hover:border-silver"
            >
              <span
                aria-hidden="true"
                className={`absolute -top-px left-0 h-px w-12 transition-all duration-300 group-hover:w-24 ${
                  isFeatured ? "bg-silver" : "bg-silver-dim"
                }`}
              />
              <div className="flex items-baseline gap-4">
                <span
                  aria-hidden="true"
                  className={`text-xs font-medium tabular-nums tracking-[0.2em] ${
                    isFeatured ? "text-silver" : "text-ink-4"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-base font-semibold leading-snug tracking-tight text-ink sm:text-lg">
                  {item.title}
                </h3>
              </div>
              <p className="mt-3 max-w-prose pl-0 text-sm leading-relaxed text-ink-3 sm:pl-10">
                {item.description}
              </p>
            </article>
          );
        })}
      </div>

      <div className="mt-12 grid gap-8 border-t border-line pt-10 text-sm text-ink-2 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-12">
        <p className="max-w-2xl leading-relaxed">
          Sin stock propio, sin comisiones ocultas, sin presión de venta. Cada
          decisión se toma junto a ti. Te mostramos comparativas reales, modelos
          disponibles en tiempo real y trabajamos como tu equipo de compras en
          Miami.
        </p>
        <div className="flex items-center gap-4 rounded-lux-lg border border-line bg-surface-2 p-4">
          <Image
            src="/images/contact/concierge.jpg"
            alt="Asesor concierge de LuxCars atendiendo a un cliente"
            width={120}
            height={80}
            className="h-16 w-20 shrink-0 rounded-lux border border-line object-cover"
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">
              Concierge bilingüe dedicado
            </p>
            <p className="text-xs leading-relaxed text-ink-3">
              Miami · Lima · Disponibilidad 7/365 para acompañarte en todo el
              proceso.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
