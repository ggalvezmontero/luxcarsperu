import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { Button } from "@/components/Button";
import { CtaBand } from "@/components/CtaBand";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { LUXCARS_CONFIG } from "@/lib/config";
import {
  CUENTA_RUTA,
  DINERO_RUTA,
  FIRMAS_RUTA,
  PAGOS_RUTA,
  PASOS_RUTA,
  PDF_RUTA,
} from "@/lib/rutaAPedido";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";

/* ---------------------------------------------------------------------------
   Hoja de ruta del cliente que contrata la importación a pedido: qué pasa, qué
   paga, qué firma y qué ve en su cuenta. Es la página que el asesor deja al
   cliente después de la cita (y la versión web del PDF de una página).
   `/como-funciona` responde "cómo importar un auto a Perú" con los seis pasos
   operativos; esta responde a quien ya va a contratar y quiere saber cómo se
   maneja su dinero. Títulos distintos para que Google no las confunda.
   ------------------------------------------------------------------------- */
const TITULO = "Importación a pedido: pasos, pagos y firmas";
const DESCRIPCION =
  "Lo que vive el cliente que importa un auto con Luxcars: cinco pasos, cinco pagos, una sola visita a la notaría, una cuenta separada para su dinero y el seguimiento desde su cuenta en luxcars.pe.";
const OG_TITLE = `${TITULO} | ${LUXCARS_CONFIG.brandName}`;
const { deliveryWindows, contact } = LUXCARS_CONFIG;

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/importar/ruta" },
  openGraph: {
    ...OG_DEFAULTS,
    type: "website",
    url: `${contact.website}/importar/ruta`,
    title: OG_TITLE,
    description: DESCRIPCION,
  },
  twitter: twitterCard(OG_TITLE, DESCRIPCION),
};


