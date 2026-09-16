import Image from "next/image";
import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

const HIGHLIGHTS = [
  {
    title: "Fast Track",
    key: "fastTrack" as const,
    description:
      "Prioridad en inspección, booking de nave y liberación en Callao. Ideal para lanzamientos, coleccionistas o entregas urgentes.",
    image: "/images/how/shipping.jpg", // Imagen de envío rápido
  },
  {
    title: "Estándar",
    key: "standard" as const,
    description:
      "Proceso regular con ahorro logístico. Supervisión diaria con reportes de avance semana a semana.",
    image: "/images/timeline/journey.jpg", // Imagen de proceso estándar
  },
];

const BENEFITS = [
  "Coordinación directa con navieras premium y seguros internacionales.",
  "Monitoreo satelital + reporte semanal a tu WhatsApp.",
  "Gestión anticipada ante SUNAT y liberación acelerada.",
];

export function DeliveryTimesSection() {
  return (
    <section
      id="services"
      className="scroll-mt-32 overflow-hidden rounded-lux-xl border border-line bg-surface px-5 py-16 sm:px-8 sm:py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="Tiempo de entrega"
        title="Llegada garantizada con seguimiento profesional"
        description="Coordinamos todo el trayecto Miami → Lima con informes y evidencias en cada hito. Selecciona el plan que mejor se adapte a tu urgencia."
        align="center"
      />
      <div className="mt-10 grid gap-5 sm:mt-12 sm:gap-6 lg:grid-cols-2">
        {HIGHLIGHTS.map((item) => {
          const window = LUXCARS_CONFIG.deliveryWindows[item.key];
          const isFeatured = item.key === "fastTrack";
          return (
            <article
              key={item.title}
              className={`group relative flex flex-col overflow-hidden rounded-lux-lg bg-surface-2 p-6 transition-colors duration-300 sm:p-8 ${
                isFeatured
                  ? "border border-silver bg-surface-3 hover:border-silver-bright"
                  : "border border-line hover:border-line-strong"
              }`}
            >
              <div className="relative h-40 overflow-hidden rounded-lux border border-line sm:h-44">
                <Image
                  src={item.image}
                  alt={`Plan ${item.title} timeline`}
                  fill
                  sizes="(min-width: 1024px) 520px, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent" />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-4 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] ${
                    isFeatured
                      ? "border border-silver bg-surface text-silver-bright"
                      : "border border-line text-ink-3"
                  }`}
                >
                  {item.title}
                </span>
                {isFeatured ? (
                  <span className="text-[0.65rem] font-medium uppercase tracking-[0.3em] text-silver-dim">
                    Plan recomendado
                  </span>
                ) : null}
              </div>

              <h3 className="mt-4 text-2xl font-semibold text-ink sm:text-[1.75rem]">
                {window.label}{" "}
                <span className="block text-base font-normal text-ink-3 sm:mt-1">
                  ({window.days[0]} - {window.days[1]} días)
                </span>
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-ink-3">
                {item.description}
              </p>

              <ul className="mt-6 space-y-3 border-t border-line pt-6 text-sm text-ink-2">
                {BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-2 h-px w-4 flex-none ${
                        isFeatured ? "bg-silver" : "bg-silver-dim"
                      }`}
                    />
                    <span className="min-w-0">{benefit}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
