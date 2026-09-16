import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { CtaBand } from "@/components/CtaBand";
import { Section } from "@/components/ui/Section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description:
    "Dudas comunes sobre comprar, importar y vender autos con LuxCars: impuestos SUNAT, plazos, antigüedad permitida y consignación sin exclusividad.",
  alternates: { canonical: "/faq" },
};

export default function FAQPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1 pt-[var(--lux-nav-h)]">
        <FAQSection titulo="Todas las preguntas frecuentes" />
        <Section tone="void" padding="tight">
          <CtaBand title="¿Tu duda no está aquí?" text="Escríbenos y te respondemos el mismo día." message="Hola LuxCars, tengo una consulta." />
        </Section>
      </main>
      <Footer />
    </div>
  );
}
