import { BrandsMarquee } from "@/components/BrandsMarquee";
import { CalculatorSection } from "@/components/CalculatorSection";
import { ContactSection } from "@/components/ContactSection";
import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";
import { MostSoughtVehiclesSection } from "@/components/MostSoughtVehiclesSection";
import { Navbar } from "@/components/Navbar";
import { ScrollAnimation } from "@/components/ScrollAnimation";
import { ConsignmentBand } from "@/components/home/ConsignmentBand";
import { HeroShowroom } from "@/components/home/HeroShowroom";
import { ImportBand } from "@/components/home/ImportBand";
import { ScanBand } from "@/components/home/ScanBand";
import { StockSection } from "@/components/home/StockSection";
import { simulationPresets } from "@/data/trendingVehicles";
import { getImportExamplesForIsr } from "@/lib/importExamples/servidor";

/**
 * El bloque de stock sale de la base: se vuelve a generar cada cinco minutos
 * para que un auto recién publicado aparezca sin esperar al próximo despliegue.
 * Mismo criterio que /comprar.
 */
export const revalidate = 300;

/**
 * HOME — siete bloques, cada uno con una sola idea:
 *   1. Portada: qué somos y los cuatro caminos.
 *   2. Stock disponible (tarjetas con foto).
 *   3. Modelos más pedidos → 4. Calculadora (el activo del sitio).
 *   5. Cómo importamos (cuatro pasos con foto).
 *   6. Consignación (foto) y, pegada debajo, la franja del escaneo pre-compra:
 *      es el enlace interno a /escaneo, que no está en la barra de navegación.
 *   7. Marcas, FAQ corto y contacto.
 */
export default async function Home() {
  // Los mismos ejemplos que pinta la sección de "más pedidos": la calculadora
  // recibe sus presets para que `/?simular=<id>` abra con esos datos.
  const { vehiculos } = await getImportExamplesForIsr();

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
            descripcion="Elige un modelo de referencia o calcula el tuyo abajo. Precio en EE.UU., tributos y entrega en Lima, en una sola cifra."
          />
        </ScrollAnimation>
        <ScrollAnimation>
          <CalculatorSection presets={simulationPresets(vehiculos)} />
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
