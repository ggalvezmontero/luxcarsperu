import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { LUXCARS_CONFIG } from "@/lib/config";
import { StockExplorer } from "./StockExplorer";
import type { StockVehicle } from "./StockExplorer";

export const metadata: Metadata = {
  title: "Comprar auto de lujo en Lima · Stock disponible ahora",
  description:
    "Autos premium físicos en Lima, listos para entregar: stock propio verificado, documentos en orden y entrega inmediata. Compra tu auto de lujo sin esperar una importación.",
  alternates: { canonical: "/comprar" },
  openGraph: {
    type: "website",
    url: `${LUXCARS_CONFIG.contact.website}/comprar`,
    title: "Comprar auto de lujo en Lima | Stock disponible ahora",
    description:
      "Unidades premium verificadas, en Lima y listas para entregar. Stock propio de LUX CARS IMPORT S.A.C. en San Isidro.",
  },
};

/* ---------------------------------------------------------------------------
   INVENTARIO DE DEMOSTRACIÓN.
   Vive en el Server Component (no en el módulo "use client") porque un Server
   Component no puede importar valores de un módulo cliente: los recibiría como
   referencias, no como datos. Se pasa por props y se reemplaza íntegramente
   cuando exista el inventario real.
   Sin fotos adjuntas a propósito: hoy no existe una sola foto propia de estas
   unidades y ninguna imagen de banco puede hacerse pasar por ellas.
   --------------------------------------------------------------------------- */
const DEMO_STOCK: StockVehicle[] = [
  {
    id: "demo-01",
    brand: "Porsche",
    model: "Cayenne S",
    year: 2021,
    km: 28400,
    priceUsd: null,
    priceSoles: null,
    condition: "usado",
    location: "San Isidro, Lima",
    status: "disponible",
    gallery: [],
    vinPartial: "WP1AB2A…4417",
    history: [
      { label: "Dueños", value: "1 · particular" },
      { label: "Reporte", value: "CarFax sin siniestros" },
      { label: "Mantenimiento", value: "Al día, red oficial" },
      { label: "Documentos", value: "Nacionalizado, placa Lima" },
    ],
    isDemo: true,
  },
  {
    id: "demo-02",
    brand: "Range Rover",
    model: "Sport HSE",
    year: 2022,
    km: 19100,
    priceUsd: null,
    priceSoles: null,
    condition: "usado",
    location: "San Isidro, Lima",
    status: "reservado",
    gallery: [],
    vinPartial: "SALWR2S…9032",
    history: [
      { label: "Dueños", value: "1 · corporativo" },
      { label: "Reporte", value: "CarFax + AutoCheck" },
      { label: "Mantenimiento", value: "2 servicios registrados" },
      { label: "Documentos", value: "Transferencia lista" },
    ],
    isDemo: true,
  },
  {
    id: "demo-03",
    brand: "Mercedes-Benz",
    model: "GLE 450",
    year: 2020,
    km: 46700,
    priceUsd: null,
    priceSoles: null,
    condition: "usado",
    location: "San Isidro, Lima",
    status: "disponible",
    gallery: [],
    vinPartial: "4JGFB4K…2185",
    history: [
      { label: "Dueños", value: "2 · particulares" },
      { label: "Reporte", value: "CarFax sin siniestros" },
      { label: "Mantenimiento", value: "Historial completo" },
      { label: "Documentos", value: "Nacionalizado, placa Lima" },
    ],
    isDemo: true,
  },
];

/**
 * Enlace de WhatsApp del encabezado: entra ya declarando que viene del stock.
 */
const STOCK_WHATSAPP = `https://wa.me/${
  LUXCARS_CONFIG.contact.whatsappNumber
}?text=${encodeURIComponent(
  [
    "Hola LuxCars, vengo de la página de autos disponibles.",
    "Quiero ver qué unidades tienen hoy en Lima y coordinar una visita.",
  ].join("\n"),
)}`;

/** Las tres promesas que distinguen el stock de una importación a pedido. */
const PROMESAS = [
  {
    titulo: "El auto existe",
    texto:
      "Cada unidad publicada está físicamente en Lima. Se ve, se maneja y se revisa el mismo día que la pides.",
  },
  {
    titulo: "Los papeles existen",
    texto:
      "Nacionalizada, con placa y transferencia lista. Nuestra gestión documentaria se encarga del trámite completo.",
  },
  {
    titulo: "El plazo es hoy",
    texto:
      "Sin tránsito marítimo ni aduanas. La entrega se coordina en días, no en los 30 a 60 de una importación.",
  },
];

