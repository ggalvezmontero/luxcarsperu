"use client";

import { Button } from "@/components/Button";
import { LUXCARS_CONFIG } from "@/lib/config";
import { formatNumber } from "@/lib/utils";
import { useState, type FormEvent } from "react";

/**
 * Formulario de tasación. No hay backend: arma el mismo tipo de enlace
 * `wa.me` que `src/lib/whatsapp.ts` (número desde LUXCARS_CONFIG, cuerpo
 * línea por línea y `encodeURIComponent`) y abre WhatsApp con el mensaje ya
 * redactado. Los datos no se guardan en ningún lado.
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

function construirEnlaceTasacion(campos: Campos) {
  const { contact } = LUXCARS_CONFIG;
  const km = Number(campos.kilometraje.replace(/\D/g, ""));

  const lines = [
    "Hola LuxCars, quiero tasar mi auto para dejarlo en consignación.",
    `Marca: ${campos.marca.trim()}`,
    `Modelo: ${campos.modelo.trim()}`,
    `Año: ${campos.anio.trim()}`,
    Number.isFinite(km) && km > 0
      ? `Kilometraje: ${formatNumber(km)} km`
      : undefined,
    `Condición: ${campos.condicion}`,
    `Teléfono de contacto: ${campos.telefono.trim()}`,
    "Entiendo que la tasación es referencial y se confirma tras ver el vehículo.",
    "Me interesa la consignación sin contrato de exclusividad.",
  ].filter(Boolean);

  const message = encodeURIComponent(lines.join("\n"));
  return `https://wa.me/${contact.whatsappNumber}?text=${message}`;
}

const filaBase =
  "grid gap-2 border-b border-line py-5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)] sm:items-baseline sm:gap-6 sm:py-6";
const etiquetaBase =
  "text-[11px] font-medium uppercase tracking-[0.28em] text-ink-3";
const campoBase =
  "w-full min-w-0 bg-transparent pb-1 text-lg text-ink placeholder:text-ink-4 focus:outline-none sm:text-xl";

export function FormularioTasacion() {
  const [campos, setCampos] = useState<Campos>(INICIAL);
  const [enviado, setEnviado] = useState(false);

  const actualizar = (campo: keyof Campos) => (valor: string) =>
    setCampos((previo) => ({ ...previo, [campo]: valor }));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const enlace = construirEnlaceTasacion(campos);
    setEnviado(true);
    window.open(enlace, "_blank", "noopener,noreferrer");
  };

  const anioActual = new Date().getFullYear();

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="border-t border-line-strong">
        <div className={filaBase}>
          <label htmlFor="tasacion-marca" className={etiquetaBase}>
            Marca
          </label>
          <input
            id="tasacion-marca"
            name="marca"
            required
            autoComplete="off"
            placeholder="Porsche, BMW, Toyota…"
            value={campos.marca}
            onChange={(e) => actualizar("marca")(e.target.value)}
            className={campoBase}
          />
        </div>

        <div className={filaBase}>
          <label htmlFor="tasacion-modelo" className={etiquetaBase}>
            Modelo
          </label>
          <input
            id="tasacion-modelo"
            name="modelo"
            required
            autoComplete="off"
            placeholder="Macan, X5, 4Runner…"
            value={campos.modelo}
            onChange={(e) => actualizar("modelo")(e.target.value)}
            className={campoBase}
          />
        </div>

        <div className={filaBase}>
          <label htmlFor="tasacion-anio" className={etiquetaBase}>
            Año
          </label>
          <input
            id="tasacion-anio"
            name="anio"
            required
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            min={1980}
            max={anioActual + 1}
            placeholder={String(anioActual - 4)}
            value={campos.anio}
            onChange={(e) =>
              actualizar("anio")(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            className={campoBase}
          />
        </div>

        <div className={filaBase}>
          <label htmlFor="tasacion-km" className={etiquetaBase}>
            Kilometraje
          </label>
          <div className="flex min-w-0 items-baseline gap-3">
            <input
              id="tasacion-km"
              name="kilometraje"
              required
              inputMode="numeric"
              placeholder="48 000"
              value={campos.kilometraje}
              onChange={(e) =>
                actualizar("kilometraje")(
                  e.target.value.replace(/[^\d\s.]/g, "").slice(0, 9),
                )
              }
              className={campoBase}
            />
            <span className="shrink-0 text-xs uppercase tracking-[0.25em] text-ink-4">
              km
            </span>
          </div>
        </div>

        <div className={filaBase}>
          <label htmlFor="tasacion-condicion" className={etiquetaBase}>
            Condición
          </label>
          <select
            id="tasacion-condicion"
            name="condicion"
            required
            value={campos.condicion}
            onChange={(e) => actualizar("condicion")(e.target.value)}
            className={`${campoBase} appearance-none`}
          >
            {CONDICIONES.map((condicion) => (
              <option key={condicion} value={condicion} className="bg-surface">
                {condicion}
              </option>
            ))}
          </select>
        </div>

        <div className={filaBase}>
          <label htmlFor="tasacion-telefono" className={etiquetaBase}>
            Teléfono
          </label>
          <input
            id="tasacion-telefono"
            name="telefono"
            type="tel"
            required
            autoComplete="tel"
            placeholder="+51 9…"
            value={campos.telefono}
            onChange={(e) => actualizar("telefono")(e.target.value)}
            className={campoBase}
          />
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit" variant="accent" size="lg">
          Enviar por WhatsApp
        </Button>
        <p className="max-w-sm text-xs leading-relaxed text-ink-4">
          Se abre WhatsApp con los datos ya escritos. Tú decides si lo envías.
          No guardamos la información en ningún servidor.
        </p>
      </div>

      <p
        aria-live="polite"
        className="mt-5 min-h-5 text-xs uppercase tracking-[0.22em] text-silver-dim"
      >
        {enviado
          ? "Abrimos WhatsApp en otra pestaña. Si no se abrió, revisa el bloqueador de ventanas."
          : ""}
      </p>
    </form>
  );
}
