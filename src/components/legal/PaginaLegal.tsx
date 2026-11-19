import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "../Button";
import { Footer } from "../Footer";
import { Navbar } from "../Navbar";
import { Icon, WhatsAppIcon, type IconName } from "../ui/Icon";
import { LUXCARS_CONFIG } from "@/lib/config";

export type SeccionLegal = {
  /** Ancla de la sección (sin #). */
  id: string;
  titulo: string;
  contenido: ReactNode;
};

export type ResumenLegal = { icon: IconName; titulo: string; texto: string };

/**
 * Plantilla de las páginas legales (términos, privacidad, cookies).
 *
 * Mismo texto que antes, otra lectura: un resumen de tres puntos arriba, un
 * índice fijo a la izquierda en escritorio y las secciones numeradas con el
 * ritmo del resto del sitio. La tarjeta de contacto cierra todas por igual.
 * Los textos de h1 y h2 no cambian: los lee Google.
 */
export function PaginaLegal({
  eyebrow,
  titulo,
  actualizada,
  intro,
  resumen,
  secciones,
  contactoTitulo,
  contactoTexto,
}: {
  eyebrow: string;
  titulo: string;
  actualizada: string;
  intro: string;
  resumen: ResumenLegal[];
  secciones: SeccionLegal[];
  /** Título de la sección de contacto, numerada al final. */
  contactoTitulo: string;
  contactoTexto: string;
}) {
  const { contact } = LUXCARS_CONFIG;
  const total = secciones.length + 1;
  const num = (i: number) => String(i + 1).padStart(2, "0");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1 pt-[var(--lux-nav-h)]">
        {/* Cabecera */}
        <header className="lux-glow-top border-b border-white/[0.06] bg-void">
          <div className="container-lux py-14 sm:py-20">
            <div className="max-w-3xl">
              <p className="eyebrow">{eyebrow}</p>
              <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                {titulo}
              </h1>
              <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-ink-2 sm:text-lg">{intro}</p>
              <p className="mt-6 inline-flex items-center gap-2 text-sm text-ink-4">
                <Icon name="calendar" size={15} />
                Última actualización: {actualizada}
              </p>
            </div>

            <dl className="mt-10 grid gap-px overflow-hidden rounded-[22px] border border-white/[0.07] bg-line sm:grid-cols-3">
              {resumen.map((r) => (
                <div key={r.titulo} className="flex gap-4 bg-surface p-5 sm:p-6">
                  <span className="icon-lux !h-10 !w-10">
                    <Icon name={r.icon} size={18} />
                  </span>
                  <div>
                    <dt className="text-sm font-semibold text-ink">{r.titulo}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-ink-3">{r.texto}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </header>

        {/* Cuerpo: índice + secciones */}
        <div className="container-lux py-14 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <nav aria-label="Índice" className="lg:col-span-3">
              <div className="lg:sticky lg:top-[calc(var(--lux-nav-h)+1.5rem)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-silver">En esta página</p>
                <ol className="mt-4 space-y-1 border-l border-line">
                  {[...secciones.map((s) => ({ id: s.id, titulo: s.titulo })), { id: "contacto", titulo: contactoTitulo }].map(
                    (s, i) => (
                      <li key={s.id}>
                        <Link
                          href={`#${s.id}`}
                          className="-ml-px flex gap-3 border-l border-transparent py-1.5 pl-4 text-sm text-ink-3 transition-colors hover:border-silver hover:text-ink"
                        >
                          <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-ink-4">{num(i)}</span>
                          <span>{s.titulo}</span>
                        </Link>
                      </li>
                    ),
                  )}
                </ol>
              </div>
            </nav>

            <div className="lg:col-span-8 lg:col-start-5">
              <div className="divide-y divide-line">
                {secciones.map((s, i) => (
                  <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titulo`} className="scroll-mt-28 py-10 first:pt-0 sm:py-12">
                    <div className="grid gap-4 sm:grid-cols-[3.5rem_1fr]">
                      <span className="font-mono text-sm tabular-nums text-silver-dim">{num(i)}</span>
                      <div className="min-w-0">
                        <h2 id={`${s.id}-titulo`} className="text-balance text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                          {s.titulo}
                        </h2>
                        <div className="prosa-legal mt-4">{s.contenido}</div>
                      </div>
                    </div>
                  </section>
                ))}

                {/* Contacto */}
                <section id="contacto" aria-labelledby="contacto-titulo" className="scroll-mt-28 py-10 sm:py-12">
                  <div className="grid gap-4 sm:grid-cols-[3.5rem_1fr]">
                    <span className="font-mono text-sm tabular-nums text-silver-dim">{num(total - 1)}</span>
                    <div className="min-w-0">
                      <h2 id="contacto-titulo" className="text-balance text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                        {contactoTitulo}
                      </h2>
                      <p className="prosa-legal mt-4">{contactoTexto}</p>
                      <div className="mt-6 grid gap-px overflow-hidden rounded-[22px] border border-white/[0.07] bg-line sm:grid-cols-2">
                        <a
                          href={`mailto:${contact.email}`}
                          className="group flex items-center gap-4 bg-surface p-5 transition-colors hover:bg-surface-2"
                        >
                          <span className="icon-lux !h-10 !w-10">
                            <Icon name="mail" size={18} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] uppercase tracking-[0.14em] text-ink-4">Email</span>
                            <span className="block truncate text-sm font-semibold text-ink">{contact.email}</span>
                          </span>
                        </a>
                        <a
                          href={`https://wa.me/${contact.whatsappNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-4 bg-surface p-5 transition-colors hover:bg-surface-2"
                        >
                          <span className="icon-lux !h-10 !w-10 !text-whatsapp">
                            <WhatsAppIcon size={18} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] uppercase tracking-[0.14em] text-ink-4">WhatsApp</span>
                            <span className="block text-sm font-semibold text-ink">{contact.phone}</span>
                          </span>
                        </a>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-8">
                <p className="text-xs text-ink-4">
                  {LUXCARS_CONFIG.legalName} · RUC {LUXCARS_CONFIG.ruc}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button href="/terminos" variant="ghost" size="sm">Términos</Button>
                  <Button href="/privacidad" variant="ghost" size="sm">Privacidad</Button>
                  <Button href="/cookies" variant="ghost" size="sm">Cookies</Button>
                  <Button href="/libro-de-reclamaciones" variant="ghost" size="sm">Libro de Reclamaciones</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
