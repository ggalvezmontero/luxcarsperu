'use client';

import { Navbar } from "@/components/Navbar";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { BrandsSection } from "@/components/BrandsSection";
import { WhyUsSection } from "@/components/WhyUsSection";
import { WebsitesSection } from "@/components/WebsitesSection";
import { DeliveryTimesSection } from "@/components/DeliveryTimesSection";
import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";

export default function ComoFuncionaPage() {

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl flex flex-col gap-20 px-4 pb-20 pt-32 sm:px-8 lg:px-0">
          {/* Título de la página */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              Cómo Funciona
            </h1>
            <p className="mt-4 text-lg text-white/60">
              Todo lo que necesitas saber sobre nuestro servicio de importación
            </p>
          </div>

          {/* Proceso Paso a Paso */}
          <HowItWorksSection />

          {/* Marcas Disponibles */}
          <BrandsSection />

          {/* Por Qué Nosotros */}
          <WhyUsSection />

          {/* Sitios de Búsqueda */}
          <WebsitesSection />

          {/* Tiempos de Entrega */}
          <DeliveryTimesSection />

          {/* Preguntas Frecuentes */}
          <FAQSection />
        </div>
      </main>
      <Footer />
    </div>
  );
}

