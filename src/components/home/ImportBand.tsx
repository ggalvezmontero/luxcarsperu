import Image from "next/image";
import { Button } from "../Button";
import { Icon } from "../ui/Icon";
import { Section, SectionHeader } from "../ui/Section";

/**
 * Cómo importamos, en cuatro pasos con foto. Reemplaza a la fila de iconos:
 * las cuatro fotos ya existen en /public y describen literalmente cada paso.
 */
const PASOS = [
  {
    n: "01",
    title: "Compra verificada",
    text: "Buscamos el modelo, lo inspeccionamos con CarFax y AutoCheck y cerramos a tu nombre.",
    foto: "/images/how/purchase.jpg",
    alt: "Dos personas cierran un acuerdo con un apretón de manos",
  },
  {
    n: "02",
    title: "Embarque asegurado",
    text: "Flete marítimo con seguro internacional hasta el Callao.",
    foto: "/images/how/shipping.jpg",
    alt: "Terminal portuario con contenedores y grúas",
  },
  {
    n: "03",
    title: "Aduanas y placas",
    text: "Despacho SUNAT, homologación, revisión técnica y tarjeta de propiedad.",
    foto: "/images/how/customs.jpg",
    alt: "Firma de documentos sobre un escritorio",
  },
  {
    n: "04",
    title: "Entrega en tu cochera",
    text: "Listo para circular, entre 30 y 60 días según el plan.",
    foto: "/images/how/delivery.jpg",
    alt: "Camioneta plateada recién lavada, estacionada al aire libre",
  },
];

export function ImportBand() {
  return (
    <Section id="timeline" tone="bg">
      <SectionHeader
        eyebrow="Importación a pedido"
        title="Así traemos tu auto desde Estados Unidos"
        description="Cuatro pasos, seguimiento semanal por WhatsApp y una sola cifra desde el inicio."
        action={
          <Button href="/como-funciona" variant="secondary">
            Ver el proceso completo
            <Icon name="arrowRight" size={16} />
          </Button>
        }
      />
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PASOS.map((p) => (
          <li key={p.n} className="group overflow-hidden rounded-[22px] border border-line bg-surface">
            <div className="relative aspect-[4/3] w-full">
              <Image
                src={p.foto}
                alt={p.alt}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <span className="absolute left-3 top-3 rounded-full bg-void/70 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-silver-bright backdrop-blur">
                {p.n}
              </span>
            </div>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-ink">{p.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{p.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