export default function ComprarPage() {
  // Inventario de demostración mientras no existe la fuente de datos real.
  const stock = DEMO_STOCK;
  const disponibles = stock.filter((v) => v.status === "disponible").length;

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-1 w-full">
        {/* ==================================================================
            ENCABEZADO A SANGRE
            Tipografía grande como elemento gráfico, franja de datos con
            filetes finos. Sin tarjetas, sin bordes redondeados.
           ================================================================== */}
        <section className="relative w-full overflow-hidden bg-void">
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-4 left-0 right-0 select-none truncate px-5 text-7xl font-semibold uppercase leading-none tracking-tighter text-ink-4/10 sm:px-8 sm:text-8xl lg:text-9xl"
          >
            En piso
          </span>

          <div className="relative mx-auto w-full max-w-6xl px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28 lg:pb-36 lg:pt-32">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-8">
                <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-silver-dim">
                  Compra y venta · Stock propio
                </p>
                <h1 className="mt-8 text-4xl font-semibold leading-[1.02] tracking-tight text-balance text-ink sm:text-6xl lg:text-7xl">
                  Autos disponibles
                  <br />
                  <span className="text-silver">ahora mismo en Lima.</span>
                </h1>
                <p className="mt-8 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg">
                  Unidades físicas, verificadas y con documentación en regla, en
                  nuestra oficina de San Isidro. Las ves esta semana y te las
                  llevas. Sin esperar una importación.
                </p>

                <div className="mt-10 flex flex-wrap gap-3">
                  <Button href="#unidades" size="lg">
                    Ver unidades
                  </Button>
                  <Button
                    href={STOCK_WHATSAPP}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="lg"
                    variant="secondary"
                  >
                    Escribir por WhatsApp
                  </Button>
                </div>
              </div>

              {/* Franja de datos densa, al estilo ficha de subasta */}
              <div className="lg:col-span-4">
                <dl className="divide-y divide-line border-y border-line">
                  <HeaderRow
                    label="Unidades disponibles"
                    value={String(disponibles).padStart(2, "0")}
                  />
                  <HeaderRow label="Dónde se ven" value="San Isidro, Lima" />
                  <HeaderRow label="Entrega" value="Coordinada en días" />
                  <HeaderRow label="Documentos" value="Al día, verificados" />
                  <HeaderRow label="Tasación de tu auto" value="Sin costo" />
                </dl>
                <p className="mt-6 text-xs leading-relaxed text-ink-4">
                  Todos los precios publicados son referenciales y se confirman
                  en la visita. {LUXCARS_CONFIG.legalName} · RUC{" "}
                  {LUXCARS_CONFIG.ruc}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================
            TRES PROMESAS — numeración a gran escala sobre filetes
           ================================================================== */}
        <section className="w-full bg-bg">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28 lg:py-32">
            <h2 className="max-w-2xl text-2xl font-semibold leading-tight tracking-tight text-balance text-ink sm:text-3xl">
              Qué significa exactamente{" "}
              <span className="text-silver">disponible ahora</span>.
            </h2>

            <div className="mt-14 border-t border-line-strong">
              {PROMESAS.map((item, index) => (
                <div
                  key={item.titulo}
                  className="grid gap-4 border-b border-line py-10 sm:gap-8 lg:grid-cols-12 lg:py-14"
                >
                  <span className="text-2xl font-semibold tabular-nums leading-none text-ink-4/60 lg:col-span-2 lg:text-3xl">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-xl font-semibold tracking-tight text-ink lg:col-span-4 lg:text-2xl">
                    {item.titulo}
                  </h3>
                  <p className="max-w-xl text-base leading-relaxed text-ink-2 lg:col-span-6">
                    {item.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================================================================
            RETÍCULA DE UNIDADES + FILTROS (cliente)
           ================================================================== */}
        <section className="w-full bg-bg pb-24 sm:pb-32">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-6 pb-10">
              <h2 className="text-3xl font-semibold leading-none tracking-tight text-ink sm:text-4xl">
                Unidades en piso
              </h2>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-4">
                Actualizado a mano · Lima
              </p>
            </div>

            {/* Aviso honesto mientras el inventario sea maqueta. */}
            {stock.some((v) => v.isDemo) ? (
              <p className="mb-8 border-l border-warn/60 pl-4 text-xs leading-relaxed text-ink-3">
                <span className="font-semibold uppercase tracking-[0.25em] text-warn">
                  Demostración
                </span>
                <br />
                Las unidades listadas abajo son ejemplos de maqueta para mostrar
                el formato de la ficha. No corresponden a autos reales en stock
                ni a precios ofertados. Se reemplazan íntegramente cuando se
                cargue el inventario verificado.
              </p>
            ) : null}
          </div>

          <StockExplorer stock={stock} />
        </section>

        {/* ==================================================================
            CIERRE — franja a sangre, asimétrica.
            Aquí vive el ÚNICO elemento dorado de la página.
           ================================================================== */}
        <section className="w-full border-t border-line bg-void">
          <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32 lg:py-40">
            <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-7">
                <Image
                  src="/brand/isotipo-blanco.svg"
                  alt=""
                  width={64}
                  height={64}
                  className="h-9 w-auto opacity-40"
                />
                <h2 className="mt-10 text-3xl font-semibold leading-[1.05] tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
                  ¿No está el que buscas?
                </h2>
                <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-2 sm:text-lg">
                  Lo traemos a pedido desde Miami con la especificación exacta
                  que quieras, o tasamos el tuyo para que entre como parte de
                  pago.
                </p>
                <div className="mt-10 flex flex-wrap gap-3">
                  <Button href="/#calculator" size="lg" variant="accent">
                    Calcular una importación
                  </Button>
                  <Button href="/#contact" size="lg" variant="secondary">
                    Tasar mi auto
                  </Button>
                </div>
              </div>

              <div className="lg:col-span-5">
                <dl className="divide-y divide-line border-y border-line">
                  {LUXCARS_CONFIG.businessLines.map((line) => (
                    <div key={line.id} className="py-5">
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.3em] text-silver-dim">
                        {line.label}
                      </dt>
                      <dd className="mt-2 text-sm leading-relaxed text-ink-2">
                        {line.description}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function HeaderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-4">
        {label}
      </dt>
      <dd className="text-sm tabular-nums text-ink">{value}</dd>
    </div>
  );
}
