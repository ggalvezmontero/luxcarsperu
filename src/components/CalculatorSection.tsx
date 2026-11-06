'use client';

import {
  checkAdmissibility,
  inferCondition,
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
import type { OriginInference } from "@/core/pricing/originInference";
import { getTrendingVehicleById } from "@/data/trendingVehicles";
import { LUXCARS_CONFIG, type VehicleTypeId } from "@/lib/config";
import { evaluateQuote } from "@/lib/cotizacion";
import {
  SHARED_QUOTE_PARAM,
  decodeSharedQuote,
  encodeSharedQuote,
  sharedQuotePath,
} from "@/lib/cotizacionCompartida";
import { cn, formatCurrency, formatPercentage, formatRate } from "@/lib/utils";
import {
  buildBlockedCalculatorWhatsappLink,
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
  type ClipboardEvent,
} from "react";
import { BrandModelPicker } from "./BrandModelPicker";
import { Button } from "./Button";
import {
  QuoteBreakdown,
  QuoteChips,
  describeOrigin,
  quoteTaxes,
} from "./cotizacion/QuoteBreakdown";
import { ShareQuoteButton } from "./cotizacion/ShareQuoteButton";
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
   3. No se pide el VIN. Es un dato que el cliente casi nunca tiene a mano. El
      origen (0% o 6% de ad valorem) se sugiere por marca y modelo con la regla
      conservadora del motor de origen, y LuxCars lo verifica con el VIN de la
      unidad antes de comprar. El cliente solo puede afinar una cosa: si el
      vendedor emite certificado de origen.
   4. Los errores se muestran donde se corrigen (bajo el campo) y el panel de
      resultado dice qué falta, en vez de un alerta genérico al final.
   5. El formulario SALE EN EL HTML del servidor. Lo único que depende de la
      URL (`?simular=` y `?c=`) se lee en `UrlPresetReader`, un hijo aparte con
      su propio Suspense. Si `useSearchParams` se llama acá arriba, Next deja
      toda la calculadora fuera del prerender y lo que recibe un buscador es
      "Cargando calculadora…".
   6. Un estimado se comparte con un enlace corto (`/c/<código>`) que lleva
      los datos adentro: ver `lib/cotizacionCompartida.ts`.
   ------------------------------------------------------------------------- */


type FormState = {
  condition: VehicleCondition;
  vehicleType: VehicleTypeId | "";
  brand: string;
  model: string;
  year: string;
  /** Solo dígitos. Se formatea con separadores al mostrarse. */
  price: string;
  preferredPlan: PlanKey;
  /** Solo se llena si el usuario corrige la sugerencia desde el resultado. */
  originOverride: VehicleOrigin | null;
};

const CONDITION_OPTIONS: { id: VehicleCondition; label: string; hint: string }[] = [
  { id: "nuevo", label: "Nuevo", hint: "Sin matricular en EE.UU." },
  { id: "usado", label: "Usado", hint: "Ya matriculado en EE.UU." },
];

/**
 * Opciones de motor que ve el cliente. Híbrido, híbrido enchufable y eléctrico
 * se muestran como UNA sola opción: tributariamente son iguales (ISC 0% nuevo,
 * 40% usado) y solo difieren en unos cientos de dólares de flete base. El motor
 * de cálculo conserva las cinco categorías; al elegir la opción agrupada se
 * cotiza como `hev`, y un preset que llegue como `ev` o `phev` se muestra
 * seleccionado en la misma opción sin perder su categoría.
 */
const MOTOR_OPTIONS: readonly {
  id: string;
  label: string;
  categories: readonly VehicleTypeId[];
  tooltip: string;
}[] = [
  {
    id: "gasolina",
    label: "Gasolina",
    categories: ["gasolina"],
    tooltip: "Nuevo: ISC escalonado por cilindrada (5% hasta 1,400 cc, 7.5% hasta 1,500 cc, 10% por encima). Usado: 40%.",
  },
  {
    id: "electrificado",
    label: "Híbrido o eléctrico",
    categories: ["hev", "phev", "ev"],
    tooltip: "Híbrido, híbrido enchufable o 100% eléctrico. Nuevo: ISC 0% en los tres casos. Usado: 40%.",
  },
  {
    id: "diesel",
    label: "Diésel",
    categories: ["diesel"],
    tooltip: "Nuevo: ISC 20%. Usado: no se puede importar (D. Leg. 843).",
  },
];

const CURRENT_YEAR = new Date().getFullYear();
/**
 * Años modelo que se pueden elegir, del más nuevo al más antiguo. Empieza en
 * el año SIGUIENTE: en EE.UU. el año modelo se adelanta al calendario (desde
 * mediados de año los concesionarios ya venden el modelo del año que viene) y
 * sin esa opción un auto 2027 comprado en 2026 se cotizaba como 2026.
 */
const NEWEST_YEAR = CURRENT_YEAR + 1;
const YEAR_OPTIONS = (() => {
  const oldest = oldestImportableModelYear(CURRENT_YEAR);
  return Array.from({ length: NEWEST_YEAR - oldest + 1 }, (_, i) => NEWEST_YEAR - i);
})();

/** Año con el que termina el nombre de un modelo destacado ("… Raptor 2026"). */
function yearFromName(name: string): string | null {
  const match = /\b(20\d{2})\s*$/.exec(name);
  return match && YEAR_OPTIONS.includes(Number(match[1])) ? match[1] : null;
}

const INITIAL_FORM: FormState = {
  condition: "nuevo",
  vehicleType: "",
  brand: "",
  model: "",
  year: String(CURRENT_YEAR - 1),
  price: "",
  preferredPlan: "fast",
  originOverride: null,
};

/** Lo que Fast Track cuesta por encima de Estándar. Sale del motor, no se escribe acá. */
const FAST_TRACK_EXTRA =
  PRICING_CONFIG.planConfigs.fast.documentHandlingFee -
  PRICING_CONFIG.planConfigs.standard.documentHandlingFee;

const STORAGE_KEY = "luxcars:last-estimate";
const FORM_STORAGE_KEY = "luxcars:form-state";
const RESULT_ID = "calc-resultado";

const onlyDigits = (value: string) => value.replace(/[^0-9]/g, "").slice(0, 8);

/**
 * Dígitos de un precio PEGADO. Descarta los centavos ("$65,000.50",
 * "65000,50"): si no, esos dos dígitos se sumaban al precio y USD 65,000.50
 * se cotizaba como USD 6,500,050. Solo vale para lo que se pega: mientras se
 * escribe, "65,00" es un 65,000 a medio borrar, no un monto con centavos.
 */
const digitsFromPastedPrice = (text: string) =>
  onlyDigits(text.trim().replace(/[.,]\d{1,2}\D*$/, ""));
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

  return evaluateQuote({
    brand: form.brand,
    model: form.model,
    year: form.year,
    priceMiami,
    vehicleType: form.vehicleType as VehicleTypeId,
    condition: form.condition,
    preferredPlan: form.preferredPlan,
    originOverride: form.originOverride,
    currentYear: CURRENT_YEAR,
  });
}

