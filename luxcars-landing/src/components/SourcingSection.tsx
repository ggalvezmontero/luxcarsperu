import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

const SUBTITLE =
  "Asesoría gratuita para encontrar la mejor oportunidad real en Miami. Te ayudamos a comparar 10+ opciones sin costo.";

export function SourcingSection() {
  return (
    <section className="rounded-[40px] border border-white/10 bg-black/65 px-6 py-20 lg:px-14">
      <SectionHeading
        eyebrow="Dónde encontramos tu auto"
        title="Exploramos el inventario premium completo"
        description={SUBTITLE}
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LUXCARS_CONFIG.sourcingPlatforms.map((platform) => (
          <article
            key={platform}
            className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/5 px-6 py-6 shadow-[0_25px_90px_rgba(0,0,0,0.35)] transition hover:border-[#f5d072]/50 hover:bg-[#f5d072]/10"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,208,114,0.2),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative flex flex-col gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/50 text-sm font-semibold text-white/60">
                LX
              </span>
              <h3 className="text-base font-semibold text-white">{platform}</h3>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                Miami Verified
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
