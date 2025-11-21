'use client';

import { Navbar } from "@/components/Navbar";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { BrandsSection } from "@/components/BrandsSection";
import { WhyUsSection } from "@/components/WhyUsSection";
import { WebsitesSection } from "@/components/WebsitesSection";
import { DeliveryTimesSection } from "@/components/DeliveryTimesSection";
import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";
import { ScrollAnimation } from "@/components/ScrollAnimation";
import { useActiveSection } from "@/hooks/useActiveSection";

export default function ComoFuncionaPage() {
  // Secciones de la página como-funciona
  const sectionIds = [
    "how-it-works",
    "brands",
    "why-us",
    "websites",
    "services",
    "faq",
  ];
  useActiveSection(sectionIds);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl flex flex-col gap-20 px-4 pb-20 pt-32 sm:px-8 lg:px-0">
          {/* Título de la página */}
          <ScrollAnimation variant="fadeIn">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
                Cómo Funciona
              </h1>
              <p className="mt-4 text-lg text-white/60">
                Todo lo que necesitas saber sobre nuestro servicio de importación
              </p>
            </div>
          </ScrollAnimation>

          {/* Proceso Paso a Paso */}
          <ScrollAnimation delay={0.1}>
            <HowItWorksSection />
          </ScrollAnimation>

          {/* Marcas Disponibles */}
          <ScrollAnimation delay={0.2}>
            <BrandsSection />
          </ScrollAnimation>

          {/* Por Qué Nosotros */}
          <ScrollAnimation delay={0.3}>
            <WhyUsSection />
          </ScrollAnimation>

          {/* Sitios de Búsqueda */}
          <ScrollAnimation delay={0.4}>
            <WebsitesSection />
          </ScrollAnimation>

          {/* Tiempos de Entrega */}
          <ScrollAnimation delay={0.5}>
            <DeliveryTimesSection />
          </ScrollAnimation>

          {/* Preguntas Frecuentes */}
          <ScrollAnimation delay={0.6}>
            <FAQSection />
          </ScrollAnimation>
        </div>
      </main>
      <Footer />
    </div>
  );
}

