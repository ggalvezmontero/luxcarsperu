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
      className="scroll-mt-32 rounded-[40px] border border-white/10 bg-black/70 px-6 py-20 backdrop-blur lg:px-14"
    >
      <SectionHeading
        eyebrow="Dónde buscamos tu auto"
        title="Inventario curado en marketplaces y sitios oficiales"
        description="Analizamos oportunidades reales, verificamos vendedores y presentamos comparativas claras de precio, kilometraje y estado."
      />
      <div className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="grid gap-6 sm:grid-cols-2">
          {WEBSITE_LOGOS.map((site) => (
            <article
              key={site.name}
              className="group relative flex items-center gap-4 overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-r from-white/10 via-black/60 to-black/80 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] transition hover:-translate-y-0.5 hover:border-[#f5d072]/50 hover:shadow-[0_28px_120px_rgba(245,208,114,0.25)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(245,208,114,0.25),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative flex h-16 w-16 flex-none items-center justify-center rounded-2xl border border-white/10 bg-black/60 p-2">
                <Image
                  src={`/images/websites/${site.file}`}
                  alt={`Logo ${site.name}`}
                  width={72}
                  height={72}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="relative">
                <p className="text-sm font-semibold text-white">{site.name}</p>
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">
                  Fuente verificada
                </p>
              </div>
            </article>
          ))}
        </div>
        <div className="space-y-6 rounded-[28px] border border-white/10 bg-gradient-to-br from-neutral-950 via-black/70 to-neutral-900 p-8 shadow-[0_25px_100px_rgba(0,0,0,0.35)]">
          <Image
            src="/images/how/search.jpg"
            alt="Selección de autos de lujo en marketplaces premium"
            width={640}
            height={360}
            className="h-48 w-full rounded-2xl border border-white/10 object-cover"
          />
          <div className="space-y-4 text-sm text-white/70">
            <p>
              Complementamos la búsqueda con inventario directo de concesionarios
              certificados, subastas cerradas y colecciones privadas.
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-[#f5d072]" />
                Validación de reputación del vendedor y condiciones de entrega.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-[#f5d072]" />
                Comparativa de precios vs mercado peruano y oportunidades de ahorro.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-[#f5d072]" />
                Negociación prioritaria gracias a relaciones con dealers boutique.
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[#f5d072]/30 bg-[#f5d072]/10 p-4 text-sm text-[#fbe5a4]">
            {LUXCARS_CONFIG.brandName} revisa en promedio 12 portales por cliente
            antes de cerrar la compra ideal.
          </div>
        </div>
      </div>
    </section>
  );
}
