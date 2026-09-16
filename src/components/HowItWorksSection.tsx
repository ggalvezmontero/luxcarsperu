import Image from "next/image";
import { SectionHeading } from "./SectionHeading";

const STEPS = [
  {
    key: "search",
    title: "Búsqueda inteligente",
    description:
      "Exploramos inventario off-market, subastas privadas y concesionarios certificados en Miami y todo Estados Unidos.",
    image: "/images/how/search.jpg",
  },
  {
    key: "inspection",
    title: "Inspección certificada",
    description:
      "Técnicos ASE realizan checklist de 150 puntos, levantamos CarFax + AutoCheck y validamos historial completo.",
    image: "/images/how/inspection.jpg",
  },
  {
    key: "purchase",
    title: "Negociación & compra",
    description:
      "Tomamos posición como tu broker, negociamos precio, extras y garantizamos contrato blindado a tu favor.",
    image: "/images/how/purchase.jpg",
  },
  {
    key: "shipping",
    title: "Envío asegurado",
    description:
      "Coordinamos transporte interno y booking marítimo premium con cobertura total en contenedor o RoRo.",
    image: "/images/how/shipping.jpg",
  },
  {
    key: "customs",
    title: "Aduanas & SUNAT",
    description:
      "Gestionamos nacionalización, pagos de impuestos, ISC y homologación sin sorpresas ni retrasos.",
    image: "/images/how/customs.jpg",
  },
  {
    key: "delivery",
    title: "Entrega VIP",
    description:
      "Detailing completo, placas instaladas y experiencia de entrega en tu garage o showroom privado.",
    image: "/images/how/delivery.jpg",
  },
];

export function HowItWorksSection() {
  const lastIndex = STEPS.length - 1;

  return (
    <section
      id="how-it-works"
      className="scroll-mt-32 rounded-lux-xl border border-line bg-surface/70 px-5 py-16 backdrop-blur sm:px-8 sm:py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="Cómo funciona"
        title="Proceso concierge Miami → Lima en 6 pasos guiados"
        description="Tu concierge coordina cada hito con documentación compartida, fotos en tiempo real y reportes semanales. Todo el flujo queda registrado para tu tranquilidad."
      />

      <ol className="mt-12 grid gap-6 sm:mt-14 md:grid-cols-2 md:gap-7 xl:grid-cols-3">
        {STEPS.map((step, index) => {
          const isFinalStep = index === lastIndex;
          const stepNumber = String(index + 1).padStart(2, "0");

          return (
            <li key={step.key} className="h-full">
              <article className="group flex h-full flex-col overflow-hidden rounded-lux-lg border border-line bg-surface transition-colors duration-300 hover:border-line-strong">
                <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-line bg-surface-2">
                  <Image
                    src={step.image}
                    alt={`Paso ${stepNumber}: ${step.title} en el proceso de importación de LuxCars`}
                    fill
                    sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-void/85 via-void/25 to-transparent"
                  />
                </div>

                <div className="flex flex-1 flex-col gap-3 p-6 sm:p-7">
                  <div className="flex items-center gap-4">
                    <span className="sr-only">
                      Paso {index + 1} de {STEPS.length}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`font-mono text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl ${
                        isFinalStep ? "text-silver-bright" : "text-silver-dim"
                      }`}
                    >
                      {stepNumber}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-line transition-colors duration-300 group-hover:bg-line-strong"
                    />
                  </div>

                  <h3 className="text-lg font-semibold tracking-tight text-ink text-balance">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-ink-3">
                    {step.description}
                  </p>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
