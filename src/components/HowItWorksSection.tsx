import Image from "next/image";
import { PlaceholderGrafico, type IconoPlaceholder } from "./PlaceholderGrafico";
import { SectionHeading } from "./SectionHeading";

/* El `alt` describe LO QUE SE VE en la foto, no lo que el paso promete. Si la
   foto no puede describirse sin mentir, no hay foto: va PlaceholderGrafico.
   Ver docs/IMAGENES.md para la lista de tomas que faltan conseguir. */
type Step = {
  key: string;
  title: string;
  description: string;
} & (
  // Union discriminada: o hay foto (con su alt real) o hay tratamiento
  // grafico. No existe el estado "foto sin alt".
  | { foto: { src: string; alt: string }; placeholder?: never }
  | {
      foto?: never;
      placeholder: { titulo: string; nota: string; icono: IconoPlaceholder };
    }
);

const STEPS: Step[] = [
  {
    key: "search",
    title: "Búsqueda inteligente",
    description:
      "Exploramos inventario off-market, subastas privadas y concesionarios certificados en Miami y todo Estados Unidos.",
    // Aquí había /images/how/search.jpg: una laptop con un dashboard de
    // analítica de marketing (plantilla de admin genérica, ni un auto a la
    // vista) presentada como "búsqueda de autos de lujo". No ilustra nada.
    placeholder: {
      titulo: "Búsqueda",
      nota: "Pendiente: captura real de una comparativa de unidades armada para un cliente.",
      icono: "busqueda",
    },
  },
  {
    key: "inspection",
    title: "Inspección certificada",
    description:
      "Técnicos ASE realizan checklist de 150 puntos, levantamos CarFax + AutoCheck y validamos historial completo.",
    // Aquí había /images/how/inspection.jpg: alguien echando aceite de motor.
    // Un cambio de aceite no es una inspección ASE de 150 puntos; usarlo como
    // prueba del servicio es exactamente el tipo de foto que cuesta la venta.
    placeholder: {
      titulo: "Inspección",
      nota: "Pendiente: foto del técnico con el checklist firmado junto a la unidad.",
      icono: "inspeccion",
    },
  },
  {
    key: "purchase",
    title: "Negociación & compra",
    description:
      "Tomamos posición como tu broker, negociamos precio, extras y garantizamos contrato blindado a tu favor.",
    foto: {
      src: "/images/how/purchase.jpg",
      alt: "Dos personas de traje se dan la mano cerrando un acuerdo en una oficina",
    },
  },
  {
    key: "shipping",
    title: "Envío asegurado",
    description:
      "Coordinamos transporte interno y booking marítimo premium con cobertura total en contenedor o RoRo.",
    foto: {
      src: "/images/how/shipping.jpg",
      alt: "Vista aérea de un terminal portuario con contenedores apilados y grúas pórtico",
    },
  },
  {
    key: "customs",
    title: "Aduanas & SUNAT",
    description:
      "Gestionamos nacionalización, pagos de impuestos, ISC y homologación sin sorpresas ni retrasos.",
    foto: {
      src: "/images/how/customs.jpg",
      alt: "Una persona firma con lapicero un juego de documentos impresos sobre un escritorio",
    },
  },
  {
    key: "delivery",
    title: "Entrega VIP",
    description:
      "Detailing completo, placas instaladas y experiencia de entrega en tu garage o showroom privado.",
    foto: {
      src: "/images/how/delivery.jpg",
      alt: "Toyota RAV4 plateada recién lavada, estacionada al aire libre y vista de tres cuartos",
    },
  },
];

export function HowItWorksSection() {
  const lastIndex = STEPS.length - 1;
  // La primera foto real de la reticula es la candidata a LCP en /como-funciona:
  // se precarga. El resto queda en lazy, que es el default de next/image.
  const firstPhotoKey = STEPS.find((step) => step.foto)?.key;

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
                  {step.foto ? (
                    <>
                      <Image
                        src={step.foto.src}
                        alt={step.foto.alt}
                        fill
                        priority={step.key === firstPhotoKey}
                        sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-void/85 via-void/25 to-transparent"
                      />
                    </>
                  ) : (
                    <PlaceholderGrafico
                      titulo={step.placeholder.titulo}
                      nota={step.placeholder.nota}
                      icono={step.placeholder.icono}
                      className="h-full w-full border-0"
                    />
                  )}
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
