"use client";

import { Button } from "@/components/Button";
import { Icon, WhatsAppIcon } from "@/components/ui/Icon";
import { LUXCARS_CONFIG } from "@/lib/config";
import { formatNumber } from "@/lib/utils";
import { useState, type FormEvent } from "react";

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
    "Hola LuxCars, quiero tasar mi auto para consignación.",
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

export function FormularioTasacion() {
  const [campos, setCampos] = useState<Campos>(INICIAL);
  const [enviado, setEnviado] = useState(false);
  const set = (k: keyof Campos) => (v: string) => setCampos((p) => ({ ...p, [k]: v }));
  const anioActual = new Date().getFullYear();

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEnviado(true);
    window.open(enlace(campos), "_blank", "noopener,noreferrer");
  };

  return (
    <form onSubmit={onSubmit} className="rounded-[22px] border border-line bg-surface p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label} htmlFor="tasacion-marca">
          Marca
          <input id="tasacion-marca" required autoComplete="off" placeholder="Porsche, BMW, Toyota…" value={campos.marca} onChange={(e) => set("marca")(e.target.value)} className="field-lux" />
        </label>
        <label className={label} htmlFor="tasacion-modelo">
          Modelo
          <input id="tasacion-modelo" required autoComplete="off" placeholder="Macan, X5, 4Runner…" value={campos.modelo} onChange={(e) => set("modelo")(e.target.value)} className="field-lux" />
        </label>
        <label className={label} htmlFor="tasacion-anio">
          Año
          <input id="tasacion-anio" required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder={String(anioActual - 4)} value={campos.anio} onChange={(e) => set("anio")(e.target.value.replace(/\D/g, "").slice(0, 4))} className="field-lux tabular-nums" />
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
        <label className={label} htmlFor="tasacion-telefono">
          WhatsApp
          <input id="tasacion-telefono" type="tel" required autoComplete="tel" placeholder="+51 9…" value={campos.telefono} onChange={(e) => set("telefono")(e.target.value)} className="field-lux" />
        </label>
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
