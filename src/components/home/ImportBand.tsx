import Image from "next/image";
import { FOTOS_PROCESO, type FotoProceso } from "@/lib/fotosProceso";
import { Button } from "../Button";
import { CreditoFoto } from "../CreditoFoto";
import { Icon } from "../ui/Icon";
import { Section, SectionHeader } from "../ui/Section";

/**
 * Cómo importamos, en cuatro pasos con foto. Las fotos son las mismas que usa
 * /como-funciona (src/lib/fotosProceso.ts): una sola fuente para la imagen, su
 * `alt` y su crédito.
 */
const PASOS: { n: string; title: string; text: string; foto: FotoProceso }[] = [
  {
    n: "01",
    title: "Compra verificada",
    text: "Buscamos el modelo, lo inspeccionamos con CarFax y AutoCheck y cerramos a tu nombre.",
    foto: FOTOS_PROCESO.compra,
  },
  {
    n: "02",
    title: "Embarque asegurado",
    text: "Flete marítimo con seguro internacional hasta el Callao.",
    foto: FOTOS_PROCESO.embarque,
  },
  {
    n: "03",
    title: "Aduanas y placas",
    text: "Despacho SUNAT, homologación, revisión técnica y tarjeta de propiedad.",
    foto: FOTOS_PROCESO.aduanas,
  },
  {
    n: "04",
    title: "Entrega en tu cochera",
    text: "Listo para circular, entre 30 y 60 días según el plan.",
    foto: FOTOS_PROCESO.entrega,
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
                src={p.foto.src}
                alt={p.foto.alt}
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
              {"credito" in p.foto && p.foto.credito ? (
                <CreditoFoto
                  credito={p.foto.credito.autor}
                  licencia={p.foto.credito.licencia}
                  fuenteUrl={p.foto.credito.fuenteUrl}
                  className="mt-3"
                />
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
