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
  oldestImportableModelYear,
  PRICING_CONFIG,
  type PlanKey,
  type VehicleCondition,
  type VehicleOrigin,
} from "@/core/pricing/pricingConfig";
import {
  resolveIscRate,
  USED_ISC_RATE,
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

/* ---------------------------------------------------------------------------
   CALCULADORA PÚBLICA — rediseño 2026-09

   Principios:
   1. El resultado se calcula EN VIVO. No hay botón "Calcular": en escritorio
      el panel de la derecha se actualiza con cada dato y en móvil una barra
      fija muestra el total y lleva al desglose. Menos pasos, más contexto.
   2. Cuatro decisiones, en orden de impacto: condición, motor, el auto,
      entrega. Nada más es obligatorio.
   3. El VIN sale del formulario. Solo sirve para afinar el ad valorem en los
      pocos modelos con doble planta, así que se ofrece junto al ad valorem del
      resultado, cuando el dato importa y con el monto en juego a la vista.
   4. Los errores se muestran donde se corrigen (bajo el campo) y el panel de
      resultado dice qué falta, en vez de un alerta genérico al final.
   ------------------------------------------------------------------------- */

const BRAND_SUGGESTIONS = [
  "Aston Martin",
  "Audi",
  "Bentley",
  "BMW",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ferrari",
  "Ford",
  "GMC",
  "Jeep",
  "Lamborghini",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Maserati",
  "McLaren",
  "Mercedes-Benz",
  "Porsche",
  "RAM",
  "Rolls-Royce",
  "Tesla",
  "Toyota",
];

type FormState = {
  condition: VehicleCondition;
  vehicleType: VehicleTypeId | "";
  brand: string;
  model: string;
  year: string;
  /** Solo dígitos. Se formatea con separadores al mostrarse. */
  price: string;
  preferredPlan: PlanKey;
  /** Opcional. Su primer carácter decide el país y manda sobre la tabla. */
  vin: string;
  /** Solo se llena si el usuario corrige la sugerencia desde el resultado. */
  originOverride: VehicleOrigin | null;
};

const CONDITION_OPTIONS: { id: VehicleCondition; label: string; hint: string }[] = [
  { id: "nuevo", label: "Nuevo", hint: "Sin matricular en EE.UU." },
  { id: "usado", label: "Usado", hint: "Ya matriculado en EE.UU." },
];

/** Etiquetas cortas para las fichas de motor. La larga queda en el tooltip. */
const MOTOR_SHORT_LABEL: Record<VehicleTypeId, string> = {
  gasolina: "Gasolina",
  hev: "Híbrido",
  diesel: "Diésel",
  ev: "Eléctrico",
  phev: "Híbrido enchufable",
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = (() => {
  const oldest = oldestImportableModelYear(CURRENT_YEAR);
  return Array.from({ length: CURRENT_YEAR - oldest + 1 }, (_, i) => CURRENT_YEAR - i);
})();

const INITIAL_FORM: FormState = {
  condition: "nuevo",
  vehicleType: "",
  brand: "",
  model: "",
  year: String(CURRENT_YEAR - 1),
  price: "",
  preferredPlan: "fast",
  vin: "",
  originOverride: null,
};

const STORAGE_KEY = "luxcars:last-estimate";
const FORM_STORAGE_KEY = "luxcars:form-state";
const RESULT_ID = "calc-resultado";

const onlyDigits = (value: string) => value.replace(/[^0-9]/g, "").slice(0, 8);
const toNumber = (digits: string) => (digits ? Number(digits) : NaN);
const formatDigits = (digits: string) =>
  digits ? Number(digits).toLocaleString("en-US") : "";

function loadStoredForm(): FormState {
  try {
    const stored = window.localStorage.getItem(FORM_STORAGE_KEY);
    if (!stored) return INITIAL_FORM;
    const parsed = JSON.parse(stored) as Partial<FormState>;
    if (!parsed || typeof parsed !== "object") return INITIAL_FORM;
    const year = String(parsed.year ?? "");
    return {
      condition: parsed.condition === "usado" ? "usado" : "nuevo",
      vehicleType: parsed.vehicleType || "",
      brand: parsed.brand || "",
      model: parsed.model || "",
      year: YEAR_OPTIONS.includes(Number(year)) ? year : INITIAL_FORM.year,
      price: onlyDigits(String(parsed.price ?? "")),
      preferredPlan: parsed.preferredPlan === "standard" ? "standard" : "fast",
      vin: parsed.vin || "",
      originOverride: parsed.originOverride ?? null,
    };
  } catch (err) {
    console.warn("Error cargando formulario desde localStorage:", err);
    return INITIAL_FORM;
  }
}

/* --- Evaluación en vivo --------------------------------------------------- */

type Evaluation =
  | { kind: "incomplete"; missing: string[] }
  | { kind: "blocked"; reason: string }
  | { kind: "ready"; estimate: PremiumImportQuote; originInfo: OriginInference };

function evaluate(form: FormState, priceSettled: boolean): Evaluation {
  const minPrice = LUXCARS_CONFIG.services.minimumVehiclePrice;
  const missing: string[] = [];
  if (!form.vehicleType) missing.push("el motor");
  if (!form.brand.trim()) missing.push("la marca");
  if (!form.model.trim()) missing.push("el modelo");
  if (!form.year) missing.push("el año");
  const priceMiami = toNumber(form.price);
  if (!(priceMiami > 0)) missing.push("el precio");
  if (missing.length > 0) return { kind: "incomplete", missing };

  if (priceMiami < minPrice) {
    // Mientras se escribe, un precio corto no es un error todavía.
    if (!priceSettled) return { kind: "incomplete", missing: ["el precio"] };
    return {
      kind: "blocked",
      reason: `Importamos a pedido desde ${formatCurrency(minPrice)}. Por debajo de ese monto los costos fijos del proceso pesan demasiado sobre el valor del auto.`,
    };
  }

  const admissibility = checkAdmissibility({
    vehicleType: form.vehicleType as VehicleTypeId,
    condition: form.condition,
    year: form.year,
    currentYear: CURRENT_YEAR,
  });
  if (!admissibility.allowed) return { kind: "blocked", reason: admissibility.reason };

  const originInfo = resolveOrigin(
    form.brand.trim(),
    form.model.trim(),
    form.vin.trim() || undefined,
  );

  const input: ImportCalculatorInput = {
    brand: form.brand.trim(),
    model: form.model.trim(),
    year: form.year,
    priceMiami,
    vehicleType: form.vehicleType as VehicleTypeId,
    condition: form.condition,
    origin: form.originOverride ?? originInfo.origin,
  };

  try {
    return {
      kind: "ready",
      estimate: calculateImportQuote(input, form.preferredPlan),
      originInfo,
    };
  } catch (err) {
    return {
      kind: "blocked",
      reason:
        err instanceof UnsupportedQuoteError
          ? err.message
          : "Hubo un problema al generar el estimado. Revisa los datos e intenta de nuevo.",
    };
  }
}

/* --- Componente ------------------------------------------------------------ */

function CalculatorSectionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // El primer render TIENE que coincidir con el del servidor: arranca en
  // INITIAL_FORM y lo guardado se aplica después de montar.
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [hydrated, setHydrated] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);
  const [showVin, setShowVin] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [resultInView, setResultInView] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const minPrice = LUXCARS_CONFIG.services.minimumVehiclePrice;
  const priceValue = toNumber(form.price);
  const priceSettled = priceTouched || form.price.length >= 5;
  const priceTooLow = priceSettled && priceValue > 0 && priceValue < minPrice;

  const evaluation = useMemo(() => evaluate(form, priceSettled), [form, priceSettled]);
  const estimate = evaluation.kind === "ready" ? evaluation.estimate : null;
  const originInfo = evaluation.kind === "ready" ? evaluation.originInfo : null;

  const yearBlocked = useMemo(() => {
    if (form.condition !== "usado" || !form.vehicleType || !form.year) return null;
    const result = checkAdmissibility({
      vehicleType: form.vehicleType,
      condition: form.condition,
      year: form.year,
      currentYear: CURRENT_YEAR,
    });
    return result.allowed ? null : result.reason;
  }, [form.condition, form.vehicleType, form.year]);

  /* Restaurar y persistir el formulario. */
  useEffect(() => {
    setForm(loadStoredForm());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form));
    } catch (err) {
      console.warn("No se pudo guardar el formulario localmente", err);
    }
  }, [form, hydrated]);

  /* Publicar el estimado para el formulario de contacto. */
  useEffect(() => {
    if (!estimate) return;
    try {
      const payload = { estimate, timestamp: Date.now(), preferredPlan: estimate.planKey };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent(STORAGE_KEY, { detail: payload }));
    } catch (err) {
      console.warn("No se pudo guardar el cálculo localmente", err);
    }
  }, [estimate]);

  /* Preset desde "más buscados": /?simular=<id>#calculator */
  const simularPresetId = searchParams.get("simular");
  useEffect(() => {
    if (!simularPresetId) return;
    const preset = getTrendingVehicleById(simularPresetId);
    if (!preset) return;
    const c = preset.calculator;
    const year = String(CURRENT_YEAR - 1);
    setForm({
      condition: inferCondition(year, CURRENT_YEAR),
      vehicleType: c.vehicleType,
      brand: c.brand,
      model: c.model,
      year,
      price: onlyDigits(String(Math.round(c.priceUsd))),
      preferredPlan: c.preferredPlan ?? "fast",
      vin: "",
      originOverride: null,
    });
    setPriceTouched(true);
    requestAnimationFrame(() => {
      document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [simularPresetId]);

  /* La barra fija de móvil se esconde cuando el resultado ya está a la vista. */
  useEffect(() => {
    const node = resultRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setResultInView(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* --- Handlers --- */

  const patch = (changes: Partial<FormState>) =>
    setForm((prev) => ({ ...prev, ...changes }));

  const handleText =
    (field: "brand" | "model" | "vin") => (event: ChangeEvent<HTMLInputElement>) => {
      const value = field === "vin" ? event.target.value.toUpperCase().slice(0, 17) : event.target.value;
      // Cambiar el auto invalida la corrección manual del origen.
      patch({ [field]: value, originOverride: null });
    };

  const handlePrice = (event: ChangeEvent<HTMLInputElement>) => {
    patch({ price: onlyDigits(event.target.value) });
  };

  const handleReset = () => {
    setForm(INITIAL_FORM);
    setPriceTouched(false);
    setShowVin(false);
    setBreakdownOpen(false);
    setPdfError(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(FORM_STORAGE_KEY);
    } catch (err) {
      console.warn("No se pudo limpiar el cálculo guardado", err);
    }
    if (simularPresetId) router.replace("/#calculator", { scroll: false });
    document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDownloadPDF = async () => {
    if (!estimate) return;
    setIsGeneratingPDF(true);
    setPdfError(null);
    try {
      // import() dinámico a propósito: jspdf pesa ~500 KB y solo hace falta
      // al pulsar el botón. No convertir en import estático.
      const { generatePDF } = await import("@/lib/pdfExport");
      await generatePDF(estimate);
    } catch (err) {
      console.error("Error generando PDF:", err);
      setPdfError("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const scrollToResult = () => {
    setBreakdownOpen(true);
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const whatsappLink = useMemo(
    () => (estimate ? buildWhatsappLink(estimate, { preferredPlan: estimate.planKey }) : null),
    [estimate],
  );

  const adviceLink = useMemo(() => {
    const category = VEHICLE_CATEGORIES.find((c) => c.id === form.vehicleType);
    const plan = LUXCARS_CONFIG.deliveryWindows;
    return buildIncompleteCalculatorWhatsappLink({
      vehicleTypeLabel: category?.label,
      brand: form.brand,
      model: form.model,
      missingYearAndPrice: true,
      preferredPlanLabel:
        form.preferredPlan === "fast" ? plan.fastTrack.label : plan.standard.label,
    });
  }, [form.vehicleType, form.brand, form.model, form.preferredPlan]);

  const plans = [
    { key: "fast" as const, ...LUXCARS_CONFIG.deliveryWindows.fastTrack },
    { key: "standard" as const, ...LUXCARS_CONFIG.deliveryWindows.standard },
  ];

  return (
    <Section id="calculator" tone="surface">
      <SectionHeader
        eyebrow="Calculadora pública"
        title="¿Cuánto cuesta importar tu auto?"
        description="Cuatro datos y ves el costo puesto en Lima al instante, con tributos SUNAT, flete, seguro y honorarios. Sin dejar tu correo."
        align="center"
      />

      <div className="mx-auto mt-10 grid max-w-6xl gap-6 lg:mt-14 lg:grid-cols-12 lg:items-start lg:gap-8">
        {/* ======================= Formulario ======================= */}
        <form
          noValidate
          onSubmit={(event) => event.preventDefault()}
          aria-label="Datos del vehículo a importar"
          className="rounded-[22px] border border-line bg-bg p-5 sm:p-8 lg:col-span-7"
        >
          {/* 1 · Condición */}
          <Step n={1} title="¿Nuevo o usado?" tooltip="El ISC que cobra SUNAT no es el mismo para un vehículo nuevo que para uno usado, y los usados tienen tope de antigüedad.">
            <div role="group" aria-label="Condición" className="grid grid-cols-2 gap-3">
              {CONDITION_OPTIONS.map((option) => (
                <Choice
                  key={option.id}
                  on={form.condition === option.id}
                  onClick={() => patch({ condition: option.id })}
                  title={option.label}
                  hint={option.hint}
                />
              ))}
            </div>
          </Step>

          {/* 2 · Motor */}
          <Step n={2} title="Motor" tooltip="El tipo de motor define el porcentaje de ISC que aplica SUNAT.">
            <div role="group" aria-label="Tipo de motor" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {VEHICLE_CATEGORIES.map((option) => {
                const rate = resolveIscRate({ category: option, condition: form.condition });
                const blocked = rate === null;
                return (
                  <Choice
                    key={option.id}
                    on={form.vehicleType === option.id}
                    disabled={blocked}
                    onClick={() => patch({ vehicleType: option.id })}
                    title={MOTOR_SHORT_LABEL[option.id]}
                    hint={blocked ? "No entra usado" : `ISC ${formatPercentage(rate)}`}
                    tooltip={option.tooltip}
                  />
                );
              })}
            </div>
            {form.condition === "usado" ? (
              <p className="mt-3 text-xs leading-relaxed text-ink-4">
                Todo usado de la partida 87.03 paga ISC {formatPercentage(USED_ISC_RATE)}. El diésel usado no se puede importar.
              </p>
            ) : null}
          </Step>

          {/* 3 · El auto */}
          <Step n={3} title="El auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Marca" htmlFor="calc-brand">
                <input
                  id="calc-brand"
                  list="calc-brands"
                  value={form.brand}
                  onChange={handleText("brand")}
                  placeholder="Ej. Porsche"
                  autoComplete="off"
                  autoCapitalize="words"
                  className="field-lux"
                />
                <datalist id="calc-brands">
                  {BRAND_SUGGESTIONS.map((brand) => (
                    <option key={brand} value={brand} />
                  ))}
                </datalist>
              </Field>
              <Field label="Modelo" htmlFor="calc-model">
                <input
                  id="calc-model"
                  value={form.model}
                  onChange={handleText("model")}
                  placeholder="Ej. Macan S"
                  autoComplete="off"
                  autoCapitalize="words"
                  className="field-lux"
                />
              </Field>
              <div>
                <span id="calc-year-label" className="block text-sm text-ink-2">Año modelo</span>
                <div
                  role="group"
                  aria-labelledby="calc-year-label"
                  className="mt-1.5 grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${YEAR_OPTIONS.length}, minmax(0, 1fr))` }}
                >
                  {YEAR_OPTIONS.map((year) => (
                    <button
                      key={year}
                      type="button"
                      aria-pressed={form.year === String(year)}
                      onClick={() => patch({ year: String(year) })}
                      className={cn(
                        "field-lux flex items-center justify-center font-semibold tabular-nums transition-colors",
                        form.year === String(year)
                          ? "!border-silver !bg-surface-3 text-ink"
                          : "text-ink-3 hover:text-ink",
                      )}
                    >
                      {year}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-4">
                  {form.condition === "usado"
                    ? `Usados: máximo ${PRICING_CONFIG.usedMaxAgeYears} años contando ${CURRENT_YEAR}.`
                    : "Nuevos: del año o del anterior."}
                </p>
                {yearBlocked ? <FieldError>{yearBlocked}</FieldError> : null}
              </div>
              <Field label="Precio en EE.UU." htmlFor="calc-price">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-ink-4">
                    USD
                  </span>
                  <input
                    id="calc-price"
                    value={formatDigits(form.price)}
                    onChange={handlePrice}
                    onBlur={() => setPriceTouched(true)}
                    placeholder="65,000"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-invalid={priceTooLow || undefined}
                    aria-describedby="calc-price-hint"
                    className="field-lux pl-14 tabular-nums"
                  />
                </div>
                {priceTooLow ? (
                  <FieldError>
                    Trabajamos desde {formatCurrency(minPrice)}. Si tu auto cuesta menos, escríbenos y vemos si hay otra opción.
                  </FieldError>
                ) : (
                  <p id="calc-price-hint" className="mt-1.5 text-xs text-ink-4">
                    El precio del anuncio en EE.UU. Mínimo {formatCurrency(minPrice)}.
                  </p>
                )}
              </Field>
            </div>
          </Step>

          {/* 4 · Entrega */}
          <Step n={4} title="Entrega">
            <div role="group" aria-label="Plazo de entrega" className="grid grid-cols-2 gap-3">
              {plans.map((plan) => (
                <Choice
                  key={plan.key}
                  on={form.preferredPlan === plan.key}
                  onClick={() => patch({ preferredPlan: plan.key })}
                  title={plan.label}
                  hint={`${plan.days[0]}–${plan.days[1]} días`}
                />
              ))}
            </div>
          </Step>

          <p className="mt-8 border-t border-line pt-5 text-sm leading-relaxed text-ink-3">
            ¿Todavía no tienes el auto o el precio?{" "}
            <a
              href={adviceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink"
            >
              Pide asesoría por WhatsApp
            </a>{" "}
            y lo buscamos contigo.
          </p>
        </form>

        {/* ======================= Resultado ======================= */}
        <div
          id={RESULT_ID}
          ref={resultRef}
          className="scroll-mt-[calc(var(--lux-nav-h)+1rem)] lg:sticky lg:top-[calc(var(--lux-nav-h)+1.5rem)] lg:col-span-5"
        >
          <ResultPanel
            evaluation={evaluation}
            estimate={estimate}
            originInfo={originInfo}
            form={form}
            breakdownOpen={breakdownOpen}
            onToggleBreakdown={() => setBreakdownOpen((v) => !v)}
            showVin={showVin}
            onToggleVin={() => setShowVin((v) => !v)}
            onVinChange={handleText("vin")}
            onOriginOverride={(next) => patch({ originOverride: next })}
            whatsappLink={whatsappLink}
            adviceLink={adviceLink}
            onDownloadPDF={handleDownloadPDF}
            isGeneratingPDF={isGeneratingPDF}
            pdfError={pdfError}
            onReset={handleReset}
          />
        </div>
      </div>

      {/* Barra fija de móvil: total + salto al desglose. */}
      <div
        aria-hidden={!estimate || resultInView}
        className={cn(
          "pointer-events-none sticky bottom-4 z-30 mt-6 transition-all duration-200 lg:hidden",
          estimate && !resultInView ? "opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        {estimate ? (
          <button
            type="button"
            tabIndex={estimate && !resultInView ? 0 : -1}
            onClick={scrollToResult}
            className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-between gap-4 rounded-full border border-line-strong bg-void/90 py-3 pl-5 pr-2 text-left shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl"
          >
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-4">
                Puesto en Lima
              </span>
              <span className="block truncate text-lg font-semibold tabular-nums text-ink">
                {formatCurrency(estimate.finalEstimate)}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-void">
              Ver desglose
              <Icon name="chevronDown" size={16} />
            </span>
          </button>
        ) : null}
      </div>
    </Section>
  );
}

/* --- Panel de resultado ---------------------------------------------------- */

type ResultPanelProps = {
  evaluation: Evaluation;
  estimate: PremiumImportQuote | null;
  originInfo: OriginInference | null;
  form: FormState;
  breakdownOpen: boolean;
  onToggleBreakdown: () => void;
  showVin: boolean;
  onToggleVin: () => void;
  onVinChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onOriginOverride: (next: VehicleOrigin) => void;
  whatsappLink: string | null;
  adviceLink: string;
  onDownloadPDF: () => void;
  isGeneratingPDF: boolean;
  pdfError: string | null;
  onReset: () => void;
};

function ResultPanel({
  evaluation,
  estimate,
  originInfo,
  form,
  breakdownOpen,
  onToggleBreakdown,
  showVin,
  onToggleVin,
  onVinChange,
  onOriginOverride,
  whatsappLink,
  adviceLink,
  onDownloadPDF,
  isGeneratingPDF,
  pdfError,
  onReset,
}: ResultPanelProps) {
  if (!estimate || !originInfo) {
    const blocked = evaluation.kind === "blocked";
    return (
      <div className="glow-lux rounded-[22px] border border-line p-6 sm:p-8" aria-live="polite">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-4">
          Puesto en Lima, con placas
        </p>
        <p className="mt-2 text-[2.5rem] font-semibold leading-none tracking-tight text-ink-4/60 sm:text-5xl">
          USD —
        </p>
        {blocked ? (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4 text-sm leading-relaxed text-ink">
            <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-warn" />
            <span>{evaluation.reason}</span>
          </div>
        ) : (
          <p className="mt-6 text-sm leading-relaxed text-ink-3">
            {evaluation.kind === "incomplete" ? (
              <>
                Falta {listInSpanish(evaluation.missing)}. El total aparece aquí en cuanto completes los datos.
              </>
            ) : null}
          </p>
        )}
        <ul className="mt-6 grid gap-2 text-sm text-ink-3">
          {[
            "Flete Miami → Callao y seguro",
            "Ad valorem, ISC, IGV e IPM según SUNAT",
            "Honorario LuxCars y gestión documentaria",
            "Percepción del IGV separada, porque se recupera",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Icon name="check" size={16} className="mt-0.5 shrink-0 text-silver" />
              {item}
            </li>
          ))}
        </ul>
        {blocked ? (
          <Button href={adviceLink} variant="whatsapp" size="lg" className="mt-6 w-full">
            Consultar por WhatsApp
          </Button>
        ) : null}
      </div>
    );
  }

  const tributos = estimate.adValorem + estimate.isc + estimate.igv + estimate.ipm;
  const servicio = estimate.stateComplianceFee + estimate.brokerFee + estimate.documentHandlingFee;
  const tributosShare = estimate.finalEstimate > 0 ? tributos / estimate.finalEstimate : 0;
  const conditionLabel = estimate.condition === "usado" ? "Usado" : "Nuevo";
  const canToggleOrigin = originInfo.mayQualifyWithCertificate || estimate.adValoremRate === 0;
  const vinHelps = originInfo.requiresVin || originInfo.confidence !== "alta";

  return (
    <div className="glow-lux rounded-[22px] border border-line p-6 sm:p-8">
      {/* Total */}
      <div aria-live="polite" aria-atomic="true">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-4">
          Puesto en Lima, con placas
        </p>
        <p className="mt-2 break-words text-[2.5rem] font-semibold leading-none tracking-tight tabular-nums text-ink sm:text-5xl">
          {formatCurrency(estimate.finalEstimate)}
        </p>
        <p className="mt-2 text-sm text-ink-3">
          Rango {formatCurrency(estimate.finalRange.min)} – {formatCurrency(estimate.finalRange.max)}
        </p>
      </div>

      <p className="mt-4 text-base font-medium text-ink">
        {estimate.input.brand} {estimate.input.model} {estimate.input.year}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Chip>{conditionLabel}</Chip>
        <Chip>{MOTOR_SHORT_LABEL[estimate.vehicleCategory.id]}</Chip>
        <Chip>{estimate.planConfig.label} · {estimate.planConfig.timelineLabel}</Chip>
      </div>

      {/* Efectivo */}
      <div className="mt-6 rounded-2xl border border-line bg-void/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
          Efectivo el día del despacho
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
          {formatCurrency(estimate.cashRequired)}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-4">
          Suma la percepción del IGV ({formatPercentage(estimate.percepcionRate)}): un adelanto que SUNAT devuelve o que descuentas de tu IGV. No es costo.
        </p>
      </div>

      {/* Desglose */}
      <div className="mt-6">
        <button
          type="button"
          aria-expanded={breakdownOpen}
          aria-controls="calc-desglose"
          onClick={onToggleBreakdown}
          className="flex w-full items-center justify-between gap-3 py-1 text-left"
        >
          <span className="text-sm font-semibold text-ink">{breakdownOpen ? "Desglose" : "Ver desglose"}</span>
          <span className="flex items-center gap-2 text-xs text-ink-4">
            Tributos {formatPercentage(tributosShare)} del total
            <Icon
              name="chevronDown"
              size={16}
              className={cn("transition-transform", breakdownOpen && "rotate-180")}
            />
          </span>
        </button>

        {breakdownOpen ? (
          <dl id="calc-desglose" className="mt-2 divide-y divide-line border-t border-line">
            <Line label="Precio en EE.UU." amount={estimate.input.priceMiami} />
            <Line
              label="Flete y seguro"
              amount={estimate.freight + estimate.insurance}
              tooltip={`Flete marítimo Miami → Callao (${formatCurrency(estimate.freight)}) más seguro internacional (${formatCurrency(estimate.insurance)}).`}
            />
            <Group label="Tributos SUNAT" amount={tributos}>
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
              label={`Percepción IGV ${formatPercentage(estimate.percepcionRate)}`}
              amount={estimate.percepcion}
              muted
              tooltip="Adelanto del IGV. Se recupera; no es un costo, pero sí efectivo el día del despacho."
            />
          </dl>
        ) : null}
      </div>

      {/* Origen y VIN */}
      <div className="mt-5 rounded-2xl border border-line bg-surface/60 p-4">
        <p className="text-xs leading-relaxed text-ink-3">{originInfo.reason}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {canToggleOrigin ? (
            <button
              type="button"
              onClick={() => onOriginOverride(estimate.adValoremRate === 0 ? "otro" : "originario-usa")}
              className="text-xs font-semibold text-silver underline underline-offset-2 hover:text-ink"
            >
              {estimate.adValoremRate === 0
                ? "No tengo certificado de origen · recalcular con 6%"
                : "Tengo certificado de origen · recalcular con 0%"}
            </button>
          ) : null}
          {vinHelps || showVin ? (
            <button
              type="button"
              aria-expanded={showVin}
              aria-controls="calc-vin"
              onClick={onToggleVin}
              className="text-xs font-semibold text-silver underline underline-offset-2 hover:text-ink"
            >
              {showVin ? "Ocultar VIN" : "¿Tienes el VIN? Afina el arancel"}
            </button>
          ) : null}
        </div>
        {showVin ? (
          <div id="calc-vin" className="mt-3">
            <label htmlFor="calc-vin-input" className="block text-xs text-ink-2">
              VIN <span className="text-ink-4">(17 caracteres, en la ficha o el parabrisas)</span>
            </label>
            <input
              id="calc-vin-input"
              value={form.vin}
              onChange={onVinChange}
              placeholder="WP1AB2A5XRLB12345"
              maxLength={17}
              autoComplete="off"
              spellCheck={false}
              className="field-lux mt-1.5 font-mono uppercase tracking-wider placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
            />
            <p className="mt-1.5 text-xs text-ink-4">
              El primer carácter dice dónde se fabricó el auto. Solo lo usamos para el ad valorem.
            </p>
          </div>
        ) : null}
      </div>

      {/* Acciones */}
      <div className="mt-6 grid gap-3">
        {whatsappLink ? (
          <Button href={whatsappLink} variant="whatsapp" size="lg" className="w-full">
            Enviar estimado por WhatsApp
          </Button>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={onDownloadPDF} variant="secondary" disabled={isGeneratingPDF} className="w-full">
            <Icon name="download" size={16} />
            {isGeneratingPDF ? "Generando…" : "Descargar PDF"}
          </Button>
          <Button onClick={onReset} variant="ghost" className="w-full border border-line">
            <Icon name="refresh" size={16} />
            Reiniciar
          </Button>
        </div>
        {pdfError ? (
          <p role="alert" className="text-xs text-danger">{pdfError}</p>
        ) : null}
      </div>

      <p className="mt-5 text-xs leading-relaxed text-ink-4">
        Estimado referencial con rango ±{formatPercentage(LUXCARS_CONFIG.services.finalRangeVariance, "es-PE", 1)}. Los tributos son tasas fijas; varían el tipo de cambio y el flete del mes.
      </p>
    </div>
  );
}

/* --- Piezas ----------------------------------------------------------------- */

function Step({
  n,
  title,
  tooltip,
  children,
}: {
  n: number;
  title: string;
  tooltip?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={cn(n > 1 && "mt-8")}>
      <legend className="flex items-center gap-2.5 text-sm font-semibold text-ink">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold tabular-nums text-silver-bright">
          {n}
        </span>
        {title}
        {tooltip ? <Tooltip content={tooltip} /> : null}
      </legend>
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

function Choice({
  on,
  onClick,
  title,
  hint,
  tooltip,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  hint: string;
  tooltip?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      title={tooltip}
      onClick={onClick}
      className={cn(
        "relative min-h-[4.25rem] rounded-2xl border px-4 py-3 text-left transition-colors",
        on
          ? "border-silver bg-surface-3 text-ink shadow-[inset_0_0_0_1px_rgba(192,192,192,0.35)]"
          : "border-line bg-surface text-ink-3 hover:border-line-strong hover:text-ink",
        disabled && "cursor-not-allowed opacity-40 hover:border-line hover:text-ink-3",
      )}
    >
      {on ? (
        <Icon name="check" size={14} className="absolute right-3 top-3 text-silver-bright" />
      ) : null}
      <span className="block pr-5 text-sm font-semibold text-ink">{title}</span>
      <span className="mt-0.5 block text-xs text-ink-4">{hint}</span>
    </button>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm text-ink-2">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-danger">
      <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">
      {children}
    </span>
  );
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

function listInSpanish(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
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
