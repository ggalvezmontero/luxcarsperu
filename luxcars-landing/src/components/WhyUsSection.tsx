import Image from "next/image";
import { LUXCARS_CONFIG } from "@/lib/config";
import { SectionHeading } from "./SectionHeading";

// Mapeo de imágenes específicas para cada diferenciador
// Cada diferenciador tiene su propia imagen única
const WHY_US_IMAGE_MAP: Record<string, string> = {
  "Transparencia total": "transparency.jpg",
  "Calculadora pública": "calculator/dashboard.jpg",
  "Ticket premium": "exotics.jpg",
  "Servicio concierge Miami → Perú": "concierge.jpg",
  "Somos tu broker": "how/purchase.jpg", // Negociación y broker
  "Inspección certificada": "how/inspection.jpg",
  "Asesoría de búsqueda": "how/search.jpg",
  "Cupos limitados": "advisory.jpg", // Asesoría personalizada
  "Precio final sin sorpresas": "calculator/dashboard.jpg", // Calculadora para precios sin sorpresas
};

export function WhyUsSection() {
  return (
    <section
      id="why-us"
      className="scroll-mt-32 rounded-[40px] border border-white/10 bg-gradient-to-br from-neutral-950 via-black to-neutral-900 px-6 py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="Por qué LuxCars"
        title="Un broker boutique que protege tu inversión en cada etapa"
        description="Nuestro equipo opera como tu departamento de compras internacional. Transparencia total, gestión personalizada y acceso a inventario que no se publica abiertamente."
      />
      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {LUXCARS_CONFIG.differentiators.map((item) => {
          const imageFile = WHY_US_IMAGE_MAP[item.title] || "advisory.jpg";
          const imagePath = imageFile.startsWith("how/") || imageFile.startsWith("calculator/")
            ? `/images/${imageFile}`
            : `/images/whyus/${imageFile}`;
          
          return (
            <article
              key={item.title}
              className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_100px_rgba(0,0,0,0.35)] transition hover:-translate-y-1 hover:border-[#f5d072]/60 hover:bg-[#f5d072]/10"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,208,114,0.2),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative space-y-4">
                <div className="relative h-28 overflow-hidden rounded-2xl border border-white/10">
                  <Image
                    src={imagePath}
                    alt={item.title}
                    fill
                    sizes="(min-width: 1280px) 280px, (min-width: 1024px) 240px, 100vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />
                  <span className="absolute left-4 top-3 inline-flex items-center rounded-full border border-[#f5d072]/30 bg-[#f5d072]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-[#fbe5a4]">
                    LuxCars
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="text-sm text-white/70">{item.description}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-10 grid gap-6 rounded-3xl border border-white/10 bg-black/60 p-6 text-sm text-white/70 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <p>
          Sin stock propio, sin comisiones ocultas, sin presión de venta. Cada
          decisión se toma junto a ti. Te mostramos comparativas reales, modelos
          disponibles en tiempo real y trabajamos como tu equipo de compras en
          Miami.
        </p>
        <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <Image
            src="/images/contact/concierge.jpg"
            alt="Asesoría concierge LuxCars"
            width={120}
            height={80}
            className="h-16 w-20 rounded-2xl border border-white/10 object-cover"
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              Concierge bilingüe dedicado
            </p>
            <p className="text-xs text-white/60">
              Miami · Lima · Disponibilidad 7/365 para acompañarte en todo el
              proceso.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
