import { LUXCARS_CONFIG } from "@/lib/config";
import Image from "next/image";
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
      className="relative overflow-hidden rounded-3xl md:rounded-[40px] border border-white/10 bg-neutral-950/90 px-4 py-16 sm:px-6 sm:py-24 shadow-[inset_0_0_90px_rgba(255,255,255,0.08)] backdrop-blur-xl lg:px-20 lg:py-32"
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
      <div className="mx-auto grid max-w-6xl gap-10 md:gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <h1 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Importamos tu auto de lujo desde Miami con transparencia absoluta.
          </h1>
          <p className="mt-5 md:mt-6 max-w-xl text-pretty text-base md:text-lg text-white/70 lg:text-xl">
            LuxCars Perú es el broker boutique que representa tus intereses, no
            los de un dealer. Calcula tu costo real al instante y acompáñanos en
            un proceso seguro, guiado y 100% premium.
          </p>
          <div className="mt-8 md:mt-10 flex flex-wrap items-center gap-3 md:gap-4">
            <Button href="/#calculator" size="lg" className="!text-black">
              Calcular Ahora
            </Button>
            <Button
              href={`https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`}
              variant="secondary"
              size="lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </Button>
          </div>
          <ul className="mt-8 md:mt-12 grid gap-2 md:gap-3 text-sm text-white/65 sm:grid-cols-2">
            {HERO_BULLETS.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-2.5 md:gap-3 rounded-xl md:rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 md:px-5 md:py-3 backdrop-blur-sm"
              >
                <span className="mt-1 inline-flex h-2.5 w-2.5 flex-none rounded-full bg-gradient-to-br from-[#f5d072] to-[#b68b2d] shadow-[0_0_12px_rgba(245,208,114,0.6)]" />
                <span className="text-sm">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-2xl md:rounded-[32px] border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-900/80 to-neutral-950 p-5 md:p-8 shadow-[0_35px_120px_rgba(0,0,0,0.35)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,208,114,0.2),transparent_55%)]" />
          <div className="relative flex h-full flex-col justify-between gap-8 md:gap-12">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/50">
                LuxCars Signature
              </p>
              <h3 className="mt-3 md:mt-4 text-xl md:text-2xl font-semibold text-white">
                Concierge Miami → Perú
              </h3>
              <p className="mt-3 md:mt-4 text-sm text-white/60">
                Acceso directo a inventario off-market, negociación avanzada,
                informes CarFax + AutoCheck y logística end-to-end con equipo en
                Miami y Lima.
              </p>
            </div>
            <div className="grid gap-2.5 md:gap-4">
              {[
                { label: "Autos cubiertos", value: "USD 40K - 1M+" },
                { label: "Reporte técnico", value: "Inspección ASE + Scanner" },
                { label: "Clientes por mes", value: "Cupos limitados" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl md:rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 md:px-5 md:py-4"
                >
                  <span className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-white/50">
                    {item.label}
                  </span>
                  <span className="text-xs md:text-sm font-medium text-white">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
