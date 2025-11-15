import Image from "next/image";
import { SectionHeading } from "./SectionHeading";

const BRAND_LOGOS = [
  { name: "Porsche", file: "porsche.png" },
  { name: "BMW", file: "bmw.png" },
  { name: "Mercedes-Benz", file: "mercedes.png" },
  { name: "Audi", file: "audi.png" },
  { name: "Lexus", file: "lexus.png" },
  { name: "Tesla", file: "tesla.png" },
  { name: "Range Rover", file: "rangerover.png" },
  { name: "Cadillac", file: "cadillac.png" },
  { name: "Dodge SRT", file: "dodge.png" },
  { name: "Ferrari", file: "ferrari.png" },
  { name: "Lamborghini", file: "lamborghini.png" },
  { name: "McLaren", file: "mclaren.png" },
  { name: "Aston Martin", file: "astonmartin.png" },
  { name: "Rolls-Royce", file: "rollsroyce.png" },
  { name: "Bentley", file: "bentley.png" },
];

export function BrandsSection() {
  return (
    <section
      id="brands"
      className="scroll-mt-32 rounded-[40px] border border-white/10 bg-black/70 px-6 py-20 backdrop-blur lg:px-14"
    >
      <SectionHeading
        eyebrow="Marcas & gamas"
        title="Superdeportivos, SUVs exóticas y sedanes ejecutivos"
        description="Trabajamos directamente con las marcas más deseadas del mundo y sus versiones más exclusivas: ediciones limitadas, packs especiales y configuraciones a medida."
        align="center"
      />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {BRAND_LOGOS.map((brand) => (
          <article
            key={brand.name}
            className="group relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-neutral-950/85 via-black/70 to-neutral-900/90 p-8 text-center shadow-[0_25px_90px_rgba(0,0,0,0.4)] transition hover:-translate-y-1 hover:border-[#f5d072]/60 hover:shadow-[0_35px_140px_rgba(245,208,114,0.25)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,208,114,0.3),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative flex h-24 w-full items-center justify-center rounded-2xl border border-white/10 bg-white p-4">
              <Image
                src={`/images/brands/${brand.file}`}
                alt={`Logo ${brand.name}`}
                width={180}
                height={100}
                className="h-full w-full object-contain"
              />
            </div>
            <p className="relative text-sm font-semibold text-white/80">{brand.name}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
