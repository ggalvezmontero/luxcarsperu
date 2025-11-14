import { LUXCARS_CONFIG } from "@/lib/config";
import { Button } from "./Button";

const HERO_BULLETS = [
  "Importación premium Miami → Lima",
  "Autos exóticos y super SUVs",
  "Concierge 360° con inspección certificada",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-gradient-to-br from-black via-neutral-900 to-black px-6 py-20 shadow-[inset_0_0_80px_rgba(255,255,255,0.05)] sm:px-12 lg:px-20 lg:py-28">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-10 rounded-[32px] bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.08),transparent_60%)]" />
        <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(245,208,114,0.25),transparent_70%)] blur-2xl" />
      </div>
      <div className="mx-auto grid max-w-5xl gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
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
            <Button href="#calculadora" size="lg">
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
      </div>
    </section>
  );
}
