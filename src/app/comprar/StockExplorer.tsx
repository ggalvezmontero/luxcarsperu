"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { LUXCARS_CONFIG } from "@/lib/config";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

/* ===========================================================================
   MODELO DE DATOS DEL STOCK PROPIO
   ---------------------------------------------------------------------------
   Todavía no hay base de datos. Este es el contrato que deberá cumplir la
   fuente real (CMS, hoja de cálculo o API) cuando exista. Los datos entran
   siempre por props desde el Server Component: hoy son el array de maqueta
   de page.tsx, marcado como demostración en la propia interfaz.
   =========================================================================== */

/** Estado comercial de la unidad. Manda sobre el CTA que se muestra. */
export type StockStatus = "disponible" | "reservado" | "vendido";

/** Condición física declarada. No es una promesa de garantía. */
export type StockCondition = "nuevo" | "seminuevo" | "usado-selecto";

/** Una línea del historial verificable de la unidad (dueños, CarFax, etc.). */
export type StockHistoryEntry = {
  label: string;
  value: string;
};

export type StockVehicle = {
  id: string;
  brand: string;
  model: string;
  /** Año-modelo. */
  year: number;
  /** Kilometraje real al momento de publicar. */
  km: number;
  /**
   * Precios REFERENCIALES. `null` significa "a consultar": la tarjeta debe
   * verse igual de digna sin cifra que con cifra.
   */
  priceUsd: number | null;
  priceSoles: number | null;
  condition: StockCondition;
  /** Dónde se puede ver físicamente la unidad. */
  location: string;
  status: StockStatus;
  /**
   * Rutas de imágenes propias en /public. Vacío = tratamiento gráfico.
   * Nunca fotos de stock: una foto que no es del auto es una mentira.
   */
  gallery: string[];
  /** VIN parcial: suficiente para verificar, insuficiente para clonar. */
  vinPartial: string;
  history: StockHistoryEntry[];
  /** Marca la unidad como maqueta mientras no haya inventario cargado. */
  isDemo?: boolean;
};

const CONDITION_LABEL: Record<StockCondition, string> = {
  nuevo: "Nuevo · 0 km",
  seminuevo: "Seminuevo",
  "usado-selecto": "Usado selecto",
};

const STATUS_LABEL: Record<StockStatus, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vendido: "Vendido",
};

const STATUS_DOT: Record<StockStatus, string> = {
  disponible: "bg-ok",
  reservado: "bg-warn",
  vendido: "bg-ink-4",
};

/* ---------------------------------------------------------------------------
   Enlaces a WhatsApp: el mensaje llega con el auto ya escrito.
   --------------------------------------------------------------------------- */

function waLink(lines: Array<string | undefined>) {
  const text = encodeURIComponent(lines.filter(Boolean).join("\n"));
  return `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${text}`;
}

function unitWhatsapp(vehicle: StockVehicle) {
  return waLink([
    `Hola LuxCars, me interesa el ${vehicle.brand} ${vehicle.model} ${vehicle.year} que tienen disponible.`,
    `Referencia: ${vehicle.id.toUpperCase()} · VIN ${vehicle.vinPartial}`,
    `Kilometraje publicado: ${formatNumber(vehicle.km)} km`,
    `Estado publicado: ${STATUS_LABEL[vehicle.status]}`,
    "Quisiera coordinar una visita y conocer el precio final.",
  ]);
}

const SEARCH_WHATSAPP = waLink([
  "Hola LuxCars, quiero dejar registrada mi búsqueda de un auto.",
  "Marca y modelo:",
  "Año deseado:",
  "Presupuesto referencial:",
  "¿Me avisan cuando entre una unidad así a su stock?",
]);

/* ---------------------------------------------------------------------------
   Filtros
   --------------------------------------------------------------------------- */

type PriceBucket = "todos" | "hasta-50" | "50-90" | "desde-90";

const PRICE_BUCKETS: Array<{ id: PriceBucket; label: string }> = [
  { id: "todos", label: "Todo el rango" },
  { id: "hasta-50", label: "Hasta USD 50 000" },
  { id: "50-90", label: "USD 50 000 – 90 000" },
  { id: "desde-90", label: "Desde USD 90 000" },
];

function matchesBucket(priceUsd: number | null, bucket: PriceBucket) {
  if (bucket === "todos") return true;
  // Sin cifra publicada no se puede afirmar el rango: la unidad se muestra
  // solo cuando el filtro de precio está abierto.
  if (priceUsd === null) return false;
  if (bucket === "hasta-50") return priceUsd < 50_000;
  if (bucket === "50-90") return priceUsd >= 50_000 && priceUsd < 90_000;
  return priceUsd >= 90_000;
}

const selectClass =
  "w-full appearance-none border-0 border-b border-line bg-transparent py-3 pr-6 text-sm text-ink transition-colors duration-200 hover:border-silver focus:border-silver";

const labelClass =
  "block text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-4";

