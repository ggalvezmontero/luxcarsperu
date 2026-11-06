import { LUXCARS_CONFIG } from "@/lib/config";
import { Button } from "./Button";
import { Icon } from "./ui/Icon";
import { Section, SectionHeader } from "./ui/Section";

type Props = {
  /** Cuántas preguntas mostrar. Sin valor, todas. */
  limite?: number;
  tone?: "bg" | "void" | "surface";
  titulo?: string;
  /**
   * Etiqueta del título. `h2` por defecto (en la home y en /como-funciona es una
   * sección más). Solo /faq pasa `h1`: ahí este título ES el de la página y sin
   * él la página no tenía ningún h1.
   */
  tituloComo?: "h1" | "h2";
};

export function FAQSection({
  limite,
  tone = "bg",
  titulo = "Preguntas frecuentes",
  tituloComo = "h2",
}: Props = {}) {
  const items = limite ? LUXCARS_CONFIG.faq.slice(0, limite) : LUXCARS_CONFIG.faq;
  const esResumen = Boolean(limite);

  return (
    <Section id="faq" tone={tone}>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <SectionHeader
            eyebrow="Dudas comunes"
            title={titulo}
            as={tituloComo}
            description="Respuestas directas sobre plazos, impuestos y condiciones."
            // SectionHeader agranda los h1 (tamaño de portada). Aquí el título
            // vive en una columna angosta y debe verse IGUAL que siempre: solo
            // cambia la etiqueta para el SEO, no el diseño. Se fija el tamaño
            // del h2 desde el contenedor (el selector descendiente gana).
            className={
              tituloComo === "h1"
                ? "[&_h1]:text-3xl [&_h1]:leading-[1.1] sm:[&_h1]:text-4xl lg:[&_h1]:text-4xl"
                : undefined
            }
          />
          {esResumen ? (
            <Button href="/faq" variant="secondary" className="mt-6">
              Ver todas las preguntas
              <Icon name="arrowRight" size={16} />
            </Button>
          ) : null}
        </div>

        <div className="lg:col-span-8">
          <div className="divide-y divide-line rounded-[22px] border border-line bg-surface">
            {items.map((item) => (
              <details key={item.question} className="group px-5 sm:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-medium text-ink [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-3 transition-transform duration-300 group-open:rotate-45 group-open:border-silver group-open:text-ink">
                    <Icon name="close" size={16} className="rotate-45" />
                  </span>
                </summary>
                <p className="pb-6 pr-12 text-sm leading-relaxed text-ink-2 sm:text-[15px]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
