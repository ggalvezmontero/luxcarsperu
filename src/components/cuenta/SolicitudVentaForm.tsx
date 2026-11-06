"use client";

/**
 * "Quiero vender mi auto": el cliente lo registra y queda PENDIENTE hasta que
 * un administrador lo apruebe desde el portal. Recién ahí se publica.
 *
 * No se piden fotos acá: el bucket público no es lugar para documentos y las
 * fotos las coordina el equipo por WhatsApp al aprobar. No se pide VIN.
 *
 * CÓMO ESTÁ ARMADO EL FORMULARIO
 *   · Tres pasos numerados (el auto, su estado, precio y contacto), con el
 *     mismo lenguaje que la calculadora: se entiende de un vistazo cuánto falta.
 *   · Marca y modelo salen del catálogo (con "Otra…"), el año es una lista y el
 *     motor y la condición son botones: casi nada se escribe a mano, así que
 *     casi nada puede quedar mal escrito.
 *   · Cada error aparece bajo su campo y el foco va al primero, en vez de un
 *     aviso genérico al final.
 *   · En escritorio, la columna de la izquierda explica qué pasa después y
 *     muestra cómo va quedando la publicación.
 */

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BrandModelPicker } from "@/components/BrandModelPicker";
import { Button } from "@/components/Button";
import { PhoneInput } from "@/components/PhoneInput";
import { Icon } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";
import { AvisoCuentaSuspendida } from "@/components/cuenta/CuentaScreen";
import { useCuentaSession } from "@/components/cuenta/cuentaSession";
import { SinCuentas } from "@/components/cuenta/SinCuentas";
import { DECLARED_CONDITIONS, createSaleRequest } from "@/lib/cuenta/solicitudes";
import { VEHICLE_CATEGORIES } from "@/core/pricing/vehicleCategories";
import type { Currency, VehicleCategoryId } from "@/lib/db/types";
import { CATEGORY_LABEL } from "@/lib/stockLabels";
import { errorDeTelefono } from "@/lib/telefono";
import { cn } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();
/** Del modelo del año que viene hacia atrás. La base acepta desde 1980. */
const YEARS = Array.from({ length: CURRENT_YEAR + 1 - 1980 + 1 }, (_, i) => CURRENT_YEAR + 1 - i);

const DESCRIPTION_MAX = 2000;
const digits = (v: string) => v.replace(/[^0-9]/g, "");
const withCommas = (v: string) => (v ? Number(digits(v)).toLocaleString("en-US") : "");

const CURRENCIES: { id: Currency; label: string }[] = [
  { id: "USD", label: "USD" },
  { id: "PEN", label: "S/" },
];

/** Campos que pueden llevar un error propio. El valor es el `id` a enfocar. */
const FIELD_IDS = {
  brand: "sv-brand",
  model: "sv-model",
  year: "sv-anio",
  mileage: "sv-km",
  price: "sv-precio",
  phone: "sv-telefono",
} as const;
type FieldName = keyof typeof FIELD_IDS;
type Errors = Partial<Record<FieldName, string>>;

const NEXT_STEPS = [
  { title: "Lo revisamos", text: "Un asesor mira tu solicitud y te escribe para ver documentos y pedirte fotos." },
  { title: "Lo publicamos", text: "Si encaja, sale en la web marcado como consignación, con el precio que acordemos." },
  { title: "Sigues manejándolo", text: "Sin exclusividad: si lo vendes por tu cuenta, no pagas comisión." },
];

