"use client";

/**
 * Pedido de búsqueda: "quiero un auto que no tienen". Escribe en
 * `solicitudes_compra` con la sesión del cliente; RLS fija `user_id` y el
 * estado inicial.
 */

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BrandModelPicker } from "@/components/BrandModelPicker";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { AvisoCuentaSuspendida } from "@/components/cuenta/CuentaScreen";
import { useCuentaSession } from "@/components/cuenta/cuentaSession";
import { SinCuentas } from "@/components/cuenta/SinCuentas";
import {
  PURCHASE_CONDITION_LABEL,
  createPurchaseRequest,
} from "@/lib/cuenta/solicitudes";
import { PURCHASE_REQUEST_CONDITIONS, type PurchaseRequestCondition } from "@/lib/db/types";
import { aniosDesde } from "@/lib/opcionesVehiculo";
import { cn } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_MIN = 1980;
/** Del año modelo siguiente (en EE.UU. se adelanta al calendario) hacia atrás. */
const ANIOS = aniosDesde(CURRENT_YEAR + 1, YEAR_MIN);
const YEAR_MAX = 2100;
const digits = (v: string) => v.replace(/[^0-9]/g, "");

/**
 * Deja solo los dígitos de un monto, pero antes quita una parte decimal final
 * (`.` o `,` seguido de 1 o 2 dígitos al final): sin eso, pegar "65,000.50"
 * dejaba 6500050. Con 3 dígitos después del separador ("65,000", "65.000") es
 * un separador de miles y se conserva.
 */
const amountDigits = (v: string) => digits(v.trim().replace(/[.,]\d{1,2}$/, ""));

export function SolicitudCompraForm() {
  const router = useRouter();
  const { status, userId, client, profile } = useCuentaSession();

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [condition, setCondition] = useState<PurchaseRequestCondition>("indistinto");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "anonimo") router.replace("/cuenta/login?next=/cuenta/comprar&modo=registro");
  }, [status, router]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!brand.trim() || !model.trim()) {
      setError("Dinos al menos la marca y el modelo.");
      return;
    }
    // Vacío = sin filtro. Ojo: "0" es un texto no vacío y `Number("0")` es 0,
    // que es falso: por eso se compara contra "" y no por veracidad.
    const yMin = yearMin === "" ? null : Number(yearMin);
    const yMax = yearMax === "" ? null : Number(yearMax);
    const yearOk = (y: number | null) =>
      y === null || (Number.isInteger(y) && y >= YEAR_MIN && y <= YEAR_MAX);
    if (!yearOk(yMin) || !yearOk(yMax)) {
      setError(`Revisa los años: deben estar entre ${YEAR_MIN} y ${YEAR_MAX}.`);
      return;
    }
    if (yMin !== null && yMax !== null && yMin > yMax) {
      setError("El año 'desde' no puede ser mayor que el 'hasta'.");
      return;
    }
    if (!client || !userId) {
      setError("No hay sesión activa. Vuelve a ingresar.");
      return;
    }
    setSubmitting(true);
    const result = await createPurchaseRequest(client, userId, {
      brand,
      model,
      yearMin: yMin,
      yearMax: yMax,
      condition,
      budgetMaxUsd: budget ? Number(amountDigits(budget)) : null,
      notes,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace("/cuenta?enviada=compra");
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

  return (
    <Section tone="bg" padding="tight">
      <div className="mx-auto max-w-2xl">
        <SectionHeader
          eyebrow="Búsqueda a pedido"
          title="¿Qué auto quieres?"
          description="Lo buscamos en Estados Unidos o en Lima y te proponemos opciones con el costo real puesto en tu puerta. Sin compromiso."
        />

        <form onSubmit={onSubmit} noValidate className="mt-8 rounded-[22px] border border-line bg-surface p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <BrandModelPicker
              idPrefix="sc"
              brand={brand}
              model={model}
              onChange={(next) => {
                setBrand(next.brand);
                setModel(next.model);
              }}
              renderField={Field}
            />
            <Field label="Año desde" htmlFor="sc-anio-min" hint="Opcional">
              <select id="sc-anio-min" value={yearMin} onChange={(e) => setYearMin(e.target.value)} className="field-lux tabular-nums">
                <option value="">Cualquiera</option>
                {ANIOS.map((anio) => (
                  <option key={anio} value={anio}>{anio}</option>
                ))}
              </select>
            </Field>
            <Field label="Año hasta" htmlFor="sc-anio-max" hint="Opcional">
              <select id="sc-anio-max" value={yearMax} onChange={(e) => setYearMax(e.target.value)} className="field-lux tabular-nums">
                <option value="">Cualquiera</option>
                {ANIOS.map((anio) => (
                  <option key={anio} value={anio}>{anio}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <span id="sc-cond-label" className="block text-sm text-ink-2">Condición</span>
              <div role="group" aria-labelledby="sc-cond-label" className="mt-1.5 grid grid-cols-3 gap-2">
                {PURCHASE_REQUEST_CONDITIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={condition === c}
                    onClick={() => setCondition(c)}
                    className={cn(
                      "field-lux flex items-center justify-center text-sm font-semibold transition-colors",
                      condition === c ? "!border-silver !bg-surface-3 text-ink" : "text-ink-3 hover:text-ink",
                    )}
                  >
                    {PURCHASE_CONDITION_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Presupuesto máximo" htmlFor="sc-presupuesto" hint="Puesto en Lima, con placas. Opcional.">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-semibold text-ink-4">USD</span>
                <input
                  id="sc-presupuesto"
                  inputMode="numeric"
                  value={budget ? Number(digits(budget)).toLocaleString("en-US") : ""}
                  // El campo muestra comas de miles, así que en `onChange` un
                  // ",50" puede ser un dígito borrado ("1,234" → "1,23"): solo
                  // se descarta el decimal con punto. La regla completa (coma
                  // o punto) corre al PEGAR, donde el texto viene de afuera.
                  onChange={(e) => setBudget(digits(e.target.value.replace(/\.\d{1,2}$/, "")).slice(0, 8))}
                  onPaste={(e) => {
                    e.preventDefault();
                    setBudget(amountDigits(e.clipboardData.getData("text")).slice(0, 8));
                  }}
                  placeholder="120,000"
                  className="field-lux pl-14 tabular-nums"
                />
              </div>
            </Field>
            <Field label="Detalles" htmlFor="sc-notas" hint="Color, versión, equipamiento, urgencia… lo que nos ayude a acertar." className="sm:col-span-2">
              <textarea id="sc-notas" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className="field-lux min-h-28 resize-y" placeholder="Ej. Lo quiero blanco o gris, con techo panorámico, para antes de diciembre." />
            </Field>
          </div>

          {error ? (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" variant="accent" size="lg" disabled={submitting || status !== "autenticado"}>
              {submitting ? "Enviando…" : "Enviar pedido"}
            </Button>
            <p className="text-xs text-ink-4 sm:max-w-xs">Te respondemos por WhatsApp. Verás el avance en tu cuenta.</p>
          </div>
        </form>
      </div>
    </Section>
  );
}

function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm text-ink-2">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-ink-4">{hint}</p> : null}
    </div>
  );
}
