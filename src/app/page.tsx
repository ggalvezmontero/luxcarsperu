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
import { StockSection } from "@/components/home/StockSection";

/**
 * HOME — siete bloques, cada uno con una sola idea:
 *   1. Portada: qué somos y los cuatro caminos.
 *   2. Stock disponible (tarjetas con foto).
 *   3. Modelos más pedidos → 4. Calculadora (el activo del sitio).
 *   5. Cómo importamos (cuatro pasos con foto).
 *   6. Consignación (foto).
 *   7. Marcas, FAQ corto y contacto.
 */
export default function Home() {
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
          <CalculatorSection />
        </ScrollAnimation>
        <ScrollAnimation>
          <ImportBand />
        </ScrollAnimation>
        <ScrollAnimation>
          <ConsignmentBand />
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
