import { LUXCARS_CONFIG } from "@/lib/config";
import { Button } from "./Button";
import { formatNumber } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="mt-20 rounded-[40px] border border-white/10 bg-black/80 px-6 py-14 text-white/60 lg:px-14">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            {LUXCARS_CONFIG.brandName}
          </h2>
          <p className="max-w-lg text-sm text-white/60">
            Broker boutique de importación de autos de lujo y exóticos Miami →
            Lima. Llevamos más de {formatNumber(12)} años conectando a clientes
            exigentes con el inventario más exclusivo del mercado.
          </p>
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.35em] text-white/40">
            {LUXCARS_CONFIG.brandVariants.map((variant) => (
              <span
                key={variant}
                className="rounded-full border border-white/10 px-3 py-1"
              >
                {variant}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.4em] text-white/40">
            Agenda una llamada
          </p>
          <Button
            href={`https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
          >
            WhatsApp oficial LuxCars.pe
          </Button>
          <p className="text-sm text-white/50">
            Email concierge:{" "}
            <a
              className="text-white hover:text-[#f5d072]"
              href={`mailto:${LUXCARS_CONFIG.contact.email}`}
            >
              {LUXCARS_CONFIG.contact.email}
            </a>
          </p>
        </div>
      </div>
      <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {CURRENT_YEAR} {LUXCARS_CONFIG.brandName}. Todos los derechos
          reservados.
        </p>
        <div className="flex flex-wrap gap-3">
          <span>
            Dominio oficial: <span className="text-white">LuxCars.pe</span>
          </span>
          <span>Hecho con precisión en Lima & Miami.</span>
        </div>
      </div>
    </footer>
  );
}
