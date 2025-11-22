'use client';

import {
  calculateImportQuote,
  type ImportCalculatorInput,
  type PremiumImportQuote,
} from "@/core/pricing/priceCalculator";
import { type PlanKey } from "@/core/pricing/pricingConfig";
import {
  getVehicleCategory,
  VEHICLE_CATEGORIES,
} from "@/core/pricing/vehicleCategories";
import { LUXCARS_CONFIG, type VehicleTypeId } from "@/lib/config";
import { generatePDF } from "@/lib/pdfExport";
import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import { buildWhatsappLink } from "@/lib/whatsapp";
import type { ReactNode } from "react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Button } from "./Button";
import { MoneyIcon, ServiceIcon, TaxIcon, VehicleIcon } from "./Icons";
import { SectionHeading } from "./SectionHeading";
import { Tooltip } from "./Tooltip";

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
  "Toyota",
  "Jeep",
  "Ford",
  "Chevrolet",
];

type FormState = {
  vehicleType: VehicleTypeId | "";
  brand: string;
  model: string;
  year: string;
  price: string;
  preferredPlan: PlanKey;
};

const getInitialYear = () => {
  const currentYear = new Date().getFullYear();
  return (currentYear - 1).toString();
};

const INITIAL_FORM: FormState = {
  vehicleType: "",
  brand: "",
  model: "",
  year: getInitialYear(),
  price: "",
  preferredPlan: "fast",
};

