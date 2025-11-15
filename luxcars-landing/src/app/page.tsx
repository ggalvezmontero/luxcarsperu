import { CalculatorSection } from "@/components/CalculatorSection";
import { ContactSection } from "@/components/ContactSection";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { TimelineSection } from "@/components/TimelineSection";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-20 px-4 pb-20 pt-16 sm:px-8 lg:px-0">
        {/* Hero - Impacto inicial */}
        <Hero />

        {/* Calculadora - CTA Principal */}
        <CalculatorSection />

        {/* Timeline - 7 Hitos del Proceso */}
        <TimelineSection />

        {/* Contacto - CTA Final */}
        <ContactSection />
      </main>
      <Footer />
    </>
  );
}
