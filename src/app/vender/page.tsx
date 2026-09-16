import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { LUXCARS_CONFIG } from "@/lib/config";
import type { Metadata } from "next";
import Image from "next/image";
import { FormularioTasacion } from "./FormularioTasacion";

export const metadata: Metadata = {
  title: "Vender mi auto en Lima · Consignación sin exclusividad",
  description:
    "Tasamos y vendemos tu auto en Lima sin contrato de exclusividad: lo sigues manejando mientras se vende y si lo vendes por tu cuenta no pagas comisión. Tasación referencial sin compromiso.",
  keywords: [
    "vender mi auto en Lima",
    "consignación de autos Lima",
    "tasación de autos Perú",
    "vender auto sin exclusividad",
    "cuánto vale mi auto Perú",
    "consignar vehículo San Isidro",
    "venta de autos usados Lima",
  ],
  alternates: { canonical: "/vender" },
  openGraph: {
    type: "website",
    url: `${LUXCARS_CONFIG.contact.website}/vender`,
    title: "Vender mi auto en Lima · Consignación sin exclusividad",
    description:
      "Dejas tu auto en venta con LuxCars y lo sigues manejando. Sin contrato de exclusividad: si lo vendes por tu cuenta, no pagas comisión.",
  },
};

/* --------------------------------------------------------------------------
   Contenido
   -------------------------------------------------------------------------- */

const WHATSAPP_CONSIGNACION = `https://wa.me/${
  LUXCARS_CONFIG.contact.whatsappNumber
}?text=${encodeURIComponent(
  [
    "Hola LuxCars, quiero información sobre la consignación sin exclusividad.",
    "Tengo un vehículo que me gustaría tasar.",
  ].join("\n"),
)}`;

/** Las tres promesas del servicio, tal como figuran en el material de marca. */
const PROMESAS = [
  {
    titulo: "Sin contrato de exclusividad",
    detalle:
      "No firmas ninguna cláusula que te ate. Puedes seguir ofreciéndolo por tu cuenta o retirarlo cuando quieras.",
  },
  {
    titulo: "Lo sigues manejando",
    detalle:
      "El auto se queda contigo. Solo lo coordinamos contigo para las visitas de compradores realmente interesados.",
  },
  {
    titulo: "Si lo vendes tú, no pagas comisión",
    detalle:
      "Solo cobramos si la venta la cerramos nosotros. La comisión se acuerda por escrito antes de publicar.",
  },
];

/**
 * Comparativa honesta. Vender por cuenta propia es, con tiempo y paciencia, la
 * vía que deja más dinero; el concesionario es la más rápida. La ventaja de la
 * consignación no es ser mejor en todo, es no obligarte a elegir entre precio
 * y esfuerzo. Nada aquí caricaturiza a las otras dos opciones.
 */
const COLUMNAS = [
  "Consignar con LuxCars",
  "Venderlo por tu cuenta",
  "Concesionario tradicional",
];

const COMPARATIVA: { criterio: string; valores: [string, string, string] }[] = [
  {
    criterio: "Tiempo hasta cerrar la venta",
    valores: [
      "Variable. Difusión y filtro de compradores desde el primer día.",
      "Variable. Depende del tiempo que puedas dedicarle cada semana.",
      "El más rápido: la compra directa se cierra en días.",
    ],
  },
  {
    criterio: "Precio que obtienes",
    valores: [
      "Precio de mercado, menos la comisión acordada.",
      "El más alto posible si negocias bien y puedes esperar.",
      "Por debajo del mercado: compran para revender con margen.",
    ],
  },
  {
    criterio: "Esfuerzo del dueño",
    valores: [
      "Bajo. Publicamos, respondemos y filtramos nosotros.",
      "Alto. Avisos, llamadas, citas y pruebas de manejo a tu cargo.",
      "Mínimo. Una tasación y la entrega.",
    ],
  },
  {
    criterio: "Exclusividad",
    valores: [
      "Ninguna. No firmas exclusividad con nosotros.",
      "No aplica: el auto siempre fue tuyo.",
      "Varía según el contrato. En compra directa el auto deja de ser tuyo.",
    ],
  },
  {
    criterio: "Uso del auto mientras se vende",
    valores: [
      "Lo sigues usando con normalidad.",
      "Lo sigues usando con normalidad.",
      "En compra directa ya no lo usas; en consignación suele quedarse en el patio.",
    ],
  },
  {
    criterio: "Si aparece un comprador tuyo",
    valores: [
      "Cierras tú y no nos pagas comisión.",
      "Cierras tú, sin intermediarios.",
      "Depende de lo que firmaste. Revisa el contrato antes.",
    ],
  },
  {
    criterio: "Trámites y transferencia",
    valores: [
      "Los gestionamos nosotros: transferencia y documentación.",
      "A tu cargo, de principio a fin.",
      "Los gestiona el concesionario.",
    ],
  },
  {
    criterio: "Filtro de compradores",
    valores: [
      "Verificamos al interesado antes de coordinar una cita.",
      "Atiendes a todo el que escriba, serio o no.",
      "No aplica: el comprador es el propio concesionario.",
    ],
  },
];

