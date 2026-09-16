'use client';

import {
  calculateImportQuote,
  checkAdmissibility,
  inferCondition,
  UnsupportedQuoteError,
  type ImportCalculatorInput,
  type PremiumImportQuote,
} from "@/core/pricing/priceCalculator";
import {
  PRICING_CONFIG,
  type PlanKey,
  type VehicleCondition,
  type VehicleOrigin,
} from "@/core/pricing/pricingConfig";
import {
  resolveIscRate,
  getVehicleCategory,
  VEHICLE_CATEGORIES,
} from "@/core/pricing/vehicleCategories";
import {
  resolveOrigin,
  type OriginInference,
} from "@/core/pricing/originInference";
import { getTrendingVehicleById } from "@/data/trendingVehicles";
import { LUXCARS_CONFIG, type VehicleTypeId } from "@/lib/config";
import { generatePDF } from "@/lib/pdfExport";
import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import {
  buildIncompleteCalculatorWhatsappLink,
  buildWhatsappLink,
} from "@/lib/whatsapp";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  Suspense,
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
  "Aston Martin",
  "Audi",
  "Bentley",
  "BMW",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge SRT",
  "Ferrari",
  "Ford",
  "Jeep",
  "Lamborghini",
  "Lexus",
  "McLaren",
  "Mercedes-Benz",
  "Porsche",
  "Range Rover",
  "Rolls-Royce",
  "Tesla",
  "Toyota",
];

type FormState = {
  vehicleType: VehicleTypeId | "";
  brand: string;
  model: string;
  year: string;
  price: string;
  preferredPlan: PlanKey;
  missingYearAndPrice: boolean;
  condition: VehicleCondition;
  /** Opcional. Si viene, su primer carácter decide el país y manda sobre la tabla. */
  vin: string;
  /** Solo se llena si el usuario corrige la sugerencia desde el resultado. */
  originOverride: VehicleOrigin | null;
};

const CONDITION_OPTIONS: { id: VehicleCondition; label: string; hint: string }[] = [
  { id: "nuevo", label: "Nuevo", hint: "Sin matricular, del año o del anterior" },
  { id: "usado", label: "Usado", hint: "Ya matriculado en EE.UU." },
];


const CURRENT_YEAR = new Date().getFullYear();

const getInitialYear = () => (CURRENT_YEAR - 1).toString();

