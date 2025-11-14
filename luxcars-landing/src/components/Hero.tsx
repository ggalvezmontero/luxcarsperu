import Image from "next/image";
import { LUXCARS_CONFIG } from "@/lib/config";
import { Button } from "./Button";

const HERO_BULLETS = [
  "Importación premium Miami → Lima",
  "Autos exóticos y super SUVs",
  "Concierge 360° con inspección certificada",
];

export function Hero() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden rounded-[40px] border border-white/10 bg-neutral-950/90 px-6 py-24 shadow-[inset_0_0_90px_rgba(255,255,255,0.08)] backdrop-blur-xl sm:px-12 lg:px-20 lg:py-32"
    >
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/hero/main.jpg"
          alt="SUV de lujo en estudio con iluminación dorada"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black via-black/80 to-neutral-950/95" />
        <div className="absolute -left-32 top-32 h-72 w-72 rounded-full bg-[#f5d072]/20 blur-3xl" />
        <div className="absolute -right-24 bottom-16 h-72 w-72 rounded-full bg-[#b68b2d]/30 blur-3xl" />
      </div>
      <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.35em] text-white/60">
            {LUXCARS_CONFIG.brandVariants.slice(0, 3).map((variant) => (
              <span
                key={variant}
                className="rounded-full border border-white/10 px-4 py-1 backdrop-blur"
              >
                {variant}
              </span>
            ))}
          </div>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Importamos tu auto de lujo desde Miami con transparencia absoluta.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg text-white/70 lg:text-xl">
            LuxCars Perú es el broker boutique que representa tus intereses, no
            los de un dealer. Calcula tu costo real al instante y acompáñanos en
            un proceso seguro, guiado y 100% premium.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button href="#calculator" size="lg">
              Calcular precio
            </Button>
            <Button
              href={`https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`}
              variant="secondary"
              size="lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              Hablar por WhatsApp
            </Button>
          </div>
          <ul className="mt-12 grid gap-3 text-sm text-white/65 sm:grid-cols-2">
            {HERO_BULLETS.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-sm"
              >
                <span className="mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-gradient-to-br from-[#f5d072] to-[#b68b2d] shadow-[0_0_12px_rgba(245,208,114,0.6)]" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-900/80 to-neutral-950 p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,208,114,0.2),transparent_55%)]" />
          <div className="relative flex h-full flex-col justify-between gap-12">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                LuxCars Signature
              </p>
              <h3 className="mt-4 text-2xl font-semibold text-white">
                Concierge Miami → Perú
              </h3>
              <p className="mt-4 text-sm text-white/60">
                Acceso directo a inventario off-market, negociación avanzada,
                informes CarFax + AutoCheck y logística end-to-end con equipo en
                Miami y Lima.
              </p>
            </div>
            <div className="grid gap-4">
              {[
                { label: "Autos cubiertos", value: "USD 50K - 1M+" },
                { label: "Reporte técnico", value: "Inspección ASE + Scanner" },
                { label: "Clientes por mes", value: "Cupos limitados" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
                >
                  <span className="text-xs uppercase tracking-[0.3em] text-white/50">
                    {item.label}
                  </span>
                  <span className="text-sm font-medium text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-black/50 p-8 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-bl from-white/10 via-transparent to-transparent opacity-40" />
          <div className="relative space-y-6">
            <Image
              src="/images/hero/main.jpg"
              alt="LuxCars concierge importando autos de lujo desde Miami"
              width={640}
              height={360}
              className="h-48 w-full rounded-3xl border border-white/10 object-cover"
              priority
            />
            <p className="text-sm text-white/70">
              Concierge bilingüe en Miami y Lima coordinando adquisición,
              inspecciones ASE, logística marítima y nacionalización con
              transparencia total.
            </p>
            <div className="grid gap-3 text-sm text-white/70">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#f5d072]/30 bg-[#f5d072]/15 text-xs font-semibold text-[#fbe5a4]">
                  01
                </span>
                <div>
                  <p className="font-semibold text-white">Broker independiente</p>
                  <p className="text-xs text-white/60">
                    Representamos tus intereses, no el inventario de un dealer.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#f5d072]/30 bg-[#f5d072]/15 text-xs font-semibold text-[#fbe5a4]">
                  02
                </span>
                <div>
                  <p className="font-semibold text-white">Inventario mundial</p>
                  <p className="text-xs text-white/60">
                    Acceso a marcas exóticas, ediciones limitadas y subastas
                    privadas.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 rounded-3xl border border-white/10 bg-black/60 px-4 py-4">
              {["porsche", "bmw", "lamborghini"].map((brand) => (
                <Image
                  key={brand}
                  src={`/images/brands/${brand}.png`}
                  alt={`${brand} logo`}
                  width={160}
                  height={80}
                  className="h-16 w-full rounded-2xl border border-white/10 bg-white/5 object-cover p-2"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
