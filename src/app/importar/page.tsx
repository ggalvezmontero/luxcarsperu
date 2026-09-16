import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { LUXCARS_CONFIG } from "@/lib/config";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MostSoughtVehiclesSection } from "@/components/MostSoughtVehiclesSection";

/* ===========================================================================
   /importar — Importación a pedido
   ---------------------------------------------------------------------------
   Server Component. Sin estado ni interactividad propia: todo lo interactivo
   (calculadora) vive en la home y aquí solo se enlaza.

   Criterio de composición: esta página NO reutiliza la retícula de tarjetas
   del resto del sitio. Se apoya en filetes finos, numeración a gran escala,
   una tabla de datos densa y tipografía como elemento gráfico. El único
   elemento dorado de toda la página es el CTA a la calculadora.
   =========================================================================== */

const { contact, legalName, brandName } = LUXCARS_CONFIG;

const WHATSAPP_HREF = `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(
  "Hola LuxCars, quiero importar un auto desde Estados Unidos. ¿Me orientan con el modelo y el costo total puesto en Lima?",
)}`;

export const metadata: Metadata = {
  title: "Importar auto de Estados Unidos a Perú",
  description:
    "Cómo importar un auto de USA a Perú en 2026: qué permite la ley (usados hasta 2 años, timón izquierdo, diésel usado prohibido), cómo se calculan ad valorem, ISC, IGV y percepción, y cuánto cuesta realmente puesto en Lima.",
  keywords: [
    "importar auto de Estados Unidos a Perú",
    "importar auto de USA a Perú",
    "importación de vehículos Perú SUNAT",
    "cuánto cuesta importar un auto a Perú",
    "impuestos de importación de autos Perú",
    "ad valorem ISC IGV vehículos Perú",
    "importar carro de Miami a Lima",
  ],
  alternates: { canonical: "/importar" },
  openGraph: {
    type: "article",
    url: `${contact.website}/importar`,
    title: `Importar auto de Estados Unidos a Perú | ${brandName}`,
    description:
      "La normativa real, los tributos explicados en lenguaje humano y una calculadora pública para saber el costo total antes de comprometer dinero.",
  },
};

/* --------------------------------------------------------------------------
   Contenido
   -------------------------------------------------------------------------- */

const PROCESO = [
  {
    titulo: "Definimos qué auto tiene sentido",
    cuerpo:
      "Presupuesto, uso real y versión que de verdad existe en el mercado americano. Si lo que buscas se consigue más barato nuevo en Perú, te lo decimos en esta conversación y no en la factura.",
  },
  {
    titulo: "Buscamos y verificamos",
    cuerpo:
      "Comparamos más de diez portales y dealers verificados en EE.UU. Cada candidato llega con CarFax, AutoCheck e inspección presencial antes de que exista una oferta.",
  },
  {
    titulo: "Cotizamos el desembolso completo",
    cuerpo:
      "Precio de compra, flete marítimo, seguro, tributos, honorarios y trámites en una sola cifra. Referencial y con rango, pero completa: no hay una segunda lista de costos después.",
  },
  {
    titulo: "Compra, flete y seguro",
    cuerpo:
      "Negociamos como si el auto fuera nuestro, cerramos la compra a nombre del cliente y embarcamos con seguro internacional desde el puerto de origen.",
  },
  {
    titulo: "Nacionalización y entrega en Lima",
    cuerpo:
      "Despacho ante SUNAT, homologación, revisión técnica, placas y tarjeta de propiedad. Entregamos el auto listo para circular, no listo para empezar trámites.",
  },
];