export function SolicitudVentaForm() {
  const router = useRouter();
  const { status, userId, client, profile } = useCuentaSession();

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [trim, setTrim] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState<VehicleCategoryId>("gasolina");
  const [mileage, setMileage] = useState("");
  const [color, setColor] = useState("");
  const [plate, setPlate] = useState("");
  const [declared, setDeclared] = useState<string>(DECLARED_CONDITIONS[1]);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  // `null` = el cliente no lo tocó: se muestra el WhatsApp de su perfil.
  const [phone, setPhone] = useState<string | null>(null);
  const phoneValue = phone ?? profile?.phone ?? "";
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "anonimo") router.replace("/cuenta/login?next=/cuenta/vender&modo=registro");
  }, [status, router]);

  /** Quita el error de un campo en cuanto el cliente lo corrige. */
  const clear = (field: FieldName) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const km = Number(digits(mileage));
    const p = Number(digits(price));
    const found: Errors = {};
    if (!brand.trim()) found.brand = "Elige la marca.";
    if (!model.trim()) found.model = "Elige el modelo.";
    if (!year) found.year = "Elige el año.";
    if (!mileage) found.mileage = "Indica el kilometraje aproximado.";
    if (!price || p <= 0) found.price = "Indica el precio que pides.";
    const phoneError = errorDeTelefono(phoneValue);
    if (phoneError) found.phone = phoneError;

    setErrors(found);
    const first = (Object.keys(FIELD_IDS) as FieldName[]).find((field) => found[field]);
    if (first) {
      // Después de pintar los errores: así el foco no se pierde con el render.
      requestAnimationFrame(() => document.getElementById(FIELD_IDS[first])?.focus());
      return;
    }
    if (!client || !userId) return setError("No hay sesión activa. Vuelve a ingresar.");

    setSubmitting(true);
    const result = await createSaleRequest(client, userId, {
      brand,
      model,
      trim,
      year: Number(year),
      category,
      mileageKm: km,
      color,
      plate,
      declaredCondition: declared,
      description,
      askingPrice: p,
      currency,
      contactPhone: phoneValue,
    });
    setSubmitting(false);
    if (!result.ok) return setError(result.message);
    router.replace("/cuenta?enviada=venta");
  };

  if (status === "sin-configurar") return <SinCuentas />;

  if (profile && !profile.active) {
    return (
      <Section tone="bg" padding="tight">
        <div className="mx-auto max-w-2xl">
          <AvisoCuentaSuspendida />
        </div>
      </Section>
    );
  }

  const vehicleName = [brand, model, trim, year].map((part) => part.trim()).filter(Boolean).join(" ");
  const currencyLabel = CURRENCIES.find((c) => c.id === currency)?.label ?? currency;

  return (
    <Section tone="bg" padding="tight">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-12 lg:gap-10">
        {/* ============ Qué es esto y qué pasa después ============ */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-[calc(var(--lux-nav-h)+1.5rem)]">
            <p className="eyebrow">Consignación sin exclusividad</p>
            <h1 className="mt-3 text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-4xl">
              Registra tu auto
            </h1>
            <p className="mt-4 text-pretty text-base leading-relaxed text-ink-2">
              Dos minutos. Lo revisamos y, si encaja, lo publicamos en la web. Tú lo sigues usando.
            </p>

            <ol className="mt-8 grid gap-5">
              {NEXT_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs font-semibold tabular-nums text-silver-bright">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{step.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-3">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            {/* Cómo va quedando: solo en escritorio, donde hay sitio. */}
            <div aria-live="polite" className="mt-8 hidden rounded-2xl border border-line bg-surface p-5 lg:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">Tu publicación</p>
              <p className="mt-2 text-base font-semibold leading-snug text-ink">
                {vehicleName || "Tu auto"}
              </p>
              <p className="mt-1 text-sm text-ink-3">
                {mileage ? `${withCommas(mileage)} km · ` : ""}
                {CATEGORY_LABEL[category]}
                {declared ? ` · ${declared.split("·")[0].trim()}` : ""}
              </p>
              <p className="mt-3 text-xl font-semibold tabular-nums tracking-tight text-ink">
                {price ? `${currencyLabel} ${withCommas(price)}` : <span className="text-ink-4">Precio por definir</span>}
              </p>
            </div>
          </div>
        </aside>

        {/* ============================ Formulario ============================ */}
        <form
          onSubmit={onSubmit}
          noValidate
          aria-label="Datos del auto que quieres vender"
          className="rounded-[22px] border border-line bg-surface p-5 sm:p-8 lg:col-span-8"
        >
          {/* 1 · El auto */}
          <Step n={1} title="Tu auto">
            <div className="grid gap-4 sm:grid-cols-2">
              <BrandModelPicker
                idPrefix="sv"
                brand={brand}
                model={model}
                onChange={(next) => {
                  setBrand(next.brand);
                  setModel(next.model);
                  clear("brand");
                  clear("model");
                }}
                renderField={Field}
                brandError={errors.brand}
                modelError={errors.model}
              />
              <Field label="Versión" htmlFor="sv-version" optional>
                <input id="sv-version" value={trim} onChange={(e) => setTrim(e.target.value)} maxLength={120} placeholder="Ej. xDrive40i M Sport" className="field-lux" />
              </Field>
              <Field label="Año" htmlFor={FIELD_IDS.year} error={errors.year}>
                <select
                  id={FIELD_IDS.year}
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    clear("year");
                  }}
                  aria-invalid={Boolean(errors.year) || undefined}
                  className="field-lux select-lux tabular-nums"
                >
                  <option value="">Selecciona el año</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <span id="sv-motor-label" className="block text-sm text-ink-2">Motor</span>
              <div role="group" aria-labelledby="sv-motor-label" className="mt-1.5 flex flex-wrap gap-2">
                {VEHICLE_CATEGORIES.map((c) => (
                  <Pill key={c.id} on={category === c.id} onClick={() => setCategory(c.id)}>
                    {CATEGORY_LABEL[c.id]}
                  </Pill>
                ))}
              </div>
            </div>
          </Step>

          {/* 2 · Su estado */}
          <Step n={2} title="Su estado">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kilometraje" htmlFor={FIELD_IDS.mileage} error={errors.mileage}>
                <div className="relative">
                  <input
                    id={FIELD_IDS.mileage}
                    inputMode="numeric"
                    autoComplete="off"
                    value={withCommas(mileage)}
                    onChange={(e) => {
                      setMileage(digits(e.target.value).slice(0, 7));
                      clear("mileage");
                    }}
                    aria-invalid={Boolean(errors.mileage) || undefined}
                    placeholder="48,000"
                    className="field-lux pr-12 tabular-nums"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-4">km</span>
                </div>
              </Field>
              <Field label="Color" htmlFor="sv-color" optional>
                <input id="sv-color" value={color} onChange={(e) => setColor(e.target.value)} maxLength={60} placeholder="Ej. Azul" className="field-lux" />
              </Field>
            </div>

            <div className="mt-4">
              <span id="sv-condicion-label" className="block text-sm text-ink-2">¿Cómo está?</span>
              <div role="group" aria-labelledby="sv-condicion-label" className="mt-1.5 grid gap-2 sm:grid-cols-2">
                {DECLARED_CONDITIONS.map((option) => {
                  const [title, hint] = option.split("·").map((part) => part.trim());
                  const on = declared === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDeclared(option)}
                      className={cn(
                        "relative rounded-2xl border px-4 py-3 text-left transition-colors",
                        on
                          ? "border-silver bg-surface-3 shadow-[inset_0_0_0_1px_rgba(192,192,192,0.35)]"
                          : "border-line bg-bg hover:border-line-strong",
                      )}
                    >
                      {on ? <Icon name="check" size={14} className="absolute right-3 top-3 text-silver-bright" /> : null}
                      <span className="block pr-5 text-sm font-semibold text-ink">{title}</span>
                      {hint ? <span className="mt-0.5 block text-xs text-ink-4">{hint}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Placa" htmlFor="sv-placa" optional hint="No se publica. Nos sirve para revisar el historial.">
                <input id="sv-placa" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase().slice(0, 12))} autoComplete="off" placeholder="ABC-123" className="field-lux font-mono uppercase" />
              </Field>
            </div>

            <Field
              label="Cuéntanos del auto"
              htmlFor="sv-descripcion"
              optional
              hint="Historial, mantenimientos, extras. Este texto sale en la ficha pública."
              aside={`${description.length}/${DESCRIPTION_MAX}`}
              className="mt-4"
            >
              <textarea
                id="sv-descripcion"
                rows={4}
                maxLength={DESCRIPTION_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="field-lux min-h-28 resize-y"
                placeholder="Ej. Único dueño, mantenimientos en concesionario, llantas nuevas."
              />
            </Field>
          </Step>

          {/* 3 · Precio y contacto */}
          <Step n={3} title="Precio y contacto">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Precio que pides"
                htmlFor={FIELD_IDS.price}
                error={errors.price}
                hint="Es el precio de publicación. Si conviene ajustarlo, lo vemos contigo."
              >
                <div className="flex gap-2">
                  <div role="group" aria-label="Moneda" className="flex shrink-0 rounded-[var(--radius-lux)] border border-line-strong bg-surface-2 p-1">
                    {CURRENCIES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={currency === option.id}
                        onClick={() => setCurrency(option.id)}
                        className={cn(
                          "min-w-12 rounded-[calc(var(--radius-lux)-4px)] px-3 text-sm font-semibold transition-colors",
                          currency === option.id ? "bg-ink text-void" : "text-ink-3 hover:text-ink",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <input
                    id={FIELD_IDS.price}
                    inputMode="numeric"
                    autoComplete="off"
                    value={withCommas(price)}
                    onChange={(e) => {
                      setPrice(digits(e.target.value).slice(0, 9));
                      clear("price");
                    }}
                    aria-invalid={Boolean(errors.price) || undefined}
                    placeholder="59,900"
                    className="field-lux min-w-0 tabular-nums"
                  />
                </div>
              </Field>
              <Field
                label="WhatsApp de contacto"
                htmlFor={FIELD_IDS.phone}
                error={errors.phone}
                hint="Ahí te escribimos para coordinar la revisión."
              >
                <PhoneInput
                  id={FIELD_IDS.phone}
                  value={phoneValue}
                  onChange={(value) => {
                    setPhone(value);
                    clear("phone");
                  }}
                  invalid={Boolean(errors.phone)}
                />
              </Field>
            </div>
          </Step>

          {error ? (
            <p role="alert" className="mt-6 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" variant="accent" size="lg" disabled={submitting || status !== "autenticado"} className="w-full sm:w-auto">
              {submitting ? "Enviando…" : "Enviar para revisión"}
            </Button>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-4 sm:max-w-xs">
              <Icon name="shield" size={14} className="mt-0.5 shrink-0" />
              Nada se publica hasta que un asesor lo apruebe.
            </p>
          </div>
        </form>
      </div>
    </Section>
  );
}

/* --- Piezas ----------------------------------------------------------------- */

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className={cn(n > 1 && "mt-8 border-t border-line pt-8")}>
      <legend className="float-left mb-4 flex w-full items-center gap-2.5 text-sm font-semibold text-ink">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold tabular-nums text-silver-bright">
          {n}
        </span>
        {title}
      </legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
        on
          ? "border-silver bg-surface-3 text-ink shadow-[inset_0_0_0_1px_rgba(192,192,192,0.35)]"
          : "border-line bg-bg text-ink-3 hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  aside,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  /** Texto pequeño a la derecha de la etiqueta (un contador, por ejemplo). */
  aside?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="block text-sm text-ink-2">
          {label}
          {optional ? <span className="ml-1.5 text-xs text-ink-4">Opcional</span> : null}
        </label>
        {aside ? <span className="text-xs tabular-nums text-ink-4">{aside}</span> : null}
      </div>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-danger">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-ink-4">{hint}</p>
      ) : null}
    </div>
  );
}
