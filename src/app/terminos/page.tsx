import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LUXCARS_CONFIG } from "@/lib/config";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Términos y condiciones del servicio de importación, compra venta y consignación de vehículos de LUX CARS IMPORT S.A.C.",
  alternates: { canonical: "/terminos" },
};

export default function TerminosPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 w-full px-4 pb-20 pt-32 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-balance text-ink sm:text-5xl">
            Términos y Condiciones
          </h1>
          <p className="mt-4 text-lg text-ink-2">
            Última actualización: {new Date().toLocaleDateString('es-PE')}
          </p>
        </div>

        <div className="space-y-8 rounded-lux-lg md:rounded-lux-xl border border-line bg-surface p-5 text-ink-2 md:p-8">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">1. Aceptación de los Términos</h2>
            <p>
              Al acceder y utilizar los servicios de {LUXCARS_CONFIG.brandName}, usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestros servicios.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">2. Descripción del Servicio</h2>
            <p>
              {LUXCARS_CONFIG.brandName} actúa como broker e intermediario en la importación de vehículos de lujo desde Estados Unidos (principalmente Miami) a Perú. Nuestros servicios incluyen:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Búsqueda y selección de vehículos</li>
              <li>Negociación con vendedores</li>
              <li>Inspección técnica y verificación de documentos</li>
              <li>Coordinación de logística internacional</li>
              <li>Gestión de trámites aduaneros y de nacionalización</li>
              <li>Entrega del vehículo en Lima, Perú</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">3. Responsabilidades del Cliente</h2>
            <p>El cliente se compromete a:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Proporcionar información veraz y completa sobre sus requerimientos</li>
              <li>Realizar los pagos acordados en los plazos establecidos</li>
              <li>Revisar y aprobar la información del vehículo seleccionado</li>
              <li>Cumplir con la normativa peruana aplicable a la importación de vehículos</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">4. Precios y Pagos</h2>
            <p>
              Los precios estimados en nuestra calculadora son referenciales y pueden variar según las condiciones del mercado, tipo de cambio, y determinación final de SUNAT. Todos los costos se detallarán claramente antes de proceder con la importación.
            </p>
            <p>
              Los pagos se realizarán de acuerdo al cronograma establecido en el contrato específico de servicio.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">5. Cancelaciones y Reembolsos</h2>
            <p>
              Las políticas de cancelación y reembolso se establecerán en el contrato específico de cada servicio. En general, los honorarios por servicios ya prestados no son reembolsables.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">6. Limitación de Responsabilidad</h2>
            <p>
              {LUXCARS_CONFIG.brandName} actúa como intermediario y no asume responsabilidad por:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Defectos ocultos no detectables en la inspección</li>
              <li>Cambios en regulaciones aduaneras o tributarias</li>
              <li>Retrasos causados por terceros (navieras, aduanas, etc.)</li>
              <li>Variaciones en tipo de cambio</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">7. Propiedad Intelectual</h2>
            <p>
              Todo el contenido de este sitio web, incluyendo textos, gráficos, logos y software, es propiedad de {LUXCARS_CONFIG.brandName} y está protegido por las leyes de propiedad intelectual.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">8. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigencia inmediatamente después de su publicación en el sitio web.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">9. Ley Aplicable y Jurisdicción</h2>
            <p>
              Estos términos se rigen por las leyes de la República del Perú. Cualquier disputa será resuelta en los tribunales de Lima, Perú.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">10. Contacto</h2>
            <p>
              Para cualquier consulta sobre estos términos, puede contactarnos en:
            </p>
            <ul className="space-y-2">
              <li>Email: {LUXCARS_CONFIG.contact.email}</li>
              <li>WhatsApp: +{LUXCARS_CONFIG.contact.whatsappNumber}</li>
            </ul>
          </section>
        </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

