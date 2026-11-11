import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { GUIAS, rutaGuia } from "@/lib/guias";

/**
 * Las guías, como bloque de enlaces para las páginas de servicio. Es lo que
 * conecta /importar y /calculadora con el contenido que explica el tema: sin
 * estos enlaces dentro del cuerpo, las guías solo colgarían del pie.
 */
export function GuiasDestacadas({
  tone = "bg",
  titulo = "Lo que conviene saber antes de importar",
}: {
  tone?: "bg" | "void" | "surface";
  titulo?: string;
}) {
  return (
    <Section tone={tone}>
      <SectionHeader
        eyebrow="Guías"
        title={titulo}
        description="Costos, requisitos e impuestos explicados con las tasas vigentes y ejemplos en cifras."
      />
      <ul className="mt-10 grid gap-3 sm:grid-cols-2">
        {GUIAS.map((g) => (
          <li key={g.slug}>
            <Link
              href={rutaGuia(g.slug)}
              className="group flex h-full items-start justify-between gap-4 rounded-[22px] border border-line bg-surface p-5 transition-colors hover:border-line-strong sm:p-6"
            >
              <span>
                <span className="block text-base font-semibold leading-snug text-ink">{g.corto}</span>
                <span className="mt-2 block text-sm leading-relaxed text-ink-3">{g.descripcion}</span>
              </span>
              <Icon name="arrowRight" size={18} className="mt-1 shrink-0 text-silver transition-transform group-hover:translate-x-1" />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
