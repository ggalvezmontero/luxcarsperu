import Image from "next/image";
import { SectionHeading } from "./SectionHeading";

const BRAND_LOGOS = [
  { name: "Aston Martin", file: "astonmartin.png" },
  { name: "Audi", file: "audi.png" },
  { name: "Bentley", file: "bentley.png" },
  { name: "BMW", file: "bmw.png" },
  { name: "Cadillac", file: "cadillac.png" },
  { name: "Chevrolet", file: "chevrolet.svg" },
  { name: "Chrysler", file: "chrysler.png" },
  { name: "Dodge SRT", file: "dodge.png" },
  { name: "Ferrari", file: "ferrari.png" },
  { name: "Ford", file: "ford.svg" },
  { name: "Jeep", file: "jeep.svg" },
  { name: "Lamborghini", file: "lamborghini.png" },
  { name: "Lexus", file: "lexus.png" },
  { name: "McLaren", file: "mclaren.png" },
  { name: "Mercedes-Benz", file: "mercedes.png" },
  { name: "Porsche", file: "porsche.png" },
  { name: "Range Rover", file: "rangerover.png" },
  { name: "Rolls-Royce", file: "rollsroyce.png" },
  { name: "Tesla", file: "tesla.png" },
  { name: "Toyota", file: "toyota.svg" },
];

export function BrandsSection() {
  return (
    <section
      id="brands"
      className="scroll-mt-32 rounded-lux-xl border border-line bg-surface px-5 py-16 sm:px-8 sm:py-20 lg:px-14"
    >
      <SectionHeading
        eyebrow="Marcas & gamas"
        title="Superdeportivos, SUVs exóticas y sedanes ejecutivos"
        description="Trabajamos directamente con las marcas más deseadas del mundo y sus versiones más exclusivas: ediciones limitadas, packs especiales y configuraciones a medida."
        align="center"
      />

      <ul className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-lux-lg border border-line bg-line sm:mt-14 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {BRAND_LOGOS.map((brand) => (
          <li
            key={brand.name}
            className="group flex flex-col items-center justify-start gap-4 bg-surface px-4 py-7 text-center transition-colors duration-300 hover:bg-surface-2 sm:px-5 sm:py-8"
          >
            <div className="flex h-14 w-full items-center justify-center rounded-lux bg-ink p-3 opacity-55 grayscale transition-opacity duration-300 group-hover:opacity-100 sm:h-16">
              <Image
                src={`/images/brands/${brand.file}`}
                alt={`Logo ${brand.name}`}
                width={180}
                height={100}
                className="h-full w-full object-contain"
              />
            </div>
            <p className="text-[0.6875rem] font-medium uppercase leading-tight tracking-[0.14em] text-ink-3 transition-colors duration-300 group-hover:text-silver-bright">
              {brand.name}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
