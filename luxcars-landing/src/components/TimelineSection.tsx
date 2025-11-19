import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

export function TimelineSection() {
  return (
    <section
      id="timeline"
      className="scroll-mt-32 rounded-[40px] border border-white/10 bg-gradient-to-br from-neutral-950 via-black to-neutral-900 px-6 py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="Timeline de entrega"
        title="Tu auto llega a Lima en 7 hitos guiados por especialistas"
        description="Coordinamos cada paso con documentación compartida, reportes fotográficos y validación en tu idioma. Así mantenemos transparencia total de punta a punta."
      />
      <div className="mt-14 relative max-w-5xl mx-auto pl-20">
        {/* Línea vertical continua con gradiente mejorado */}
        <div className="absolute left-[28px] top-[7px] bottom-[7px] w-[3px] bg-gradient-to-b from-white/50 via-white/30 via-white/20 to-transparent rounded-full" />

        <div className="grid gap-8">
          {LUXCARS_CONFIG.timeline.map((stage, index) => (
            <div
              key={stage.day}
              className="group relative"
            >
              {/* Círculo fuera de la tarjeta */}
              <div className="absolute left-[-76px] top-[24px] z-10">
                <div className="relative">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white/50 bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-md text-base font-bold text-white shadow-[0_8px_32px_rgba(255,255,255,0.2)] transition-all group-hover:scale-110 group-hover:border-white/70 group-hover:shadow-[0_12px_48px_rgba(255,255,255,0.3)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {/* Pulse ring effect */}
                  <span className="absolute inset-0 rounded-full border-2 border-white/30 opacity-0 transition-all group-hover:animate-ping group-hover:opacity-100" />
                </div>
              </div>

              {/* Tarjeta */}
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.04] to-transparent p-7 shadow-[0_20px_80px_rgba(0,0,0,0.4)] transition-all hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_25px_100px_rgba(0,0,0,0.5)]">
                {/* Glow effect on hover */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="relative grid gap-4 md:grid-cols-[280px_1fr]">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/40">
                      {stage.day}
                    </p>
                    <h3 className="text-xl font-bold text-white transition-colors group-hover:text-white">
                      {stage.title}
                    </h3>
                  </div>
                  <p className="text-[15px] text-white/70 leading-relaxed">
                    {descriptions[index] ?? GENERIC_DESCRIPTION}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const GENERIC_DESCRIPTION =
  "Coordinación personalizada con reporte diario, documentos digitales y soporte continuo con nuestro concierge bilingüe.";

const descriptions: string[] = [
  "Investigamos inventario en 10+ portales, negociamos directamente con el dealer y aseguramos la reserva ideal para tu presupuesto.",
  "Inspección presencial con técnicos certificados, informe de 150 puntos, CarFax, AutoCheck y verificación de título limpio.",
  "Agendamos transporte interno hasta el puerto, cubrimos seguro y certificamos que tu auto suba a bodega protegida.",
  "Seguimiento satelital diario, control de documentación, pago de fees portuarios y coordinación de seguros marítimos.",
  "Equipo de abogados y agentes numerarios gestiona aduana SUNAT, pagos, y libera el vehículo sin contratiempos.",
  "Realizamos homologación, inspección técnica y gestionamos placas personalizadas si lo deseas.",
  "Coordinamos entrega VIP en tu hogar, detailing inicial y sesión fotográfica para tu colección.",
];
