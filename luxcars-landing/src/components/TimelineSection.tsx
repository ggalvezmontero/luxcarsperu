import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

export function TimelineSection() {
  return (
    <section className="rounded-[40px] border border-white/10 bg-gradient-to-br from-neutral-950 via-black to-neutral-900 px-6 py-20 lg:px-14">
      <SectionHeading
        eyebrow="Timeline de entrega"
        title="Tu auto llega a Lima en 7 hitos guiados por especialistas"
        description="Coordinamos cada paso con documentación compartida, reportes fotográficos y validación en tu idioma. Así mantenemos transparencia total de punta a punta."
      />
      <div className="mt-14 grid gap-6">
        {LUXCARS_CONFIG.timeline.map((stage, index) => (
          <div
            key={stage.day}
            className="relative grid gap-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_95px_rgba(0,0,0,0.35)] md:grid-cols-[auto_1fr]"
          >
            <div className="absolute left-6 top-8 h-full w-[2px] -translate-x-1/2 bg-gradient-to-b from-[#f5d072] via-[#fbe5a4]/60 to-transparent md:left-10" />
            <div className="flex items-center gap-4">
              <span className="relative z-10 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#f5d072]/30 bg-[#f5d072]/10 text-sm font-semibold text-[#fbe5a4]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                  {stage.day}
                </p>
                <h3 className="text-lg font-semibold text-white">
                  {stage.title}
                </h3>
              </div>
            </div>
            <p className="text-sm text-white/65 md:pl-16">
              {descriptions[index] ?? GENERIC_DESCRIPTION}
            </p>
          </div>
        ))}
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
