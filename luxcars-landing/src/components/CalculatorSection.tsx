'use client';

import { useEffect, useMemo, useState } from "react";
import {
  LUXCARS_CONFIG,
  type CalculatorInput,
} from "@/lib/config";
import {
  calculateImportCosts,
  type ImportEstimate,
} from "@/lib/calculator";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { Button } from "./Button";
import { SectionHeading } from "./SectionHeading";
import { cn, formatCurrency } from "@/lib/utils";

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
  brand: string;
  model: string;
  year: string;
  price: string;
  preferredPlan: "fast" | "standard";
};

const INITIAL_FORM: FormState = {
  brand: "",
  model: "",
  year: "",
  price: "",
  preferredPlan: "fast",
};

const STORAGE_KEY = "luxcars:last-estimate";

export function CalculatorSection() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [estimate, setEstimate] = useState<ImportEstimate | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minPrice = LUXCARS_CONFIG.services.minimumVehiclePrice;

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

  const handleChange = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCalculate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    const parsed: CalculatorInput = {
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: form.year.trim(),
      price: Number(form.price.replace(/[^0-9.]/g, "")),
    };

    if (!parsed.brand || !parsed.model || !parsed.year || !parsed.price) {
      setError("Completa todos los campos para obtener tu estimado premium.");
      return;
    }

    if (Number.isNaN(parsed.price) || parsed.price <= 0) {
      setError("Ingresa un precio válido del auto en Miami en USD.");
      return;
    }

    if (parsed.price < minPrice) {
      setError(
        `Trabajamos con vehículos premium desde ${formatCurrency(minPrice)}. Ingresa un monto igual o superior.`,
      );
      return;
    }

    setIsCalculating(true);
    try {
      const nextEstimate = calculateImportCosts(parsed);
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

  return (
    <section className="rounded-[40px] border border-white/10 bg-black/60 px-6 py-20 backdrop-blur lg:px-14">
      <SectionHeading
        id="calculadora"
        eyebrow="Calculadora pública"
        title="Calcula tu importación premium en menos de un minuto"
        description="Ingresa los datos reales del auto que deseas en Miami. Nosotros estimamos fletes, impuestos SUNAT y honorarios para mostrarte un precio final sin sorpresas."
        align="center"
      />
      <div className="mt-16 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <form
          onSubmit={handleCalculate}
          className="grid gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-white/70">
              Marca
              <select
                value={form.brand}
                onChange={(event) => handleChange("brand")(event.target.value)}
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
                onChange={(event) => handleChange("model")(event.target.value)}
                placeholder="Ej. 911 Turbo S"
                className="h-12 rounded-2xl border border-white/10 bg-black/60 px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-white/70">
              Año
              <input
                value={form.year}
                onChange={(event) => handleChange("year")(event.target.value)}
                placeholder="Ej. 2024"
                inputMode="numeric"
                className="h-12 rounded-2xl border border-white/10 bg-black/60 px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40"
              />
            </label>
            <label className="grid gap-2 text-sm text-white/70">
              Precio en Miami (USD)
              <input
                value={form.price}
                onChange={(event) => handleChange("price")(event.target.value)}
                placeholder="Ej. 265000"
                className="h-12 rounded-2xl border border-white/10 bg-black/60 px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40"
              />
            </label>
          </div>
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
            Estimados referenciales con fines informativos. Nuestras cifras
            consideran tarifas promedio de importación vigentes y pueden variar
            según modelo, tipo de cambio y políticas SUNAT.
          </p>
        </form>
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950/90 via-black/70 to-neutral-950/80 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
          {estimate ? (
            <div className="grid gap-8">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Resultado premium
                </h3>
                <p className="mt-2 text-sm text-white/60">
                  Flete + impuestos calculados sobre tu vehículo. Incluimos
                  honorarios de LuxCars y rango estimado realista.
                </p>
                {status ? (
                  <div className="mt-4 rounded-2xl border border-[#f5d072]/30 bg-[#f5d072]/10 px-4 py-3 text-sm text-[#fbe5a4]">
                    {status}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.35em] text-white/50">
                    Precio final estimado
                  </span>
                  <span className="text-2xl font-semibold text-white">
                    {formatCurrency(estimate.finalEstimate)}
                  </span>
                </div>
                <div className="grid gap-2 text-sm text-white/60">
                  <div className="flex items-center justify-between">
                    <span>Rango probable</span>
                    <span className="font-medium text-white">
                      {formatCurrency(estimate.finalRange.min)} -{" "}
                      {formatCurrency(estimate.finalRange.max)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Ahorro estimado vs Perú</span>
                    <span
                      className={cn(
                        "font-medium",
                        estimate.savingsVsPeru > 0
                          ? "text-emerald-300"
                          : "text-white",
                      )}
                    >
                      {formatCurrency(estimate.savingsVsPeru)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Precio de mercado en Perú</span>
                    <span className="font-medium text-white/80">
                      {formatCurrency(estimate.peruMarketReference)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 text-sm text-white/65">
                <BreakdownItem
                  label="Precio Miami"
                  amount={estimate.input.price}
                />
                <BreakdownItem
                  label="Flete + seguro estimado"
                  amount={estimate.shippingInsurance}
                />
                <BreakdownItem
                  label="Ad Valorem 6%"
                  amount={estimate.adValorem}
                />
                <BreakdownItem
                  label={`ISC (${estimate.iscLabel})`}
                  amount={estimate.isc}
                />
                <BreakdownItem label="IGV 18%" amount={estimate.igv} />
                <BreakdownItem
                  label="Administrative fee 7%"
                  amount={estimate.adminFee}
                />
                <BreakdownItem
                  label="Broker fee 10%"
                  amount={estimate.brokerFee}
                />
                <BreakdownItem
                  label="CIF (auto + flete)"
                  amount={estimate.cif}
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
              <h3 className="text-xl font-semibold text-white">
                Desglose premium
              </h3>
              <p>
                Ingresa los datos de tu auto de lujo y te mostraremos el precio
                final puesto en Lima con impuestos SUNAT, flete y honorarios
                incluidos.
              </p>
              <ul className="grid gap-3 text-sm">
                <li className="rounded-2xl border border-white/5 bg-white/5 px-5 py-3">
                  Transparencia total: cero costos ocultos.
                </li>
                <li className="rounded-2xl border border-white/5 bg-white/5 px-5 py-3">
                  Datos reales actualizados según tarifas promedio.
                </li>
                <li className="rounded-2xl border border-white/5 bg-white/5 px-5 py-3">
                  Calculadora diseñada para autos desde USD 50,000.
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
};

function BreakdownItem({ label, amount }: BreakdownItemProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
      <span>{label}</span>
      <span className="font-medium text-white">{formatCurrency(amount)}</span>
    </div>
  );
}
