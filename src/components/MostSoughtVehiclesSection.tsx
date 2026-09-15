import { TRENDING_VEHICLES } from "@/data/trendingVehicles";
import { formatCurrency } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./Button";
import { SectionHeading } from "./SectionHeading";

function formatPriceRange(min: number, max: number) {
  return `${formatCurrency(min)} – ${formatCurrency(max)}`;
}

export function MostSoughtVehiclesSection() {
  return (
    <section
      id="mas-buscados"
      className="scroll-mt-32 rounded-[40px] md:rounded-[40px] rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-950/90 via-black/75 to-neutral-900/90 px-4 md:px-6 py-12 md:py-20 backdrop-blur lg:px-14"
    >
      <SectionHeading
        eyebrow="Mercado Perú"
        title="Los autos más buscados con precios reales de referencia"
        description="Ejemplos basados en anuncios y listados recientes en Miami y EE. UU. Toca un vehículo para abrir la calculadora con los datos completos y ver el desglose del estimado. Los montos son referenciales en USD."
        align="center"
      />

      <div className="mx-auto mt-10 md:mt-14 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TRENDING_VEHICLES.map((vehicle) => (
          <Link
            key={vehicle.id}
            href={`/?simular=${vehicle.id}#calculator`}
            scroll={false}
            className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left shadow-[0_20px_80px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:border-[#f5d072]/35 hover:shadow-[0_28px_100px_rgba(245,208,114,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5d072]/50"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/50">
              <Image
                src={vehicle.imageSrc}
                alt={vehicle.imageAlt}
                fill
                className="object-cover transition duration-500 group-hover:scale-[1.04]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <span className="absolute bottom-3 left-3 right-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#f5d072]/95">
                {vehicle.segment}
              </span>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-lg font-semibold tracking-tight text-white">
                {vehicle.name}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-white/60">
                {vehicle.detail}
              </p>
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/45">
                  Precio Miami (ref.)
                </p>
                <p className="mt-1 text-base font-semibold tabular-nums text-white">
                  {formatPriceRange(vehicle.priceMinUsd, vehicle.priceMaxUsd)}
                </p>
                <p className="mt-3 text-xs font-medium text-[#f5d072]">
                  Ver simulación con precio referencial →
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-2xl text-center">
        <p className="text-xs leading-relaxed text-white/45">
          Cada simulación usa el punto medio del rango como precio Miami de
          ejemplo, el año reciente admitido por la calculadora y el tipo de
          motor/ISC más coherente con el modelo. El precio final en Lima depende
          del CIF, SUNAT y tipo de cambio.
        </p>
        <Button href="/#calculator" size="lg" className="mt-6 !text-black">
          Simular otro vehículo
        </Button>
      </div>
    </section>
  );
}
