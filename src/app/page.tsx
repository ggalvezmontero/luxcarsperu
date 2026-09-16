import type { ReactNode } from "react";

import { ActiveSectionTracker } from "@/components/ActiveSectionTracker";
import { CalculatorSection } from "@/components/CalculatorSection";
import { ConfianzaSection } from "@/components/ConfianzaSection";
import { ConsignacionSection } from "@/components/ConsignacionSection";
import { ContactSection } from "@/components/ContactSection";
import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";
import { HeroNuevo } from "@/components/HeroNuevo";
import { LineasNegocioSection } from "@/components/LineasNegocioSection";
import { MostSoughtVehiclesSection } from "@/components/MostSoughtVehiclesSection";
import { Navbar } from "@/components/Navbar";
import { ProcesoSection } from "@/components/ProcesoSection";
import { ScrollAnimation } from "@/components/ScrollAnimation";
import { StockPreviewSection } from "@/components/StockPreviewSection";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   HOME
   ---------------------------------------------------------------------------
   La web anterior contaba una sola línea de negocio (importación) dentro de
   una pila de tarjetas del mismo tamaño. Esta home cuenta las cuatro y
   alterna dos anchos:

     · A SANGRE (fuera del contenedor, de borde a borde del viewport):
       la portada y la banda de stock. Son los dos momentos de imagen.
     · CONTENIDA (max-w-6xl): el resto. El texto nunca se estira más allá de
       una medida legible.

   El ritmo vertical es deliberadamente amplio —de 80 a 160 px entre
   secciones— porque el problema del sitio anterior era la compresión.

   Ninguna sección usa `w-screen` ni márgenes negativos para sangrar: se
   sangra sacando la sección del contenedor. Ese fue el origen del desborde
   horizontal de 74 px en tablet y no debe volver.

   Orden narrativo:
     01 Portada: los dos caminos (comprar hoy / importar a pedido).
     02 Índice de las cuatro líneas de negocio.
     03 Stock propio — la línea que antes era invisible.
     04 Calculadora — el activo del sitio, puesto a media página.
     05 Consignación sin exclusividad — el diferenciador comercial.
     06 Proceso de importación en siete etapas.
     07 Confianza verificable (identidad fiscal y desglose del cálculo).
     08 Preguntas frecuentes.
     09 Contacto.
   ------------------------------------------------------------------------- */

/** Anclas que el navbar, el footer y el hash de la URL siguen al hacer scroll. */
const SECTION_IDS = [
  "stock",
  "calculator",
  "consignacion",
  "timeline",
  "confianza",
  "faq",
  "contact",
];

/** Medida de lectura común a todas las secciones que no van a sangre. */
function Contenida({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <ActiveSectionTracker ids={SECTION_IDS} />

      <main className="w-full flex-1">
        {/* 01 · PORTADA — a sangre, sin caja ni radio. */}
        <ScrollAnimation variant="fadeIn">
          <HeroNuevo />
        </ScrollAnimation>

        {/* 02 · LAS CUATRO LÍNEAS DE NEGOCIO.
            Sin bloque destacado: la consignación tiene su propia sección más
            abajo y repetir aquí sus condiciones sería decir dos veces lo
            mismo. Aquí es índice; allá es argumento. */}
        <Contenida className="pt-20 sm:pt-28 lg:pt-36">
          <ScrollAnimation>
            <LineasNegocioSection destacarConsignacion={false} />
          </ScrollAnimation>
        </Contenida>

        {/* 03 · STOCK PROPIO — segunda banda a sangre.
            Hoy sale con el listado vacío y lo dice en claro ("00 unidades
            publicadas hoy"). Cuando exista inventario real se le pasa por
            `unidades`. */}
        <ScrollAnimation>
          <StockPreviewSection className="mt-24 sm:mt-32 lg:mt-40" />
        </ScrollAnimation>

        {/* 04 · CALCULADORA — el activo del sitio. */}
        <Contenida className="pt-20 sm:pt-28 lg:pt-36">
          <ScrollAnimation delay={0.05}>
            <MostSoughtVehiclesSection
              limite={3}
              verTodosHref="/importar#mas-buscados"
              id="referencias"
              eyebrow="Mercado Perú"
              titulo="Lo que más nos piden traer"
              descripcion="Ejemplos con precio referencial de Miami. Toca uno y la calculadora se abre con sus datos cargados."
            />
          </ScrollAnimation>
        </Contenida>

        <Contenida className="pt-24 sm:pt-32 lg:pt-40">
          <ScrollAnimation>
            <CalculatorSection />
          </ScrollAnimation>
        </Contenida>

        {/* 05 · CONSIGNACIÓN SIN EXCLUSIVIDAD — el diferenciador. */}
        <Contenida className="pt-20 sm:pt-28 lg:pt-36">
          <ScrollAnimation>
            <ConsignacionSection />
          </ScrollAnimation>
        </Contenida>

        {/* 06 · PROCESO DE IMPORTACIÓN (id="timeline": lo siguen el navbar y
            el footer, no renombrar sin actualizarlos). */}
        <Contenida className="pt-16 sm:pt-24 lg:pt-32">
          <ScrollAnimation>
            <ProcesoSection />
          </ScrollAnimation>
        </Contenida>

        {/* 07 · CONFIANZA VERIFICABLE. Trae su propio py generoso. */}
        <Contenida className="pt-8 sm:pt-12 lg:pt-16">
          <ScrollAnimation>
            <ConfianzaSection />
          </ScrollAnimation>
        </Contenida>

        {/* 08 · PREGUNTAS FRECUENTES. */}
        <Contenida className="pt-8 sm:pt-12 lg:pt-16">
          <ScrollAnimation>
            <FAQSection />
          </ScrollAnimation>
        </Contenida>

        {/* 09 · CONTACTO. */}
        <Contenida className="pt-20 pb-24 sm:pt-28 sm:pb-32 lg:pt-36 lg:pb-40">
          <ScrollAnimation>
            <ContactSection />
          </ScrollAnimation>
        </Contenida>
      </main>

      <Footer />
    </div>
  );
}
