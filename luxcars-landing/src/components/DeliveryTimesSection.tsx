import Image from "next/image";
import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

const HIGHLIGHTS = [
  {
    title: "Fast Track",
    key: "fastTrack" as const,
    description:
      "Prioridad en inspección, booking de nave y liberación en Callao. Ideal para lanzamientos, coleccionistas o entregas urgentes.",
  },
  {
    title: "Estándar",
    key: "standard" as const,
    description:
      "Proceso regular con ahorro logístico. Supervisión diaria con reportes de avance semana a semana.",
  },
];

export function DeliveryTimesSection() {
  return (
    <section
      id="services"
      className="scroll-mt-32 rounded-[40px] border border-white/10 bg-gradient-to-br from-neutral-950/90 via-black/75 to-neutral-900/80 px-6 py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="Tiempo de entrega"
        title="Llegada garantizada con seguimiento profesional"
        description="Coordinamos todo el trayecto Miami → Lima con informes y evidencias en cada hito. Selecciona el plan que mejor se adapte a tu urgencia."
        align="center"
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {HIGHLIGHTS.map((item) => {
          const window = LUXCARS_CONFIG.deliveryWindows[item.key];
          return (
            <article
              key={item.title}
              className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_35px_120px_rgba(0,0,0,0.3)] transition hover:-translate-y-1 hover:border-[#f5d072]/60 hover:shadow-[0_35px_140px_rgba(245,208,114,0.25)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,208,114,0.25),transparent_65%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative space-y-4">
                <div className="relative h-36 overflow-hidden rounded-2xl border border-white/10">
                  <Image
                    src="/images/timeline/journey.jpg"
                    alt={`Plan ${item.title} timeline`}
                    fill
                    sizes="(min-width: 1024px) 320px, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                </div>
                <span className="inline-flex items-center rounded-full border border-[#f5d072]/30 bg-[#f5d072]/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[#fbe5a4]">
                  {item.title}
                </span>
                <h3 className="text-2xl font-semibold text-white">
                  {window.label} ({window.days[0]} - {window.days[1]} días)
                </h3>
                <p className="text-sm text-white/65">{item.description}</p>
                <ul className="space-y-3 text-sm text-white/70">
                  <li className="flex items-center gap-3">
                    <span className="inline-flex h-2 w-2 rounded-full bg-[#f5d072]" />
                    Coordinación directa con navieras premium y seguros
                    internacionales.
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="inline-flex h-2 w-2 rounded-full bg-[#f5d072]" />
                    Monitoreo satelital + reporte semanal a tu WhatsApp.
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="inline-flex h-2 w-2 rounded-full bg-[#f5d072]" />
                    Gestión anticipada ante SUNAT y liberación acelerada.
                  </li>
                </ul>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
