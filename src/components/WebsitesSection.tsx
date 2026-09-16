import Image from "next/image";
import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

const WEBSITE_LOGOS = [
  { name: "Autotrader", file: "autotrader.png" },
  { name: "CarGurus", file: "cargurus.png" },
  { name: "Cars.com", file: "carsdotcom.png" },
  { name: "TrueCar", file: "truecar.png" },
  { name: "eBay Motors", file: "ebaymotors.png" },
  { name: "AutoTempest", file: "autotempest.png" },
  { name: "Facebook Marketplace", file: "marketplace.png" },
  { name: "Porsche Certified", file: "porsche.svg" },
  { name: "BMW USA", file: "bmw.svg" },
  { name: "Tesla Inventory", file: "tesla.svg" },
];

export function WebsitesSection() {
  return (
    <section
      id="websites"
      className="scroll-mt-32 rounded-lux-xl border border-line bg-surface/70 px-5 py-16 backdrop-blur sm:px-8 lg:px-14 lg:py-24"
    >
      <SectionHeading
        eyebrow="Dónde buscamos tu auto"
        title="Inventario curado en marketplaces y sitios oficiales"
        description="Analizamos oportunidades reales, verificamos vendedores y presentamos comparativas claras de precio, kilometraje y estado."
      />

      <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-ink-3">
            Fuentes verificadas
          </h3>
          <ul className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lux border border-line bg-line sm:grid-cols-3">
            {WEBSITE_LOGOS.map((site) => (
              <li
                key={site.name}
                className="flex min-w-0 flex-col items-center justify-center gap-3 bg-surface px-3 py-6 transition-colors duration-300 hover:bg-surface-2"
              >
                <Image
                  src={`/images/websites/${site.file}`}
                  alt={`Logo ${site.name}`}
                  width={72}
                  height={72}
                  className="h-9 w-auto max-w-full object-contain opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0"
                />
                {/* Sin truncate: a 360px "Facebook Marketplace" perdia la ultima
                    letra. La celda es flex-col centrada, asi que envolver solo
                    la hace mas alta y la reticula mantiene el ritmo. */}
                <p className="w-full text-balance text-center text-[11px] leading-tight tracking-wide text-ink-3">
                  {site.name}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 space-y-6 rounded-lux-lg border border-line bg-surface p-6 sm:p-8">
          <Image
            src="/images/how/search.jpg"
            alt="Selección de autos de lujo en marketplaces premium"
            width={640}
            height={360}
            className="h-44 w-full rounded-lux border border-line object-cover sm:h-48"
          />
          <div className="space-y-5 text-sm text-ink-2">
            <p>
              Complementamos la búsqueda con inventario directo de concesionarios
              certificados, subastas cerradas y colecciones privadas.
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-[7px] inline-flex h-px w-4 flex-none bg-silver-dim"
                />
                <span className="min-w-0">
                  Validación de reputación del vendedor y condiciones de entrega.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-[7px] inline-flex h-px w-4 flex-none bg-silver-dim"
                />
                <span className="min-w-0">
                  Comparativa de precios vs mercado peruano y oportunidades de ahorro.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-[7px] inline-flex h-px w-4 flex-none bg-silver-dim"
                />
                <span className="min-w-0">
                  Negociación prioritaria gracias a relaciones con dealers boutique.
                </span>
              </li>
            </ul>
          </div>
          <p className="border-l-2 border-silver bg-surface-2 px-4 py-3 text-sm text-ink-2">
            {LUXCARS_CONFIG.brandName} revisa en promedio 12 portales por cliente
            antes de cerrar la compra ideal.
          </p>
        </div>
      </div>
    </section>
  );
}
