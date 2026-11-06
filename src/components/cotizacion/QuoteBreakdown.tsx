/**
 * Piezas con las que se muestra un estimado de importación: las fichas, el
 * desglose línea por línea y la explicación del ad valorem.
 *
 * Las comparten la calculadora y la página del estimado compartido
 * (`/c/<código>`), para que el mismo número se explique con las mismas
 * palabras en los dos sitios. No llevan estado: sirven igual en un componente
 * de servidor que en uno de cliente.
 */

import type { ReactNode } from "react";
import type { PremiumImportQuote } from "@/core/pricing/priceCalculator";
import type { OriginInference } from "@/core/pricing/originInference";
import type { VehicleTypeId } from "@/lib/config";
import { cn, formatCurrency, formatPercentage, formatRate } from "@/lib/utils";
import { Tooltip } from "@/components/Tooltip";

/** Etiquetas cortas para las fichas de motor. La larga queda en el tooltip. */
export const MOTOR_SHORT_LABEL: Record<VehicleTypeId, string> = {
  gasolina: "Gasolina",
  hev: "Híbrido",
  diesel: "Diésel",
  ev: "Eléctrico",
  phev: "Híbrido enchufable",
};

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">
      {children}
    </span>
  );
}

/** Condición, motor y entrega del estimado, como fichas. */
export function QuoteChips({ estimate }: { estimate: PremiumImportQuote }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip>{estimate.condition === "usado" ? "Usado" : "Nuevo"}</Chip>
      <Chip>{MOTOR_SHORT_LABEL[estimate.vehicleCategory.id]}</Chip>
      <Chip>{estimate.planConfig.label} · {estimate.planConfig.timelineLabel}</Chip>
    </div>
  );
}

/** Suma de los tributos que son costo (la percepción no lo es). */
export function quoteTaxes(estimate: PremiumImportQuote): number {
  return estimate.adValorem + estimate.isc + estimate.igv + estimate.ipm;
}

function Line({
  label,
  amount,
  tooltip,
  muted,
  sub,
}: {
  label: string;
  amount: number;
  tooltip?: string;
  muted?: boolean;
  sub?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", sub ? "py-2 pl-4" : "py-3")}>
      <dt className={cn("flex min-w-0 items-center gap-2 text-sm", muted || sub ? "text-ink-4" : "text-ink-2")}>
        <span>{label}</span>
        {tooltip ? <Tooltip content={tooltip} placement="top" /> : null}
      </dt>
      <dd className={cn("shrink-0 text-sm tabular-nums", muted || sub ? "text-ink-3" : "font-semibold text-ink")}>
        {formatCurrency(amount)}
      </dd>
    </div>
  );
}

function Group({
  label,
  amount,
  children,
}: {
  label: string;
  amount: number;
  children: ReactNode;
}) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-4 py-2">
        <dt className="text-sm text-ink-2">{label}</dt>
        <dd className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatCurrency(amount)}</dd>
      </div>
      <div className="border-l border-line">{children}</div>
    </div>
  );
}

/** El desglose completo: precio, flete, tributos, servicio y percepción. */
export function QuoteBreakdown({
  estimate,
  id,
  className,
}: {
  estimate: PremiumImportQuote;
  id?: string;
  className?: string;
}) {
  const servicio = estimate.stateComplianceFee + estimate.brokerFee + estimate.documentHandlingFee;

  return (
    <dl id={id} className={cn("divide-y divide-line border-t border-line", className)}>
      <Line label="Precio en EE.UU." amount={estimate.input.priceMiami} />
      <Line
        label="Flete y seguro"
        amount={estimate.freight + estimate.insurance}
        tooltip={`Flete marítimo Miami → Callao (${formatCurrency(estimate.freight)}) más seguro internacional (${formatCurrency(estimate.insurance)}).`}
      />
      <Group label="Tributos SUNAT" amount={quoteTaxes(estimate)}>
        <Line
          sub
          label={`Ad valorem ${formatPercentage(estimate.adValoremRate)}`}
          amount={estimate.adValorem}
          tooltip={
            estimate.adValoremRate === 0
              ? "0%: vehículo nuevo originario de EE.UU. con certificado de origen (acuerdo Perú–EE.UU.)."
              : "Sobre el valor CIF. Baja a 0% solo si el vehículo es nuevo, originario de EE.UU. y tiene certificado de origen."
          }
        />
        <Line
          sub
          label={`ISC ${formatPercentage(estimate.iscRate)}`}
          amount={estimate.isc}
          tooltip={`Sobre CIF + ad valorem. ${estimate.iscTooltip}`}
        />
        <Line
          sub
          label="IGV + IPM 18%"
          amount={estimate.igv + estimate.ipm}
          tooltip="IGV 15.5% más IPM 2.5%, sobre CIF + ad valorem + ISC."
        />
      </Group>
      <Line
        label="Servicio LuxCars"
        amount={servicio}
        tooltip="Inspección, negociación, logística, gestión documentaria y Fast Track si aplica."
      />
      <Line
        label={`Percepción IGV ${formatRate(estimate.percepcionRate)}`}
        amount={estimate.percepcion}
        muted
        tooltip="Adelanto del IGV. Se recupera; no es un costo, pero sí efectivo el día del despacho."
      />
    </dl>
  );
}

/**
 * Explicación corta del ad valorem para el cliente. Las notas internas del
 * motor de origen (`reason`) hablan de plantas, VIN y AALA: son para el
 * asesor, no para la web pública. Aquí se resume con los campos estructurados.
 */
export function describeOrigin(info: OriginInference, estimate: PremiumImportQuote): string {
  const vehicle = `${estimate.input.brand} ${estimate.input.model}`.trim() || "vehículo";
  const country = info.assemblyCountry.replace(/\s*\(verificar VIN\)/i, "");
  const verify = "Antes de comprar lo confirmamos con el VIN de la unidad.";

  if (estimate.adValoremRate === 0) {
    const where = info.plant ? `en ${info.plant}` : "en Estados Unidos";
    return `Ad valorem 0%: el ${vehicle} se ensambla ${where} y califica al acuerdo Perú–EE.UU. si el vendedor emite el certificado de origen. ${verify}`;
  }
  if (estimate.condition === "usado") {
    return `Ad valorem 6%: el acuerdo Perú–EE.UU. solo exonera vehículos nuevos. Un usado paga 6% aunque se haya ensamblado en Estados Unidos y tenga certificado de origen.`;
  }
  if (!info.matched) {
    return `No reconocimos este modelo, así que cotizamos 6% por seguridad. Si se ensambla en Estados Unidos puede bajar a 0% con certificado de origen. ${verify}`;
  }
  const multiCountry = /,| o /.test(country);
  if (info.requiresVin && multiCountry) {
    return `Cotizamos 6% por seguridad: el ${vehicle} se fabrica en más de un país (${country}) y solo las unidades ensambladas en Estados Unidos califican al 0%. ${verify}`;
  }
  if (info.mayQualifyWithCertificate) {
    return `Cotizamos 6% por seguridad. El ${vehicle} se ensambla en Estados Unidos y puede bajar a 0% si el vendedor emite el certificado de origen del acuerdo Perú–EE.UU. ${verify}`;
  }
  if (info.requiresVin) {
    return `Cotizamos 6% por seguridad: el origen del ${vehicle} depende de la unidad concreta. ${verify}`;
  }
  return `Ad valorem 6%: el ${vehicle} se ensambla en ${country} y no califica al acuerdo Perú–EE.UU.`;
}
