'use client';

import { LUXCARS_CONFIG } from "@/lib/config";
import Image from "next/image";
import { Button } from "./Button";

const HERO_BULLETS = [
  "Importación premium Miami → Lima",
  "Autos exóticos y super SUVs",
  "Concierge 360° con inspección certificada",
];

export function Hero() {
  const handleCalculateClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const calculatorElement = document.getElementById('calculator');
    if (calculatorElement) {
      // Obtener la altura del navbar sticky (aproximadamente 80-100px)
      const navbar = document.querySelector('header');
      const navbarHeight = navbar ? navbar.offsetHeight + 20 : 100; // 20px extra de padding
      const elementPosition = calculatorElement.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - navbarHeight;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth'
      });
    }
  };

  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden rounded-lux-lg border border-line bg-bg px-4 py-16 sm:px-6 sm:py-24 md:rounded-lux-xl lg:px-20 lg:py-32"
    >
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/hero/main.jpg"
          // La foto es un Audi R8 gris mate de tres cuartos trasero en una
          // carretera de montaña al atardecer. El alt anterior decía "SUV de
          // lujo en estudio con iluminación dorada": ni SUV, ni estudio, ni
          // dorado. Describe lo que se ve.
          alt="Audi R8 gris mate visto de tres cuartos trasero sobre una carretera de montaña al atardecer"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Velo sobrio: oscurece el lado del texto y deja respirar la foto. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-r from-void via-void/90 to-void/70 lg:to-void/25"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-void via-transparent to-transparent"
        />
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 md:gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="min-w-0">
          <span
            aria-hidden="true"
            className="block h-px w-12 bg-silver/70 sm:w-16"
          />
          <h1 className="mt-6 text-balance text-3xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Importamos tu auto de lujo desde Miami con transparencia absoluta.
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base text-ink-2 md:mt-6 md:text-lg lg:text-xl">
            LuxCars Perú es el broker boutique que representa tus intereses, no
            los de un dealer. Calcula tu costo real al instante y acompáñanos en
            un proceso seguro, guiado y 100% premium.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 md:mt-10 md:gap-4">
            <Button
              href="/#calculator"
              size="lg"
              className="bg-gold! text-void! shadow-none! hover:bg-gold-bright! hover:shadow-none!"
              onClick={handleCalculateClick}
            >
              Calcular Ahora
            </Button>
            <Button
              href={`https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`}
              variant="secondary"
              size="lg"
              target="_blank"
              rel="noopener noreferrer"
              className="border-line-strong! bg-transparent! text-silver-bright! hover:border-silver! hover:bg-surface-2!"
            >
              WhatsApp
            </Button>
          </div>

          <ul className="mt-8 grid gap-2 text-sm text-ink-2 sm:grid-cols-2 md:mt-12 md:gap-3">
            {HERO_BULLETS.map((bullet) => (
              <li
                key={bullet}
                className="flex min-w-0 items-start gap-2.5 rounded-lux border border-line bg-surface/70 px-3.5 py-2.5 backdrop-blur-sm md:gap-3 md:px-5 md:py-3"
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 inline-block h-1.5 w-1.5 flex-none rounded-full bg-silver"
                />
                <span className="min-w-0 text-sm">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative min-w-0 overflow-hidden rounded-lux-lg border border-line bg-surface/85 p-5 backdrop-blur-sm md:rounded-lux-xl md:p-8">
          <div className="flex h-full flex-col justify-between gap-8 md:gap-12">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-silver-dim">
                LuxCars Signature
              </p>
              <h2 className="mt-3 text-xl font-semibold text-ink md:mt-4 md:text-2xl">
                Concierge Miami → Perú
              </h2>
              <p className="mt-3 text-sm text-ink-3 md:mt-4">
                Acceso directo a inventario off-market, negociación avanzada,
                informes CarFax + AutoCheck y logística end-to-end con equipo en
                Miami y Lima.
              </p>
            </div>
            <dl className="grid gap-2.5 md:gap-4">
              {[
                {
                  label: "Autos cubiertos",
                  value: `USD ${LUXCARS_CONFIG.services.minimumVehiclePrice / 1000}K - 1M+`,
                },
                { label: "Reporte técnico", value: "Inspección ASE + Scanner" },
                { label: "Clientes por mes", value: "Cupos limitados" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lux border border-line bg-surface-2/70 px-3.5 py-3 md:px-5 md:py-4"
                >
                  <dt className="text-[10px] uppercase tracking-[0.3em] text-ink-4 md:text-xs">
                    {item.label}
                  </dt>
                  <dd className="text-xs font-medium text-silver-bright md:text-sm">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
