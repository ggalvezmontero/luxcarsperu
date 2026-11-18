"use client";

/**
 * Filtro de la guía "Traer tu auto de Estados Unidos a Perú".
 *
 * Responde, antes de que la persona escriba, si su auto puede entrar y si le
 * corresponde la Ley del Retorno. Quien pasa llega a WhatsApp con sus datos ya
 * escritos; a quien no pasa se le dice por qué y se le ofrece lo que sí
 * podemos hacer (conseguirle un auto que entre).
 *
 * La regla vive en `src/lib/retorno.ts`. Este archivo solo pide los datos y
 * pinta el resultado.
 */

import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { VEHICLE_CATEGORIES, type VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import { LUXCARS_CONFIG } from "@/lib/config";
import {
  evaluarRetorno,
  type ResultadoRetorno,
  type TipoVehiculoRetorno,
  type UnidadRecorrido,
  type Veredicto,
} from "@/lib/retorno";
import { cn } from "@/lib/utils";

/** Cuántos años modelo se listan antes de la opción "o anterior". */
const ANIOS_LISTADOS = 8;

const soloDigitos = (texto: string) => texto.replace(/\D/g, "").slice(0, 7);
const conMiles = (digitos: string) => (digitos ? Number(digitos).toLocaleString("en-US") : "");

const TITULOS: Record<Veredicto, string> = {
  "no-entra": "Este auto no puede entrar a Perú",
  retorno: "Puede entrar, y sin tributos de importación",
  regular: "Puede entrar, pagando tributos",
};

const ESTILO: Record<Veredicto, { icono: IconName; clase: string }> = {
  "no-entra": { icono: "ban", clase: "bg-danger/10 text-danger" },
  retorno: { icono: "check", clase: "bg-ok/10 text-ok" },
  regular: { icono: "info", clase: "bg-warn/10 text-warn" },
};

const EXPLICACION: Record<Veredicto, string> = {
  "no-entra":
    "No depende de la Ley del Retorno: es un requisito del vehículo y no hay trámite que lo levante.",
  retorno:
    "Cumple los requisitos de un usado y calificas a la Ley del Retorno. Lo confirmamos con el VIN antes de mover el auto.",
  regular:
    "El auto cumple los requisitos de un usado, pero sin el beneficio paga los tributos de una importación regular.",
};

function Campo({ etiqueta, htmlFor, children }: { etiqueta: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm text-ink-2">
        {etiqueta}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function SiNo({
  etiqueta,
  valor,
  onChange,
}: {
  etiqueta: string;
  valor: boolean | null;
  onChange: (valor: boolean) => void;
}) {
  const id = useId();
  return (
    <div>
      <span id={id} className="block text-sm text-ink-2">
        {etiqueta}
      </span>
      <div role="group" aria-labelledby={id} className="mt-1.5 grid grid-cols-2 gap-2">
        {([true, false] as const).map((opcion) => (
          <button
            key={String(opcion)}
            type="button"
            aria-pressed={valor === opcion}
            onClick={() => onChange(opcion)}
            className={cn(
              "field-lux flex items-center justify-center font-semibold transition-colors",
              // Relleno claro: con solo el borde no se distinguía cuál estaba elegido.
              valor === opcion ? "!border-ink !bg-ink !text-void" : "text-ink-2",
            )}
          >
            {opcion ? "Sí" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FiltroRetorno({ anio, aniosFuera }: { anio: number; aniosFuera: number }) {
  const [anioModelo, setAnioModelo] = useState("");
  const [tipo, setTipo] = useState<TipoVehiculoRetorno>("auto");
  const [combustible, setCombustible] = useState<VehicleCategoryId>("gasolina");
  const [recorrido, setRecorrido] = useState("");
  const [unidad, setUnidad] = useState<UnidadRecorrido>("mi");
  const [valor, setValor] = useState("");
  const [cumplePersona, setCumplePersona] = useState<boolean | null>(null);
  const [prestamo, setPrestamo] = useState<boolean | null>(null);

  const anios = Array.from({ length: ANIOS_LISTADOS }, (_, i) => anio + 1 - i);
  const anterior = anios[anios.length - 1] - 1;

  const completo =
    anioModelo !== "" && recorrido !== "" && valor !== "" && cumplePersona !== null && prestamo !== null;

  const resultado: ResultadoRetorno | null = completo
    ? evaluarRetorno(
        {
          anioModelo: Number(anioModelo),
          tipo,
          combustible,
          recorrido: Number(recorrido),
          unidad,
          valorUsd: Number(valor),
          cumplePersona: cumplePersona === true,
        },
        anio,
      )
    : null;

  const avisos = resultado
    ? [
        ...resultado.avisos,
        ...(prestamo && resultado.veredicto !== "no-entra"
          ? [
              "Con un préstamo vigente, el auto no sale de Estados Unidos sin cancelarlo o sin la autorización escrita del financista.",
            ]
          : []),
      ]
    : [];

  const combustibleLabel = VEHICLE_CATEGORIES.find((c) => c.id === combustible)?.label ?? combustible;
  const mensaje = resultado
    ? [
        "Hola Luxcars, quiero traer mi auto de Estados Unidos a Perú.",
        `Año modelo: ${Number(anioModelo) === anterior ? `${anterior} o anterior` : anioModelo}`,
        `Tipo: ${tipo === "auto" ? "auto o SUV" : "camioneta o pickup"} · ${combustibleLabel}`,
        `Recorrido: ${conMiles(recorrido)} ${unidad === "mi" ? "millas" : "km"}`,
        `Valor aproximado: US$ ${conMiles(valor)}`,
        `Peruano con ${aniosFuera} años o más fuera: ${cumplePersona ? "sí" : "no"}`,
        `Préstamo vigente: ${prestamo ? "sí" : "no"}`,
        `Resultado del filtro: ${TITULOS[resultado.veredicto]}.`,
      ].join("\n")
    : "";
  const whatsapp = `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(mensaje)}`;

  return (
    <div className="mt-6 rounded-[22px] border border-line bg-surface p-5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Año modelo" htmlFor="fr-anio">
          <select
            id="fr-anio"
            value={anioModelo}
            onChange={(e) => setAnioModelo(e.target.value)}
            className="field-lux tabular-nums"
          >
            <option value="">Elige el año</option>
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value={anterior}>{anterior} o anterior</option>
          </select>
        </Campo>
        <Campo etiqueta="Tipo de vehículo" htmlFor="fr-tipo">
          <select
            id="fr-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoVehiculoRetorno)}
            className="field-lux"
          >
            <option value="auto">Auto o SUV</option>
            <option value="camioneta">Camioneta o pickup</option>
          </select>
        </Campo>
        <Campo etiqueta="Combustible" htmlFor="fr-combustible">
          <select
            id="fr-combustible"
            value={combustible}
            onChange={(e) => setCombustible(e.target.value as VehicleCategoryId)}
            className="field-lux"
          >
            {VEHICLE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Recorrido" htmlFor="fr-recorrido">
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
            <input
              id="fr-recorrido"
              inputMode="numeric"
              autoComplete="off"
              placeholder="18,000"
              value={conMiles(recorrido)}
              onChange={(e) => setRecorrido(soloDigitos(e.target.value))}
              className="field-lux tabular-nums"
            />
            <select
              aria-label="Unidad del recorrido"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value as UnidadRecorrido)}
              className="field-lux"
            >
              <option value="mi">millas</option>
              <option value="km">km</option>
            </select>
          </div>
        </Campo>
        <Campo etiqueta="Valor aproximado hoy, en dólares" htmlFor="fr-valor">
          <input
            id="fr-valor"
            inputMode="numeric"
            autoComplete="off"
            placeholder="32,000"
            value={conMiles(valor)}
            onChange={(e) => setValor(soloDigitos(e.target.value))}
            className="field-lux tabular-nums"
          />
        </Campo>
        <SiNo etiqueta="¿Hay un préstamo vigente sobre el auto?" valor={prestamo} onChange={setPrestamo} />
        <div className="sm:col-span-2">
          <SiNo
            etiqueta={`¿Eres peruano y llevas ${aniosFuera} años seguidos o más viviendo fuera?`}
            valor={cumplePersona}
            onChange={setCumplePersona}
          />
        </div>
      </div>

      <div aria-live="polite" className="mt-6 border-t border-line pt-6">
        {resultado ? (
          <>
            <div className="flex gap-4">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                  ESTILO[resultado.veredicto].clase,
                )}
              >
                <Icon name={ESTILO[resultado.veredicto].icono} size={20} />
              </span>
              <div>
                <p className="text-lg font-semibold leading-snug text-ink">{TITULOS[resultado.veredicto]}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{EXPLICACION[resultado.veredicto]}</p>
              </div>
            </div>
            {resultado.motivos.length + avisos.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-2">
                {[...resultado.motivos, ...avisos].map((texto) => (
                  <li key={texto} className="flex gap-3">
                    <Icon name="chevronRight" size={16} className="mt-0.5 shrink-0 text-ink-4" />
                    <span>{texto}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              {resultado.veredicto === "no-entra" ? (
                <Button href="/importar" variant="accent" size="lg" data-ga-cta="retorno_filtro_importar">
                  Ver cómo te conseguimos uno que sí entra
                  <Icon name="arrowRight" size={18} />
                </Button>
              ) : (
                <Button
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="whatsapp"
                  size="lg"
                  data-ga-cta={`retorno_filtro_${resultado.veredicto}`}
                >
                  Enviar por WhatsApp
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-ink-3">
            Completa los datos y te decimos al instante si tu auto puede entrar. No guardamos nada de lo que
            escribas aquí.
          </p>
        )}
      </div>
    </div>
  );
}