const STORAGE_KEY = "luxcars:last-estimate";
const FORM_STORAGE_KEY = "luxcars:form-state";

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
  // Cargar estado inicial desde localStorage
  const loadFormFromStorage = (): FormState => {
    if (typeof window === 'undefined') return INITIAL_FORM;

    try {
      const stored = window.localStorage.getItem(FORM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FormState;
        // Validar que tenga la estructura correcta
        if (parsed && typeof parsed === 'object') {
          return {
            vehicleType: parsed.vehicleType || INITIAL_FORM.vehicleType,
            brand: parsed.brand || INITIAL_FORM.brand,
            model: parsed.model || INITIAL_FORM.model,
            year: parsed.year || INITIAL_FORM.year,
            price: parsed.price || INITIAL_FORM.price,
            preferredPlan: parsed.preferredPlan || INITIAL_FORM.preferredPlan,
          };
        }
      }
    } catch (err) {
      console.warn('Error cargando formulario desde localStorage:', err);
    }
    return INITIAL_FORM;
  };

  const [form, setForm] = useState<FormState>(loadFormFromStorage);
  const [estimate, setEstimate] = useState<PremiumImportQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const minPrice = LUXCARS_CONFIG.services.minimumVehiclePrice;
  const vehicleTypeOptions = VEHICLE_CATEGORIES;
  const selectedVehicleType = form.vehicleType
    ? getVehicleCategory(form.vehicleType)
    : null;

  const handleCalculate = () => {
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
        `El valor mínimo para nuestro servicio de importación es ${formatCurrency(minPrice)}. Por favor, ingresa un monto igual o superior.`,
      );
      return;
    }

    if (!form.brand.trim() || !form.model.trim() || !form.year.trim()) {
      setError("Completa marca, modelo y año del vehículo.");
      return;
    }

    const parsed: ImportCalculatorInput = {
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: form.year.trim(),
      priceMiami,
      vehicleType: form.vehicleType,
    };

    try {
      const nextEstimate = calculateImportQuote(
        parsed,
        form.preferredPlan,
      );
      setEstimate(nextEstimate);
      setShowResults(true);
    } catch (err) {
      console.error(err);
      setError("Hubo un problema al generar el estimado. Intenta nuevamente.");
    }
  };

  const handleReset = () => {
    setShowResults(false);
    setEstimate(null);
    setError(null);
    // Limpiar el estimate guardado pero mantener el formulario
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn("No se pudo limpiar el cálculo guardado", err);
    }
  };

  // Guardar formulario en localStorage cada vez que cambie
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form));
    } catch (err) {
      console.warn("No se pudo guardar el formulario localmente", err);
    }
  }, [form]);

  // Cargar estimate guardado si existe y el formulario está completo
  // Solo ejecutar una vez después de que el componente se monte
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Pequeño delay para asegurar que el formulario se haya cargado desde localStorage
    const timer = setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const currentForm = loadFormFromStorage();

        if (stored && currentForm.vehicleType && currentForm.brand && currentForm.model && currentForm.year && currentForm.price) {
          const payload = JSON.parse(stored);
          if (payload?.estimate && payload?.preferredPlan === currentForm.preferredPlan) {
            // Verificar que el estimate corresponde al formulario actual
            const storedEstimate = payload.estimate as PremiumImportQuote;
            const priceMiami = toNumber(currentForm.price);
            if (
              !Number.isNaN(priceMiami) &&
              storedEstimate.input.brand === currentForm.brand.trim() &&
              storedEstimate.input.model === currentForm.model.trim() &&
              storedEstimate.input.year === currentForm.year.trim() &&
              storedEstimate.input.priceMiami === priceMiami &&
              storedEstimate.input.vehicleType === currentForm.vehicleType
            ) {
              setEstimate(storedEstimate);
              setShowResults(true);
            }
          }
        }
      } catch (err) {
        console.warn("No se pudo cargar el cálculo guardado", err);
      }
    }, 150);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar una vez al montar

  // Guardar estimate cuando cambie
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

  // Scroll automático a los resultados en mobile cuando se muestran
  useEffect(() => {
    if (showResults && resultsRef.current && typeof window !== 'undefined') {
      // Solo hacer scroll en mobile (ancho < 768px)
      if (window.innerWidth < 768) {
        // Usar requestAnimationFrame para asegurar que el DOM esté actualizado
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (resultsRef.current) {
              // Obtener la posición del elemento
              const elementTop = resultsRef.current.getBoundingClientRect().top + window.pageYOffset;
              // Hacer scroll considerando el navbar sticky (aproximadamente 80px)
              const offset = 100;
              window.scrollTo({
                top: elementTop - offset,
                behavior: 'smooth',
              });
            }
          }, 150);
        });
      }
    }
  }, [showResults]);

  const handleFieldChange =
    (field: keyof FormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let value = event.target.value;

        if (field === "price") {
          value = sanitizeNumber(value);
        }
        // El campo year ahora es un select, no necesita validación adicional

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

  const whatsappLink = useMemo(() => {
    if (!estimate) return null;
    return buildWhatsappLink(estimate, {
      preferredPlan: form.preferredPlan,
    });
  }, [estimate, form.preferredPlan]);

  const handleDownloadPDF = async () => {
    if (!estimate) return;

    setIsGeneratingPDF(true);
    try {
      await generatePDF(estimate);
    } catch (err) {
      console.error('Error generando PDF:', err);
      setError('Hubo un problema al generar el PDF. Intenta nuevamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };


  return (
    <section
      id="calculator"
      className="scroll-mt-32 rounded-[40px] md:rounded-[40px] rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950/95 via-black/80 to-neutral-900 px-4 md:px-6 py-12 md:py-20 backdrop-blur lg:px-14"
    >
      <SectionHeading
        eyebrow="Calculadora pública"
        title="Calcula tu importación premium en menos de un minuto"
        description="Selecciona el tipo de vehículo, ingresa tu precio en Miami y obtén un estimado completo con flete, seguros, impuestos SUNAT y honorarios LuxCars."
        align="center"
      />
      {!showResults ? (
        /* FORMULARIO */
        <div className="mt-8 md:mt-16 max-w-3xl mx-auto">
          <div className="grid gap-5 md:gap-7 rounded-2xl md:rounded-3xl border border-white/10 bg-white/5 p-4 md:p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
            <div className="grid gap-2.5 md:gap-3 text-sm text-white/70">
              <div className="flex items-center gap-2 text-white">
                <VehicleIcon size={18} />
                <span className="font-semibold tracking-wide text-sm md:text-base">
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
              <div className="grid gap-2.5 md:gap-3 md:grid-cols-2">
                {vehicleTypeOptions.map((option) => {
                  const isSelected = form.vehicleType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleVehicleTypeSelect(option.id)}
                      className={cn(
                        "flex flex-col items-start gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border px-4 md:px-5 py-3 md:py-4 text-left transition",
                        isSelected
                          ? "border-[#f5d072]/80 bg-[#f5d072]/10 text-white shadow-[0_15px_60px_rgba(245,208,114,0.2)]"
                          : "border-white/10 bg-black/40 text-white/60 hover:border-white/20 hover:text-white",
                      )}
                    >
                      <span className="text-sm font-semibold text-white">
                        {option.label}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/40">
                        <TaxIcon size={14} /> {formatPercentage(option.iscRate)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-white/70">
                Marca
                <select
                  value={form.brand}
                  onChange={handleFieldChange("brand")}
                  className="h-11 md:h-12 rounded-xl md:rounded-2xl border border-white/10 bg-black/60 px-3 md:px-4 pr-10 text-white shadow-inner shadow-black/40 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTUgNy41TDEwIDEyLjVMMTUgNy41IiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIwLjUiLz4KPC9zdmc+Cg==')] bg-[length:20px_20px] bg-[right_12px_center] bg-no-repeat cursor-pointer text-base"
                  style={{
                    colorScheme: 'dark',
                    fontSize: '16px', // Prevenir zoom automático en móviles
                  }}
                >
                  <option value="" className="bg-neutral-900 text-white/60">Selecciona</option>
                  {BRAND_OPTIONS.map((brand) => (
                    <option key={brand} value={brand} className="bg-neutral-900 text-white">
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
                  className="h-11 md:h-12 rounded-xl md:rounded-2xl border border-white/10 bg-black/60 px-3 md:px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40 text-base"
                  style={{
                    fontSize: '16px', // Prevenir zoom automático en móviles
                  }}
                />
              </label>
            </div>
            <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <span>Año</span>
                  <span className="text-xs text-white/40">
                    (hasta 2 años)
                  </span>
                </div>
                <select
                  value={form.year}
                  onChange={handleFieldChange("year")}
                  className="h-11 md:h-12 rounded-xl md:rounded-2xl border border-white/10 bg-black/60 px-3 md:px-4 pr-10 text-white shadow-inner shadow-black/40 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40 appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTUgNy41TDEwIDEyLjVMMTUgNy41IiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIwLjUiLz4KPC9zdmc+Cg==')] bg-[length:20px_20px] bg-[right_12px_center] bg-no-repeat cursor-pointer text-base"
                  style={{
                    colorScheme: 'dark',
                    fontSize: '16px', // Prevenir zoom automático en móviles
                  }}
                >
                  <option value="" className="bg-neutral-900 text-white/60">Selecciona</option>
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    const years = [currentYear, currentYear - 1];
                    return years.map((year) => (
                      <option key={year} value={year.toString()} className="bg-neutral-900 text-white">
                        {year}
                      </option>
                    ));
                  })()}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-white/70">
                Precio en Miami (USD)
                <input
                  value={form.price}
                  onChange={handleFieldChange("price")}
                  placeholder="Ej. 265000"
                  inputMode="decimal"
                  className="h-11 md:h-12 rounded-xl md:rounded-2xl border border-white/10 bg-black/60 px-3 md:px-4 text-white shadow-inner shadow-black/40 placeholder:text-white/30 focus:border-[#f5d072] focus:outline-none focus:ring-2 focus:ring-[#f5d072]/40 text-base"
                  style={{
                    fontSize: '16px', // Prevenir zoom automático en móviles
                  }}
                />
              </label>
            </div>
            <div className="grid gap-2 text-sm text-white/70">
              Plan estimado de entrega
              <div className="grid gap-2.5 md:gap-3 sm:grid-cols-2">
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
                      "rounded-xl md:rounded-2xl border px-4 md:px-5 py-3 md:py-4 text-left transition",
                      form.preferredPlan === option.key
                        ? "border-[#f5d072]/80 bg-[#f5d072]/10 text-white"
                        : "border-white/10 bg-black/50 text-white/60 hover:border-white/20 hover:text-white",
                    )}
                  >
                    <span className="text-xs uppercase tracking-[0.3em] text-white/50">
                      {option.label}
                    </span>
                    <p className="mt-1.5 md:mt-2 text-base md:text-lg font-medium text-white">
                      {option.days[0]} - {option.days[1]} días
                    </p>
                  </button>
                ))}
              </div>
            </div>
            {error ? (
              <div className="rounded-xl md:rounded-2xl border border-red-400/40 bg-red-500/10 px-4 md:px-5 py-2.5 md:py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <Button onClick={handleCalculate} size="lg" className="!text-black">
              Calcular Estimado
            </Button>

            <p className="text-xs text-white/40 leading-relaxed">
              Este es un estimado de importación. El valor final puede variar según
              la partida arancelaria, condición del vehículo y determinación de SUNAT.
            </p>
          </div>
        </div>
      ) : (
        /* RESULTADOS */
        <div ref={resultsRef} className="mt-8 md:mt-16 max-w-4xl mx-auto">
          <div className="flex flex-col rounded-2xl md:rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950/90 via-black/70 to-neutral-950/80 p-4 md:p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
            {estimate ? (
              <div className="flex flex-col gap-4 md:gap-6 h-full">
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 md:px-3 py-0.5 md:py-1 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.35em] text-white/60">
                        {estimate.vehicleCategory.label}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 md:px-3 py-0.5 md:py-1 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.35em] text-white/60">
                        {estimate.planConfig.label}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 md:px-3 py-0.5 md:py-1 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.35em] text-white/60">
                        ISC {formatPercentage(estimate.iscRate)}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-semibold text-white">
                        Estimado de Importación
                      </h3>
                      <p className="mt-1 text-sm text-white/50">
                        {estimate.input.brand} {estimate.input.model} {estimate.input.year}
                      </p>
                    </div>
                  </div>

                <div className="rounded-2xl md:rounded-3xl border border-white/10 bg-white/5 p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4">
                    <div className="space-y-2 md:space-y-3 flex-1">
                      <span className="text-xs uppercase tracking-[0.35em] text-white/50">
                        Precio final estimado Lima
                      </span>
                      <div className="text-2xl md:text-3xl font-bold text-white">
                        {formatCurrency(estimate.finalEstimate)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleReset();
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleReset();
                      }}
                      type="button"
                      className="w-full md:w-auto md:flex-shrink-0 inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-2 text-sm font-medium tracking-[0.08em] uppercase text-white transition-all duration-300 hover:bg-white/20 hover:border-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/70 focus-visible:ring-offset-black hover:-translate-y-0.5 hover:scale-[1.015] active:scale-[0.97]"
                    >
                      Nueva Simulación
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1.5 md:space-y-2 text-sm">
                  <BreakdownItem
                    label="Precio Miami"
                    amount={estimate.input.priceMiami}
                    icon={<MoneyIcon size={16} />}
                  />
                  <BreakdownItem
                    label="Flete + Seguro"
                    amount={estimate.freight + estimate.insurance}
                    icon={<TaxIcon size={16} />}
                    tooltip="Flete marítimo desde Miami hasta Callao más seguro internacional (1.5% del CIF)."
                  />
                  <BreakdownItem
                    label="Ad Valorem (6%)"
                    amount={estimate.adValorem}
                    icon={<TaxIcon size={16} />}
                    tooltip="Ad Valorem 6% calculado sobre el CIF (Costo + Seguro + Flete)."
                  />
                  <BreakdownItem
                    label="ISC"
                    amount={estimate.isc}
                    icon={<TaxIcon size={16} />}
                    tooltip={`Impuesto Selectivo al Consumo ${formatPercentage(estimate.iscRate)}. Varía según el tipo de vehículo (gasolina, híbrido, diésel o eléctrico).`}
                  />
                  <BreakdownItem
                    label="IGV (18%)"
                    amount={estimate.igv}
                    icon={<TaxIcon size={16} />}
                    tooltip="Impuesto General a las Ventas 18% aplicado sobre CIF + Ad Valorem + ISC."
                  />
                  <BreakdownItem
                    label="Fees & Servicios"
                    amount={estimate.stateComplianceFee + estimate.brokerFee + estimate.documentHandlingFee}
                    icon={<ServiceIcon size={16} />}
                    tooltip="Incluye State Compliance Fee (5%), Broker Fee (10%) y Extra FastTrack si aplica. Cubre inspección certificada, negociación, logística concierge y gestión documental."
                  />
                </div>

                {whatsappLink && (
                  <div className="pt-3 md:pt-4 border-t border-white/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
                      <Button
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="lg"
                        className="!text-black w-full"
                      >
                        Enviar WhatsApp
                      </Button>
                      <Button
                        onClick={handleDownloadPDF}
                        variant="secondary"
                        size="lg"
                        className="w-full"
                        disabled={isGeneratingPDF}
                      >
                        {isGeneratingPDF ? 'Generando PDF...' : 'Descargar PDF'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
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
    <div className="flex items-center justify-between gap-3 md:gap-4 rounded-lg md:rounded-xl border border-white/5 bg-white/[0.03] px-3 md:px-4 py-2 md:py-2.5">
      <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
        {icon && <span className="text-white/40 flex-shrink-0">{icon}</span>}
        <span className="text-white/70 text-sm truncate">{label}</span>
        {tooltip && <Tooltip content={tooltip} placement="top" />}
      </div>
      <span className="font-semibold text-white tabular-nums text-sm md:text-base flex-shrink-0">
        {formatCurrency(amount)}
      </span>
    </div>
  );
}
