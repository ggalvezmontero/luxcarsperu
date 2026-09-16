import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

export function TimelineSection() {
  const stages = LUXCARS_CONFIG.timeline;

  return (
    <section
      id="timeline"
      className="scroll-mt-32 rounded-lux-lg md:rounded-lux-xl border border-line bg-surface px-4 py-12 md:px-8 md:py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="Timeline de entrega"
        title="Tu auto llega a Lima en 7 hitos guiados por especialistas"
        description="Coordinamos cada paso con documentación compartida, reportes fotográficos y validación en tu idioma. Así mantenemos transparencia total de punta a punta."
      />

      <ol className="mt-10 md:mt-16 max-w-5xl mx-auto grid gap-5 md:gap-8">
        {stages.map((stage, index) => {
          const isLast = index === stages.length - 1;

          return (
            <li
              key={stage.day}
              className="group relative pl-11 md:pl-16"
            >
              {/* Riel vertical: conecta este hito con el siguiente */}
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[15px] md:left-[21px] top-1.5 md:top-2 -bottom-5 md:-bottom-8 w-px bg-line"
                />
              ) : null}

              {/* Marcador numerado */}
              <span
                aria-hidden="true"
                className={[
                  "absolute left-0 top-1.5 md:top-2 z-10 inline-flex h-8 w-8 md:h-11 md:w-11",
                  "items-center justify-center rounded-full border font-mono text-[11px] md:text-sm",
                  "tabular-nums bg-surface transition-colors",
                  isLast
                    ? "border-silver text-silver-bright"
                    : "border-line-strong text-silver group-hover:border-silver group-hover:text-silver-bright",
                ].join(" ")}
              >
                {String(index + 1).padStart(2, "0")}
              </span>

              {/* Tarjeta del hito */}
              <div className="rounded-lux border border-line bg-surface-2 p-4 md:p-6 transition-colors hover:border-line-strong">
                <div className="grid gap-2 md:gap-6 md:grid-cols-[220px_1fr] md:items-baseline">
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] md:text-xs uppercase tracking-[0.25em] tabular-nums text-silver">
                      {stage.day}
                    </p>
                    <h3 className="text-lg md:text-xl font-semibold tracking-tight text-ink">
                      {stage.title}
                    </h3>
                  </div>
                  <p className="text-sm md:text-[15px] leading-relaxed text-ink-2">
                    {descriptions[index] ?? GENERIC_DESCRIPTION}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
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