/* --- Lo que llega por la URL ----------------------------------------------- */

/** Lo que puede traer la URL para precargar la calculadora. */
type UrlPreset = {
  /** `?simular=<id>`: un modelo de "más buscados". */
  simular: string | null;
  /** `?c=<código>`: un estimado compartido. */
  compartido: string | null;
};

const SIN_PRESET: UrlPreset = { simular: null, compartido: null };

/**
 * Lee los parámetros de la URL y se los pasa a la calculadora. No pinta nada.
 *
 * Vive aparte, dentro de su propio Suspense, porque `useSearchParams` saca del
 * prerender a todo lo que tenga alrededor hasta el Suspense más cercano.
 */
function UrlPresetReader({ onPreset }: { onPreset: (preset: UrlPreset) => void }) {
  const searchParams = useSearchParams();
  const simular = searchParams.get("simular");
  const compartido = searchParams.get(SHARED_QUOTE_PARAM);
  useEffect(() => {
    onPreset({ simular, compartido });
  }, [simular, compartido, onPreset]);
  return null;
}

/* --- Componente ------------------------------------------------------------ */

export function CalculatorSection() {
  const router = useRouter();
  const [urlPreset, setUrlPreset] = useState<UrlPreset>(SIN_PRESET);

  // El primer render TIENE que coincidir con el del servidor: arranca en
  // INITIAL_FORM y lo guardado se aplica después de montar.
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [hydrated, setHydrated] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [resultInView, setResultInView] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  // Sube cada vez que el formulario se reemplaza entero (lo guardado, un
  // preset, un reinicio). El selector de marca y modelo decide al montarse si
  // muestra una lista o el campo de texto de "Otra…"; con esto se vuelve a
  // montar y decide con los datos nuevos. Sin esto, un modelo fuera de
  // catálogo llegado por preset perdía su campo de texto al borrarlo.
  const [pickerEpoch, setPickerEpoch] = useState(0);
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
    setPickerEpoch((n) => n + 1);
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

  /* Publicar el estimado para el formulario de contacto, y RETIRARLO cuando
     deja de valer (datos incompletos, auto que no entra, reinicio). Si no se
     retira, el contacto sigue adjuntando el estimado anterior: por ejemplo el
     de un diésel nuevo después de cambiarlo a usado, que no se puede importar. */
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (estimate) {
        const payload = { estimate, timestamp: Date.now(), preferredPlan: estimate.planKey };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent(STORAGE_KEY, { detail: payload }));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new CustomEvent(STORAGE_KEY, { detail: null }));
      }
    } catch (err) {
      console.warn("No se pudo guardar el cálculo localmente", err);
    }
  }, [estimate, hydrated]);

  /* Preset desde "más buscados": /?simular=<id>#calculator */
  const simularPresetId = urlPreset.simular;
  useEffect(() => {
    if (!simularPresetId) return;
    const preset = getTrendingVehicleById(simularPresetId);
    if (!preset) return;
    const c = preset.calculator;
    // El año es el que anuncia la tarjeta ("… Raptor 2026"), no uno fijo.
    const year = yearFromName(preset.name) ?? String(CURRENT_YEAR);
    setForm({
      condition: inferCondition(year, CURRENT_YEAR),
      vehicleType: c.vehicleType,
      brand: c.brand,
      model: c.model,
      year,
      price: onlyDigits(String(Math.round(c.priceUsd))),
      preferredPlan: c.preferredPlan ?? "fast",
      originOverride: null,
    });
    setPickerEpoch((n) => n + 1);
    setPriceTouched(true);
    requestAnimationFrame(() => {
      document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [simularPresetId]);

  /* Estimado compartido: /?c=<código>#calculator abre la calculadora con los
     mismos datos y el desglose a la vista, para ajustarlos. */
  const sharedPresetCode = urlPreset.compartido;
  useEffect(() => {
    if (!sharedPresetCode) return;
    const shared = decodeSharedQuote(sharedPresetCode);
    if (!shared) return;
    setForm({
      condition: shared.condition,
      vehicleType: shared.vehicleType,
      brand: shared.brand,
      model: shared.model,
      year: String(shared.year),
      price: onlyDigits(String(shared.price)),
      preferredPlan: shared.plan,
      originOverride: shared.origin,
    });
    setPickerEpoch((n) => n + 1);
    setPriceTouched(true);
    setBreakdownOpen(true);
    requestAnimationFrame(() => {
      document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [sharedPresetCode]);

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

  const handlePrice = (event: ChangeEvent<HTMLInputElement>) => {
    patch({ price: onlyDigits(event.target.value) });
  };

  const handlePricePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const digits = digitsFromPastedPrice(event.clipboardData.getData("text"));
    if (!digits) return;
    event.preventDefault();
    patch({ price: digits });
  };

  const handleReset = () => {
    setForm(INITIAL_FORM);
    setPickerEpoch((n) => n + 1);
    setPriceTouched(false);
    setBreakdownOpen(false);
    setPdfError(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(FORM_STORAGE_KEY);
    } catch (err) {
      console.warn("No se pudo limpiar el cálculo guardado", err);
    }
    if (simularPresetId || sharedPresetCode) router.replace("/#calculator", { scroll: false });
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

  /* Código del enlace corto. Sale de los mismos datos que produjeron el
     estimado, así que abrirlo da exactamente este resultado. */
  const shareCode = useMemo(() => {
    if (!estimate) return null;
    return encodeSharedQuote({
      condition: estimate.condition,
      vehicleType: estimate.input.vehicleType,
      brand: estimate.input.brand,
      model: estimate.input.model,
      year: Number(estimate.input.year),
      price: Math.round(estimate.input.priceMiami),
      plan: estimate.planKey,
      origin: form.originOverride,
    });
  }, [estimate, form.originOverride]);

  // El mensaje de WhatsApp lleva el enlace del estimado: el asesor abre el
  // mismo desglose que vio el cliente en vez de reconstruirlo del texto.
  const whatsappLink = useMemo(
    () =>
      estimate
        ? buildWhatsappLink(estimate, {
            preferredPlan: estimate.planKey,
            detailUrl: shareCode ? `${window.location.origin}${sharedQuotePath(shareCode)}` : undefined,
          })
        : null,
    [estimate, shareCode],
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

  /* Auto que no se puede cotizar (precio bajo el mínimo, diésel usado, muy
     antiguo): el mensaje lleva lo que el cliente SÍ escribió y el motivo. */
  const blockedLink = useMemo(() => {
    if (evaluation.kind !== "blocked") return null;
    const category = VEHICLE_CATEGORIES.find((c) => c.id === form.vehicleType);
    return buildBlockedCalculatorWhatsappLink({
      vehicleTypeLabel: category?.label,
      conditionLabel: form.condition === "usado" ? "Usado" : "Nuevo",
      brand: form.brand,
      model: form.model,
      year: form.year,
      priceUsd: priceValue > 0 ? priceValue : null,
      reason: evaluation.reason,
    });
  }, [evaluation, form.vehicleType, form.condition, form.brand, form.model, form.year, priceValue]);

  const plans = [
    { key: "fast" as const, ...LUXCARS_CONFIG.deliveryWindows.fastTrack },
    { key: "standard" as const, ...LUXCARS_CONFIG.deliveryWindows.standard },
  ];

  return (
    <Section id="calculator" tone="surface">
      <Suspense fallback={null}>
        <UrlPresetReader onPreset={setUrlPreset} />
      </Suspense>
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
            <div role="group" aria-label="Tipo de motor" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {MOTOR_OPTIONS.map((option) => {
                const representative = VEHICLE_CATEGORIES.find((c) => c.id === option.categories[0]);
                const rate = representative
                  ? resolveIscRate({ category: representative, condition: form.condition })
                  : null;
                const blocked = rate === null;
                const on = form.vehicleType !== "" && option.categories.includes(form.vehicleType);
                return (
                  <Choice
                    key={option.id}
                    on={on}
                    disabled={blocked}
                    // Si ya está dentro del grupo (p. ej. un preset `ev`), no se pisa.
                    onClick={() => (on ? undefined : patch({ vehicleType: option.categories[0] }))}
                    title={option.label}
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
              <BrandModelPicker
                key={pickerEpoch}
                idPrefix="calc"
                brand={form.brand}
                model={form.model}
                // Cambiar el auto invalida la corrección manual del origen.
                onChange={({ brand, model }) => patch({ brand, model, originOverride: null })}
                renderField={Field}
              />
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
                    : "Nuevos: del año en curso, el siguiente o el anterior."}
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
                    onPaste={handlePricePaste}
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
                  hint={
                    plan.key === "fast" && FAST_TRACK_EXTRA > 0
                      ? `${plan.days[0]}–${plan.days[1]} días · +${formatCurrency(FAST_TRACK_EXTRA)}`
                      : `${plan.days[0]}–${plan.days[1]} días`
                  }
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
            breakdownOpen={breakdownOpen}
            onToggleBreakdown={() => setBreakdownOpen((v) => !v)}
            onOriginOverride={(next) => patch({ originOverride: next })}
            whatsappLink={whatsappLink}
            adviceLink={blockedLink ?? adviceLink}
            shareCode={shareCode}
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
  breakdownOpen: boolean;
  onToggleBreakdown: () => void;
  onOriginOverride: (next: VehicleOrigin) => void;
  whatsappLink: string | null;
  adviceLink: string;
  /** Código del enlace corto; `null` si el estimado no se puede compartir. */
  shareCode: string | null;
  onDownloadPDF: () => void;
  isGeneratingPDF: boolean;
  pdfError: string | null;
  onReset: () => void;
};

function ResultPanel({
  evaluation,
  estimate,
  originInfo,
  breakdownOpen,
  onToggleBreakdown,
  onOriginOverride,
  whatsappLink,
  adviceLink,
  shareCode,
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

  const tributosShare = estimate.finalEstimate > 0 ? quoteTaxes(estimate) / estimate.finalEstimate : 0;
  const vehicleName = `${estimate.input.brand} ${estimate.input.model} ${estimate.input.year}`;
  // Un usado paga 6% haga lo que haga el certificado: no hay nada que corregir.
  const canToggleOrigin =
    estimate.condition === "nuevo" &&
    (originInfo.mayQualifyWithCertificate || estimate.adValoremRate === 0);

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

      <p className="mt-4 text-base font-medium text-ink">{vehicleName}</p>
      <div className="mt-2">
        <QuoteChips estimate={estimate} />
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
          Suma la percepción del IGV ({formatRate(estimate.percepcionRate)}): un adelanto que SUNAT devuelve o que descuentas de tu IGV. No es costo.
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
          <QuoteBreakdown estimate={estimate} id="calc-desglose" className="mt-2" />
        ) : null}
      </div>

      {/* Origen */}
      <div className="mt-5 rounded-2xl border border-line bg-surface/60 p-4">
        <p className="text-xs leading-relaxed text-ink-3">
          {describeOrigin(originInfo, estimate)}
        </p>
        {canToggleOrigin ? (
          <button
            type="button"
            onClick={() => onOriginOverride(estimate.adValoremRate === 0 ? "otro" : "originario-usa")}
            className="mt-2 text-xs font-semibold text-silver underline underline-offset-2 hover:text-ink"
          >
            {estimate.adValoremRate === 0
              ? "No tengo certificado de origen · recalcular con 6%"
              : "Tengo certificado de origen · recalcular con 0%"}
          </button>
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
          {shareCode ? (
            <ShareQuoteButton
              code={shareCode}
              title={`${vehicleName} puesto en Lima`}
              text={`${vehicleName} importado, puesto en Lima con placas: ${formatCurrency(estimate.finalEstimate)}. Mira el desglose:`}
            />
          ) : null}
          <Button
            onClick={onDownloadPDF}
            variant="secondary"
            disabled={isGeneratingPDF}
            className={cn("w-full", !shareCode && "col-span-2")}
          >
            <Icon name="download" size={16} />
            {isGeneratingPDF ? "Generando…" : "Descargar PDF"}
          </Button>
        </div>
        <Button onClick={onReset} variant="ghost" size="sm" className="w-full border border-line">
          <Icon name="refresh" size={14} />
          Reiniciar
        </Button>
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

function listInSpanish(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}
