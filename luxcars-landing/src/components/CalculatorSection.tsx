'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type { ReactNode } from "react";
import {
  LUXCARS_CONFIG,
  type CalculatorInput,
  type VehicleTypeId,
} from "@/lib/config";
import {
  calculateImportCosts,
  getVehicleTypeConfig,
  type ImportEstimate,
} from "@/lib/calculator";
import type { PlanKey } from "@/lib/pricingConfig";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { Button } from "./Button";
import { SectionHeading } from "./SectionHeading";
import { Tooltip } from "./Tooltip";
import { VehicleIcon, TaxIcon, MoneyIcon } from "./Icons";
import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import Image from "next/image";

const BRAND_OPTIONS = [
  "Porsche",
  "BMW",
  "Mercedes-Benz",
  "Audi",
  "Lexus",
  "Tesla",
  "Range Rover",
  "Cadillac",
  "Dodge SRT",
  "Bentley",
  "Ferrari",
  "Lamborghini",
  "McLaren",
  "Aston Martin",
  "Rolls-Royce",
];

type FormState = {
  vehicleType: VehicleTypeId | "";
  brand: string;
  model: string;
  year: string;
  price: string;
  peruPrice: string;
  preferredPlan: PlanKey;
};

const INITIAL_FORM: FormState = {
  vehicleType: "",
  brand: "",
  model: "",
  year: "",
  price: "",
  peruPrice: "",
  preferredPlan: "fast",
};

const STORAGE_KEY = "luxcars:last-estimate";

function sanitizeNumber(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  return cleaned;
}

function toNumber(value: string) {
  const sanitized = sanitizeNumber(value);
  if (!sanitized) return NaN;
  return Number(sanitized);
}

