import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LUXCARS_CONFIG } from "@/lib/config";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de cookies",
  description:
    "Qué cookies utiliza luxcars.pe, para qué sirven y cómo gestionarlas.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 w-full px-4 pb-20 pt-32 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-balance text-ink sm:text-5xl">
            Política de Cookies
          </h1>
          <p className="mt-4 text-lg text-ink-2">
            Última actualización: {new Date().toLocaleDateString('es-PE')}
          </p>
        </div>

        <div className="space-y-8 rounded-lux-lg md:rounded-lux-xl border border-line bg-surface p-5 text-ink-2 md:p-8">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">¿Qué son las Cookies?</h2>
            <p>
              Las cookies son pequeños archivos de texto que se almacenan en su dispositivo cuando visita nuestro sitio web. Nos ayudan a mejorar su experiencia, recordar sus preferencias y entender cómo utiliza nuestro sitio.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">Tipos de Cookies que Utilizamos</h2>
            
            <div className="space-y-4">
              <div className="rounded-lux border border-line bg-surface-2 p-5 md:p-6">
                <h3 className="text-xl font-semibold text-ink mb-2">1. Cookies Esenciales</h3>
                <p className="mb-2">
                  <strong className="text-ink">Necesarias:</strong> Requeridas para el funcionamiento básico del sitio.
                </p>
                <ul className="list-disc space-y-1 pl-6">
                  <li>Gestión de sesión</li>
                  <li>Seguridad y autenticación</li>
                  <li>Preferencias de idioma</li>
                </ul>
                <p className="mt-2 text-sm text-ink-3">Estas cookies no pueden ser desactivadas.</p>
              </div>

              <div className="rounded-lux border border-line bg-surface-2 p-5 md:p-6">
                <h3 className="text-xl font-semibold text-ink mb-2">2. Cookies de Funcionalidad</h3>
                <p className="mb-2">
                  <strong className="text-ink">Opcionales:</strong> Mejoran la experiencia del usuario.
                </p>
                <ul className="list-disc space-y-1 pl-6">
                  <li>Recordar preferencias de cálculo</li>
                  <li>Guardar vehículos favoritos</li>
                  <li>Configuración de visualización</li>
                </ul>
              </div>

              <div className="rounded-lux border border-line bg-surface-2 p-5 md:p-6">
                <h3 className="text-xl font-semibold text-ink mb-2">3. Cookies Analíticas</h3>
                <p className="mb-2">
                  <strong className="text-ink">Opcionales:</strong> Nos ayudan a entender cómo se usa el sitio.
                </p>
                <ul className="list-disc space-y-1 pl-6">
                  <li>Páginas más visitadas</li>
                  <li>Tiempo de permanencia</li>
                  <li>Origen del tráfico</li>
                  <li>Patrones de navegación</li>
                </ul>
                <p className="mt-2 text-sm text-ink-3">Utilizamos herramientas como Google Analytics.</p>
              </div>

              <div className="rounded-lux border border-line bg-surface-2 p-5 md:p-6">
                <h3 className="text-xl font-semibold text-ink mb-2">4. Cookies de Marketing</h3>
                <p className="mb-2">
                  <strong className="text-ink">Opcionales:</strong> Para personalizar anuncios y comunicaciones.
                </p>
                <ul className="list-disc space-y-1 pl-6">
                  <li>Publicidad relevante</li>
                  <li>Retargeting</li>
                  <li>Medición de campañas</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">Duración de las Cookies</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong className="text-ink">Cookies de Sesión:</strong> Se eliminan al cerrar el navegador</li>
              <li><strong className="text-ink">Cookies Persistentes:</strong> Permanecen hasta 12 meses o hasta que las elimine</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">Cookies de Terceros</h2>
            <p>
              Algunos servicios que utilizamos pueden instalar sus propias cookies:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong className="text-ink">Google Analytics:</strong> Análisis de uso del sitio</li>
              <li><strong className="text-ink">Google Fonts:</strong> Tipografías del sitio</li>
              <li><strong className="text-ink">Vercel:</strong> Hosting y optimización</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">Gestionar sus Preferencias de Cookies</h2>
            <p>
              Puede gestionar o eliminar cookies de las siguientes maneras:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li><strong className="text-ink">Banner de Cookies:</strong> Al visitar nuestro sitio por primera vez, puede aceptar o rechazar cookies opcionales</li>
              <li><strong className="text-ink">Configuración del Navegador:</strong> Puede configurar su navegador para bloquear o alertar sobre cookies</li>
              <li><strong className="text-ink">Eliminar Cookies:</strong> Puede eliminar cookies existentes desde la configuración de su navegador</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">Instrucciones por Navegador</h2>
            <div className="space-y-3">
              <div className="rounded-lux-lg border border-line bg-surface-2 p-4">
                <p><strong className="text-ink">Chrome:</strong> Configuración → Privacidad y seguridad → Cookies</p>
              </div>
              <div className="rounded-lux-lg border border-line bg-surface-2 p-4">
                <p><strong className="text-ink">Firefox:</strong> Opciones → Privacidad y Seguridad</p>
              </div>
              <div className="rounded-lux-lg border border-line bg-surface-2 p-4">
                <p><strong className="text-ink">Safari:</strong> Preferencias → Privacidad</p>
              </div>
              <div className="rounded-lux-lg border border-line bg-surface-2 p-4">
                <p><strong className="text-ink">Edge:</strong> Configuración → Cookies y permisos del sitio</p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">Consecuencias de Rechazar Cookies</h2>
            <p>
              Si rechaza las cookies opcionales:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>El sitio seguirá funcionando normalmente</li>
              <li>Algunas funciones de personalización pueden no estar disponibles</li>
              <li>Deberá reingresar información en cada visita</li>
              <li>No podremos mejorar su experiencia basándonos en sus preferencias</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">Actualizaciones</h2>
            <p>
              Podemos actualizar esta política de cookies periódicamente para reflejar cambios en las tecnologías que utilizamos. Le recomendamos revisar esta página ocasionalmente.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-ink">Contacto</h2>
            <p>
              Para preguntas sobre nuestra política de cookies, contáctenos en:
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

