import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preguntas frecuentes sobre importación de autos",
  description:
    "Resolvemos las dudas más comunes sobre importar un auto de EE.UU. a Perú: impuestos SUNAT, plazos, antigüedad permitida, consignación sin exclusividad y garantías.",
  alternates: { canonical: "/faq" },
};

export default function FAQPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl flex flex-col gap-20 px-4 pb-20 pt-32 sm:px-8 lg:px-0">
          {/* Título de la página */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-balance text-ink sm:text-5xl lg:text-6xl">
              Preguntas Frecuentes
            </h1>
            <p className="mt-4 text-lg text-ink-2">
              Todo lo que necesitas saber sobre importar autos de lujo desde Miami
            </p>
          </div>

          {/* Preguntas Frecuentes */}
          <FAQSection />
        </div>
      </main>
      <Footer />
    </div>
  );
}