export function CalculatorSection() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [estimate, setEstimate] = useState<ImportEstimate | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minPrice = LUXCARS_CONFIG.services.minimumVehiclePrice;
  const vehicleTypeOptions = LUXCARS_CONFIG.vehicleTypes;
  const selectedVehicleType = form.vehicleType
    ? getVehicleTypeConfig(form.vehicleType)
    : null;

  useEffect(() => {
    if (!estimate) return;
    try {
      const payload = {
        estimate,
        timestamp: Date.now(),
        preferredPlan: form.preferredPlan,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent(STORAGE_KEY, { detail: payload }));
    } catch (err) {
      console.warn("No se pudo guardar el cálculo localmente", err);
    }
  }, [estimate, form.preferredPlan]);

  const handleFieldChange =
    (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        field === "price" || field === "peruPrice"
          ? sanitizeNumber(event.target.value)
          : event.target.value;
      setForm((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleVehicleTypeSelect = (vehicleType: VehicleTypeId) => {
    setForm((prev) => ({
      ...prev,
      vehicleType,
    }));
  };

  const handleCalculate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    if (!form.vehicleType) {
      setError("Selecciona el tipo de vehículo para aplicar el ISC correcto.");
      return;
    }

    const priceMiami = toNumber(form.price);
    if (Number.isNaN(priceMiami) || priceMiami <= 0) {
      setError("Ingresa un precio válido del auto en Miami en USD.");
      return;
    }

    if (priceMiami < minPrice) {
      setError(
        `Trabajamos con vehículos premium desde ${formatCurrency(minPrice)}. Ingresa un monto igual o superior.`,
      );
      return;
    }

    if (!form.brand.trim() || !form.model.trim() || !form.year.trim()) {
      setError("Completa marca, modelo y año del vehículo.");
      return;
    }

    const peruReference = toNumber(form.peruPrice);

    const parsed: CalculatorInput = {
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: form.year.trim(),
      price: priceMiami,
      vehicleType: form.vehicleType,
      peruPrice: Number.isNaN(peruReference) ? undefined : peruReference,
    };

    setIsCalculating(true);
    try {
      const nextEstimate = calculateImportCosts(parsed, form.preferredPlan);
      setEstimate(nextEstimate);
      setStatus(
        "Listo. Este es tu precio estimado puesto en Lima. Puedes compartirlo en WhatsApp o agendar una llamada.",
      );
    } catch (err) {
      console.error(err);
      setError("Hubo un problema al generar el estimado. Intenta nuevamente.");
    } finally {
      setIsCalculating(false);
    }
  };

  const whatsappLink = useMemo(() => {
    if (!estimate) return null;
    return buildWhatsappLink(estimate, {
      preferredPlan: form.preferredPlan,
    });
  }, [estimate, form.preferredPlan]);

  const planAdjustmentPercent =
    estimate && estimate.freightAdjustment
      ? Math.round((estimate.freightAdjustment - 1) * 100)
      : 0;

  const freightTooltip =
    estimate && planAdjustmentPercent > 0
      ? `Flete base ${formatCurrency(estimate.freightBase)} ajustado con +${planAdjustmentPercent}% vía Fast Track.`
      : "El flete estimado se calcula según volumen y tipo de vehículo.";

  const freightSummary =
    estimate && planAdjustmentPercent > 0
      ? `Flete base ${formatCurrency(estimate.freightBase)} ajustado +${planAdjustmentPercent}% Fast Track → ${formatCurrency(estimate.freight)}.`
      : estimate
        ? `Flete estimado según categoría: ${formatCurrency(estimate.freight)}.`
        : "";

  const varianceLabel = formatPercentage(
    LUXCARS_CONFIG.services.finalRangeVariance,
  );

  return (
    <section
      id="calculator"
      className="scroll-mt-32 rounded-[40px] border border-white/10 bg-gradient-to-br from-neutral-950/95 via-black/80 to-neutral-900 px-6 py-20 backdrop-blur lg:px-14"
    >
      <SectionHeading
        eyebrow="Calculadora pública"
        title="Calcula tu importación premium en menos de un minuto"
        description="Selecciona el tipo de vehículo, ingresa tu precio en Miami y obtén un estimado completo con flete, seguros, impuestos SUNAT y honorarios LuxCars."
        align="center"
      />
      <div className="mt-16 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <form
          onSubmit={handleCalculate}
          className="grid gap-7 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]"
        >
          <div className="grid gap-3 text-sm text-white/70">
            <div className="flex items-center gap-2 text-white">
              <VehicleIcon size={18} />
              <span className="font-semibold tracking-wide">
                Tipo de vehículo & ISC
              </span>
              <Tooltip
                content={
                  selectedVehicleType
                    ? selectedVehicleType.tooltip
                    : "Elige el tipo de vehículo para aplicar el porcentaje ISC estimado según SUNAT."
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {vehicleTypeOptions.map((option) => {
                const isSelected = form.vehicleType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleVehicleTypeSelect(option.id)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-2xl border px-5 py-4 text-left transition",
                      isSelected
                        ? "border-[#f5d072]/80 bg-[#f5d072]/10 text-white shadow-[0_15px_60px_rgba(245,208,114,0.2)]"
                        : "border-white/10 bg-black/40 text-white/60 hover:border-white/20 hover:text-white",
                    )}
                  >
                    <span className="text-sm font-semibold text-white">
                      {option.label}
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/40">
                      <TaxIcon size={14} /> {formatPercentage(option.iscRate)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-white/70">
              Marca
              <select
                value={form.brand}
                onChange={handleFieldChange("brand")}
                className="h-12 rounded-2xl border border-white/10 bg-black/60 px-4 text-white shadow-inner shadow-black/40 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40"
              >
                <option value="">Selecciona</option>
                {BRAND_OPTIONS.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-white/70">
              Modelo
              <input
                value={form.model}
                onChange={handleFieldChange("model")}
                placeholder="Ej. 911 Turbo S"
                className="h-12 rounded-2xl border border-white/10 bg-black/60 px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2 text-sm text-white/70">
              Año
              <input
                value={form.year}
                onChange={handleFieldChange("year")}
                placeholder="Ej. 2024"
                inputMode="numeric"
                className="h-12 rounded-2xl border border-white/10 bg-black/60 px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40"
              />
            </label>
            <label className="grid gap-2 text-sm text-white/70 sm:col-span-2">
              Precio en Miami (USD)
              <input
                value={form.price}
                onChange={handleFieldChange("price")}
                placeholder="Ej. 265000"
                inputMode="decimal"
                className="h-12 rounded-2xl border border-white/10 bg-black/60 px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40"
              />
            </label>
          </div>
          <label className="grid gap-2 text-sm text-white/70">
            Precio de mercado en Perú (opcional)
            <div className="flex items-center gap-2">
              <input
                value={form.peruPrice}
                onChange={handleFieldChange("peruPrice")}
                placeholder="Ingresa tu referencia en Perú"
                inputMode="decimal"
                className="h-12 flex-1 rounded-2xl border border-white/10 bg-black/60 px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40"
              />
              <Tooltip content="Ingresa el precio que encontraste en Perú para calcular el ahorro exacto. Si lo dejas vacío usaremos un estimado de mercado." />
            </div>
          </label>

  <div className="grid gap-2 text-sm text-white/70">
            Plan estimado de entrega
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                {
                  key: "fast",
                  label: LUXCARS_CONFIG.deliveryWindows.fastTrack.label,
                  days: LUXCARS_CONFIG.deliveryWindows.fastTrack.days,
                },
                {
                  key: "standard",
                  label: LUXCARS_CONFIG.deliveryWindows.standard.label,
                  days: LUXCARS_CONFIG.deliveryWindows.standard.days,
                },
              ] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, preferredPlan: option.key }))
                  }
                  className={cn(
                    "rounded-2xl border px-5 py-4 text-left transition",
                    form.preferredPlan === option.key
                      ? "border-[#f5d072]/80 bg-[#f5d072]/10 text-white"
                      : "border-white/10 bg-black/50 text-white/60 hover:border-white/20 hover:text-white",
                  )}
                >
                  <span className="text-xs uppercase tracking-[0.3em] text-white/50">
                    {option.label}
                  </span>
                  <p className="mt-2 text-lg font-medium text-white">
                    {option.days[0]} - {option.days[1]} días
                  </p>
                </button>
              ))}
            </div>
          </div>
          {error ? (
            <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-5 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          <Button type="submit" size="lg" disabled={isCalculating}>
            {isCalculating ? "Calculando..." : "Generar precio estimado"}
          </Button>
          <p className="text-xs text-white/40">
            Este es un estimado basado en rangos reales de importación. El valor
            final puede variar según la partida arancelaria, condición del
            vehículo y determinación de SUNAT.
          </p>
        </form>
        <div className="space-y-6 rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950/90 via-black/70 to-neutral-950/80 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
          <Image
            src="/images/calculator/dashboard.jpg"
            alt="Dashboard de costos de importación de autos de lujo"
            width={640}
            height={360}
            className="h-48 w-full rounded-2xl border border-white/10 object-cover"
          />
            {estimate ? (
              <div className="grid gap-8">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-[#f5d072]/40 bg-[#f5d072]/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#fbe5a4]">
                      {estimate.vehicleType.label}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/60">
                      {estimate.planConfig.label}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/60">
                      Timeline {estimate.planConfig.timelineLabel}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/60">
                      ISC {formatPercentage(estimate.iscRate)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Resultado premium
                    </h3>
                    <p className="mt-2 text-sm text-white/60">
                      Plan {estimate.planConfig.label} · Timeline {estimate.planConfig.timelineLabel}.{" "}
                      {freightSummary}
                    </p>
                    {status ? (
                      <div className="mt-4 rounded-2xl border border-[#f5d072]/30 bg-[#f5d072]/10 px-4 py-3 text-sm text-[#fbe5a4]">
                        {status}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-[0.35em] text-white/50">
                      Precio final estimado Lima
                    </span>
                    <span className="text-2xl font-semibold text-white">
                      {formatCurrency(estimate.finalEstimate)}
                      <span className="ml-2 text-base font-medium text-white/70">
                        ± {varianceLabel}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/60">
                    <span>Rango estimado</span>
                    <span className="font-medium text-white">
                      {formatCurrency(estimate.finalRange.min)} –{" "}
                      {formatCurrency(estimate.finalRange.max)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/60">
                    <span>Ahorro estimado vs Perú</span>
                    <span
                      className={cn(
                        "font-medium",
                        estimate.input.peruPrice && estimate.savingsVsPeru > 0
                          ? "text-emerald-300"
                          : "text-white",
                      )}
                    >
                      {formatCurrency(estimate.savingsVsPeru)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-white/60">
                    <span>Referencia de mercado en Perú</span>
                    <span className="font-medium text-white">
                      {formatCurrency(estimate.peruMarketReference)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-white/65">
                  <BreakdownItem
                    label="Precio Miami"
                    amount={estimate.input.price}
                    icon={<MoneyIcon size={16} />}
                  />
                  <BreakdownItem
                    label="Flete"
                    amount={estimate.freight}
                    icon={<TaxIcon size={16} />}
                    tooltip={freightTooltip}
                  />
                  <BreakdownItem
                    label="Seguro"
                    amount={estimate.insurance}
                    icon={<TaxIcon size={16} />}
                    tooltip="Seguro marítimo 1.5% calculado sobre el CIF."
                  />
                  <BreakdownItem
                    label="CIF"
                    amount={estimate.cif}
                    tooltip="Costo, seguro y flete (CIF) utilizados para el cálculo tributario."
                  />
                  <BreakdownItem
                    label="Ad Valorem"
                    amount={estimate.adValorem}
                    tooltip="Ad Valorem 6% calculado sobre el CIF."
                  />
                  <BreakdownItem
                    label="ISC"
                    amount={estimate.isc}
                    tooltip={`${formatPercentage(estimate.iscRate)} · ${estimate.iscTooltip}`}
                  />
                  <BreakdownItem
                    label="IGV"
                    amount={estimate.igv}
                    tooltip="IGV 18% aplicado a CIF + Ad Valorem + ISC."
                  />
                  <BreakdownItem
                    label="State Compliance Fee"
                    amount={estimate.stateComplianceFee}
                    tooltip="State Compliance Fee (7%): cubre verificación legal, validación de documentos, compliance en USA y gestión administrativa del vehículo."
                  />
                  <BreakdownItem
                    label="Broker Fee"
                    amount={estimate.brokerFee}
                    tooltip="Broker Fee (10%): incluye negociación, inspección del vehículo, CarFax, AutoCheck, coordinación logística y servicio concierge completo."
                  />
                  {estimate.localFixedFees.map((fee) => (
                    <BreakdownItem
                      key={fee.key}
                      label={fee.label}
                      amount={fee.amount}
                    />
                  ))}
                  {estimate.documentHandlingFee > 0 ? (
                    <BreakdownItem
                      label="Extra FastTrack"
                      amount={estimate.documentHandlingFee}
                      tooltip="Fast Track añade gestión documental prioritaria y coordinación acelerada en Miami."
                    />
                  ) : null}
                  <BreakdownItem
                    label="Precio final estimado Lima"
                    amount={estimate.finalEstimate}
                    tooltip={`Incluye todos los conceptos listados. Variación estimada ± ${varianceLabel}.`}
                  />
                </div>
                {whatsappLink ? (
                  <div className="space-y-3">
                    <Button
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="lg"
                    >
                      Enviar estimado por WhatsApp
                    </Button>
                    <p className="text-xs text-white/40">
                      Abriremos una conversación con nuestros especialistas con
                      toda la información precargada.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
            <div className="grid gap-6 text-white/60">
              <h3 className="flex items-center gap-2 text-xl font-semibold text-white">
                <MoneyIcon size={18} />
                Desglose premium
              </h3>
              <p>
                Selecciona el tipo de vehículo, ingresa tu precio en Miami y
                obtén un estimado instantáneo sin costos ocultos. Transparencia
                total en impuestos, logística y honorarios.
              </p>
              <ul className="grid gap-3 text-sm">
                <li className="rounded-2xl border border-white/5 bg-white/5 px-5 py-3">
                  Calculadora exclusiva para vehículos desde USD 50,000.
                </li>
                <li className="rounded-2xl border border-white/5 bg-white/5 px-5 py-3">
                  ISC diferenciado por tipo (EV, híbridos, SUVs, deportivos,
                  pickups).
                </li>
                <li className="rounded-2xl border border-white/5 bg-white/5 px-5 py-3">
                  Incluye flete, seguro, IGV, State Compliance Fee y Broker Fee.
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type BreakdownItemProps = {
  label: string;
  amount: number;
  tooltip?: string;
  icon?: ReactNode;
};

function BreakdownItem({ label, amount, tooltip, icon }: BreakdownItemProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
      <div className="flex items-start gap-3 text-white/70">
        {icon ? <span className="flex-none">{icon}</span> : null}
        <span>{label}</span>
        {tooltip ? (
          <Tooltip content={tooltip} placement="bottom" />
        ) : null}
      </div>
      <span className="text-right font-medium text-white tabular-nums">
        {formatCurrency(amount)}
      </span>
    </div>
  );
}
