import { BRAND_LOGOS, LOGO_MODE_CLASS } from "@/lib/brandLogos";
import Image from "next/image";

/** Franja de marcas en marquesina continua. Sin JS. */
export function BrandsMarquee({ label = "Marcas con las que trabajamos" }: { label?: string }) {
  const items = [...BRAND_LOGOS, ...BRAND_LOGOS];
  return (
    <div className="w-full overflow-hidden border-y border-line bg-void py-8">
      <p className="container-lux mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-4">
        {label}
      </p>
      <div className="relative [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <ul className="lux-marquee gap-12 px-6" aria-label={label}>
          {items.map((b, i) => (
            <li key={`${b.name}-${i}`} className="flex h-8 w-28 shrink-0 items-center justify-center" aria-hidden={i >= BRAND_LOGOS.length}>
              <Image
                src={`/images/brands/${b.file}`}
                alt={i < BRAND_LOGOS.length ? b.name : ""}
                width={140}
                height={70}
                unoptimized
                className={`h-full w-auto max-w-full object-contain opacity-70 transition-opacity hover:opacity-100 ${LOGO_MODE_CLASS[b.mode]}`}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