const PROCESO = [
  {
    numero: "01",
    titulo: "Tasación referencial",
    detalle:
      "Nos envías marca, modelo, año, kilometraje y condición. Revisamos el mercado local y te devolvemos un rango referencial, sin compromiso.",
  },
  {
    numero: "02",
    titulo: "Inspección y precio de salida",
    detalle:
      "Vemos el auto en persona, revisamos historial y estado real, y acordamos contigo el precio con el que sale a la venta.",
  },
  {
    numero: "03",
    titulo: "Acuerdo por escrito",
    detalle:
      "Dejamos la comisión y las condiciones claras en un documento. Sin exclusividad y sin permanencia mínima.",
  },
  {
    numero: "04",
    titulo: "Publicación y difusión",
    detalle:
      "Fotografía, ficha técnica y publicación en nuestros canales y en los portales donde se mueve el segmento premium.",
  },
  {
    numero: "05",
    titulo: "Visitas coordinadas",
    detalle:
      "Filtramos consultas, verificamos a los interesados y coordinamos cada cita contigo. Mientras tanto, el auto sigue en tu cochera.",
  },
  {
    numero: "06",
    titulo: "Cierre y transferencia",
    detalle:
      "Negociamos el cierre, acompañamos el pago y gestionamos la transferencia y la documentación hasta que esté a nombre del comprador.",
  },
];

/* --------------------------------------------------------------------------
   Página
   -------------------------------------------------------------------------- */

const CONTENEDOR = "mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12";