const NORMATIVA = [
  {
    regla: "Antigüedad",
    dice: "Usados de hasta 2 años de antigüedad, contados desde el año modelo.",
    significa:
      "En 2026 entran modelos 2024 en adelante. Un 2023 ya no se nacionaliza como usado, por bueno que esté el precio.",
  },
  {
    regla: "Combustible",
    dice: "Diésel usado prohibido en automóviles y camionetas.",
    significa:
      "Una pickup o SUV diésel de segunda mano no es importable. En diésel, la única vía es vehículo nuevo.",
  },
  {
    regla: "Timón",
    dice: "Timón izquierdo de fábrica, sin excepción.",
    significa:
      "Las conversiones de timón no se aceptan aunque estén bien hechas. Se verifica contra el VIN antes de comprar.",
  },
  {
    regla: "Kilometraje",
    dice: "Los usados están sujetos a límites de kilometraje para su nacionalización.",
    significa:
      "Contrastamos el odómetro con el historial CarFax antes de ofertar. Un kilometraje alto puede bloquear el ingreso, no solo bajar el precio.",
  },
  {
    regla: "Estado del vehículo",
    dice: "El historial y la condición se revisan en el despacho.",
    significa:
      "Una unidad con historial de siniestro grave puede complicar la homologación. Por eso la inspección es previa a la compra, no posterior.",
  },
];

const TRIBUTOS = [
  {
    cifra: "0% / 6%",
    nombre: "Ad valorem",
    base: "Se calcula sobre el valor CIF: auto + flete + seguro.",
    cuerpo:
      "El 0% del acuerdo comercial con Estados Unidos no se gana por comprar en Miami: exige que el vehículo sea originario de EE.UU., con certificado de origen, y además ser nuevo. Todo usado paga 6%, y también lo paga un japonés, un alemán o un coreano comprado en Florida.",
  },
  {
    cifra: "40%",
    nombre: "ISC en usados",
    base: "Se calcula sobre CIF + ad valorem.",
    cuerpo:
      "Todo vehículo usado de la partida 87.03 paga 40% de Impuesto Selectivo al Consumo, sin importar la propulsión. El 10% que todavía se cita en foros corresponde a un texto derogado en 2019. En vehículos nuevos la tasa baja mucho: gasolina entre 5% y 10% según cilindrada, híbrido full 0%, diésel nuevo 20%.",
  },
  {
    cifra: "18%",
    nombre: "IGV + IPM",
    base: "Se calcula sobre CIF + ad valorem + ISC.",
    cuerpo:
      "Desde el ejercicio 2026 ese 18% se descompone legalmente en 15.5% de IGV más 2.5% de IPM. El total que pagas no cambia; el desglose de la liquidación sí, y conviene reconocerlo cuando lo veas en la DAM.",
  },
  {
    cifra: "3.5 – 10%",
    nombre: "Percepción del IGV",
    base: "No es un impuesto adicional. Es un adelanto.",
    cuerpo:
      "La percepción se aplica al momento de importar y se recupera después como crédito fiscal: no encarece el auto, pero sí es caja que hay que poner el día del despacho. La tasa es 10% en primera importación o sin RUC afecto, 5% en mercancía usada y 3.5% para el importador recurrente con mercancía nueva. Cualquiera que te la presente como costo hundido, no está leyendo la norma.",
  },
];

const TRANSPARENCIA = [
  {
    titulo: "Los precios que circulan están inflados",
    cuerpo:
      "En los catálogos de importación que se ven en Perú hemos encontrado precios de hasta 48% por encima del precio real de fábrica del modelo. Nuestras cifras son referenciales y se contrastan contra el mercado americano real, no contra una lista de deseos.",
  },
  {
    titulo: "El Tesla Cybertruck no está homologado fuera de Norteamérica",
    cuerpo:
      "Se puede comprar, pero no cuenta con homologación fuera de Norteamérica. Traerlo no garantiza que termine con placa peruana y circulando. Si te lo ofrecen sin esa advertencia, falta información en la conversación.",
  },
  {
    titulo: "Hay autos que no conviene importar",
    cuerpo:
      "El Changan CS55 Plus y el Geely Coolray, entre otros, se venden nuevos en Perú por debajo de lo que costaría importarlos usados. En esos casos nuestra recomendación es comprarlos aquí. Cobramos por acertar, no por embarcar.",
  },
];

/* --------------------------------------------------------------------------
   Piezas de layout locales (filetes finos, no tarjetas)
   -------------------------------------------------------------------------- */

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-silver-dim">
      {children}
    </span>
  );
}