/* ===========================================================================
   COMPONENTE
   =========================================================================== */

export function StockExplorer({ stock }: { stock: StockVehicle[] }) {
  const [brand, setBrand] = useState("todas");
  const [bucket, setBucket] = useState<PriceBucket>("todos");
  const [condition, setCondition] = useState<StockCondition | "todas">("todas");

  const brands = useMemo(
    () => Array.from(new Set(stock.map((v) => v.brand))).sort(),
    [stock],
  );

  const results = useMemo(
    () =>
      stock.filter(
        (v) =>
          (brand === "todas" || v.brand === brand) &&
          (condition === "todas" || v.condition === condition) &&
          matchesBucket(v.priceUsd, bucket),
      ),
    [stock, brand, condition, bucket],
  );

  const hasStock = stock.length > 0;
  const isFiltered =
    brand !== "todas" || condition !== "todas" || bucket !== "todos";

  const resetFilters = () => {
    setBrand("todas");
    setCondition("todas");
    setBucket("todos");
  };

  return (
    <section id="unidades" className="w-full">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        {/* --- Barra de filtros: filetes, no tarjetas ------------------- */}
        {hasStock ? (
          <div className="border-t border-line-strong pt-8">
            <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
              <div>
                <label className={labelClass} htmlFor="filtro-marca">
                  Marca
                </label>
                <select
                  id="filtro-marca"
                  className={selectClass}
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                >
                  <option value="todas">Todas las marcas</option>
                  {brands.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor="filtro-precio">
                  Precio referencial
                </label>
                <select
                  id="filtro-precio"
                  className={selectClass}
                  value={bucket}
                  onChange={(event) =>
                    setBucket(event.target.value as PriceBucket)
                  }
                >
                  {PRICE_BUCKETS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass} htmlFor="filtro-condicion">
                  Condición
                </label>
                <select
                  id="filtro-condicion"
                  className={selectClass}
                  value={condition}
                  onChange={(event) =>
                    setCondition(
                      event.target.value as StockCondition | "todas",
                    )
                  }
                >
                  <option value="todas">Cualquier condición</option>
                  {(
                    Object.keys(CONDITION_LABEL) as StockCondition[]
                  ).map((item) => (
                    <option key={item} value={item}>
                      {CONDITION_LABEL[item]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 lg:justify-end">
                <span className="text-sm tabular-nums text-ink-2">
                  <span className="text-ink">{results.length}</span>{" "}
                  {results.length === 1 ? "unidad" : "unidades"}
                </span>
                {isFiltered ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-4 transition-colors duration-200 hover:text-silver-bright"
                  >
                    Limpiar
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* --- Listado ------------------------------------------------- */}
        {results.length > 0 ? (
          <div className="mt-4">
            {results.map((vehicle, index) => (
              <UnitRow key={vehicle.id} vehicle={vehicle} index={index} />
            ))}
          </div>
        ) : hasStock ? (
          <NoMatches onReset={resetFilters} />
        ) : (
          <EmptyStock />
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Una unidad. Fila editorial asimétrica, no tarjeta.
   --------------------------------------------------------------------------- */

function UnitRow({
  vehicle,
  index,
}: {
  vehicle: StockVehicle;
  index: number;
}) {
  const sold = vehicle.status === "vendido";
  const mediaFirst = index % 2 === 0;

  return (
    <article
      className={cn(
        "grid gap-8 border-t border-line py-14 sm:py-16 lg:grid-cols-12 lg:gap-12 lg:py-24",
        sold ? "opacity-60" : "",
      )}
    >
      {/* Numeración a gran escala */}
      <div className="lg:col-span-1">
        <span className="block text-3xl font-semibold tabular-nums leading-none text-ink-4/50 lg:text-4xl">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Media */}
      <div
        className={cn(
          "lg:col-span-6",
          mediaFirst ? "lg:order-none" : "lg:order-last",
        )}
      >
        <UnitMedia vehicle={vehicle} />
      </div>

      {/* Ficha */}
      <div className="lg:col-span-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-3">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                STATUS_DOT[vehicle.status],
              )}
            />
            {STATUS_LABEL[vehicle.status]}
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-ink-4">
            {CONDITION_LABEL[vehicle.condition]}
          </span>
        </div>

        <h3 className="mt-4 text-3xl font-semibold leading-[1.05] tracking-tight text-balance text-ink sm:text-4xl">
          {vehicle.brand}{" "}
          <span className="text-silver">{vehicle.model}</span>
        </h3>

        <dl className="mt-8 divide-y divide-line border-y border-line">
          <Row label="Año" value={String(vehicle.year)} />
          <Row label="Kilometraje" value={`${formatNumber(vehicle.km)} km`} />
          <Row
            label="Precio referencial"
            value={
              vehicle.priceUsd !== null
                ? formatCurrency(vehicle.priceUsd, "en-US", "USD")
                : "A consultar"
            }
          />
          <Row
            label="Equivalente en soles"
            value={
              vehicle.priceSoles !== null
                ? formatCurrency(vehicle.priceSoles, "es-PE", "PEN")
                : "Según tipo de cambio del día"
            }
          />
          <Row label="VIN" value={vehicle.vinPartial} mono />
          <Row label="Ubicación" value={vehicle.location} />
        </dl>

        {vehicle.history.length > 0 ? (
          <ul className="mt-6 divide-y divide-line/70">
            {vehicle.history.map((entry) => (
              <li
                key={entry.label}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5"
              >
                <span className="text-[10px] uppercase tracking-[0.25em] text-ink-4">
                  {entry.label}
                </span>
                <span className="text-sm text-ink-2">{entry.value}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-6 text-xs leading-relaxed text-ink-4">
          Precio referencial sujeto a verificación presencial y a la
          documentación de la unidad. No constituye oferta en firme.
        </p>

        <div className="mt-8">
          {sold ? (
            <span className="inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-4">
              Unidad vendida
            </span>
          ) : (
            <Button
              href={unitWhatsapp(vehicle)}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              variant={vehicle.status === "reservado" ? "secondary" : "primary"}
            >
              {vehicle.status === "reservado"
                ? "Avisarme si se libera"
                : "Coordinar visita"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-4">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm tabular-nums text-ink",
          mono ? "font-mono text-ink-2" : "",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Con foto: imagen a sangre dentro de su marco, sin borde.
 * Sin foto: bloque gráfico deliberado con el nombre de la marca como
 * tipografía-objeto. Nunca una imagen de banco haciéndose pasar por el auto.
 */
function UnitMedia({ vehicle }: { vehicle: StockVehicle }) {
  const photo = vehicle.gallery[0];

  if (photo) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
        <Image
          src={photo}
          alt={`${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
        {vehicle.gallery.length > 1 ? (
          <span className="absolute bottom-4 left-4 bg-void/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-silver backdrop-blur-sm">
            {vehicle.gallery.length} fotos
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative flex aspect-[4/3] w-full flex-col justify-between overflow-hidden bg-surface-2 p-6 sm:p-8">
      <span className="relative z-10 text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-4">
        {vehicle.year} · {formatNumber(vehicle.km)} km
      </span>

      {/* Tipografía como elemento gráfico */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-2 left-4 right-4 select-none truncate text-5xl font-semibold uppercase leading-none tracking-tight text-ink-4/25 sm:text-7xl lg:text-8xl"
      >
        {vehicle.brand}
      </span>

      <div className="relative z-10">
        <Image
          src="/brand/isotipo-blanco.svg"
          alt=""
          width={48}
          height={48}
          className="h-8 w-auto opacity-25"
        />
        <p className="mt-4 max-w-xs text-xs leading-relaxed text-ink-3">
          Fotografía propia en producción. Enviamos el set completo y un video
          de la unidad por WhatsApp.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Estados vacíos
   --------------------------------------------------------------------------- */

function NoMatches({ onReset }: { onReset: () => void }) {
  return (
    <div className="border-t border-line py-20 sm:py-28">
      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-ink-4">
        Sin coincidencias
      </p>
      <h3 className="mt-6 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-balance text-ink sm:text-4xl">
        Ninguna unidad del stock coincide con esa combinación.
      </h3>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-2">
        Amplía el rango o déjanos tu búsqueda: te avisamos el día que entre una
        unidad así.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Button onClick={onReset} size="lg" variant="secondary">
          Quitar filtros
        </Button>
        <Button
          href={SEARCH_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          size="lg"
        >
          Dejar mi búsqueda
        </Button>
      </div>
    </div>
  );
}

function EmptyStock() {
  return (
    <div className="border-t border-line-strong py-20 sm:py-28 lg:py-32">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-ink-4">
            Sala vacía
          </p>
          <h3 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
            Ahora mismo no hay unidades en piso.
          </h3>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg">
            Trabajamos con pocas unidades a la vez y solo publicamos las que ya
            están en Lima, verificadas y con documentos en orden. Cuando la sala
            está vacía es porque todo se vendió, no porque no haya qué mostrar.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              href={SEARCH_WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
            >
              Dejar mi búsqueda
            </Button>
            <Button href="/#calculator" size="lg" variant="secondary">
              Importar a pedido
            </Button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <dl className="divide-y divide-line border-y border-line">
            <Row label="Próximo ingreso" value="Consultar por WhatsApp" />
            <Row label="Importación a pedido" value="30 a 60 días" />
            <Row label="Tasación de tu auto" value="Sin costo" />
            <Row label="Consignación" value="Sin exclusividad" />
          </dl>
          <p className="mt-6 text-xs leading-relaxed text-ink-4">
            Si prefieres vender el tuyo antes de comprar, lo tasamos y lo
            publicamos sin que dejes de usarlo.
          </p>
        </div>
      </div>
    </div>
  );
}