export default function RutaAPedidoPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <BreadcrumbJsonLd
        items={[
          { nombre: "Importar", ruta: "/importar" },
          { nombre: "Ruta a pedido", ruta: "/importar/ruta" },
        ]}
      />
      <Navbar />
      <main id="contenido" className="w-full flex-1">
        <section className="relative isolate w-full overflow-hidden bg-void lux-glow-top pt-[calc(var(--lux-nav-h)+3rem)] pb-12 sm:pt-[calc(var(--lux-nav-h)+4rem)] sm:pb-16">
          <div className="container-lux relative">
            <h1>
              <span className="eyebrow">Importación a pedido</span>{" "}
              <span className="mt-3 block max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                Tu ruta, <span className="display-accent">paso a paso</span>
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-base text-ink-2 sm:text-lg">
              Cinco pasos, cinco pagos y una sola visita a la notaría. Tu dinero en una cuenta
              separada, los tributos directo a SUNAT y cada movimiento visible desde tu cuenta en luxcars.pe.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href={PDF_RUTA} variant="accent" size="lg" data-ga-cta="ruta_pdf">
                <Icon name="download" size={18} />
                Descargar en una página (PDF)
              </Button>
              <Button href="/calculadora" variant="secondary" size="lg" data-ga-cta="ruta_calculadora">
                <Icon name="calculator" size={18} />
                Calcular mi importación
              </Button>
            </div>
            <ul className="mt-8 grid max-w-2xl grid-cols-3 gap-3 text-center sm:text-left">
              {[
                [`${deliveryWindows.fastTrack.days[0]}–${deliveryWindows.standard.days[1]}`, "días desde EE.UU."],
                [String(PAGOS_RUTA.length), "pagos, cada uno con su comprobante"],
                ["1", "visita a la notaría"],
              ].map(([n, l]) => (
                <li key={l} className="rounded-2xl border border-line/80 bg-void/60 p-3 sm:p-4">
                  <p className="whitespace-nowrap text-lg font-semibold tabular-nums text-ink sm:text-2xl">{n}</p>
                  <p className="text-[11px] text-ink-3 sm:text-xs">{l}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Los cinco pasos, con lo que hace el cliente y los pagos que dispara cada uno. */}
        <Section tone="bg">
          <SectionHeader
            eyebrow="Los cinco pasos"
            title="Qué pasa, en orden"
            description="Cada paso tiene una parte nuestra y una tuya. La tuya siempre se resuelve desde tu cuenta o en una visita a la notaría."
          />
          <ol className="mt-10 grid gap-px overflow-hidden rounded-[22px] border border-line bg-line">
            {PASOS_RUTA.map((p, i) => (
              <li key={p.titulo} className="grid gap-5 bg-surface p-6 sm:p-8 lg:grid-cols-[auto_1fr_minmax(0,18rem)] lg:gap-8">
                <div className="flex items-start gap-4 lg:w-56">
                  <span className="icon-lux">
                    <Icon name={p.icon} size={22} />
                  </span>
                  <div>
                    <span className="font-mono text-sm text-silver">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">{p.titulo}</h3>
                  </div>
                </div>
                <div>
                  <p className="text-sm leading-relaxed text-ink-2">{p.texto}</p>
                  <p className="mt-3 text-sm text-ink-3">
                    <span className="font-semibold text-ink">Tu parte:</span> {p.tuParte}
                  </p>
                </div>
                <div className="grid content-start gap-3">
                  {p.pagos?.length ? (
                    p.pagos.map((pago) => (
                      <div key={pago.numero} className="rounded-2xl border border-gold-dim/60 bg-void/40 p-4">
                        <p className="eyebrow text-gold!">Pago {pago.numero}</p>
                        <p className="mt-2 text-base font-semibold text-ink">{pago.titulo}</p>
                        <p className="mt-1 text-xs leading-relaxed text-ink-3">{pago.detalle}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-line/70 p-4">
                      <p className="eyebrow">Sin pago</p>
                      <p className="mt-2 text-sm text-ink-3">Buscar y cotizar no cuesta. Decidimos juntos si conviene traerlo.</p>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-ink-4">
            Desde Estados Unidos, entre {deliveryWindows.fastTrack.days[0]} y {deliveryWindows.standard.days[1]} días según el plan;
            desde otros países el plazo se fija al cotizar. El tramo marítimo depende del calendario de naves.
          </p>
        </Section>

        {/* Dinero: la parte que decide la confianza. */}
        <Section tone="void">
          <SectionHeader
            eyebrow="Tu dinero"
            title="Cinco pagos, una cuenta separada"
            description="Pagas cuando cada cosa toca, nunca mezclamos tu dinero con el nuestro y los tributos los pagas directo a SUNAT."
          />
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ol className="grid gap-3">
              {PAGOS_RUTA.map((pago) => (
                <li key={pago.numero} className="panel-lux flex items-start gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold-dim/70 font-mono text-sm text-gold">
                    {pago.numero}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-ink">{pago.titulo}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-3">{pago.detalle}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ul className="grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-2">
              {DINERO_RUTA.map((d) => (
                <li key={d.titulo} className="flex items-start gap-4 bg-surface p-5">
                  <span className="icon-lux">
                    <Icon name={d.icon} size={20} />
                  </span>
                  <span>
                    <h3 className="text-sm font-semibold text-ink">{d.titulo}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-ink-3">{d.texto}</p>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 text-sm text-ink-3">
            Los honorarios y cada tributo están explicados en la{" "}
            <Link href="/calculadora" className="font-medium text-ink underline underline-offset-4">
              calculadora de importación
            </Link>
            .
          </p>
        </Section>

        {/* Firmas y la cuenta del cliente. */}
        <Section tone="bg">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <SectionHeader eyebrow="Lo que firmas" title="Dos momentos de firma en todo el proceso" />
              <ol className="mt-8 grid gap-px overflow-hidden rounded-[22px] border border-line bg-line">
                {FIRMAS_RUTA.map((f, i) => (
                  <li key={f.titulo} className="flex items-start gap-4 bg-surface p-5">
                    <span className="font-mono text-sm text-silver">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <h3 className="text-sm font-semibold text-ink">{f.titulo}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-ink-3">{f.texto}</p>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <SectionHeader eyebrow="Tu cuenta en luxcars.pe" title="Todo el expediente, a la vista" />
              <ul className="mt-8 grid gap-3">
                {CUENTA_RUTA.map((c) => (
                  <li key={c} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm text-ink-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-silver-bright">
                      <Icon name="check" size={16} />
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section tone="void" padding="tight">
          <CtaBand
            title="¿Vamos por tu auto?"
            text="Cuéntanos cuál quieres y te decimos si conviene traerlo, cuánto cuesta puesto en Lima y en cuánto tiempo llega."
            message="Hola Luxcars, quiero importar un auto a pedido y conocer la ruta completa."
          />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
