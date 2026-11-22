import { BrandsMarquee } from "@/components/BrandsMarquee";
import { ContactSection } from "@/components/ContactSection";
import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";
import { MostSoughtVehiclesSection } from "@/components/MostSoughtVehiclesSection";
import { Navbar } from "@/components/Navbar";
import { ScrollAnimation } from "@/components/ScrollAnimation";
import { CalculatorTeaser } from "@/components/home/CalculatorTeaser";
import { ConsignmentBand } from "@/components/home/ConsignmentBand";
import { HeroShowroom } from "@/components/home/HeroShowroom";
import { ImportBand } from "@/components/home/ImportBand";
import { ScanBand } from "@/components/home/ScanBand";
import { StockSection } from "@/components/home/StockSection";
import { currentYearInLima } from "@/core/pricing/pricingConfig";
import { cotizarEjemplo, tienePaginaPropia } from "@/lib/importExamples/modelo";
import { getImportExamplesForIsr } from "@/lib/importExamples/servidor";

/**
 * El bloque de stock sale de la base: se vuelve a generar cada hora para que
 * no se congele hasta el próximo despliegue. Un auto recién publicado no espera
 * esa hora: el portal pide regenerar la portada al guardar
 * (/api/portal/vehiculos/revalidar). Mismo criterio que /comprar.
 */
export const revalidate = 3600;

/**
 * HOME — siete bloques, cada uno con una sola idea:
 *   1. Portada: qué somos y los cuatro caminos.
 *   2. Stock disponible (tarjetas con foto).
 *   3. Modelos más pedidos → 4. Invitación a la calculadora, con un caso
 *      resuelto. La calculadora completa vive en /calculadora: en la portada
 *      la pesaba demasiado (12,000 px en móvil) y escondía el stock.
 *   5. Cómo importamos (cuatro pasos con foto).
 *   6. Consignación (foto) y, pegada debajo, la franja del escaneo pre-compra:
 *      es el enlace interno a /escaneo, que no está en la barra de navegación.
 *   7. Marcas, FAQ corto y contacto.
 */
export default async function Home() {
  // El caso resuelto de la invitación a la calculadora: el primer ejemplo
  // cotizable de la lista del dueño, con el motor real.
  const { vehiculos } = await getImportExamplesForIsr();
  const anioActual = currentYearInLima();
  const cotizables = vehiculos
    .filter(tienePaginaPropia)
    .map((v) => ({ v, r: cotizarEjemplo(v, anioActual) }))
    .flatMap(({ v, r }) => (r.kind === "ready" ? [{ v, estimate: r.estimate }] : []));
  // Sin advertencias y con foto; si no hay, el primero cotizable.
  const caso = cotizables.find(({ v }) => v.importViability === "importable" && v.imageSrc) ?? cotizables[0] ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1">
        <HeroShowroom />
        <StockSection />
        <ScrollAnimation>
          <MostSoughtVehiclesSection
            limite={3}
            verTodosHref="/importar#mas-buscados"
            id="referencias"
            tone="bg"
            eyebrow="Importación a pedido"
            titulo="¿Cuánto cuesta traer el que quieres?"
            descripcion="Elige un modelo de referencia o calcula el tuyo. Precio en EE.UU., tributos y entrega en Lima, en una sola cifra."
          />
        </ScrollAnimation>
        <ScrollAnimation>
          <CalculatorTeaser caso={caso} />
        </ScrollAnimation>
        <ScrollAnimation>
          <ImportBand />
        </ScrollAnimation>
        <ScrollAnimation>
          <ConsignmentBand />
        </ScrollAnimation>
        <ScrollAnimation>
          <ScanBand />
        </ScrollAnimation>
        <div className="pt-16 sm:pt-20 lg:pt-28">
          <BrandsMarquee />
        </div>
        <ScrollAnimation>
          <FAQSection limite={4} />
        </ScrollAnimation>
        <ScrollAnimation>
          <ContactSection />
        </ScrollAnimation>
      </main>
      <Footer />
    </div>
  );
}
