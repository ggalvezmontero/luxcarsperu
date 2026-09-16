import { LUXCARS_CONFIG } from "@/lib/config";
import { PlaceholderGrafico } from "./PlaceholderGrafico";
import { SectionHeading } from "./SectionHeading";

export function FAQSection() {
  return (
    <section
      id="faq"
      className="scroll-mt-32 overflow-hidden rounded-lux-lg md:rounded-lux-xl border border-line bg-surface px-4 py-12 md:px-6 md:py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="FAQ LuxCars.pe"
        title="Preguntas clave sobre importar autos de lujo a Perú"
        description="Respondemos las inquietudes más comunes para que avances con total confianza. Escríbenos si necesitas una asesoría personalizada."
      />

      <div className="mt-8 md:mt-12 grid gap-6 md:gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3 md:space-y-4">
          {LUXCARS_CONFIG.faq.map((item, index) => (
            <details
              key={item.question}
              className="group rounded-lux border border-line bg-surface-2 transition-colors duration-200 hover:border-line-strong open:border-line-strong open:bg-surface-3"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 md:gap-5 p-4 md:p-6 text-left [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-start gap-3 md:gap-4">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 md:mt-1 flex-none font-mono text-[11px] md:text-xs tabular-nums tracking-widest text-silver-dim transition-colors group-open:text-silver"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 break-words text-base md:text-lg font-medium leading-snug text-ink transition-colors group-hover:text-silver-bright group-open:text-silver-bright">
                    {item.question}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 md:h-8 md:w-8 flex-none items-center justify-center rounded-full border border-line-strong text-silver transition-transform duration-300 group-open:rotate-45 group-open:border-silver"
                >
                  <svg
                    viewBox="0 0 12 12"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  >
                    <path d="M6 1.5v9M1.5 6h9" />
                  </svg>
                </span>
              </summary>
              <div className="px-4 pb-4 md:px-6 md:pb-6">
                <div className="h-px w-full bg-line" />
                <p className="mt-3 md:mt-4 max-w-2xl text-sm leading-relaxed text-ink-3 md:pl-8">
                  {item.answer}
                </p>
              </div>
            </details>
          ))}
        </div>

        <aside className="h-fit space-y-4 md:space-y-6 rounded-lux md:rounded-lux-lg border border-line bg-surface-2 p-5 md:p-8">
          {/* Aquí había /images/faq/questions.jpg con el alt "Asesor LuxCars
              respondiendo preguntas frecuentes": stock de tres desconocidos
              señalando una laptop. Ni es LuxCars ni está respondiendo nada.
              Ver docs/IMAGENES.md. */}
          <PlaceholderGrafico
            titulo="Soporte directo"
            nota="Pendiente: foto real del equipo atendiendo consultas."
            icono="soporte"
            className="h-40 w-full rounded-lux md:h-48"
          />
          <div className="space-y-3 md:space-y-4 text-sm leading-relaxed text-ink-3">
            <p>
              ¿No encontraste tu pregunta? Escribe a nuestro concierge para obtener
              respuestas inmediatas.
            </p>
            <div className="rounded-lux border border-line-strong bg-surface-3 p-3 md:p-4 text-sm font-medium break-words text-silver-bright">
              WhatsApp oficial · +{LUXCARS_CONFIG.contact.whatsappNumber}
            </div>
            <p className="text-[11px] md:text-xs uppercase tracking-[0.25em] text-ink-4">
              Respuesta promedio &lt; 15 minutos
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
