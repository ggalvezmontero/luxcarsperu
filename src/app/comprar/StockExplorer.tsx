"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { VehicleCard } from "@/components/VehicleCard";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { LUXCARS_CONFIG } from "@/lib/config";
import {
  CATEGORY_LABEL,
  CONSIGNMENT_LABEL,
  OWN_STOCK_LABEL,
  isConsignment,
  type StockVehicle,
} from "@/lib/stockLabels";
import { cn } from "@/lib/utils";

type PriceBucket = "todos" | "hasta-50" | "50-90" | "desde-90";
type Origin = "todos" | "propio" | "consignacion";

const ORIGINS: { id: Origin; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "propio", label: OWN_STOCK_LABEL },
  { id: "consignacion", label: CONSIGNMENT_LABEL },
];
type Sort = "recientes" | "precio-asc" | "precio-desc" | "km-asc";

const PRICE_BUCKETS: { id: PriceBucket; label: string }[] = [
  { id: "todos", label: "Cualquier precio" },
  { id: "hasta-50", label: "Hasta USD 50k" },
  { id: "50-90", label: "USD 50k – 90k" },
  { id: "desde-90", label: "Desde USD 90k" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "recientes", label: "Más recientes" },
  { id: "precio-asc", label: "Menor precio" },
  { id: "precio-desc", label: "Mayor precio" },
  { id: "km-asc", label: "Menos kilómetros" },
];

function inBucket(price: number | null, bucket: PriceBucket) {
  if (bucket === "todos") return true;
  if (price === null) return false;
  if (bucket === "hasta-50") return price < 50_000;
  if (bucket === "50-90") return price >= 50_000 && price < 90_000;
  return price >= 90_000;
}

const SEARCH_WHATSAPP = `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(
  ["Hola LuxCars, quiero dejar registrada mi búsqueda.", "Marca y modelo:", "Año:", "Presupuesto:"].join("\n"),
)}`;

export function StockExplorer({ stock }: { stock: StockVehicle[] }) {
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("todas");
  const [bucket, setBucket] = useState<PriceBucket>("todos");
  const [category, setCategory] = useState<string>("todas");
  const [origin, setOrigin] = useState<Origin>("todos");
  const [sort, setSort] = useState<Sort>("recientes");
  // El filtro de origen solo aparece si conviven propios y consignados.
  const hasConsigned = stock.some(isConsignment);
  const hasOwn = stock.some((v) => !isConsignment(v));

  const brands = useMemo(
    () => Array.from(new Set(stock.map((v) => v.brand))).sort(),
    [stock],
  );
  const categories = useMemo(
    () => Array.from(new Set(stock.map((v) => v.category))),
    [stock],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = stock.filter(
      (v) =>
        (brand === "todas" || v.brand === brand) &&
        (category === "todas" || v.category === category) &&
        (origin === "todos" || (origin === "consignacion") === isConsignment(v)) &&
        inBucket(v.price, bucket) &&
        (!q || `${v.brand} ${v.model} ${v.trim ?? ""} ${v.year}`.toLowerCase().includes(q)),
    );
    const price = (v: StockVehicle) => v.price ?? Number.POSITIVE_INFINITY;
    switch (sort) {
      case "precio-asc": return [...list].sort((a, b) => price(a) - price(b));
      case "precio-desc": return [...list].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
      case "km-asc": return [...list].sort((a, b) => a.mileageKm - b.mileageKm);
      default: return list;
    }
  }, [stock, query, brand, category, origin, bucket, sort]);

  const filtered =
    query || brand !== "todas" || category !== "todas" || bucket !== "todos" || origin !== "todos";
  const reset = () => {
    setQuery("");
    setBrand("todas");
    setCategory("todas");
    setBucket("todos");
    setOrigin("todos");
  };
  const demo = stock.some((v) => v.isDemo);

  return (
    <section id="unidades" className="w-full bg-bg py-10 sm:py-14">
      <div className="container-lux">
        {/* Barra de filtros */}
        <div className="rounded-[22px] border border-line bg-surface p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <label className="relative block">
              <span className="sr-only">Buscar</span>
              <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-4" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar marca o modelo"
                className="field-lux pl-11"
              />
            </label>
            <label className="block">
              <span className="sr-only">Marca</span>
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="field-lux select-lux">
                <option value="todas">Todas las marcas</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Precio</span>
              <select value={bucket} onChange={(e) => setBucket(e.target.value as PriceBucket)} className="field-lux select-lux">
                {PRICE_BUCKETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Motor</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-lux select-lux">
                <option value="todas">Cualquier motor</option>
                {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </label>
          </div>
        </div>

        {/* Resultado + orden */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <p className="text-sm text-ink-2">
              <span className="font-semibold text-ink">{results.length}</span>{" "}
              {results.length === 1 ? "unidad" : "unidades"}
            </p>
            {demo ? <Badge tone="warn">Demostración</Badge> : null}
            {hasConsigned && hasOwn ? (
              <div role="group" aria-label="Origen" className="flex rounded-full border border-line bg-surface p-0.5">
                {ORIGINS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={origin === o.id}
                    onClick={() => setOrigin(o.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      origin === o.id ? "bg-ink text-void" : "text-ink-3 hover:text-ink",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : null}
            {filtered ? (
              <button type="button" onClick={reset} className="text-sm font-medium text-silver underline-offset-4 hover:underline">
                Limpiar filtros
              </button>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-3">
            Ordenar
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={cn("field-lux select-lux min-h-10 w-auto py-1.5 text-sm")}>
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>

        {results.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((v, i) => <VehicleCard key={v.id} vehicle={v} priority={i < 3} />)}
          </div>
        ) : (
          <div className="mt-6 rounded-[22px] border border-dashed border-line-strong px-6 py-16 text-center">
            <Icon name="search" size={28} className="mx-auto text-ink-4" />
            <p className="mt-4 text-lg font-semibold text-ink">
              {stock.length ? "Nada coincide con esos filtros." : "Ahora mismo no hay unidades en piso."}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-3">
              Déjanos tu búsqueda y te avisamos el día que entre una unidad así.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              {stock.length ? <Button onClick={reset} variant="secondary">Quitar filtros</Button> : null}
              <Button href="/cuenta/comprar" variant="secondary">Pedir que lo busquen</Button>
              <Button href={SEARCH_WHATSAPP} variant="whatsapp">Dejar mi búsqueda</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
