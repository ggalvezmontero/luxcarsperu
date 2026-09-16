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
import { Tooltip } from "./Tooltip";
import { Icon } from "./ui/Icon";
import { Section, SectionHeader } from "./ui/Section";

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
  const formRef = useRef<HTMLDivElement>(null);
  /* Distingue el primer render de un cambio real de vista. Ver el efecto de
     foco más abajo. */
  const yaCambioDeVista = useRef(false);

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

  /* FOCO AL CAMBIAR DE VISTA.
     El formulario y los resultados no conviven: al pulsar "Calcular Estimado"
     el formulario entero se desmonta y lo reemplaza el panel de resultados. El
     botón que tenía el foco desaparece con él, así que el navegador manda el
     foco a `<body>` y la siguiente tabulación reinicia desde la cabecera de la
     página. Peor aún: con lector de pantalla no se anuncia nada, porque no hubo
     navegación ni región en vivo — la persona no se entera de que el cálculo ya
     está hecho.

     Llevar el foco al contenedor de resultados resuelve las dos cosas: anuncia
     el panel y deja la tabulación justo donde continúa el flujo (WCAG 2.4.3).
     Lo mismo aplica al volver con "Nueva Simulación", donde el foco se devuelve
     al formulario. */
  useEffect(() => {
    // En el primer render no hubo ningún cambio de vista: si no se saltara,
    // la calculadora robaría el foco nada más cargar la página.
    if (!yaCambioDeVista.current) {
      yaCambioDeVista.current = true;
      return;
    }

    const destino = showResults ? resultsRef.current : formRef.current;
    destino?.focus({ preventScroll: true });
  }, [showResults]);

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
      // import() dinámico a propósito: `@/lib/pdfExport` arrastra jspdf y
      // jspdf-autotable (~500 KB sin comprimir). Pedirlos recién al pulsar el
      // botón los saca del bundle inicial de la home. No convertir esto en un
      // import estático arriba.
      const { generatePDF } = await import("@/lib/pdfExport");
      await generatePDF(estimate);
    } catch (err) {
      console.error('Error generando PDF:', err);
      setError('Hubo un problema al generar el PDF. Intenta nuevamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };


  const yearOptions = (() => {
    const oldest = CURRENT_YEAR - PRICING_CONFIG.usedMaxAgeYears;
    return Array.from({ length: CURRENT_YEAR - oldest + 1 }, (_, i) => CURRENT_YEAR - i);
  })();

  const planOptions = [
    {
      key: "fast" as const,
      label: LUXCARS_CONFIG.deliveryWindows.fastTrack.label,
      days: LUXCARS_CONFIG.deliveryWindows.fastTrack.days,
    },
    {
      key: "standard" as const,
      label: LUXCARS_CONFIG.deliveryWindows.standard.label,
      days: LUXCARS_CONFIG.deliveryWindows.standard.days,
    },
  ];

  return (
    <Section id="calculator" tone="surface">
      <SectionHeader
        eyebrow="Calculadora pública"
        title="¿Cuánto cuesta importar tu auto?"
        description="Precio en EE.UU., flete, seguro, tributos SUNAT y honorarios en una sola cifra. En menos de un minuto."
        align="center"
      />

      {!showResults ? (
        <div
          ref={formRef}
          tabIndex={-1}
          role="group"
          aria-label="Formulario de la calculadora de importación"
          className="mx-auto mt-10 max-w-3xl"
        >
          <div className="rounded-[22px] border border-line bg-bg p-5 sm:p-8">
            {/* 1 · Condición */}
            <fieldset>
              <legend className="flex items-center gap-2 text-sm font-semibold text-ink">
                <StepNumber n={1} /> Condición
                <Tooltip content="El ISC que cobra SUNAT no es el mismo para un vehículo nuevo que para uno usado." />
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {CONDITION_OPTIONS.map((option) => {
                  const on = form.condition === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setForm((prev) => ({ ...prev, condition: option.id }))}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition-colors",
                        on
                          ? "border-silver bg-surface-3 text-ink"
                          : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink",
                      )}
                    >
                      <span className="block text-sm font-semibold text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-4">{option.hint}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* 2 · Tipo de vehículo */}
            <fieldset className="mt-8">
              <legend className="flex items-center gap-2 text-sm font-semibold text-ink">
                <StepNumber n={2} /> Motor
                <Tooltip
                  content={
                    selectedVehicleType
                      ? selectedVehicleType.tooltip
                      : "El tipo de motor define el porcentaje de ISC que aplica SUNAT."
                  }
                />
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {vehicleTypeOptions.map((option) => {
                  const on = form.vehicleType === option.id;
                  const rate = resolveIscRate({ category: option, condition: form.condition });
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => handleVehicleTypeSelect(option.id)}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition-colors",
                        on
                          ? "border-silver bg-surface-3 text-ink"
                          : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink",
                      )}
                    >
                      <span className="block text-sm font-semibold text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-4">
                        ISC {rate === null ? "no importable" : formatPercentage(rate)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* 3 · Datos del auto */}
            <fieldset className="mt-8">
              <legend className="flex items-center gap-2 text-sm font-semibold text-ink">
                <StepNumber n={3} /> El auto
              </legend>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm text-ink-2">
                  Marca
                  <select
                    value={form.brand}
                    onChange={handleFieldChange("brand")}
                    className="field-lux select-lux"
                  >
                    <option value="">Selecciona</option>
                    {BRAND_OPTIONS.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm text-ink-2">
                  Modelo
                  <input
                    value={form.model}
                    onChange={handleFieldChange("model")}
                    placeholder="Ej. Macan S"
                    className="field-lux"
                  />
                </label>
                <label className="grid gap-1.5 text-sm text-ink-2">
                  Año
                  <select
                    id="calc-year"
                    value={form.year}
                    onChange={handleFieldChange("year")}
                    disabled={form.missingYearAndPrice}
                    className="field-lux select-lux"
                  >
                    <option value="">Selecciona</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={String(year)}>{year}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm text-ink-2" htmlFor="calc-price">
                  Precio en EE.UU. (USD)
                  <input
                    id="calc-price"
                    value={form.price}
                    onChange={handleFieldChange("price")}
                    placeholder="Ej. 65000"
                    inputMode="decimal"
                    disabled={form.missingYearAndPrice}
                    className="field-lux tabular-nums"
                  />
                </label>
                <label className="grid gap-1.5 text-sm text-ink-2 sm:col-span-2">
                  <span className="flex items-center gap-2">
                    VIN <span className="text-xs text-ink-4">(opcional, afina el arancel)</span>
                    <Tooltip content="El primer carácter del VIN identifica el país de fabricación y ajusta el ad valorem automáticamente." />
                  </span>
                  <input
                    value={form.vin}
                    onChange={handleFieldChange("vin")}
                    placeholder="17 caracteres"
                    maxLength={17}
                    autoComplete="off"
                    spellCheck={false}
                    className="field-lux font-mono uppercase tracking-wider placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
                  />
                </label>
              </div>
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-ink-3">
                <input
                  id="calc-missing-year-price"
                  type="checkbox"
                  checked={form.missingYearAndPrice}
                  onChange={handleMissingYearAndPriceToggle}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded accent-silver"
                />
                No tengo el año ni el precio, quiero que me asesoren
              </label>
            </fieldset>

            {/* 4 · Plan */}
            <fieldset className="mt-8">
              <legend className="flex items-center gap-2 text-sm font-semibold text-ink">
                <StepNumber n={4} /> Plazo de entrega
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {planOptions.map((option) => {
                  const on = form.preferredPlan === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setForm((prev) => ({ ...prev, preferredPlan: option.key }))}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition-colors",
                        on
                          ? "border-silver bg-surface-3 text-ink"
                          : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink",
                      )}
                    >
                      <span className="block text-sm font-semibold text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-xs text-ink-4">
                        {option.days[0]}–{option.days[1]} días
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {error ? (
              <p role="alert" className="mt-6 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
                {error}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {form.missingYearAndPrice && incompleteDataWhatsappLink ? (
                <Button href={incompleteDataWhatsappLink} variant="whatsapp" size="lg" className="w-full sm:w-auto">
                  Pedir asesoría por WhatsApp
                </Button>
              ) : (
                <Button onClick={handleCalculate} variant="accent" size="lg" className="w-full sm:w-auto">
                  <Icon name="calculator" size={18} />
                  Calcular estimado
                </Button>
              )}
              <p className="text-xs leading-relaxed text-ink-4 sm:max-w-xs">
                Estimado referencial. El monto final depende de SUNAT, tipo de cambio y flete del mes.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div
          ref={resultsRef}
          tabIndex={-1}
          role="group"
          aria-label="Resultado del estimado de importación"
          className="mx-auto mt-10 max-w-4xl"
        >
          {estimate ? (
            <div className="grid gap-5 lg:grid-cols-5">
              {/* Resumen */}
              <div className="glow-lux flex flex-col rounded-[22px] border border-line p-6 sm:p-8 lg:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-4">
                  Puesto en Lima, con placas
                </p>
                <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-ink sm:text-5xl">
                  {formatCurrency(estimate.finalEstimate)}
                </p>
                <p className="mt-2 text-sm text-ink-3">
                  {estimate.input.brand} {estimate.input.model} {estimate.input.year}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Chip>{estimate.vehicleCategory.label}</Chip>
                  <Chip>{estimate.planConfig.label}</Chip>
                  <Chip>ISC {formatPercentage(estimate.iscRate)}</Chip>
                </div>

                <div className="mt-6 rounded-2xl border border-line bg-void/40 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                    Efectivo a desembolsar
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
                    {formatCurrency(estimate.cashRequired)}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-4">
                    Incluye la percepción del IGV ({formatPercentage(estimate.percepcionRate)}), que se recupera como crédito fiscal.
                  </p>
                </div>

                <div className="mt-auto grid gap-3 pt-6">
                  {whatsappLink ? (
                    <Button href={whatsappLink} variant="whatsapp" size="lg" className="w-full">
                      Enviar por WhatsApp
                    </Button>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <Button onClick={handleDownloadPDF} variant="secondary" disabled={isGeneratingPDF} className="w-full">
                      <Icon name="download" size={16} />
                      {isGeneratingPDF ? "Generando…" : "PDF"}
                    </Button>
                    <Button onClick={handleReset} variant="ghost" className="w-full border border-line">
                      <Icon name="refresh" size={16} />
                      Nuevo
                    </Button>
                  </div>
                </div>
              </div>

              {/* Desglose */}
              <div className="rounded-[22px] border border-line bg-bg p-6 sm:p-8 lg:col-span-3">
                <h3 className="text-base font-semibold text-ink">Desglose</h3>
                <dl className="mt-4 divide-y divide-line">
                  <Row label="Precio en EE.UU." amount={estimate.input.priceMiami} />
                  <Row
                    label="Flete + seguro"
                    amount={estimate.freight + estimate.insurance}
                    tooltip="Flete marítimo hasta el Callao más seguro internacional."
                  />
                  <Row
                    label={`Ad valorem ${formatPercentage(estimate.adValoremRate)}`}
                    amount={estimate.adValorem}
                    tooltip={
                      estimate.adValoremRate === 0
                        ? "0%: vehículo originario de EE.UU. con certificado de origen (acuerdo Perú–EE.UU.)."
                        : "Sobre el valor CIF. Baja a 0% solo si el vehículo es nuevo, originario de EE.UU. y tiene certificado de origen."
                    }
                  />
                  {originInfo ? (
                    <div className="py-3">
                      <p className="text-xs leading-relaxed text-ink-4">{originInfo.reason}</p>
                      {(originInfo.mayQualifyWithCertificate || estimate.adValoremRate === 0) ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleOriginOverride(estimate.adValoremRate === 0 ? "otro" : "originario-usa")
                          }
                          className="mt-1.5 text-xs font-semibold text-silver underline underline-offset-2 hover:text-ink"
                        >
                          {estimate.adValoremRate === 0
                            ? "No tengo certificado de origen · recalcular con 6%"
                            : "Sí tengo certificado de origen · recalcular con 0%"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <Row
                    label={`ISC ${formatPercentage(estimate.iscRate)}`}
                    amount={estimate.isc}
                    tooltip={`Sobre CIF + ad valorem. ${estimate.iscTooltip}`}
                  />
                  <Row
                    label="IGV 15.5% + IPM 2.5%"
                    amount={estimate.igv + estimate.ipm}
                    tooltip="Sobre CIF + ad valorem + ISC."
                  />
                  <Row
                    label="Servicio LuxCars"
                    amount={estimate.stateComplianceFee + estimate.brokerFee + estimate.documentHandlingFee}
                    tooltip="Inspección, negociación, logística, gestión documentaria y Fast Track si aplica."
                  />
                  <Row
                    label={`Percepción IGV ${formatPercentage(estimate.percepcionRate)}`}
                    amount={estimate.percepcion}
                    muted
                    tooltip="Adelanto del IGV. Se recupera como crédito fiscal; no es un costo, pero sí efectivo el día del despacho."
                  />
                </dl>
                <p className="mt-4 text-xs leading-relaxed text-ink-4">
                  Rango final ±{formatPercentage(LUXCARS_CONFIG.services.finalRangeVariance, "es-PE", 1)}. Los tributos son tasas fijas; varían el tipo de cambio y el flete.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold tabular-nums text-silver-bright">
      {n}
    </span>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">
      {children}
    </span>
  );
}

function Row({
  label,
  amount,
  tooltip,
  muted,
}: {
  label: string;
  amount: number;
  tooltip?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className={cn("flex min-w-0 items-center gap-2 text-sm", muted ? "text-ink-4" : "text-ink-2")}>
        <span>{label}</span>
        {tooltip ? <Tooltip content={tooltip} placement="top" /> : null}
      </dt>
      <dd className={cn("shrink-0 text-sm font-semibold tabular-nums sm:text-base", muted ? "text-ink-3" : "text-ink")}>
        {formatCurrency(amount)}
      </dd>
    </div>
  );
}

function CalculatorSectionFallback() {
  return (
    <Section id="calculator" tone="surface">
      <div className="mx-auto max-w-3xl py-16 text-center text-sm text-ink-3">
        Cargando calculadora…
      </div>
    </Section>
  );
}

export function CalculatorSection() {
  return (
    <Suspense fallback={<CalculatorSectionFallback />}>
      <CalculatorSectionInner />
    </Suspense>
  );
}
