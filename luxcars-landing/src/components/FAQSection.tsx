import Image from "next/image";
import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

export function FAQSection() {
  return (
    <section
      id="faq"
      className="scroll-mt-32 rounded-[40px] border border-white/10 bg-black/60 px-6 py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="FAQ LuxCars.pe"
        title="Preguntas clave sobre importar autos de lujo a Perú"
        description="Respondemos las inquietudes más comunes para que avances con total confianza. Escríbenos si necesitas una asesoría personalizada."
      />
      <div className="mt-12 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-4">
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
        <aside className="space-y-6 rounded-[28px] border border-white/10 bg-gradient-to-b from-white/10 via-black/70 to-black/85 p-8 shadow-[0_25px_90px_rgba(0,0,0,0.35)]">
          <Image
            src="/images/faq/questions.jpg"
            alt="Asesor LuxCars respondiendo preguntas frecuentes"
            width={560}
            height={360}
            className="h-48 w-full rounded-2xl border border-white/10 object-cover"
          />
          <div className="space-y-3 text-sm text-white/70">
            <p>
              ¿No encontraste tu pregunta? Escribe a nuestro concierge para obtener
              respuestas inmediatas.
            </p>
            <div className="rounded-2xl border border-[#f5d072]/30 bg-[#f5d072]/10 p-4 text-sm text-[#fbe5a4]">
              WhatsApp oficial · +{LUXCARS_CONFIG.contact.whatsappNumber}
            </div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">
              Respuesta promedio &lt; 15 minutos
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
