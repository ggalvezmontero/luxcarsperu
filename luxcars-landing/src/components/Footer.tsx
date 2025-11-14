'use client';

import { LUXCARS_CONFIG } from "@/lib/config";
import { Button } from "./Button";

const CURRENT_YEAR = new Date().getFullYear();

const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/luxcars.pe",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/luxcars-pe",
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@luxcarspe",
  },
];

export function Footer() {
  return (
    <footer className="mt-20 rounded-[40px] border border-white/10 bg-[#0f0f0f]/85 px-6 py-16 text-white/70 backdrop-blur lg:px-14">
      <div className="grid gap-12 lg:grid-cols-[1.15fr_0.9fr_0.95fr]">
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold text-white tracking-tight">
            {LUXCARS_CONFIG.brandName}
          </h2>
          <p className="max-w-lg text-sm text-white/60">
            Broker boutique de importación de autos de lujo y exóticos Miami → Lima.
            Coordinamos búsqueda, negociación, inspecciones certificadas y entrega concierge.
          </p>
          <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.4em] text-white/45">
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
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.4em] text-white/45">
            Oficinas en Lima
          </p>
          <address className="space-y-2 text-sm not-italic text-white/65">
            <p className="text-white/80">
              Av. Santo Toribio 173, Oficina 702<span className="hidden sm:inline"> · </span>
              <br className="sm:hidden" />
              San Isidro, Lima 15073
            </p>
            <p>Horario: Lunes a Viernes · 9:00 — 18:00</p>
          </address>
          <div className="space-y-2 text-sm">
            <p>
              Teléfono concierge:{" "}
              <a
                className="text-white transition hover:text-[#f1d387]"
                href={`https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                +{LUXCARS_CONFIG.contact.whatsappNumber}
              </a>
            </p>
            <p>
              Email:{" "}
              <a
                className="text-white transition hover:text-[#f1d387]"
                href={`mailto:${LUXCARS_CONFIG.contact.email}`}
              >
                {LUXCARS_CONFIG.contact.email}
              </a>
            </p>
          </div>
          <Button
            href={`https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            className="w-full sm:w-auto"
          >
            Coordinar visita privada
          </Button>
        </div>
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-[0.4em] text-white/45">
            Síguenos
          </p>
          <p className="text-sm text-white/60">
            Acceso directo a lanzamientos, inventario curado y eventos privados.
          </p>
          <ul className="space-y-3 text-sm text-white/70">
            {SOCIAL_LINKS.map((item) => (
              <li key={item.label}>
                <a
                  className="inline-flex items-center gap-2 transition hover:text-[#f1d387]"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/20 text-[10px] uppercase tracking-[0.25em] text-white/70">
                    {item.label[0]}
                  </span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
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
