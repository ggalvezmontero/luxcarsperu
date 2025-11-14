import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { BrandsSection } from "@/components/BrandsSection";
import { CalculatorSection } from "@/components/CalculatorSection";
import { HowItWorksSection } from "@/components/HowItWorksSection";
import { DeliveryTimesSection } from "@/components/DeliveryTimesSection";
import { WhyUsSection } from "@/components/WhyUsSection";
import { WebsitesSection } from "@/components/WebsitesSection";
import { TimelineSection } from "@/components/TimelineSection";
import { FAQSection } from "@/components/FAQSection";
import { ContactSection } from "@/components/ContactSection";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-4 pb-20 pt-16 sm:px-8 lg:px-0">
        <Hero />
        <BrandsSection />
        <CalculatorSection />
        <HowItWorksSection />
        <WhyUsSection />
        <WebsitesSection />
        <DeliveryTimesSection />
        <TimelineSection />
        <FAQSection />
        <ContactSection />
        <Footer />
      </main>
    </>
  );
}
