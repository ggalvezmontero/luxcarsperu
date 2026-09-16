import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LUXCARS_CONFIG } from "@/lib/config";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Cómo LuxCars Perú trata tus datos personales conforme a la Ley de Protección de Datos Personales del Perú.",
  alternates: { canonical: "/privacidad" },
};

export default function PrivacidadPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1 pt-[calc(var(--lux-nav-h)+3rem)] pb-20">
        <div className="container-lux max-w-3xl space-y-10">
        <div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Política de Privacidad
          </h1>
          <p className="mt-3 text-sm text-ink-4">Última actualización: 15 de septiembre de 2026</p>
        </div>

        <div className="space-y-10 text-[15px] leading-relaxed text-ink-2">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">1. Información que Recopilamos</h2>
            <p>
              En {LUXCARS_CONFIG.brandName}, recopilamos la siguiente información:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong>Información Personal:</strong> Nombre, correo electrónico, teléfono, DNI/pasaporte</li>
              <li><strong>Información del Vehículo:</strong> Preferencias, presupuesto, requisitos específicos</li>
              <li><strong>Información de Navegación:</strong> Dirección IP, tipo de navegador, páginas visitadas</li>
              <li><strong>Cookies:</strong> Utilizamos cookies para mejorar la experiencia del usuario</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">2. Uso de la Información</h2>
            <p>Utilizamos su información para:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Prestar nuestros servicios de importación de vehículos</li>
              <li>Comunicarnos con usted sobre el proceso de importación</li>
              <li>Generar cotizaciones y estimados de costos</li>
              <li>Cumplir con obligaciones legales y regulatorias</li>
              <li>Mejorar nuestros servicios y experiencia del usuario</li>
              <li>Enviar comunicaciones sobre servicios relacionados (si ha dado su consentimiento)</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">3. Compartir Información</h2>
            <p>
              No vendemos ni alquilamos su información personal a terceros. Podemos compartir su información con:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong>Proveedores de Servicios:</strong> Inspectores, agentes de aduana, navieras</li>
              <li><strong>Autoridades:</strong> Cuando sea requerido por ley (SUNAT, aduanas, etc.)</li>
              <li><strong>Socios Comerciales:</strong> Solo con su consentimiento explícito</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">4. Seguridad de los Datos</h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas para proteger su información personal contra acceso no autorizado, pérdida o alteración. Sin embargo, ningún método de transmisión por Internet es 100% seguro.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">5. Cookies y Tecnologías Similares</h2>
            <p>
              Utilizamos cookies y tecnologías similares para:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Mantener sus preferencias y sesión</li>
              <li>Analizar el uso del sitio web</li>
              <li>Personalizar su experiencia</li>
              <li>Mejorar nuestros servicios</li>
            </ul>
            <p>
              Puede gestionar sus preferencias de cookies en la configuración de su navegador o mediante nuestro banner de cookies.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">6. Sus Derechos</h2>
            <p>
              Usted tiene derecho a:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong>Acceso:</strong> Solicitar una copia de su información personal</li>
              <li><strong>Rectificación:</strong> Corregir información inexacta</li>
              <li><strong>Eliminación:</strong> Solicitar la eliminación de su información</li>
              <li><strong>Oposición:</strong> Oponerse al procesamiento de su información</li>
              <li><strong>Portabilidad:</strong> Recibir su información en formato estructurado</li>
              <li><strong>Retirar Consentimiento:</strong> En cualquier momento</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">7. Retención de Datos</h2>
            <p>
              Conservamos su información personal durante el tiempo necesario para cumplir con los propósitos descritos en esta política, o según lo requiera la ley peruana (generalmente 5 años para registros comerciales).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">8. Transferencias Internacionales</h2>
            <p>
              Debido a la naturaleza de nuestro servicio (importación desde Estados Unidos), su información puede ser transferida y procesada en Estados Unidos. Tomamos medidas para garantizar que su información esté protegida adecuadamente.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">9. Menores de Edad</h2>
            <p>
              Nuestros servicios no están dirigidos a menores de 18 años. No recopilamos intencionalmente información de menores.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">10. Cambios a esta Política</h2>
            <p>
              Podemos actualizar esta política periódicamente. Le notificaremos sobre cambios significativos a través de nuestro sitio web o por correo electrónico.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-ink">11. Contacto</h2>
            <p>
              Para ejercer sus derechos o hacer consultas sobre privacidad, contáctenos en:
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

