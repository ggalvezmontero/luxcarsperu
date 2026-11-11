/**
 * Plantilla de una guía: migas, título, respuesta corta, cuerpo, enlaces a
 * las demás guías y llamado final. También emite los datos estructurados
 * (Article y migas) y arma el `metadata`, para que cada guía solo escriba su
 * contenido.
 *
 * Sin FAQPage: el layout del sitio ya emite uno en todas las páginas.
 */

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Icon } from "@/components/ui/Icon";
import { Section } from "@/components/ui/Section";
import { LUXCARS_CONFIG } from "@/lib/config";
import { GUIAS, guiaPorSlug, rutaGuia, tituloGuia } from "@/lib/guias";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";
import { ORGANIZATION_ID, breadcrumbSchema } from "@/lib/structuredData";
import { cn } from "@/lib/utils";

const { contact, brandName } = LUXCARS_CONFIG;

/** `metadata` de una guía. El año del título es el de la última regeneración. */
export function metadataDeGuia(slug: string): Metadata {
  const guia = guiaPorSlug(slug);
  const title = tituloGuia(guia, new Date().getFullYear());
  const ogTitle = `${title} | ${brandName}`;
  return {
    title,
    description: guia.descripcion,
    alternates: { canonical: rutaGuia(slug) },
    openGraph: {
      ...OG_DEFAULTS,
      type: "article",
      url: `${contact.website}${rutaGuia(slug)}`,
      title: ogTitle,
      description: guia.descripcion,
      publishedTime: guia.publicada,
      modifiedTime: guia.actualizada,
    },
    twitter: twitterCard(ogTitle, guia.descripcion),
  };
}

function fechaLarga(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export function GuiaLayout({
  slug,
  respuesta,
  children,
}: {
  slug: string;
  /** La respuesta en dos o tres frases. Va arriba, antes de cualquier explicación. */
  respuesta: ReactNode;
  children: ReactNode;
}) {
  const guia = guiaPorSlug(slug);
  const titulo = tituloGuia(guia, new Date().getFullYear());
  const url = `${contact.website}${rutaGuia(slug)}`;
  const otras = GUIAS.filter((g) => g.slug !== slug);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "@id": `${url}#articulo`,
      headline: titulo,
      description: guia.descripcion,
      url,
      mainEntityOfPage: url,
      inLanguage: "es-PE",
      datePublished: guia.publicada,
      dateModified: guia.actualizada,
      author: { "@id": ORGANIZATION_ID },
      publisher: { "@id": ORGANIZATION_ID },
    },
    breadcrumbSchema([
      { nombre: "Inicio", ruta: "/" },
      { nombre: "Guías", ruta: "/guias" },
      { nombre: guia.corto, ruta: rutaGuia(slug) },
    ]),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Navbar />
      <main id="contenido" className="w-full flex-1 pt-[var(--lux-nav-h)]">
        <article>
          <div className="container-lux py-8 sm:py-12">
            <div className="mx-auto max-w-3xl">
              <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-2 text-sm text-ink-4">
                <Link href="/guias" className="hover:text-ink">Guías</Link>
                <Icon name="chevronRight" size={14} />
                <span className="text-ink-2">{guia.corto}</span>
              </nav>
              <h1 className="mt-6 text-balance text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-4xl lg:text-5xl">
                {titulo}
              </h1>
              <p className="mt-4 text-sm text-ink-4">
                Actualizada el {fechaLarga(guia.actualizada)} · Tasas vigentes, las mismas que aplica la calculadora
              </p>

              <div className="glow-lux mt-8 rounded-[22px] border border-line p-6 sm:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-4">La respuesta corta</p>
                <div className="mt-3 space-y-3 text-pretty text-base leading-relaxed text-ink sm:text-lg">{respuesta}</div>
              </div>

              <div className="mt-4">{children}</div>
            </div>
          </div>
        </article>

        <Section tone="void">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Sigue leyendo</h2>
          <ul className="mt-8 grid gap-3 lg:grid-cols-3">
            {otras.map((g) => (
              <li key={g.slug}>
                <Link
                  href={rutaGuia(g.slug)}
                  className="group flex h-full flex-col justify-between gap-4 rounded-[22px] border border-line bg-surface p-5 transition-colors hover:border-line-strong"
                >
                  <span>
                    <span className="block text-base font-semibold leading-snug text-ink">{g.corto}</span>
                    <span className="mt-2 block text-sm leading-relaxed text-ink-3">{g.descripcion}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-silver transition-colors group-hover:text-ink">
                    Leer la guía
                    <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section tone="bg" padding="tight">
          <CtaBand />
        </Section>
      </main>
      <Footer />
    </div>
  );
}

/* --- Piezas del cuerpo ----------------------------------------------------- */

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-24 text-balance text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 text-lg font-semibold leading-snug text-ink">{children}</h3>;
}

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-4 text-pretty text-base leading-relaxed text-ink-2", className)}>{children}</p>;
}

export function Fuerte({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

export function Enlace({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-ink underline underline-offset-4 hover:text-silver-bright">
      {children}
    </Link>
  );
}

export function Lista({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-4 space-y-2.5 text-base leading-relaxed text-ink-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <Icon name="check" size={18} className="mt-1 shrink-0 text-silver" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tabla con la primera columna como encabezado de fila. */
export function Tabla({
  columnas,
  filas,
  nota,
}: {
  columnas: string[];
  filas: ReactNode[][];
  nota?: ReactNode;
}) {
  return (
    <figure className="mt-6">
      <div className="overflow-x-auto rounded-[22px] border border-line bg-surface">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-ink-4">
              {columnas.map((c) => (
                <th key={c} scope="col" className="px-4 py-3.5 font-semibold sm:px-5">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filas.map((fila, i) => (
              <tr key={i}>
                {fila.map((celda, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="px-4 py-3.5 font-medium text-ink sm:px-5">{celda}</th>
                  ) : (
                    <td key={j} className="px-4 py-3.5 tabular-nums text-ink-2 sm:px-5">{celda}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nota ? <figcaption className="mt-3 px-1 text-xs leading-relaxed text-ink-4">{nota}</figcaption> : null}
    </figure>
  );
}

/** Aviso destacado dentro del cuerpo. */
export function Aviso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mt-6 flex gap-4 rounded-[22px] border border-line bg-surface p-5 sm:p-6">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-warn/10 text-warn">
        <Icon name="alert" size={20} />
      </span>
      <div>
        <p className="text-base font-semibold text-ink">{titulo}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{children}</p>
      </div>
    </div>
  );
}

/** Botón a la calculadora, para cerrar una sección con la acción. */
export function IrACalculadora({ texto = "Calcular mi importación" }: { texto?: string }) {
  return (
    <div className="mt-6">
      <Button href="/calculadora" variant="accent" size="lg">
        <Icon name="calculator" size={18} />
        {texto}
      </Button>
    </div>
  );
}

/** Preguntas con respuesta, visibles. `h3` para que cuenten como subtítulos. */
export function Preguntas({ items }: { items: { pregunta: string; respuesta: ReactNode }[] }) {
  return (
    <div className="mt-6 divide-y divide-line rounded-[22px] border border-line bg-surface">
      {items.map((item) => (
        <div key={item.pregunta} className="px-5 py-5 sm:px-6">
          <h3 className="text-base font-semibold text-ink">{item.pregunta}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2 sm:text-[15px]">{item.respuesta}</p>
        </div>
      ))}
    </div>
  );
}
