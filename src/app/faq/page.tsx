import { FAQSection } from "@/components/FAQSection";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export default function FAQPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl flex flex-col gap-20 px-4 pb-20 pt-32 sm:px-8 lg:px-0">
          {/* Título de la página */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white sm:text-5xl lg:text-6xl">
              Preguntas Frecuentes
            </h1>
            <p className="mt-4 text-lg text-white/60">
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

