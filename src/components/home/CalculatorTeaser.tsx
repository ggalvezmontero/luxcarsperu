import Image from "next/image";

import type { PremiumImportQuote } from "@/core/pricing/priceCalculator";
import type { ImportableTrendingVehicle } from "@/data/trendingVehicles";
import { rutaModelo } from "@/lib/importExamples/modelo";
import { formatCurrency } from "@/lib/utils";

import { Button } from "../Button";
import { CreditoFoto } from "../CreditoFoto";
import { Icon } from "../ui/Icon";
import { Section } from "../ui/Section";

/**
 * Invitación a la calculadora desde la portada, con un caso resuelto por el
 * motor real. La calculadora completa vive en /calculadora.
 */
export function CalculatorTeaser({
  caso,
}: {
  caso: { v: ImportableTrendingVehicle; estimate: PremiumImportQuote } | null;
}) {
  const e = caso?.estimate;
  return (
    <Section id="calculator" tone="void">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:items-center">
        <div>
          <p className="eyebrow">Calculadora pública</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-4xl">
            ¿Cuánto cuesta importar tu auto?
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-ink-2 sm:text-lg">
            Cuatro datos y ves el costo puesto en Lima al instante: flete, seguro, tributos SUNAT y nuestro
            servicio, en una sola cifra. Sin dejar tu correo.
          </p>
          <ul className="mt-6 grid gap-2 text-sm text-ink-2 sm:grid-cols-2">
            {[
              "Flete Miami → Callao y seguro",
              "Ad valorem, ISC, IGV e IPM según SUNAT",
              "Honorario Luxcars y gestión documentaria",
              "Percepción del IGV aparte, porque se recupera",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-silver-bright" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/calculadora" variant="accent" size="lg" data-ga-cta="portada_calculadora_abrir">
              <Icon name="calculator" size={18} />
              Abrir la calculadora
            </Button>
            <Button href="/importar" variant="secondary" size="lg" data-ga-cta="portada_calculadora_importar">
              Importación de autos a pedido
            </Button>
          </div>
        </div>

        {caso && e ? (
          <div className="flex flex-col">
            <div className="overflow-hidden panel-lux">
              <div className="relative aspect-[16/9] w-full bg-surface-2">
                {caso.v.imageSrc ? (
                  <Image src={caso.v.imageSrc} alt={caso.v.imageAlt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
                ) : null}
                <span className="absolute left-3 top-3 rounded-full bg-void/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-silver-bright backdrop-blur">
                  Caso resuelto
                </span>
              </div>
              <div className="p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-ink">{caso.v.name}</h3>
                <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-4">Precio en EE.UU.</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink-2">{formatCurrency(e.input.priceMiami)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.12em] text-ink-4">Puesto en Lima, con placas</dt>
                    <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{formatCurrency(e.finalEstimate)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-ink-4">
                  {e.condition === "nuevo" ? "Nuevo" : "Usado"} · plan {e.planConfig.label}, {e.planConfig.timelineLabel}. Percepción del IGV aparte:{" "}
                  {formatCurrency(e.percepcion)}, recuperable.
                </p>
                <Button href={rutaModelo(caso.v.id)} variant="ghost" size="sm" className="mt-3 -ml-2" data-ga-cta="portada_calculadora_caso">
                  Ver el desglose completo
                  <Icon name="arrowRight" size={14} />
                </Button>
              </div>
            </div>
            <CreditoFoto credito={caso.v.imageCredit} licencia={caso.v.imageLicense} fuenteUrl={caso.v.imageSourceUrl} className="mt-2 px-1" />
          </div>
        ) : null}
      </div>
    </Section>
  );
}
