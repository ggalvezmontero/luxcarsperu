import { PaginaLegal, type SeccionLegal } from "@/components/legal/PaginaLegal";
import { LUXCARS_CONFIG } from "@/lib/config";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";

import type { Metadata } from "next";

// El <title> sale de la plantilla del layout ("%s | marca"); Open Graph y
// Twitter repiten exactamente ese texto y la misma descripción. Sin `openGraph`
// propio la página heredaba og:url y og:title de la home.
const TITLE = "Política de privacidad";
const DESCRIPTION =
  "Cómo Luxcars Perú trata tus datos personales conforme a la Ley de Protección de Datos Personales del Perú.";
const OG_TITLE = `${TITLE} | ${LUXCARS_CONFIG.brandName}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/privacidad" },
  openGraph: {
    ...OG_DEFAULTS,
    type: "website",
    url: `${LUXCARS_CONFIG.contact.website}/privacidad`,
    title: OG_TITLE,
    description: DESCRIPTION,
  },
  twitter: twitterCard(OG_TITLE, DESCRIPTION),
};

const marca = LUXCARS_CONFIG.brandName;

const SECCIONES: SeccionLegal[] = [
  {
    id: "informacion",
    titulo: "1. Información que Recopilamos",
    contenido: (
      <>
        <p>En {marca}, recopilamos la siguiente información:</p>
        <ul>
          <li><strong>Información Personal:</strong> Nombre, correo electrónico, teléfono, DNI/pasaporte</li>
          <li><strong>Información del Vehículo:</strong> Preferencias, presupuesto, requisitos específicos</li>
          <li><strong>Información de Navegación:</strong> Dirección IP, tipo de navegador, páginas visitadas</li>
          <li><strong>Cookies:</strong> Utilizamos cookies para mejorar la experiencia del usuario</li>
        </ul>
      </>
    ),
  },
  {
    id: "uso",
    titulo: "2. Uso de la Información",
    contenido: (
      <>
        <p>Utilizamos su información para:</p>
        <ul>
          <li>Prestar nuestros servicios de importación de vehículos</li>
          <li>Comunicarnos con usted sobre el proceso de importación</li>
          <li>Generar cotizaciones y estimados de costos</li>
          <li>Cumplir con obligaciones legales y regulatorias</li>
          <li>Mejorar nuestros servicios y experiencia del usuario</li>
          <li>Enviar comunicaciones sobre servicios relacionados (si ha dado su consentimiento)</li>
        </ul>
      </>
    ),
  },
  {
    id: "compartir",
    titulo: "3. Compartir Información",
    contenido: (
      <>
        <p>No vendemos ni alquilamos su información personal a terceros. Podemos compartir su información con:</p>
        <ul>
          <li><strong>Proveedores de Servicios:</strong> Inspectores, agentes de aduana, navieras</li>
          <li><strong>Autoridades:</strong> Cuando sea requerido por ley (SUNAT, aduanas, etc.)</li>
          <li><strong>Socios Comerciales:</strong> Solo con su consentimiento explícito</li>
        </ul>
      </>
    ),
  },
  {
    id: "seguridad",
    titulo: "4. Seguridad de los Datos",
    contenido: (
      <p>
        Implementamos medidas de seguridad técnicas y organizativas para proteger su información personal contra acceso no autorizado, pérdida o alteración. Sin embargo, ningún método de transmisión por Internet es 100% seguro.
      </p>
    ),
  },
  {
    id: "cookies",
    titulo: "5. Cookies y Tecnologías Similares",
    contenido: (
      <>
        <p>Utilizamos cookies y tecnologías similares para:</p>
        <ul>
          <li>Mantener sus preferencias y sesión</li>
          <li>Analizar el uso del sitio web</li>
          <li>Personalizar su experiencia</li>
          <li>Mejorar nuestros servicios</li>
        </ul>
        <p>Puede gestionar sus preferencias de cookies en la configuración de su navegador o mediante nuestro banner de cookies.</p>
      </>
    ),
  },
  {
    id: "derechos",
    titulo: "6. Sus Derechos",
    contenido: (
      <>
        <p>Usted tiene derecho a:</p>
        <ul>
          <li><strong>Acceso:</strong> Solicitar una copia de su información personal</li>
          <li><strong>Rectificación:</strong> Corregir información inexacta</li>
          <li><strong>Eliminación:</strong> Solicitar la eliminación de su información</li>
          <li><strong>Oposición:</strong> Oponerse al procesamiento de su información</li>
          <li><strong>Portabilidad:</strong> Recibir su información en formato estructurado</li>
          <li><strong>Retirar Consentimiento:</strong> En cualquier momento</li>
        </ul>
      </>
    ),
  },
  {
    id: "retencion",
    titulo: "7. Retención de Datos",
    contenido: (
      <p>
        Conservamos su información personal durante el tiempo necesario para cumplir con los propósitos descritos en esta política, o según lo requiera la ley peruana (generalmente 5 años para registros comerciales).
      </p>
    ),
  },
  {
    id: "transferencias",
    titulo: "8. Transferencias Internacionales",
    contenido: (
      <p>
        Debido a la naturaleza de nuestro servicio (importación desde Estados Unidos), su información puede ser transferida y procesada en Estados Unidos. Tomamos medidas para garantizar que su información esté protegida adecuadamente.
      </p>
    ),
  },
  {
    id: "menores",
    titulo: "9. Menores de Edad",
    contenido: <p>Nuestros servicios no están dirigidos a menores de 18 años. No recopilamos intencionalmente información de menores.</p>,
  },
  {
    id: "cambios",
    titulo: "10. Cambios a esta Política",
    contenido: (
      <p>
        Podemos actualizar esta política periódicamente. Le notificaremos sobre cambios significativos a través de nuestro sitio web o por correo electrónico.
      </p>
    ),
  },
];

export default function PrivacidadPage() {
  return (
    <PaginaLegal
      eyebrow="Legal · Protección de datos personales"
      titulo="Política de Privacidad"
      actualizada="15 de septiembre de 2026"
      intro="Qué datos tuyos guardamos, para qué los usamos y cómo puedes pedir verlos, corregirlos o borrarlos."
      resumen={[
        {
          icon: "shield",
          titulo: "No vendemos tus datos",
          texto: "Solo los comparten quienes intervienen en tu importación y las autoridades cuando la ley lo exige.",
        },
        {
          icon: "key",
          titulo: "Tú decides",
          texto: "Puedes pedir acceso, corrección o eliminación de tu información, y retirar tu consentimiento cuando quieras.",
        },
        {
          icon: "clock",
          titulo: "Solo el tiempo necesario",
          texto: "Conservamos la información lo que exige el servicio o la ley peruana para registros comerciales.",
        },
      ]}
      secciones={SECCIONES}
      contactoTitulo="11. Contacto"
      contactoTexto="Para ejercer sus derechos o hacer consultas sobre privacidad, contáctenos en:"
    />
  );
}
