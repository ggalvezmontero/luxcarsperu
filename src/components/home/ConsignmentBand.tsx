import Image from "next/image";
import { Button } from "../Button";
import { Icon } from "../ui/Icon";
import { Section } from "../ui/Section";

const POINTS = [
  "Sin contrato de exclusividad",
  "Lo sigues manejando mientras se vende",
  "Si lo vendes tú, no pagas comisión",
];

export function ConsignmentBand() {
  return (
    <Section id="consignacion" tone="void" padding="none">
      <div className="grid overflow-hidden rounded-[28px] border border-line bg-surface lg:grid-cols-2">
        <div className="relative min-h-[260px] lg:min-h-[460px]">
          <Image
            src="/images/timeline/journey.jpg"
            alt="Mercedes-AMG GT amarillo circulando sobre una carretera despejada"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent lg:bg-gradient-to-r" />
        </div>
        <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-14">
          <p className="eyebrow">Vende tu auto</p>
          <h2 className="mt-3 text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-4xl">
            Lo vendemos por ti. Tú lo sigues usando.
          </h2>
          <ul className="mt-7 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-base text-ink-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok">
                  <Icon name="check" size={14} strokeWidth={2.5} />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/vender#tasacion" size="lg">
              Tasar mi auto gratis
            </Button>
            <Button href="/vender" variant="secondary" size="lg">
              Cómo funciona
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
