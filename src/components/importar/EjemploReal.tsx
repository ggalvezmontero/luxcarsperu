import Image from "next/image";

import { currentYearInLima } from "@/core/pricing/pricingConfig";
import { cotizarEjemplo, rutaModelo, tienePaginaPropia } from "@/lib/importExamples/modelo";
import { getImportExamplesForIsr } from "@/lib/importExamples/servidor";
import { formatCurrency, formatRate } from "@/lib/utils";

import { Button } from "../Button";
import { CreditoFoto } from "../CreditoFoto";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";
import { Section, SectionHeader } from "../ui/Section";

/**
 * Un caso real resuelto con el motor de precios, para que /importar enseñe
 * con un auto concreto y no con cuatro porcentajes: de qué se compone el
 * costo puesto en Lima, en una barra, con los montos al lado.
 *
 * El auto es el primer ejemplo cotizable de la lista del dueño (la misma que
 * pinta "los más pedidos"); si no hay ninguno, el bloque no se pinta.
 */
export async function EjemploReal() {
  const { vehiculos } = await getImportExamplesForIsr();
  const anio = currentYearInLima();
  // Primero un ejemplo sin advertencias y con foto: el caso de portada no
  // puede ser un auto "con aviso". Si no hay ninguno, el primero cotizable.
  const cotizables = vehiculos
    .filter(tienePaginaPropia)
    .map((v) => ({ v, r: cotizarEjemplo(v, anio) }))
    .flatMap(({ v, r }) => (r.kind === "ready" ? [{ v, e: r.estimate }] : []));
  const caso = cotizables.find(({ v }) => v.importViability === "importable" && v.imageSrc) ?? cotizables[0];
  if (!caso) return null;
  const { v, e } = caso;

  const tramos = [
    { nombre: "Precio en EE.UU.", monto: e.input.priceMiami, color: "bg-ink" },
    { nombre: "Flete y seguro", monto: e.freight + e.insurance, color: "bg-silver-bright" },
    { nombre: "Tributos SUNAT", monto: e.adValorem + e.isc + e.igv + e.ipm, color: "bg-silver-dim" },
    { nombre: "Aduana y servicio Luxcars", monto: e.customsFee + e.brokerFee + e.documentHandlingFee, color: "bg-silver-dim/40" },
  ];
  const total = tramos.reduce((s, t) => s + t.monto, 0);
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  return (
    <Section tone="bg">
      <SectionHeader
        eyebrow="Un caso real, con números"
        title={`De ${formatCurrency(e.input.priceMiami)} en Estados Unidos a ${formatCurrency(e.finalEstimate)} en tu cochera`}
        description="Así se compone el costo de importar. Cada tramo sale del motor de precios que usa la calculadora; nada está puesto a mano."
      />

      <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex flex-col">
          <div className="relative overflow-hidden panel-lux">
            <div className="relative aspect-[4/3] w-full bg-surface-2">
              {v.imageSrc ? (
                <Image src={v.imageSrc} alt={v.imageAlt} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
              ) : null}
              <div className="absolute left-3 top-3 flex gap-2">
                <Badge onPhoto>{e.condition === "nuevo" ? "Nuevo" : "Usado"}</Badge>
                <Badge onPhoto>{e.vehicleCategory.label}</Badge>
              </div>
            </div>
            <div className="p-5">
              <h3 className="text-xl font-semibold text-ink">{v.name}</h3>
              <p className="mt-1 text-sm text-ink-3">
                Plan {e.planConfig.label}, {e.planConfig.timelineLabel}. Origen {e.origin === "originario-usa" ? "EE.UU." : "fuera de EE.UU."}: ad valorem {formatRate(e.adValoremRate)}.
              </p>
            </div>
          </div>
          <CreditoFoto credito={v.imageCredit} licencia={v.imageLicense} fuenteUrl={v.imageSourceUrl} className="mt-2 px-1" />
        </div>

        <div className="flex flex-col justify-between panel-lux p-5 sm:p-6">
          <div>
            <div className="flex h-4 w-full overflow-hidden rounded-full border border-line bg-surface-2" role="img" aria-label="Composición del costo puesto en Lima">
              {tramos.map((t) => (
                <span key={t.nombre} className={t.color} style={{ width: pct(t.monto) }} />
              ))}
            </div>
            <ul className="mt-5 divide-y divide-line">
              {tramos.map((t) => (
                <li key={t.nombre} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="flex items-center gap-3 text-ink-2">
                    <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full border border-line-strong ${t.color}`} />
                    {t.nombre}
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="text-xs tabular-nums text-ink-4">{pct(t.monto)}</span>
                    <span className="font-semibold tabular-nums text-ink">{formatCurrency(t.monto)}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-surface-2 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3">Puesto en Lima, con placas</p>
                <p className="mt-1 text-xs text-ink-4">Percepción del IGV aparte: {formatCurrency(e.percepcion)}, recuperable.</p>
              </div>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-ink sm:text-3xl">{formatCurrency(e.finalEstimate)}</p>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink-4">
              Tasas aplicadas: ad valorem {formatRate(e.adValoremRate)}, ISC {formatRate(e.iscRate)}, IGV e IPM 18% en cascada sobre el CIF, percepción {formatRate(e.percepcionRate)}. Servicio con IGV incluido.
            </p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button href="/calculadora" variant="accent" data-ga-cta="importar_caso_calculadora">
              <Icon name="calculator" size={16} />
              Calcular el tuyo
            </Button>
            <Button href={rutaModelo(v.id)} variant="secondary" data-ga-cta="importar_caso_modelo">
              Ver el detalle del modelo
              <Icon name="arrowRight" size={16} />
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
