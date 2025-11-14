import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

export function DifferentiatorsSection() {
  return (
    <section className="rounded-[40px] border border-white/10 bg-gradient-to-br from-neutral-950 via-black to-neutral-900 px-6 py-20 lg:px-14">
      <SectionHeading
        eyebrow="Por qué LuxCars"
        title="Importar autos de lujo con transparencia y acompañamiento total"
        description="Somos brokers independientes. Nuestro compromiso es proteger tu inversión, mostrarte cifras reales y acompañarte hasta que el auto esté en tu garage."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {LUXCARS_CONFIG.differentiators.map((item) => (
          <article
            key={item.title}
            className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_100px_rgba(0,0,0,0.35)] transition ring-offset-2 hover:border-[#f5d072]/60 hover:bg-[#f5d072]/10 hover:ring-2 hover:ring-[#f5d072]/40"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,208,114,0.15),transparent_70%)] opacity-0 transition-opacity duration-500 hover:opacity-100" />
            <div className="relative">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#f5d072]/30 bg-[#f5d072]/10 text-sm font-semibold text-[#fbe5a4]">
                LX
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-white/70">{item.description}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="mt-10 rounded-3xl border border-white/10 bg-black/60 p-6 text-sm text-white/60">
        <p>
          Sin stock propio, sin comisiones ocultas, sin presión de venta. Cada
          decisión se toma junto a ti. Te mostramos comparativas reales y
          trabajamos como tu equipo de compras en Miami.
        </p>
      </div>
    </section>
  );
}
