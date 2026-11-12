"use client";

import { Button } from "@/components/Button";
import { Icon, WhatsAppIcon } from "@/components/ui/Icon";
import { LUXCARS_CONFIG } from "@/lib/config";
import { formatNumber } from "@/lib/utils";
import { useState, type FormEvent, type ReactNode } from "react";
import { BrandModelPicker } from "@/components/BrandModelPicker";
import { aniosDesde } from "@/lib/opcionesVehiculo";
import { PhoneInput } from "@/components/PhoneInput";
import { errorDeTelefono } from "@/lib/telefono";
import { GA_EVENTS, trackEvent } from "@/lib/analytics";

/**
 * Formulario de tasación. Sin backend: arma el enlace wa.me con el mensaje
 * ya redactado y lo abre. Los datos no se guardan en ningún lado.
 */
const CONDICIONES = [
  "Impecable · sin detalles",
  "Muy bueno · detalles menores",
  "Bueno · uso normal",
  "Requiere trabajos",
] as const;

type Campos = {
  marca: string;
  modelo: string;
  anio: string;
  kilometraje: string;
  condicion: string;
  telefono: string;
};

const INICIAL: Campos = {
  marca: "",
  modelo: "",
  anio: "",
  kilometraje: "",
  condicion: CONDICIONES[1],
  telefono: "",
};

function enlace(campos: Campos) {
  const km = Number(campos.kilometraje.replace(/\D/g, ""));
  const lines = [
    "Hola Luxcars, quiero tasar mi auto para consignación.",
    `Marca: ${campos.marca.trim()}`,
    `Modelo: ${campos.modelo.trim()}`,
    `Año: ${campos.anio.trim()}`,
    Number.isFinite(km) && km > 0 ? `Kilometraje: ${formatNumber(km)} km` : undefined,
    `Condición: ${campos.condicion}`,
    `Teléfono: ${campos.telefono.trim()}`,
  ].filter(Boolean);
  return `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
}

const label = "grid gap-1.5 text-sm font-medium text-ink-2";

/**
 * Envoltorio de los campos de marca y modelo, con el mismo aspecto que el resto
 * del formulario. Va fuera del componente: `BrandModelPicker` necesita que sea
 * una función estable o los campos pierden el foco al escribir.
 */
function CampoTasacion({ label: texto, htmlFor, children, error }: { label: string; htmlFor: string; children: ReactNode; error?: string }) {
  return (
    <div className={label}>
      <label htmlFor={htmlFor}>{texto}</label>
      <div>{children}</div>
      {error ? (
        <p role="alert" className="text-xs font-normal text-danger">{error}</p>
      ) : null}
    </div>
  );
}

export function FormularioTasacion() {
  const [campos, setCampos] = useState<Campos>(INICIAL);
  const [enviado, setEnviado] = useState(false);
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null);
  /** Marca o modelo sin elegir: los desplegables no llevan `required` nativo. */
  const [errorAuto, setErrorAuto] = useState<string | null>(null);
  const set = (k: keyof Campos) => (v: string) => setCampos((p) => ({ ...p, [k]: v }));
  const anioActual = new Date().getFullYear();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!campos.marca.trim() || !campos.modelo.trim()) {
      setErrorAuto(!campos.marca.trim() ? "Elige la marca." : "Elige el modelo.");
      const sinMarca = !campos.marca.trim();
      (
        document.getElementById(sinMarca ? "tasacion-brand" : "tasacion-model") ??
        document.getElementById(sinMarca ? "tasacion-brand-text" : "tasacion-model-text")
      )?.focus();
      return;
    }
    const problema = errorDeTelefono(campos.telefono);
    if (problema) {
      setErrorTelefono(problema);
      document.getElementById("tasacion-telefono")?.focus();
      return;
    }
    setEnviado(true);
    trackEvent(GA_EVENTS.valuationFormSubmit, {
      vehicle_brand: campos.marca.trim(),
      vehicle_model: campos.modelo.trim(),
      vehicle_year: campos.anio.trim(),
      vehicle_condition: campos.condicion,
    });
    window.open(enlace(campos), "_blank", "noopener,noreferrer");
  };

  return (
    <form onSubmit={onSubmit} className="rounded-[22px] border border-line bg-surface p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <BrandModelPicker
          idPrefix="tasacion"
          brand={campos.marca}
          model={campos.modelo}
          onChange={(next) => {
            setCampos((p) => ({ ...p, marca: next.brand, modelo: next.model }));
            setErrorAuto(null);
          }}
          renderField={CampoTasacion}
          brandError={errorAuto && !campos.marca.trim() ? errorAuto : undefined}
          modelError={errorAuto && campos.marca.trim() && !campos.modelo.trim() ? errorAuto : undefined}
        />
        <label className={label} htmlFor="tasacion-anio">
          Año
          <select id="tasacion-anio" required value={campos.anio} onChange={(e) => set("anio")(e.target.value)} className="field-lux tabular-nums">
            <option value="">Selecciona el año</option>
            {aniosDesde(anioActual + 1, 1980).map((anio) => (
              <option key={anio} value={anio}>{anio}</option>
            ))}
          </select>
        </label>
        <label className={label} htmlFor="tasacion-km">
          Kilometraje
          <input id="tasacion-km" required inputMode="numeric" placeholder="48 000" value={campos.kilometraje} onChange={(e) => set("kilometraje")(e.target.value.replace(/[^\d\s.]/g, "").slice(0, 9))} className="field-lux tabular-nums" />
        </label>
        <label className={label} htmlFor="tasacion-condicion">
          Condición
          <select id="tasacion-condicion" required value={campos.condicion} onChange={(e) => set("condicion")(e.target.value)} className="field-lux select-lux">
            {CONDICIONES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <div className={label}>
          <label htmlFor="tasacion-telefono">WhatsApp</label>
          <PhoneInput
            id="tasacion-telefono"
            required
            invalid={Boolean(errorTelefono)}
            aria-describedby={errorTelefono ? "tasacion-telefono-error" : undefined}
            value={campos.telefono}
            onChange={(v) => {
              set("telefono")(v);
              setErrorTelefono(null);
            }}
          />
          {errorTelefono ? (
            <p id="tasacion-telefono-error" role="alert" className="text-xs font-normal text-danger">
              {errorTelefono}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit" variant="whatsapp" size="lg">
          <WhatsAppIcon size={20} />
          Pedir tasación por WhatsApp
        </Button>
        <p className="text-xs text-ink-4">No guardamos tus datos. Tú decides si envías el mensaje.</p>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-xs text-ok">
        {enviado ? (
          <span className="inline-flex items-center gap-1.5"><Icon name="check" size={14} />Abrimos WhatsApp en otra pestaña.</span>
        ) : null}
      </p>
    </form>
  );
}
