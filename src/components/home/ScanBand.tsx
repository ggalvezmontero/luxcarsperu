import Link from "next/link";
import { Icon } from "../ui/Icon";
import { Section } from "../ui/Section";

/**
 * Franja angosta que lleva a /escaneo. El servicio no está en la barra de
 * navegación (ya va cargada), así que este es su enlace interno desde la home
 * y desde /comprar: sin él la página quedaría colgada solo del pie.
 */
export function ScanBand() {
  return (
    <Section tone="void" padding="none" className="pt-6 sm:pt-8">
      <Link
        href="/escaneo"
        className="group flex flex-col gap-5 rounded-[22px] border border-line bg-surface p-6 transition-colors hover:border-line-strong sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <span className="flex items-start gap-4 sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-silver-bright">
            <Icon name="scan" size={24} />
          </span>
          <span>
            <span className="block text-lg font-semibold text-ink">¿Vas a comprar un auto usado en Lima?</span>
            <span className="mt-1 block text-sm leading-relaxed text-ink-3">
              Lo escaneamos antes de que pagues: fallas ocultas, códigos borrados y kilometraje real.
            </span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-ink">
          Escaneo pre-compra
          <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </Section>
  );
}
