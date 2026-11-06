"use client";

/**
 * "Quiero vender mi auto": el cliente lo registra y queda PENDIENTE hasta que
 * un administrador lo apruebe desde el portal. Recién ahí se publica.
 *
 * No se piden fotos acá: el bucket público no es lugar para documentos y las
 * fotos las coordina el equipo por WhatsApp al aprobar. No se pide VIN.
 */

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { useCuentaSession } from "@/components/cuenta/cuentaSession";
import { SinCuentas } from "@/components/cuenta/SinCuentas";
import { DECLARED_CONDITIONS, createSaleRequest } from "@/lib/cuenta/solicitudes";
import { VEHICLE_CATEGORIES } from "@/core/pricing/vehicleCategories";
import type { Currency, VehicleCategoryId } from "@/lib/db/types";
import { CATEGORY_LABEL } from "@/lib/stockLabels";
import { cn } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();
const digits = (v: string) => v.replace(/[^0-9]/g, "");

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "anonimo") router.replace("/cuenta/login?next=/cuenta/vender&modo=registro");
  }, [status, router]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const y = Number(year);
    const km = Number(digits(mileage));
    const p = Number(digits(price));
    if (!brand.trim() || !model.trim()) return setError("Dinos la marca y el modelo.");
    if (!year || y < 1980 || y > CURRENT_YEAR + 1) return setError("Revisa el año.");
    if (!mileage) return setError("Indica el kilometraje aproximado.");
    if (!price || p <= 0) return setError("Indica el precio que pides.");
    if (phoneValue.trim().length < 6) return setError("Necesitamos un WhatsApp para coordinar.");
    if (!client || !userId) return setError("No hay sesión activa. Vuelve a ingresar.");

    setSubmitting(true);
    const result = await createSaleRequest(client, userId, {
      brand,
      model,
      trim,
      year: y,
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

  return (
    <Section tone="bg" padding="tight">
      <div className="mx-auto max-w-2xl">
        <SectionHeader
          eyebrow="Consignación sin exclusividad"
          title="Registra tu auto"
          description="Lo revisamos y, si encaja, lo publicamos en la web como consignación. Tú lo sigues usando; si lo vendes por tu cuenta, no pagas comisión."
        />

        <form onSubmit={onSubmit} noValidate className="mt-8 rounded-[22px] border border-line bg-surface p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marca" htmlFor="sv-marca">
              <input id="sv-marca" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ej. BMW" autoCapitalize="words" className="field-lux" />
            </Field>
            <Field label="Modelo" htmlFor="sv-modelo">
              <input id="sv-modelo" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ej. X5" autoCapitalize="words" className="field-lux" />
            </Field>
            <Field label="Versión" htmlFor="sv-version" hint="Opcional">
              <input id="sv-version" value={trim} onChange={(e) => setTrim(e.target.value)} placeholder="Ej. xDrive40i M Sport" className="field-lux" />
            </Field>
            <Field label="Año" htmlFor="sv-anio">
              <input id="sv-anio" inputMode="numeric" value={year} onChange={(e) => setYear(digits(e.target.value).slice(0, 4))} placeholder={String(CURRENT_YEAR - 3)} className="field-lux tabular-nums" />
            </Field>
            <div className="sm:col-span-2">
              <span id="sv-motor-label" className="block text-sm text-ink-2">Motor</span>
              <div role="group" aria-labelledby="sv-motor-label" className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {VEHICLE_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={category === c.id}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      "field-lux flex items-center justify-center px-2 text-center text-sm font-semibold transition-colors",
                      category === c.id ? "!border-silver !bg-surface-3 text-ink" : "text-ink-3 hover:text-ink",
                    )}
                  >
                    {CATEGORY_LABEL[c.id]}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Kilometraje" htmlFor="sv-km">
              <div className="relative">
                <input id="sv-km" inputMode="numeric" value={mileage ? Number(digits(mileage)).toLocaleString("en-US") : ""} onChange={(e) => setMileage(digits(e.target.value).slice(0, 7))} placeholder="48,000" className="field-lux pr-12 tabular-nums" />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-4">km</span>
              </div>
            </Field>
            <Field label="Color" htmlFor="sv-color" hint="Opcional">
              <input id="sv-color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Ej. Azul" className="field-lux" />
            </Field>
            <Field label="Placa" htmlFor="sv-placa" hint="Opcional. No se publica.">
              <input id="sv-placa" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase().slice(0, 12))} placeholder="ABC-123" className="field-lux font-mono uppercase" />
            </Field>
            <Field label="Condición" htmlFor="sv-condicion">
              <select id="sv-condicion" value={declared} onChange={(e) => setDeclared(e.target.value)} className="field-lux select-lux">
                {DECLARED_CONDITIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Precio que pides" htmlFor="sv-precio" hint="Es el precio de publicación. Lo revisamos contigo si conviene ajustarlo.">
              <div className="flex gap-2">
                <select aria-label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value === "PEN" ? "PEN" : "USD")} className="field-lux select-lux w-28 shrink-0">
                  <option value="USD">USD</option>
                  <option value="PEN">PEN</option>
                </select>
                <input id="sv-precio" inputMode="numeric" value={price ? Number(digits(price)).toLocaleString("en-US") : ""} onChange={(e) => setPrice(digits(e.target.value).slice(0, 9))} placeholder="59,900" className="field-lux tabular-nums" />
              </div>
            </Field>
            <Field label="WhatsApp de contacto" htmlFor="sv-telefono">
              <input id="sv-telefono" type="tel" inputMode="tel" autoComplete="tel" value={phoneValue} onChange={(e) => setPhone(e.target.value)} placeholder="+51 9…" className="field-lux" />
            </Field>
            <Field label="Descripción" htmlFor="sv-descripcion" hint="Historial, mantenimientos, extras. Sale en la ficha pública." className="sm:col-span-2">
              <textarea id="sv-descripcion" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="field-lux min-h-28 resize-y" placeholder="Ej. Único dueño, mantenimientos en concesionario, llantas nuevas." />
            </Field>
          </div>

          <ul className="mt-6 grid gap-2 text-sm text-ink-3">
            {[
              "Un asesor revisa la solicitud y te contacta para verificar documentos y pedirte fotos.",
              "Si la aprobamos, la ficha sale publicada en la web marcada como consignación.",
              "Sin contrato de exclusividad: lo sigues usando y puedes venderlo por tu cuenta.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-silver" />
                {t}
              </li>
            ))}
          </ul>

          {error ? (
            <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="submit" variant="accent" size="lg" disabled={submitting || status !== "autenticado"}>
              {submitting ? "Enviando…" : "Enviar para revisión"}
            </Button>
            <p className="text-xs text-ink-4 sm:max-w-xs">Nada se publica hasta que un asesor lo apruebe.</p>
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
