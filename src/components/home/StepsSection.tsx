import { Button } from "../Button";
import { Icon, type IconName } from "../ui/Icon";
import { Section, SectionHeader } from "../ui/Section";

export type Step = { icon: IconName; title: string; text: string };

export const IMPORT_STEPS: Step[] = [
  { icon: "search", title: "Buscamos", text: "El modelo exacto en dealers verificados de EE.UU." },
  { icon: "scan", title: "Inspeccionamos", text: "CarFax, AutoCheck y revisión presencial antes de pagar." },
  { icon: "ship", title: "Embarcamos", text: "Flete marítimo asegurado hasta el Callao." },
  { icon: "key", title: "Entregamos", text: "Nacionalizado, con placas y listo para circular." },
];

export function StepsRow({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li
          key={s.title}
          className="relative rounded-[22px] border border-line bg-surface p-6"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-silver-bright">
              <Icon name={s.icon} size={24} />
            </span>
            <span className="text-sm font-semibold tabular-nums text-ink-4">
              {String(i + 1).padStart(2, "0")}
            </span>
          </div>
          <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

export function StepsSection() {
  return (
    <Section id="timeline" tone="bg">
      <SectionHeader
        eyebrow="Importación a pedido"
        title="De Miami a tu cochera en cuatro pasos"
        description="Entre 30 y 60 días según el plan. Seguimiento semanal por WhatsApp."
        action={
          <Button href="/como-funciona" variant="secondary">
            Ver el proceso completo
            <Icon name="arrowRight" size={16} />
          </Button>
        }
      />
      <div className="mt-10">
        <StepsRow steps={IMPORT_STEPS} />
      </div>
    </Section>
  );
}
