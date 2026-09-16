'use client';

import Image from "next/image";
import { LUXCARS_CONFIG } from "@/lib/config";
import { Button } from "./Button";

/**
 * HERO NUEVO — composición de dos caminos.
 *
 * Rompe con el patrón anterior (caja redondeada con foto dentro y texto
 * encima a la izquierda). Aquí:
 *   · La sección sangra de borde a borde: sin radio, sin borde, sin tarjeta.
 *   · Titular gigante a dos tonos que ya enuncia las dos propuestas.
 *   · Dos rutas numeradas a gran escala separadas por filetes, no por tarjetas.
 *   · Foto asimétrica a altura completa en la columna derecha (desktop) y como
 *     banda a sangre entre el titular y las rutas (móvil).
 *   · Un solo elemento dorado: el CTA de la calculadora. Todo lo demás, plata.
 *
 * SANGRADO SIN DESBORDE: desde el rediseño de la home, este hero se monta
 * FUERA del contenedor `max-w-6xl` de src/app/page.tsx, así que ya sangra de
 * borde a borde del viewport por sí solo y no necesita márgenes negativos
 * (`BLEED` queda vacío a propósito). Nunca usar `w-screen` ni `100vw`: suman
 * el ancho de la barra de scroll y reintroducen el desborde horizontal.
 * Si alguien vuelve a montarlo DENTRO de un contenedor con padding, hay que
 * devolver a BLEED los negativos que cancelen exactamente ese padding.
 */

const BLEED = "";

export function HeroNuevo() {
  const scrollToAnchor = (
    event: React.MouseEvent<HTMLAnchorElement>,
    targetId: string,
  ) => {
    const target = document.getElementById(targetId);
    if (!target) return;

    event.preventDefault();
    const navbar = document.querySelector("header");
    const navbarHeight = navbar ? navbar.offsetHeight + 20 : 100;
    const top =
      target.getBoundingClientRect().top + window.pageYOffset - navbarHeight;

    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      aria-labelledby="hero-titular"
      className={`relative isolate w-full overflow-hidden bg-void ${BLEED}`.trim()}
    >
      <div className="grid w-full lg:grid-cols-12 lg:items-stretch">
        {/* ---------------------------------------------------------------
            TITULAR — tipografía como elemento gráfico
            --------------------------------------------------------------- */}
        <div className="min-w-0 px-5 pt-14 pb-10 sm:px-10 sm:pt-20 sm:pb-14 md:px-8 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:pl-12 lg:pt-32 lg:pb-16 lg:pr-16">
          <div className="flex items-center gap-3">
            <Image
              src="/brand/isotipo-blanco.svg"
              alt=""
              aria-hidden="true"
              width={22}
              height={22}
              priority
              className="h-6 w-auto opacity-70 sm:h-7"
            />
            <span className="text-[10px] uppercase leading-none tracking-[0.35em] text-silver-dim sm:text-xs">
              {LUXCARS_CONFIG.contact.city} · Miami
            </span>
          </div>

          <h1
            id="hero-titular"
            className="mt-8 text-4xl font-semibold leading-[0.95] tracking-tight text-ink sm:mt-10 sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Cómpralo hoy.
            <span className="block text-silver-dim">O te lo importamos.</span>
          </h1>

          <p className="mt-7 max-w-xl text-pretty text-base leading-relaxed text-ink-2 sm:mt-9 sm:text-lg">
            Stock propio verificado y disponible en Lima, o el auto exacto que
            buscas traído a pedido desde Miami. Dos caminos, el mismo
            acompañamiento: inspección, nacionalización y papeles en regla.
          </p>
        </div>

        {/* ---------------------------------------------------------------
            FOTO — a sangre, altura completa en desktop, banda en móvil
            --------------------------------------------------------------- */}
        <div className="relative min-w-0 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <div className="relative h-56 w-full sm:h-72 lg:absolute lg:inset-0 lg:h-full">
            <Image
              src="/images/hero/main.jpg"
              alt="Vehículo premium fotografiado en estudio"
              fill
              priority
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover"
            />
            {/* Costura con el negro: vertical en móvil, lateral en desktop. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-void via-void/25 to-transparent lg:bg-linear-to-r lg:from-void lg:via-void/30 lg:to-transparent"
            />
          </div>
        </div>

        {/* ---------------------------------------------------------------
            LAS DOS RUTAS — numeración grande y filetes, sin tarjetas
            --------------------------------------------------------------- */}
        <div className="min-w-0 px-5 pt-12 sm:px-10 sm:pt-16 md:px-8 lg:col-span-7 lg:col-start-1 lg:row-start-2 lg:pl-12 lg:pt-4 lg:pr-16">
          <div className="border-t border-line pt-8 sm:pt-10">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
              <span
                aria-hidden="true"
                className="text-4xl font-semibold leading-none tracking-tight text-ink-4 tabular-nums sm:text-5xl"
              >
                01
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xs uppercase tracking-[0.3em] text-silver-bright">
                  Compra ahora
                </h2>
                <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-ink-3">
                  Unidades de nuestro stock, verificadas y listas para
                  transferir. Las ves, las manejas y te las llevas.
                </p>
                <Button href="/comprar" variant="secondary" className="mt-6">
                  Ver stock disponible
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-line pt-8 sm:mt-12 sm:pt-10">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
              <span
                aria-hidden="true"
                className="text-4xl font-semibold leading-none tracking-tight text-ink-4 tabular-nums sm:text-5xl"
              >
                02
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xs uppercase tracking-[0.3em] text-silver-bright">
                  Importación a pedido
                </h2>
                <p className="mt-3 max-w-md text-pretty text-sm leading-relaxed text-ink-3">
                  Lo buscamos, lo inspeccionamos y lo traemos a tu nombre.
                  Calcula el costo real puesto en Lima antes de decidir; el
                  estimado es referencial y se confirma con SUNAT.
                </p>
                {/* Único elemento dorado de la pantalla. */}
                <Button
                  href="/#calculator"
                  variant="accent"
                  className="mt-6"
                  onClick={(event) => scrollToAnchor(event, "calculator")}
                >
                  Calcular costo real
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* -----------------------------------------------------------------
          FILETE INFERIOR — cierre de identidad.
          Aquí vivía además una lista con las cuatro líneas de negocio. Se
          quitó al ensamblar la home: `LineasNegocioSection` entra justo
          debajo y las despliega enteras, así que el hero las decía dos veces
          en una pantalla y media. El hero cierra con quién factura y por
          dónde se escribe.
          ----------------------------------------------------------------- */}
      <div className="mt-14 border-t border-line px-5 py-7 sm:mt-20 sm:px-10 sm:py-8 md:px-8 lg:mt-24 lg:px-12">
        <p className="text-xs text-ink-4">
          LUX CARS IMPORT S.A.C. ·{" "}
          <a
            href={`https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-b border-line-strong pb-0.5 text-silver transition-colors hover:border-silver hover:text-silver-bright"
          >
            {LUXCARS_CONFIG.contact.phone}
          </a>
        </p>
      </div>
    </section>
  );
}
