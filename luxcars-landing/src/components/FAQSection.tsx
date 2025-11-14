import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

export function FAQSection() {
  return (
    <section className="rounded-[40px] border border-white/10 bg-black/60 px-6 py-20 lg:px-14">
      <SectionHeading
        eyebrow="FAQ LuxCars.pe"
        title="Preguntas clave sobre importar autos de lujo a Perú"
        description="Respondemos las inquietudes más comunes para que avances con total confianza. Escríbenos si necesitas una asesoría personalizada."
      />
      <div className="mt-12 space-y-4">
        {LUXCARS_CONFIG.faq.map((item) => (
          <details
            key={item.question}
            className="group rounded-[24px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_90px_rgba(0,0,0,0.35)]"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-left text-lg font-semibold text-white marker:hidden">
              <span>{item.question}</span>
              <span className="text-sm text-white/40 transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-4 text-sm text-white/70">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
