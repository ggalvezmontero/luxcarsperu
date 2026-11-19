import { PaginaLegal, type SeccionLegal } from "@/components/legal/PaginaLegal";
import { LUXCARS_CONFIG } from "@/lib/config";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";

import type { Metadata } from "next";

// El <title> sale de la plantilla del layout ("%s | marca"); Open Graph y
// Twitter repiten exactamente ese texto y la misma descripción. Sin `openGraph`
// propio la página heredaba og:url y og:title de la home.
const TITLE = "Política de cookies";
const DESCRIPTION =
  "Qué cookies utiliza luxcars.pe, para qué sirven y cómo gestionarlas.";
const OG_TITLE = `${TITLE} | ${LUXCARS_CONFIG.brandName}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/cookies" },
  openGraph: {
    ...OG_DEFAULTS,
    type: "website",
    url: `${LUXCARS_CONFIG.contact.website}/cookies`,
    title: OG_TITLE,
    description: DESCRIPTION,
  },
  twitter: twitterCard(OG_TITLE, DESCRIPTION),
};

/** Los cuatro tipos, en una rejilla de filetes en lugar de cuatro tarjetas. */
const TIPOS = [
  {
    titulo: "1. Cookies Esenciales",
    clase: "Necesarias",
    texto: "Requeridas para el funcionamiento básico del sitio.",
    items: ["Gestión de sesión", "Seguridad y autenticación", "Preferencias de idioma"],
    nota: "Estas cookies no pueden ser desactivadas.",
  },
  {
    titulo: "2. Cookies de Funcionalidad",
    clase: "Opcionales",
    texto: "Mejoran la experiencia del usuario.",
    items: ["Recordar preferencias de cálculo", "Guardar vehículos favoritos", "Configuración de visualización"],
    nota: null,
  },
  {
    titulo: "3. Cookies Analíticas",
    clase: "Opcionales",
    texto: "Nos ayudan a entender cómo se usa el sitio.",
    items: ["Páginas más visitadas", "Tiempo de permanencia", "Origen del tráfico", "Patrones de navegación"],
    nota: "Utilizamos Google Analytics y el píxel de Meta (Facebook e Instagram); ninguno se carga hasta que aceptas las cookies.",
  },
  {
    titulo: "4. Cookies de Marketing",
    clase: "Opcionales",
    texto: "Para personalizar anuncios y comunicaciones.",
    items: ["Publicidad relevante", "Retargeting", "Medición de campañas"],
    nota: null,
  },
];

const NAVEGADORES = [
  { nombre: "Chrome", ruta: "Configuración → Privacidad y seguridad → Cookies" },
  { nombre: "Firefox", ruta: "Opciones → Privacidad y Seguridad" },
  { nombre: "Safari", ruta: "Preferencias → Privacidad" },
  { nombre: "Edge", ruta: "Configuración → Cookies y permisos del sitio" },
];

const SECCIONES: SeccionLegal[] = [
  {
    id: "que-son",
    titulo: "¿Qué son las Cookies?",
    contenido: (
      <p>
        Las cookies son pequeños archivos de texto que se almacenan en su dispositivo cuando visita nuestro sitio web. Nos ayudan a mejorar su experiencia, recordar sus preferencias y entender cómo utiliza nuestro sitio.
      </p>
    ),
  },
  {
    id: "tipos",
    titulo: "Tipos de Cookies que Utilizamos",
    contenido: (
      <div className="grid gap-px overflow-hidden rounded-[22px] border border-white/[0.07] bg-line sm:grid-cols-2">
        {TIPOS.map((t) => (
          <div key={t.titulo} className="bg-surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-ink">{t.titulo}</h3>
              <span
                className={
                  t.clase === "Necesarias"
                    ? "shrink-0 rounded-full border border-silver/40 bg-silver/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-silver-bright"
                    : "shrink-0 rounded-full border border-line px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4"
                }
              >
                {t.clase}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-3">{t.texto}</p>
            <ul className="mt-3">
              {t.items.map((i) => (
                <li key={i} className="text-sm">{i}</li>
              ))}
            </ul>
            {t.nota ? <p className="mt-3 text-xs leading-relaxed text-ink-4">{t.nota}</p> : null}
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "duracion",
    titulo: "Duración de las Cookies",
    contenido: (
      <ul>
        <li><strong>Cookies de Sesión:</strong> Se eliminan al cerrar el navegador</li>
        <li><strong>Cookies Persistentes:</strong> Permanecen hasta 12 meses o hasta que las elimine</li>
      </ul>
    ),
  },
  {
    id: "terceros",
    titulo: "Cookies de Terceros",
    contenido: (
      <>
        <p>Algunos servicios que utilizamos pueden instalar sus propias cookies:</p>
        <ul>
          <li><strong>Google Analytics:</strong> Análisis de uso del sitio</li>
          <li><strong>Meta (Facebook e Instagram):</strong> Medición de los anuncios que te trajeron al sitio</li>
          <li><strong>Google Fonts:</strong> Tipografías del sitio</li>
          <li><strong>Vercel:</strong> Hosting y optimización</li>
        </ul>
      </>
    ),
  },
  {
    id: "preferencias",
    titulo: "Gestionar sus Preferencias de Cookies",
    contenido: (
      <>
        <p>Puede gestionar o eliminar cookies de las siguientes maneras:</p>
        <ul>
          <li><strong>Banner de Cookies:</strong> Al visitar nuestro sitio por primera vez, puede aceptar o rechazar cookies opcionales</li>
          <li><strong>Configuración del Navegador:</strong> Puede configurar su navegador para bloquear o alertar sobre cookies</li>
          <li><strong>Eliminar Cookies:</strong> Puede eliminar cookies existentes desde la configuración de su navegador</li>
        </ul>
      </>
    ),
  },
  {
    id: "navegadores",
    titulo: "Instrucciones por Navegador",
    contenido: (
      <dl className="grid gap-px overflow-hidden rounded-[22px] border border-white/[0.07] bg-line sm:grid-cols-2">
        {NAVEGADORES.map((n) => (
          <div key={n.nombre} className="bg-surface p-4 sm:p-5">
            <dt className="text-sm font-semibold text-ink">{n.nombre}</dt>
            <dd className="mt-1 text-sm text-ink-3">{n.ruta}</dd>
          </div>
        ))}
      </dl>
    ),
  },
  {
    id: "rechazar",
    titulo: "Consecuencias de Rechazar Cookies",
    contenido: (
      <>
        <p>Si rechaza las cookies opcionales:</p>
        <ul>
          <li>El sitio seguirá funcionando normalmente</li>
          <li>Algunas funciones de personalización pueden no estar disponibles</li>
          <li>Deberá reingresar información en cada visita</li>
          <li>No podremos mejorar su experiencia basándonos en sus preferencias</li>
        </ul>
      </>
    ),
  },
  {
    id: "actualizaciones",
    titulo: "Actualizaciones",
    contenido: (
      <p>
        Podemos actualizar esta política de cookies periódicamente para reflejar cambios en las tecnologías que utilizamos. Le recomendamos revisar esta página ocasionalmente.
      </p>
    ),
  },
];

export default function CookiesPage() {
  return (
    <PaginaLegal
      eyebrow="Legal · Cookies y medición"
      titulo="Política de Cookies"
      actualizada="15 de septiembre de 2026"
      intro="Qué guarda luxcars.pe en tu navegador, qué servicios de medición usamos y cómo aceptarlos, rechazarlos o borrarlos."
      resumen={[
        {
          icon: "shield",
          titulo: "Nada se carga sin tu permiso",
          texto: "Google Analytics y el píxel de Meta solo se activan cuando aceptas las cookies opcionales.",
        },
        {
          icon: "activity",
          titulo: "Medición, no vigilancia",
          texto: "Las analíticas nos dicen qué páginas se visitan y de dónde llega la gente, en conjunto.",
        },
        {
          icon: "clock",
          titulo: "Máximo 12 meses",
          texto: "Las cookies persistentes caducan en un año; las de sesión, al cerrar el navegador.",
        },
      ]}
      secciones={SECCIONES}
      contactoTitulo="Contacto"
      contactoTexto="Para preguntas sobre nuestra política de cookies, contáctenos en:"
    />
  );
}
