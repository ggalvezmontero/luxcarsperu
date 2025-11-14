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
  return (
    <section
      id="how-it-works"
      className="scroll-mt-32 rounded-[40px] border border-white/10 bg-black/65 px-6 py-20 backdrop-blur lg:px-14"
    >
      <SectionHeading
        eyebrow="Cómo funciona"
        title="Proceso concierge Miami → Lima en 6 pasos guiados"
        description="Tu concierge coordina cada hito con documentación compartida, fotos en tiempo real y reportes semanales. Todo el flujo queda registrado para tu tranquilidad."
      />
      <div className="mt-12 grid gap-8 lg:grid-cols-2 xl:grid-cols-3">
        {STEPS.map((step, index) => (
          <article
            key={step.key}
            className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-white/10 via-black/40 to-black/80 p-6 shadow-[0_25px_90px_rgba(0,0,0,0.45)] transition hover:-translate-y-1 hover:border-[#f5d072]/60 hover:shadow-[0_35px_140px_rgba(245,208,114,0.25)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,208,114,0.3),transparent_75%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative space-y-5">
              <div className="relative h-40 overflow-hidden rounded-2xl border border-white/10">
                <Image
                  src={step.image}
                  alt={step.title}
                  fill
                  sizes="(min-width: 1024px) 320px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
                <span className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#f5d072]/30 bg-[#f5d072]/15 text-sm font-semibold text-[#fbe5a4]">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="relative space-y-2">
                <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                <p className="text-sm text-white/70">{step.description}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