export default function VenderPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-1 w-full">
        {/* ── Portada: el gancho es el titular, no la letra chica ───────── */}
        <section className="relative w-full border-b border-line bg-void pt-20 pb-24 sm:pt-28 sm:pb-32 lg:pt-36 lg:pb-40">
          <div className={CONTENEDOR}>
            <div className="grid gap-16 lg:grid-cols-12 lg:gap-12">
              <div className="lg:col-span-7">
                <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-silver-dim">
                  Tasación y consignación
                </p>

                <h1 className="mt-8 text-4xl font-semibold leading-[0.95] tracking-tight text-balance text-ink sm:text-6xl lg:text-7xl">
                  Sin contrato
                  <br />
                  de exclusividad.
                  <span className="mt-3 block text-ink-3">
                    Y tú sigues manejándolo.
                  </span>
                </h1>

                <p className="mt-10 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg">
                  Dejas tu auto en venta con nosotros y sigues usándolo con
                  normalidad. Nosotros lo publicamos, filtramos compradores y
                  cerramos la operación. Si lo vendes por tu cuenta, no nos
                  debes nada.
                </p>

                <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button href="#tasacion" size="lg">
                    Tasar mi auto
                  </Button>
                  <Button
                    href={WHATSAPP_CONSIGNACION}
                    variant="secondary"
                    size="lg"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Conversar por WhatsApp
                  </Button>
                </div>
              </div>

              {/* Filetes finos en lugar de tarjetas. */}
              <div className="lg:col-span-4 lg:col-start-9">
                <dl className="border-t border-line-strong">
                  {PROMESAS.map((promesa) => (
                    <div
                      key={promesa.titulo}
                      className="border-b border-line py-6"
                    >
                      <dt className="text-sm font-medium uppercase tracking-[0.16em] text-silver">
                        {promesa.titulo}
                      </dt>
                      <dd className="mt-3 text-sm leading-relaxed text-ink-3">
                        {promesa.detalle}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* ── Banda a sangre: imagen de ambiente + texto encima ─────────── */}
        <section className="relative isolate flex min-h-[26rem] w-full items-end overflow-hidden border-b border-line bg-void py-16 sm:min-h-[32rem] sm:py-20 lg:min-h-[38rem] lg:py-24">
          <Image
            src="/images/hero/main.jpg"
            alt="Auto deportivo gris estacionado en carretera al atardecer"
            fill
            sizes="100vw"
            className="-z-20 object-cover object-center opacity-40 grayscale"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-r from-void via-void/80 to-void/20"
          />

          <div className={`${CONTENEDOR} relative`}>
            <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-silver-dim">
              La diferencia
            </p>
            <p className="mt-6 max-w-3xl text-3xl font-semibold leading-[1.05] tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
              Tu auto no se queda en un patio esperando comprador.
            </p>
            <p className="mt-8 max-w-lg text-sm leading-relaxed text-ink-2 sm:text-base">
              Ninguna consignación debería costarte tu movilidad. Con nosotros
              el vehículo se queda contigo hasta el día en que se vende.
            </p>
          </div>
        </section>

        {/* ── Comparativa densa ────────────────────────────────────────── */}
        <section className="w-full border-b border-line bg-bg py-24 sm:py-28 lg:py-36">
          <div className={CONTENEDOR}>
            <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-7">
                <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-silver-dim">
                  Tres caminos
                </p>
                <h2 className="mt-7 text-3xl font-semibold leading-tight tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl">
                  Cómo se compara con venderlo solo o entregarlo a un
                  concesionario
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-ink-3 lg:col-span-4 lg:col-start-9">
                Ninguna de las tres opciones gana en todo. Venderlo tú mismo
                suele dejar más dinero si tienes tiempo; el concesionario es la
                salida más rápida. Esta es la comparación sin adornos.
              </p>
            </div>

            <p className="mt-12 text-[11px] uppercase tracking-[0.25em] text-ink-4 lg:hidden">
              Desliza para comparar →
            </p>

            <div className="mt-4 w-full overflow-x-auto lg:mt-16">
              <table className="w-full min-w-[46rem] border-collapse text-left align-top">
                <caption className="sr-only">
                  Comparación entre consignar con LuxCars, vender por cuenta
                  propia y entregar el vehículo a un concesionario tradicional.
                </caption>
                <thead>
                  <tr className="border-b border-line-strong">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 w-40 border-r border-line bg-bg py-5 pr-6 text-[11px] font-medium uppercase tracking-[0.25em] text-ink-4 lg:w-60"
                    >
                      Criterio
                    </th>
                    {COLUMNAS.map((columna, indice) => (
                      <th
                        key={columna}
                        scope="col"
                        className={`py-5 pr-6 align-bottom text-sm font-semibold tracking-tight last:pr-0 ${
                          indice === 0 ? "text-silver-bright" : "text-ink-3"
                        }`}
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARATIVA.map((fila) => (
                    <tr key={fila.criterio} className="border-b border-line">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-r border-line bg-bg py-6 pr-6 text-[11px] font-medium uppercase leading-relaxed tracking-[0.18em] text-ink-4"
                      >
                        {fila.criterio}
                      </th>
                      {fila.valores.map((valor, indice) => (
                        <td
                          key={COLUMNAS[indice]}
                          className={`py-6 pr-6 text-sm leading-relaxed last:pr-0 ${
                            indice === 0
                              ? "bg-surface/50 pl-5 text-ink"
                              : "text-ink-3"
                          }`}
                        >
                          {valor}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-10 max-w-2xl text-xs leading-relaxed text-ink-4">
              Los tiempos y precios dependen del modelo, el año, el estado y el
              momento del mercado. No prometemos una cifra antes de ver el
              vehículo: cualquier valor que te demos antes de la inspección es
              referencial.
            </p>
          </div>
        </section>

        {/* ── Proceso: numeración a gran escala, sin tarjetas ───────────── */}
        <section className="w-full border-b border-line bg-void py-24 sm:py-28 lg:py-36">
          <div className={CONTENEDOR}>
            <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-silver-dim">
              El proceso
            </p>
            <h2 className="mt-7 max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl">
              De la tasación a la transferencia
            </h2>

            <ol className="mt-16 border-t border-line-strong">
              {PROCESO.map((paso) => (
                <li
                  key={paso.numero}
                  className="grid gap-4 border-b border-line py-10 lg:grid-cols-12 lg:gap-10 lg:py-12"
                >
                  <span className="text-4xl font-semibold leading-none tracking-tight text-line-strong sm:text-5xl lg:col-span-2 lg:text-6xl">
                    {paso.numero}
                  </span>
                  <h3 className="text-xl font-medium tracking-tight text-ink lg:col-span-4 lg:text-2xl">
                    {paso.titulo}
                  </h3>
                  <p className="max-w-2xl text-sm leading-relaxed text-ink-2 lg:col-span-6 lg:text-base">
                    {paso.detalle}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Tasación ─────────────────────────────────────────────────── */}
        <section
          id="tasacion"
          className="w-full scroll-mt-24 bg-bg py-24 sm:py-28 lg:py-36"
        >
          <div className={CONTENEDOR}>
            <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-silver-dim">
                  Tasación
                </p>
                <h2 className="mt-7 text-3xl font-semibold leading-[1.05] tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl">
                  ¿Cuánto vale hoy tu auto?
                </h2>
                <p className="mt-8 max-w-md text-base leading-relaxed text-ink-2">
                  Seis datos y te devolvemos un rango referencial de mercado. Sin
                  compromiso, sin exclusividad y sin que el auto salga de tu
                  cochera.
                </p>

                <dl className="mt-12 border-t border-line">
                  <div className="flex items-baseline justify-between gap-6 border-b border-line py-4">
                    <dt className="text-[11px] uppercase tracking-[0.22em] text-ink-4">
                      Atiende
                    </dt>
                    <dd className="text-sm text-ink-2">
                      {LUXCARS_CONFIG.legalName}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-6 border-b border-line py-4">
                    <dt className="text-[11px] uppercase tracking-[0.22em] text-ink-4">
                      Oficina
                    </dt>
                    <dd className="text-right text-sm text-ink-2">
                      {LUXCARS_CONFIG.contact.address}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-6 border-b border-line py-4">
                    <dt className="text-[11px] uppercase tracking-[0.22em] text-ink-4">
                      WhatsApp
                    </dt>
                    <dd className="text-sm text-ink-2">
                      {LUXCARS_CONFIG.contact.phone}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="lg:col-span-6 lg:col-start-7">
                <FormularioTasacion />
              </div>
            </div>
          </div>
        </section>

        {/* ── Condiciones, en claro ────────────────────────────────────── */}
        <section className="w-full border-t border-line bg-void py-20 sm:py-24">
          <div className={CONTENEDOR}>
            <div className="grid gap-10 lg:grid-cols-12">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.42em] text-silver-dim lg:col-span-3">
                Condiciones
              </h2>
              <div className="space-y-6 text-sm leading-relaxed text-ink-3 lg:col-span-8 lg:col-start-5">
                <p>
                  La tasación previa es referencial: se calcula con los datos que
                  nos envías y se confirma recién después de ver el vehículo,
                  revisar su historial y su estado real.
                </p>
                <p>
                  La comisión se acuerda por escrito antes de publicar el auto y
                  solo se cobra si la venta la cerramos nosotros. No hay
                  exclusividad, no hay permanencia mínima y puedes retirar el
                  vehículo de la venta cuando quieras.
                </p>
                <p>
                  Trabajamos con vehículos en regla. Si el auto tiene deudas,
                  papeletas, gravámenes o documentación pendiente, te decimos qué
                  hay que resolver antes de ponerlo en venta.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
