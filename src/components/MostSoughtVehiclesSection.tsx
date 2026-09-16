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
      className="scroll-mt-32 rounded-lux-lg border border-line bg-surface px-4 py-12 md:rounded-lux-xl md:px-6 md:py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="Mercado Perú"
        title="Los autos más buscados con precios reales de referencia"
        description="Ejemplos basados en anuncios y listados recientes en Miami y EE. UU. Toca un vehículo para abrir la calculadora con los datos completos y ver el desglose del estimado. Los montos son referenciales en USD."
        align="center"
      />

      <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-2 md:mt-14 md:gap-5 lg:grid-cols-3">
        {TRENDING_VEHICLES.map((vehicle) => (
          <Link
            key={vehicle.id}
            href={`/?simular=${vehicle.id}#calculator`}
            scroll={false}
            className="group relative flex flex-col overflow-hidden rounded-lux-lg border border-line bg-surface-2 text-left shadow-[var(--lux-shadow)] transition duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-[var(--lux-shadow-lg)]"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-void">
              <Image
                src={vehicle.imageSrc}
                alt={vehicle.imageAlt}
                fill
                className="object-cover transition duration-700 ease-out group-hover:scale-[1.03]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-void via-void/25 to-transparent" />
              <span className="absolute left-4 top-4 max-w-[calc(100%-2rem)] truncate rounded-full border border-line bg-void/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-silver backdrop-blur-sm">
                {vehicle.segment}
              </span>
            </div>

            <div className="flex flex-1 flex-col p-5 md:p-6">
              <h3 className="text-lg font-semibold leading-snug tracking-tight text-ink">
                {vehicle.name}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-3">
                {vehicle.detail}
              </p>

              <div className="mt-5 border-t border-line pt-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-ink-4">
                  Precio Miami (ref.)
                </p>
                <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight text-silver-bright">
                  {formatPriceRange(vehicle.priceMinUsd, vehicle.priceMaxUsd)}
                </p>
                <p className="mt-4 flex items-center gap-2 text-xs font-medium text-silver transition-colors duration-300 group-hover:text-silver-bright">
                  <span>Ver simulación con precio referencial</span>
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-2xl text-center md:mt-14">
        <p className="text-xs leading-relaxed text-ink-4">
          Cada simulación usa el punto medio del rango como precio Miami de
          ejemplo, el año reciente admitido por la calculadora y el tipo de
          motor/ISC más coherente con el modelo. El precio final en Lima depende
          del CIF, SUNAT y tipo de cambio.
        </p>
        <Button href="/#calculator" size="lg" className="mt-6">
          Simular otro vehículo
        </Button>
      </div>
    </section>
  );
}
