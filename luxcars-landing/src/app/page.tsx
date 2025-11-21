'use client';

import { CalculatorSection } from "@/components/CalculatorSection";
import { ContactSection } from "@/components/ContactSection";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { ScrollAnimation } from "@/components/ScrollAnimation";
import { TimelineSection } from "@/components/TimelineSection";
import { useActiveSection } from "@/hooks/useActiveSection";

export default function Home() {
  // Secciones de la página de inicio
  const sectionIds = ["calculator", "timeline", "contact"];
  useActiveSection(sectionIds);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl flex flex-col gap-20 px-4 pb-20 pt-16 sm:px-8 lg:px-0">
          {/* Hero - Impacto inicial */}
          <ScrollAnimation variant="fadeIn">
            <Hero />
          </ScrollAnimation>

          {/* Calculadora - CTA Principal */}
          <ScrollAnimation delay={0.1}>
            <CalculatorSection />
          </ScrollAnimation>

          {/* Timeline - 7 Hitos del Proceso */}
          <ScrollAnimation delay={0.2}>
            <TimelineSection />
          </ScrollAnimation>

          {/* Contacto - CTA Final */}
          <ScrollAnimation delay={0.3}>
            <ContactSection />
          </ScrollAnimation>
        </div>
      </main>
      <Footer />
    </div>
  );
}
