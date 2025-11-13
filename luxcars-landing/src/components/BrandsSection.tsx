import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

export function BrandsSection() {
  return (
    <section className="rounded-[40px] border border-white/10 bg-black/60 px-6 py-20 backdrop-blur lg:px-14">
      <SectionHeading
        eyebrow="Marcas & gamas"
        title="Superdeportivos, SUVs exóticas y sedanes ejecutivos"
        description="Trabajamos directamente con las marcas más deseadas del mundo y sus versiones más exclusivas: ediciones limitadas, packs especiales y configuraciones a medida."
        align="center"
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LUXCARS_CONFIG.brandShowcase.map((brand) => (
          <div
            key={brand}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 via-transparent to-white/5 px-6 py-8 text-center transition duration-500 hover:border-[#f5d072]/60 hover:shadow-[0_25px_90px_rgba(245,208,114,0.25)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,208,114,0.18),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <p className="relative text-lg font-semibold text-white">
              {brand}
            </p>
            <span className="relative mt-3 block text-xs uppercase tracking-[0.35em] text-white/40">
              Miami → Lima
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