export default function ImportarPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Importación de vehículos desde Estados Unidos a Perú",
    name: "Importación de autos a pedido",
    url: `${contact.website}/importar`,
    areaServed: { "@type": "Country", name: "Perú" },
    provider: {
      "@type": "AutoDealer",
      name: legalName,
      telephone: contact.phone,
      email: contact.email,
      address: {
        "@type": "PostalAddress",
        streetAddress: contact.address,
        addressLocality: contact.city,
        addressCountry: contact.country,
      },
    },
    description:
      "Búsqueda, inspección, compra, flete marítimo, nacionalización SUNAT, homologación y placas de vehículos importados desde Estados Unidos hacia Perú.",
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <main className="flex-1 w-full">
        {/* ============================================================
            HERO — full bleed, tipografía como elemento gráfico.
            El isotipo funciona de marca de agua: no hay foto que mienta.
           ============================================================ */}
        <section className="relative w-full overflow-hidden bg-void">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-16 select-none opacity-[0.06] sm:-right-16 lg:right-4"
          >
            <Image
              src="/brand/isotipo-blanco.svg"
              alt=""
              width={520}
              height={520}
              className="h-56 w-auto sm:h-80 lg:h-96"
              priority
            />
          </div>

          <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-20 sm:px-10 sm:pb-28 sm:pt-28 lg:px-16 lg:pb-36 lg:pt-32">
            <Etiqueta>Línea de negocio · Importación a pedido</Etiqueta>

            <h1 className="mt-8 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-balance text-ink sm:text-5xl lg:text-7xl">
              Importar un auto de Estados Unidos a Perú, sin letra chica.
            </h1>

            <div className="mt-10 grid gap-10 lg:mt-16 lg:grid-cols-12 lg:gap-16">
              <p className="max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg lg:col-span-7">
                Buscamos, inspeccionamos y traemos el vehículo exacto que pides,
                con una sola cifra sobre la mesa antes de que comprometas dinero.
                Esta página existe para que sepas lo mismo que sabemos nosotros:
                qué permite la ley peruana, qué tributos se pagan y en qué casos
                importar sencillamente no conviene.
              </p>

              {/* Rail de datos: filetes, sin caja */}
              <dl className="lg:col-span-5 lg:pt-1">
                {[
                  ["Antigüedad máxima", "2 años · en 2026, modelos 2024+"],
                  ["Diésel usado", "Prohibido en autos y camionetas"],
                  ["Timón", "Izquierdo de fábrica"],
                  ["Entrega estimada", "30 a 60 días según plan"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line py-4 last:border-b"
                  >
                    <dt className="text-[11px] uppercase tracking-[0.25em] text-ink-4">
                      {k}
                    </dt>
                    <dd className="text-sm text-silver-bright sm:text-base">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-4 sm:mt-16">
              {/* Único elemento dorado de la página. */}
              <Button href="/#calculator" variant="accent" size="lg">
                Calcular mi importación
              </Button>
              <Button href={WHATSAPP_HREF} variant="secondary" size="lg">
                Hablar con un asesor
              </Button>
            </div>
          </div>

          <div className="h-px w-full bg-line" />
        </section>

        {/* ============================================================
            EL SERVICIO — numeración a gran escala, filetes finos
           ============================================================ */}
        <section className="w-full bg-bg">
          <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-36">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-4">
                <div className="lg:sticky lg:top-28">
                  <Etiqueta>El servicio</Etiqueta>
                  <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-tight text-balance text-ink sm:text-4xl">
                    Cinco etapas, una sola cifra
                  </h2>
                  <p className="mt-5 max-w-md text-base leading-relaxed text-ink-3">
                    Trabajamos como broker: representamos tus intereses, no los
                    del vendedor. Por eso la transparencia no es un eslogan sino
                    la forma en que cobramos.
                  </p>
                </div>
              </div>

              <ol className="lg:col-span-8">
                {PROCESO.map((paso, i) => (
                  <li
                    key={paso.titulo}
                    className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-t border-line py-8 last:border-b sm:gap-x-10 sm:py-10"
                  >
                    <span
                      aria-hidden
                      className="font-mono text-2xl font-light leading-none text-ink-4 sm:text-4xl lg:text-5xl"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-xl font-medium tracking-tight text-ink sm:text-2xl">
                        {paso.titulo}
                      </h3>
                      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-2">
                        {paso.cuerpo}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ============================================================
            NORMATIVA — tabla de datos densa, a sangre en móvil
           ============================================================ */}
        <section className="w-full bg-void">
          <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-36">
            <div className="max-w-3xl">
              <Etiqueta>Lo que permite la ley</Etiqueta>
              <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl">
                Cuatro reglas deciden si tu auto puede entrar
              </h2>
              <p className="mt-6 text-base leading-relaxed text-ink-2 sm:text-lg">
                No son trabas: son el filtro que define qué vale la pena buscar.
                Conocerlas antes de enamorarte de un modelo te ahorra la peor
                conversación del proceso. Datos verificados contra la normativa
                vigente de SUNAT y el Decreto Legislativo 843.
              </p>
            </div>

            {/* Móvil: la misma información en filetes, sin scroll lateral. */}
            <dl className="mt-12 md:hidden">
              {NORMATIVA.map((fila) => (
                <div key={fila.regla} className="border-t border-line py-7 last:border-b">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.25em] text-silver-dim">
                    {fila.regla}
                  </dt>
                  <dd className="mt-3 text-base leading-relaxed text-ink">
                    {fila.dice}
                  </dd>
                  <dd className="mt-2 text-sm leading-relaxed text-ink-3">
                    {fila.significa}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Tablet y desktop: tabla densa. */}
            <div className="mt-12 hidden overflow-x-auto sm:mt-16 md:block">
              <table className="w-full min-w-[40rem] border-collapse text-left">
                <caption className="sr-only">
                  Requisitos legales para importar un vehículo usado a Perú
                </caption>
                <thead>
                  <tr className="border-y border-line-strong">
                    <th
                      scope="col"
                      className="w-1/6 py-4 pr-6 text-[11px] font-semibold uppercase tracking-[0.25em] text-silver-dim"
                    >
                      Regla
                    </th>
                    <th
                      scope="col"
                      className="w-2/5 py-4 pr-6 text-[11px] font-semibold uppercase tracking-[0.25em] text-silver-dim"
                    >
                      Qué dice la norma
                    </th>
                    <th
                      scope="col"
                      className="py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-silver-dim"
                    >
                      Qué significa para ti
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {NORMATIVA.map((fila) => (
                    <tr key={fila.regla} className="border-b border-line align-top">
                      <th
                        scope="row"
                        className="py-7 pr-6 text-base font-medium tracking-tight text-silver-bright"
                      >
                        {fila.regla}
                      </th>
                      <td className="py-7 pr-6 text-sm leading-relaxed text-ink sm:text-base">
                        {fila.dice}
                      </td>
                      <td className="py-7 text-sm leading-relaxed text-ink-3 sm:text-base">
                        {fila.significa}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-8 max-w-3xl text-sm leading-relaxed text-ink-4">
              La determinación final de la partida arancelaria y de los
              requisitos aplicables corresponde a SUNAT en el despacho. Nuestro
              trabajo es que no haya sorpresas en esa mesa.
            </p>
          </div>
        </section>

        {/* ============================================================
            TRIBUTOS — cifra a gran escala + explicación, sin tarjetas
           ============================================================ */}
        <section className="w-full bg-bg">
          <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-36">
            <div className="max-w-3xl">
              <Etiqueta>Los tributos</Etiqueta>
              <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl">
                Qué se paga, sobre qué base y por qué
              </h2>
              <p className="mt-6 text-base leading-relaxed text-ink-2 sm:text-lg">
                Los impuestos no se aplican sobre el precio del auto: se aplican
                en cascada, cada uno sobre la base que dejó el anterior. Esa es
                la razón por la que dos autos del mismo precio pueden terminar
                costando muy distinto.
              </p>
            </div>

            <div className="mt-14 sm:mt-20">
              {TRIBUTOS.map((t) => (
                <article
                  key={t.nombre}
                  className="grid gap-x-10 gap-y-5 border-t border-line py-10 last:border-b sm:py-14 lg:grid-cols-12"
                >
                  <header className="lg:col-span-5">
                    <p className="font-mono text-4xl font-light leading-none tracking-tight text-silver sm:text-5xl lg:text-6xl">
                      {t.cifra}
                    </p>
                    <h3 className="mt-5 text-xl font-medium tracking-tight text-ink sm:text-2xl">
                      {t.nombre}
                    </h3>
                    <p className="mt-2 text-sm uppercase tracking-[0.2em] text-ink-4">
                      {t.base}
                    </p>
                  </header>
                  <p className="max-w-2xl text-base leading-relaxed text-ink-2 lg:col-span-7 lg:pt-2">
                    {t.cuerpo}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================
            CALCULADORA — banda a sangre, tipografía grande
           ============================================================ */}
        <section className="relative w-full overflow-hidden bg-surface">
          <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-32">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-16">
              <div className="lg:col-span-7">
                <Etiqueta>Calculadora pública</Etiqueta>
                <p className="mt-6 text-3xl font-semibold leading-tight tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl">
                  Saca el número tú mismo, antes de hablar con nosotros.
                </p>
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg">
                  La calculadora aplica las mismas tasas que acabas de leer,
                  incluyendo el desglose IGV + IPM y la percepción separada del
                  costo. Es la misma herramienta que usamos internamente.
                </p>
              </div>
              <div className="lg:col-span-5 lg:justify-self-end">
                <Button href="/#calculator" variant="primary" size="lg">
                  Ir a la calculadora
                </Button>
                <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-4">
                  Resultado referencial con rango. Sujeto a verificación de
                  partida arancelaria y determinación SUNAT.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            TRANSPARENCIA — lista con filetes, numeración discreta
           ============================================================ */}
        <section className="w-full bg-void">
          <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-36">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-4">
                <Etiqueta>Te decimos lo que otros no</Etiqueta>
                <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-tight text-balance text-ink sm:text-4xl">
                  Tres advertencias que nos cuestan ventas
                </h2>
              </div>

              <div className="lg:col-span-8">
                {TRANSPARENCIA.map((item) => (
                  <div
                    key={item.titulo}
                    className="border-t border-line py-8 last:border-b sm:py-10"
                  >
                    <h3 className="text-xl font-medium tracking-tight text-balance text-silver-bright sm:text-2xl">
                      {item.titulo}
                    </h3>
                    <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
                      {item.cuerpo}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            CIERRE
           ============================================================ */}
        <section className="w-full bg-bg">
          <div className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-10 sm:py-28 lg:px-16 lg:py-32">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-7">
                <h2 className="text-3xl font-semibold leading-tight tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl">
                  Dinos qué auto tienes en mente.
                </h2>
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg">
                  Te respondemos si es importable, en cuánto tiempo llega y qué
                  desembolso real implica. Si la respuesta es que no conviene,
                  también te la damos.
                </p>
                <div className="mt-10 flex flex-wrap gap-4">
                  <Button href={WHATSAPP_HREF} variant="primary" size="lg">
                    Escribir por WhatsApp
                  </Button>
                  <Button href="/comprar" variant="secondary" size="lg">
                    Ver stock disponible
                  </Button>
                </div>
              </div>

              <dl className="lg:col-span-5">
                {[
                  ["Razón social", legalName],
                  ["RUC", LUXCARS_CONFIG.ruc],
                  ["Oficina", `${contact.address}, ${contact.city}`],
                  ["Correo", contact.email],
                  ["Teléfono", contact.phone],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line py-4 last:border-b"
                  >
                    <dt className="text-[11px] uppercase tracking-[0.25em] text-ink-4">
                      {k}
                    </dt>
                    <dd className="min-w-0 break-words text-sm text-ink-2">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <p className="mt-16 text-sm text-ink-4">
              ¿Prefieres ver el proceso completo paso a paso?{" "}
              <Link
                href="/como-funciona"
                className="text-silver underline underline-offset-4 transition-colors hover:text-silver-bright"
              >
                Cómo funciona la importación
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Catálogo completo de referencia. Vive aquí y no en la home porque
            son ejemplos de lo que se PUEDE traer, no stock disponible: eso
            último es /comprar. La home lleva solo un adelanto de tres. */}
        <section className="w-full bg-bg px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto w-full max-w-6xl">
            <MostSoughtVehiclesSection />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
