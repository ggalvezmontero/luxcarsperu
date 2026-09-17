"use client";

/**
 * Pedido de búsqueda: "quiero un auto que no tienen". Escribe en
 * `solicitudes_compra` con la sesión del cliente; RLS fija `user_id` y el
 * estado inicial.
 */

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { useCuentaSession } from "@/components/cuenta/cuentaSession";
import { SinCuentas } from "@/components/cuenta/SinCuentas";
import {
  PURCHASE_CONDITION_LABEL,
  createPurchaseRequest,
} from "@/lib/cuenta/solicitudes";
import { PURCHASE_REQUEST_CONDITIONS, type PurchaseRequestCondition } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();
const digits = (v: string) => v.replace(/[^0-9]/g, "");

export function SolicitudCompraForm() {
  const router = useRouter();
  const { status, userId, client } = useCuentaSession();

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
    const yMin = yearMin ? Number(yearMin) : null;
    const yMax = yearMax ? Number(yearMax) : null;
    if ((yMin && (yMin < 1980 || yMin > CURRENT_YEAR + 1)) || (yMax && (yMax < 1980 || yMax > CURRENT_YEAR + 1))) {
      setError("Revisa los años.");
      return;
    }
    if (yMin && yMax && yMin > yMax) {
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
      budgetMaxUsd: budget ? Number(digits(budget)) : null,
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
            <Field label="Marca" htmlFor="sc-marca">
              <input id="sc-marca" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ej. Porsche" autoCapitalize="words" className="field-lux" />
            </Field>
            <Field label="Modelo" htmlFor="sc-modelo">
              <input id="sc-modelo" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ej. Macan S" autoCapitalize="words" className="field-lux" />
            </Field>
            <Field label="Año desde" htmlFor="sc-anio-min" hint="Opcional">
              <input id="sc-anio-min" inputMode="numeric" value={yearMin} onChange={(e) => setYearMin(digits(e.target.value).slice(0, 4))} placeholder={String(CURRENT_YEAR - 3)} className="field-lux tabular-nums" />
            </Field>
            <Field label="Año hasta" htmlFor="sc-anio-max" hint="Opcional">
              <input id="sc-anio-max" inputMode="numeric" value={yearMax} onChange={(e) => setYearMax(digits(e.target.value).slice(0, 4))} placeholder={String(CURRENT_YEAR)} className="field-lux tabular-nums" />
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
                  onChange={(e) => setBudget(digits(e.target.value).slice(0, 8))}
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
