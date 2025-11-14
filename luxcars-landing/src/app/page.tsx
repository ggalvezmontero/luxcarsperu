import { Hero } from "@/components/Hero";
import { CalculatorSection } from "@/components/CalculatorSection";
import { DeliveryTimesSection } from "@/components/DeliveryTimesSection";
import { BrandsSection } from "@/components/BrandsSection";
import { DifferentiatorsSection } from "@/components/DifferentiatorsSection";
import { SourcingSection } from "@/components/SourcingSection";
import { TimelineSection } from "@/components/TimelineSection";
import { ContactSection } from "@/components/ContactSection";
import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-4 py-12 sm:px-8 lg:px-0">
      <Hero />
      <CalculatorSection />
      <DeliveryTimesSection />
      <BrandsSection />
      <DifferentiatorsSection />
      <SourcingSection />
      <TimelineSection />
      <ContactSection />
      <FAQSection />
      <Footer />
    </main>
  );
}
