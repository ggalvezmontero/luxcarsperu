import type { Metadata } from "next";

import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { LUXCARS_CONFIG } from "@/lib/config";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";

import { FormularioReclamacion } from "./FormularioReclamacion";

/**
 * Libro de Reclamaciones virtual (Ley 29571 y D.S. 011-2011-PCM). Obligatorio
 * para quien vende por internet; el enlace va en el pie de todas las páginas.
 * La hoja se guarda en `public.reclamaciones` y el consumidor recibe su número
 * en pantalla, con opción de imprimirla o guardarla como PDF.
 */
const TITLE = "Libro de Reclamaciones";
const DESCRIPTION = `Libro de Reclamaciones virtual de ${LUXCARS_CONFIG.legalName}. Registra un reclamo o una queja y recibe tu número de hoja al instante.`;
const OG_TITLE = `${TITLE} | ${LUXCARS_CONFIG.brandName}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/libro-de-reclamaciones" },
  openGraph: {
    ...OG_DEFAULTS,
    type: "website",
    url: `${LUXCARS_CONFIG.contact.website}/libro-de-reclamaciones`,
    title: OG_TITLE,
    description: DESCRIPTION,
  },
  twitter: twitterCard(OG_TITLE, DESCRIPTION),
};

export default function LibroDeReclamacionesPage() {
  const { legalName, ruc, contact } = LUXCARS_CONFIG;
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1 pt-[calc(var(--lux-nav-h)+3rem)] pb-20">
        <div className="container-lux max-w-3xl space-y-10">
          <div>
            <p className="eyebrow">Ley 29571 · Código de Protección y Defensa del Consumidor</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Libro de Reclamaciones
            </h1>
            <p className="mt-4 text-pretty text-base leading-relaxed text-ink-2 sm:text-lg">
              Si algo no salió como esperabas, aquí lo registras. Recibes tu número de hoja al instante y te
              respondemos en un plazo máximo de quince (15) días hábiles.
            </p>
          </div>

          <dl className="grid gap-4 rounded-[22px] border border-line bg-surface p-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">Razón social</dt>
              <dd className="mt-1 font-semibold text-ink">{legalName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">RUC</dt>
              <dd className="mt-1 font-semibold tabular-nums text-ink">{ruc}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">Domicilio</dt>
              <dd className="mt-1 text-ink-2">
                {contact.address}, {contact.city}
              </dd>
            </div>
          </dl>

          <FormularioReclamacion />

          <div className="space-y-3 text-xs leading-relaxed text-ink-4">
            <p>
              <strong className="text-ink-3">Reclamo:</strong> disconformidad relacionada con el producto o servicio.{" "}
              <strong className="text-ink-3">Queja:</strong> malestar o descontento respecto a la atención al
              público, sin relación directa con el producto o servicio.
            </p>
            <p>
              La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito
              previo para presentar una denuncia ante el INDECOPI. El proveedor debe dar respuesta en un plazo no
              mayor a quince (15) días hábiles, improrrogables.
            </p>
            <p>
              Tus datos se usan solo para atender esta hoja, conforme a la Ley 29733 de Protección de Datos
              Personales y nuestra política de privacidad.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