const INITIAL_FORM: FormState = {
  vehicleType: "",
  brand: "",
  model: "",
  year: getInitialYear(),
  price: "",
  preferredPlan: "fast",
  missingYearAndPrice: false,
  condition: "nuevo",
  vin: "",
  originOverride: null,
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

function CalculatorSectionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Cargar estado inicial desde localStorage
  const loadFormFromStorage = (): FormState => {
    if (typeof window === 'undefined') return INITIAL_FORM;

    try {
      const stored = window.localStorage.getItem(FORM_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<FormState> & {
          // Compatibilidad con estados guardados antes de unificar ambos flags
          missingYear?: boolean;
          missingPrice?: boolean;
        };
        // Validar que tenga la estructura correcta
        if (parsed && typeof parsed === 'object') {
          return {
            vehicleType: parsed.vehicleType || INITIAL_FORM.vehicleType,
            brand: parsed.brand || INITIAL_FORM.brand,
            model: parsed.model || INITIAL_FORM.model,
            year: parsed.year || INITIAL_FORM.year,
            price: parsed.price || INITIAL_FORM.price,
            preferredPlan: parsed.preferredPlan || INITIAL_FORM.preferredPlan,
            missingYearAndPrice: Boolean(
              parsed.missingYearAndPrice ??
                parsed.missingYear ??
                parsed.missingPrice,
            ),
            condition: parsed.condition || INITIAL_FORM.condition,
            vin: parsed.vin || INITIAL_FORM.vin,
            originOverride: parsed.originOverride ?? null,
          };
        }
      }
    } catch (err) {
      console.warn('Error cargando formulario desde localStorage:', err);
    }
    return INITIAL_FORM;
  };

  // El primer render TIENE que coincidir con el del servidor, así que arranca
  // siempre en INITIAL_FORM. Lo guardado en localStorage se aplica después de
  // montar: leerlo durante el render rompe la hidratación y React descarta los
  // valores del cliente sin avisar, perdiendo el formulario del usuario.
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [hydrated, setHydrated] = useState(false);
  const [estimate, setEstimate] = useState<PremiumImportQuote | null>(null);
  const [originInfo, setOriginInfo] = useState<OriginInference | null>(null);
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

    if (form.missingYearAndPrice) {
      return;
    }

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

    const admissibility = checkAdmissibility({
      vehicleType: form.vehicleType,
      condition: form.condition,
      year: form.year.trim(),
      currentYear: CURRENT_YEAR,
    });
    if (!admissibility.allowed) {
      setError(admissibility.reason);
      return;
    }

    const inferred = resolveOrigin(
      form.brand.trim(),
      form.model.trim(),
      form.vin.trim() || undefined,
    );
    setOriginInfo(inferred);

    const parsed: ImportCalculatorInput = {
      brand: form.brand.trim(),
      model: form.model.trim(),
      year: form.year.trim(),
      priceMiami,
      vehicleType: form.vehicleType,
      condition: form.condition,
      // El usuario nunca elige el origen: se deduce del modelo (y del VIN si lo
      // dio). Solo lo corrige desde el resultado, donde ve el monto en juego.
      origin: form.originOverride ?? inferred.origin,
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
      setError(
        err instanceof UnsupportedQuoteError
          ? err.message
          : "Hubo un problema al generar el estimado. Intenta nuevamente.",
      );
    }
  };

  const handleReset = () => {
    setShowResults(false);
    setEstimate(null);
    setError(null);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn("No se pudo limpiar el cálculo guardado", err);
    }
    router.replace("/", { scroll: false });
  };

  // Restaurar el formulario guardado, ya montado y con la hidratación cerrada.
  useEffect(() => {
    setForm(loadFormFromStorage());
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar el formulario cada vez que cambie, pero nunca antes de haberlo
  // restaurado: si no, el INITIAL_FORM del primer render pisa lo guardado.
  useEffect(() => {
    if (!hydrated) return;

    try {
      window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form));
    } catch (err) {
      console.warn("No se pudo guardar el formulario localmente", err);
    }
  }, [form, hydrated]);

  // Cargar estimate guardado si existe y el formulario está completo
  // Solo ejecutar una vez después de que el componente se monte
  useEffect(() => {
    if (!hydrated) return;

    {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("simular")) {
          return;
        }

        const stored = window.localStorage.getItem(STORAGE_KEY);
        const currentForm = loadFormFromStorage();

        if (
          stored &&
          currentForm.vehicleType &&
          currentForm.brand &&
          currentForm.model &&
          currentForm.year &&
          currentForm.price &&
          !currentForm.missingYearAndPrice
        ) {
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const simularPresetId = searchParams.get("simular");

  useEffect(() => {
    if (!simularPresetId) {
      return;
    }
    const preset = getTrendingVehicleById(simularPresetId);
    if (!preset) {
      return;
    }

    const c = preset.calculator;
    const presetOrigin = resolveOrigin(c.brand, c.model);
    const simYear = getInitialYear();
    const priceStr = String(Math.round(c.priceUsd));
    const preferredPlan = c.preferredPlan ?? "fast";

    const nextForm: FormState = {
      vehicleType: c.vehicleType,
      brand: c.brand,
      model: c.model,
      year: simYear,
      price: priceStr,
      preferredPlan,
      missingYearAndPrice: false,
      // Los presets de vehículos destacados son unidades nuevas traídas de
      // Miami; el usuario puede cambiarlo después en el formulario.
      condition: inferCondition(simYear, CURRENT_YEAR),
      vin: "",
      originOverride: null,
    };

    setForm(nextForm);
    setOriginInfo(presetOrigin);
    setError(null);

    const parsed: ImportCalculatorInput = {
      brand: c.brand.trim(),
      model: c.model.trim(),
      year: simYear,
      priceMiami: c.priceUsd,
      vehicleType: c.vehicleType,
      condition: nextForm.condition,
      origin: presetOrigin.origin,
    };

    try {
      const nextEstimate = calculateImportQuote(parsed, preferredPlan);
      setEstimate(nextEstimate);
      setShowResults(true);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la simulación de ejemplo. Intenta de nuevo.");
      setShowResults(false);
      setEstimate(null);
    }

    requestAnimationFrame(() => {
      document
        .getElementById("calculator")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [simularPresetId]);

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

  /** Recalcula el estimado cambiando solo el origen, sin volver al formulario. */
  const handleOriginOverride = (next: VehicleOrigin) => {
    if (!estimate) return;
    setForm((prev) => ({ ...prev, originOverride: next }));
    try {
      setEstimate(
        calculateImportQuote(
          { ...estimate.input, origin: next },
          estimate.planKey,
        ),
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof UnsupportedQuoteError
          ? err.message
          : "Hubo un problema al recalcular el estimado.",
      );
    }
  };

  const handleVehicleTypeSelect = (vehicleType: VehicleTypeId) => {
    setForm((prev) => ({
      ...prev,
      vehicleType,
    }));
  };

  const handleMissingYearAndPriceToggle = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const checked = event.target.checked;
    if (checked) {
      setError(null);
    }
    setForm((prev) => ({
      ...prev,
      missingYearAndPrice: checked,
      year: checked ? "" : prev.year || getInitialYear(),
      price: checked ? "" : prev.price,
    }));
  };

  const whatsappLink = useMemo(() => {
    if (!estimate) return null;
    return buildWhatsappLink(estimate, {
      preferredPlan: form.preferredPlan,
    });
  }, [estimate, form.preferredPlan]);

  const incompleteDataWhatsappLink = useMemo(() => {
    if (!form.missingYearAndPrice) return null;
    const planLabel =
      form.preferredPlan === "fast"
        ? LUXCARS_CONFIG.deliveryWindows.fastTrack.label
        : LUXCARS_CONFIG.deliveryWindows.standard.label;
    return buildIncompleteCalculatorWhatsappLink({
      vehicleTypeLabel: selectedVehicleType?.label,
      brand: form.brand,
      model: form.model,
      missingYearAndPrice: form.missingYearAndPrice,
      preferredPlanLabel: planLabel,
    });
  }, [
    form.brand,
    form.model,
    form.missingYearAndPrice,
    form.preferredPlan,
    selectedVehicleType?.label,
  ]);

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
      className="scroll-mt-32 rounded-lux-lg md:rounded-lux-xl border border-line bg-surface px-4 md:px-6 py-12 md:py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="Calculadora pública"
        title="Calcula tu importación premium en menos de un minuto"
        description="Selecciona el tipo de vehículo, ingresa tu precio en Miami y obtén un estimado completo con flete, seguros, impuestos SUNAT y honorarios LuxCars. Si no tienes año ni precio, indícalo y te contactamos para asesorarte."
        align="center"
      />
      {!showResults ? (
        /* FORMULARIO */
        <div className="mt-8 md:mt-16 max-w-3xl mx-auto">
          <div className="grid gap-5 md:gap-7 rounded-lux md:rounded-lux-lg border border-line bg-surface-2 p-4 md:p-8 shadow-[var(--lux-shadow-lg)]">
            <div className="grid gap-4 md:gap-5">
              <div className="grid gap-2.5 text-sm text-ink-2">
                <div className="flex items-center gap-2 text-ink">
                  <span className="font-semibold tracking-wide text-sm md:text-base">
                    Condición
                  </span>
                  <Tooltip content="El ISC que cobra SUNAT no es el mismo para un vehículo nuevo que para uno usado." />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {CONDITION_OPTIONS.map((option) => {
                    const isSelected = form.condition === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, condition: option.id }))
                        }
                        className={cn(
                          "flex flex-col items-start gap-1 rounded-lux border px-3.5 py-3 text-left transition",
                          isSelected
                            ? "border-silver bg-surface-3 text-ink"
                            : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink",
                        )}
                      >
                        <span className="text-sm font-semibold text-ink">
                          {option.label}
                        </span>
                        <span className="text-[11px] leading-tight text-ink-4">
                          {option.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            <div className="grid gap-2.5 md:gap-3 text-sm text-ink-2">
              <div className="flex items-center gap-2 text-ink">
                <VehicleIcon size={18} className="text-silver" />
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
                        "flex flex-col items-start gap-1.5 md:gap-2 rounded-lux border px-4 md:px-5 py-3 md:py-4 text-left transition",
                        isSelected
                          ? "border-silver bg-surface-3 text-ink"
                          : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink",
                      )}
                    >
                      <span className="text-sm font-semibold text-ink">
                        {option.label}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink-4">
                        <TaxIcon size={14} />{" "}
                        {(() => {
                          const rate = resolveIscRate({
                            category: option,
                            condition: form.condition,
                          });
                          return rate === null
                            ? "no importable"
                            : formatPercentage(rate);
                        })()}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-ink-2">
                Marca
                <select
                  value={form.brand}
                  onChange={handleFieldChange("brand")}
                  className="h-11 md:h-12 rounded-lux border border-line-strong bg-surface-3 px-3 md:px-4 pr-10 text-ink hover:border-silver-dim focus:border-silver-bright appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTUgNy41TDEwIDEyLjVMMTUgNy41IiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIwLjUiLz4KPC9zdmc+Cg==')] bg-[length:20px_20px] bg-[right_12px_center] bg-no-repeat cursor-pointer text-base"
                  style={{
                    colorScheme: 'dark',
                    fontSize: '16px', // Prevenir zoom automático en móviles
                  }}
                >
                  <option value="" className="bg-surface text-ink-3">Selecciona</option>
                  {BRAND_OPTIONS.map((brand) => (
                    <option key={brand} value={brand} className="bg-surface text-ink">
                      {brand}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm text-ink-2">
                Modelo
                <input
                  value={form.model}
                  onChange={handleFieldChange("model")}
                  placeholder="Ej. 911 Turbo S"
                  className="h-11 md:h-12 rounded-lux border border-line-strong bg-surface-3 px-3 md:px-4 text-ink placeholder:text-ink-3 hover:border-silver-dim focus:border-silver-bright text-base"
                  style={{
                    fontSize: '16px', // Prevenir zoom automático en móviles
                  }}
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm text-ink-2">
              <span className="flex items-center gap-2">
                VIN
                <span className="text-xs text-ink-4">(opcional)</span>
                <Tooltip content="Si tienes el VIN del vehículo, su primer carácter identifica el país de fabricación con certeza y ajusta el arancel automáticamente." />
              </span>
              <input
                value={form.vin}
                onChange={handleFieldChange("vin")}
                placeholder="17 caracteres · afina el arancel"
                maxLength={17}
                autoComplete="off"
                spellCheck={false}
                className="h-11 md:h-12 rounded-lux border border-line-strong bg-surface-3 px-3 md:px-4 font-mono uppercase tracking-wider text-ink placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-3 hover:border-silver-dim focus:border-silver-bright text-base"
                style={{ fontSize: '16px' }}
              />
            </label>
            <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
              <div className="grid gap-2 text-sm text-ink-2">
                <div className="flex items-center gap-2">
                  <span>Año</span>
                  <span className="text-xs text-ink-4">
                    (hasta 2 años)
                  </span>
                </div>
                <select
                  id="calc-year"
                  aria-label="Año del vehículo"
                  value={form.year}
                  onChange={handleFieldChange("year")}
                  disabled={form.missingYearAndPrice}
                  className="h-11 md:h-12 rounded-lux border border-line-strong bg-surface-3 px-3 md:px-4 pr-10 text-ink hover:border-silver-dim focus:border-silver-bright appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTUgNy41TDEwIDEyLjVMMTUgNy41IiBzdHJva2U9IiNGRkZGRkYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIwLjUiLz4KPC9zdmc+Cg==')] bg-[length:20px_20px] bg-[right_12px_center] bg-no-repeat cursor-pointer text-base disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    colorScheme: 'dark',
                    fontSize: '16px', // Prevenir zoom automático en móviles
                  }}
                >
                  <option value="" className="bg-surface text-ink-3">Selecciona</option>
                  {(() => {
                    // El rango se deriva de la regla de antigüedad, no se
                    // escribe a mano: si cambia la norma, cambia el select.
                    const newest = CURRENT_YEAR;
                    const oldest = CURRENT_YEAR - PRICING_CONFIG.usedMaxAgeYears;
                    const years = Array.from(
                      { length: newest - oldest + 1 },
                      (_, i) => newest - i,
                    );
                    return years.map((year) => (
                      <option key={year} value={year.toString()} className="bg-surface text-ink">
                        {year}
                      </option>
                    ));
                  })()}
                </select>
              </div>
              <div className="grid gap-2 text-sm text-ink-2">
                <label htmlFor="calc-price" className="text-sm text-ink-2">
                  Precio en Miami (USD)
                </label>
                <input
                  id="calc-price"
                  value={form.price}
                  onChange={handleFieldChange("price")}
                  placeholder="Ej. 265000"
                  inputMode="decimal"
                  disabled={form.missingYearAndPrice}
                  className="h-11 md:h-12 rounded-lux border border-line-strong bg-surface-3 px-3 md:px-4 text-ink placeholder:text-ink-3 hover:border-silver-dim focus:border-silver-bright text-base disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    fontSize: '16px', // Prevenir zoom automático en móviles
                  }}
                />
              </div>
            </div>
            <div className="flex items-start gap-2.5 -mt-1">
              <input
                id="calc-missing-year-price"
                type="checkbox"
                checked={form.missingYearAndPrice}
                onChange={handleMissingYearAndPriceToggle}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong bg-surface-3 accent-silver"
              />
              <label
                htmlFor="calc-missing-year-price"
                className="cursor-pointer text-xs leading-snug text-ink-3"
              >
                No tengo el año ni el precio — quiero que me asesoren
              </label>
            </div>
            <div className="grid gap-2 text-sm text-ink-2">
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
                      "rounded-lux border px-4 md:px-5 py-3 md:py-4 text-left transition",
                      form.preferredPlan === option.key
                        ? "border-silver bg-surface-3 text-ink"
                        : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink",
                    )}
                  >
                    <span className="text-xs uppercase tracking-[0.3em] text-ink-3">
                      {option.label}
                    </span>
                    <p className="mt-1.5 md:mt-2 text-base md:text-lg font-medium text-ink">
                      {option.days[0]} - {option.days[1]} días
                    </p>
                  </button>
                ))}
              </div>
            </div>
            {error ? (
              <div className="rounded-lux border border-danger/40 bg-danger/10 px-4 md:px-5 py-2.5 md:py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            {form.missingYearAndPrice ? (
              <div className="grid gap-3">
                <div className="rounded-lux border border-line-strong bg-surface-3 px-4 md:px-5 py-3 md:py-4 text-sm text-ink-2">
                  <p className="font-medium text-ink">
                    Te ayudamos con lo que falta
                  </p>
                  <p className="mt-1.5 text-ink-2">
                    Completa lo que sepas (tipo de vehículo, marca, modelo) y
                    escríbenos. Prepararemos opciones a tu medida según tu caso.
                  </p>
                </div>
                {incompleteDataWhatsappLink ? (
                  <Button
                    href={incompleteDataWhatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="lg"
                    className="w-full"
                  >
                    Pedir asesoría por WhatsApp
                  </Button>
                ) : null}
              </div>
            ) : (
              <Button onClick={handleCalculate} size="lg">
                Calcular Estimado
              </Button>
            )}

            <p className="text-xs text-ink-4 leading-relaxed">
              Este es un estimado de importación. El valor final puede variar según
              la partida arancelaria, condición del vehículo y determinación de SUNAT.
            </p>
          </div>
        </div>
      ) : (
        /* RESULTADOS */
        <div ref={resultsRef} className="mt-8 md:mt-16 max-w-4xl mx-auto">
          <div className="flex flex-col rounded-lux md:rounded-lux-lg border border-line bg-surface-2 p-4 md:p-8 shadow-[var(--lux-shadow-lg)]">
            {estimate ? (
              <div className="flex flex-col gap-4 md:gap-6 h-full">
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                      <span className="rounded-full border border-line bg-surface-3 px-2.5 md:px-3 py-0.5 md:py-1 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.25em] text-ink-3">
                        {estimate.vehicleCategory.label}
                      </span>
                      <span className="rounded-full border border-line bg-surface-3 px-2.5 md:px-3 py-0.5 md:py-1 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.25em] text-ink-3">
                        {estimate.planConfig.label}
                      </span>
                      <span className="rounded-full border border-line bg-surface-3 px-2.5 md:px-3 py-0.5 md:py-1 text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.25em] text-ink-3">
                        ISC {formatPercentage(estimate.iscRate)}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl md:text-2xl font-semibold text-ink">
                        Estimado de Importación
                      </h3>
                      <p className="mt-1 text-sm text-ink-3">
                        {estimate.input.brand} {estimate.input.model} {estimate.input.year}
                      </p>
                    </div>
                  </div>

                <div className="rounded-lux md:rounded-lux-lg border border-line bg-surface-3 p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4">
                    <div className="space-y-2 md:space-y-3 flex-1">
                      <span className="text-xs uppercase tracking-[0.3em] text-ink-3">
                        Precio final estimado Lima
                      </span>
                      <div className="text-2xl md:text-3xl font-bold tabular-nums text-silver-bright">
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
                      className="w-full md:w-auto md:flex-shrink-0 inline-flex items-center justify-center rounded-full border border-line-strong bg-surface-2 px-6 py-2 text-sm font-medium tracking-[0.08em] uppercase text-ink transition-colors duration-300 hover:border-silver hover:bg-surface-3"
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
                    tooltip="Flete marítimo desde Miami hasta Callao más seguro internacional (0.35% sobre el 110% del FOB + flete, mínimo USD 45)."
                  />
                  <BreakdownItem
                    label={`Ad Valorem (${formatPercentage(estimate.adValoremRate)})`}
                    amount={estimate.adValorem}
                    icon={<TaxIcon size={16} />}
                    tooltip={
                      estimate.adValoremRate === 0
                        ? "Ad Valorem 0%: los vehículos originarios de EE.UU. entran libres de arancel por el APC Perú–Estados Unidos. Requiere certificado de origen."
                        : `Ad Valorem ${formatPercentage(estimate.adValoremRate)} sobre el CIF. Solo baja a 0% si el vehículo es originario de EE.UU. y se presenta certificado de origen.`
                    }
                  />
                  {originInfo && (
                    <div className="-mt-1 mb-1 rounded-lux border border-line bg-surface px-3 py-2">
                      <p className="text-[11px] leading-snug text-ink-4">
                        {originInfo.reason}
                      </p>
                      {(originInfo.mayQualifyWithCertificate ||
                        estimate.adValoremRate === 0) && (
                        <button
                          type="button"
                          onClick={() => handleOriginOverride(
                            estimate.adValoremRate === 0 ? "otro" : "originario-usa",
                          )}
                          className="mt-1.5 text-[11px] font-medium text-silver-bright underline underline-offset-2 hover:text-ink"
                        >
                          {estimate.adValoremRate === 0
                            ? "No tengo certificado de origen · recalcular con 6%"
                            : "Sí tengo certificado de origen · recalcular con 0%"}
                        </button>
                      )}
                    </div>
                  )}
                  <BreakdownItem
                    label={`ISC (${formatPercentage(estimate.iscRate)})`}
                    amount={estimate.isc}
                    icon={<TaxIcon size={16} />}
                    tooltip={`Impuesto Selectivo al Consumo ${formatPercentage(estimate.iscRate)} sobre CIF + Ad Valorem. ${estimate.iscTooltip}`}
                  />
                  <BreakdownItem
                    label="IGV (15.5%)"
                    amount={estimate.igv}
                    icon={<TaxIcon size={16} />}
                    tooltip="Impuesto General a las Ventas 15.5% sobre CIF + Ad Valorem + ISC."
                  />
                  <BreakdownItem
                    label="IPM (2.5%)"
                    amount={estimate.ipm}
                    icon={<TaxIcon size={16} />}
                    tooltip="Impuesto de Promoción Municipal 2.5%, sobre la misma base que el IGV. Juntos suman el 18% habitual."
                  />
                  <BreakdownItem
                    label="Fees & Servicios"
                    amount={estimate.stateComplianceFee + estimate.brokerFee + estimate.documentHandlingFee}
                    icon={<ServiceIcon size={16} />}
                    tooltip="Incluye State Compliance Fee (5%), Broker Fee (10%) y Extra FastTrack si aplica. Cubre inspección certificada, negociación, logística concierge y gestión documental."
                  />
                  <div className="mt-2 rounded-lux border border-line bg-surface-3 p-3">
                    <BreakdownItem
                      label={`Percepción IGV (${formatPercentage(estimate.percepcionRate)})`}
                      amount={estimate.percepcion}
                      icon={<TaxIcon size={16} />}
                      tooltip="Adelanto del IGV que se paga en aduanas y luego se recupera como crédito fiscal. No es un costo, pero sí es efectivo que hay que desembolsar."
                    />
                    <p className="mt-1.5 text-[11px] leading-snug text-ink-4">
                      No es costo: se recupera como crédito fiscal. Efectivo total a
                      desembolsar {formatCurrency(estimate.cashRequired)}.
                    </p>
                  </div>
                </div>

                {whatsappLink && (
                  <div className="pt-3 md:pt-4 border-t border-line">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-3">
                      <Button
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="lg"
                        className="w-full"
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
    <div className="flex items-center justify-between gap-3 md:gap-4 rounded-lux border border-line bg-surface px-3 md:px-4 py-2 md:py-2.5">
      <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
        {icon && <span className="text-ink-4 flex-shrink-0">{icon}</span>}
        {/* Sin truncate: a 360px recortaba conceptos del desglose
            ("Percepción IGV (4%)" perdía media etiqueta). Envuelve en dos
            líneas; el monto no se comprime porque es flex-shrink-0. */}
        <span className="min-w-0 text-sm leading-snug text-ink-2">{label}</span>
        {tooltip && <Tooltip content={tooltip} placement="top" />}
      </div>
      <span className="font-semibold text-ink tabular-nums text-sm md:text-base flex-shrink-0">
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function CalculatorSectionFallback() {
  return (
    <section
      id="calculator"
      className="scroll-mt-32 rounded-lux-lg md:rounded-lux-xl border border-line bg-surface px-4 md:px-6 py-12 md:py-20 lg:px-14"
    >
      <div className="mx-auto max-w-3xl py-16 text-center text-sm text-ink-3">
        Cargando calculadora…
      </div>
    </section>
  );
}

export function CalculatorSection() {
  return (
    <Suspense fallback={<CalculatorSectionFallback />}>
      <CalculatorSectionInner />
    </Suspense>
  );
}
