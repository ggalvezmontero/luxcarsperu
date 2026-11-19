import { PaginaLegal, type SeccionLegal } from "@/components/legal/PaginaLegal";
import { LUXCARS_CONFIG } from "@/lib/config";
import { OG_DEFAULTS, twitterCard } from "@/lib/seo";

import type { Metadata } from "next";

// El <title> sale de la plantilla del layout ("%s | marca"); Open Graph y
// Twitter repiten exactamente ese texto y la misma descripción. Sin `openGraph`
// propio la página heredaba og:url y og:title de la home.
const TITLE = "Términos y condiciones";
const DESCRIPTION =
  "Términos y condiciones del servicio de importación, compra venta y consignación de vehículos de LUX CARS IMPORT S.A.C.";
const OG_TITLE = `${TITLE} | ${LUXCARS_CONFIG.brandName}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/terminos" },
  openGraph: {
    ...OG_DEFAULTS,
    type: "website",
    url: `${LUXCARS_CONFIG.contact.website}/terminos`,
    title: OG_TITLE,
    description: DESCRIPTION,
  },
  twitter: twitterCard(OG_TITLE, DESCRIPTION),
};

const marca = LUXCARS_CONFIG.brandName;

const SECCIONES: SeccionLegal[] = [
  {
    id: "aceptacion",
    titulo: "1. Aceptación de los Términos",
    contenido: (
      <p>
        Al acceder y utilizar los servicios de {marca}, usted acepta estar sujeto a estos Términos y Condiciones. Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestros servicios.
      </p>
    ),
  },
  {
    id: "servicio",
    titulo: "2. Descripción del Servicio",
    contenido: (
      <>
        <p>
          {marca} actúa como broker e intermediario en la importación de vehículos de lujo desde Estados Unidos (principalmente Miami) a Perú. Nuestros servicios incluyen:
        </p>
        <ul>
          <li>Búsqueda y selección de vehículos</li>
          <li>Negociación con vendedores</li>
          <li>Inspección técnica y verificación de documentos</li>
          <li>Coordinación de logística internacional</li>
          <li>Gestión de trámites aduaneros y de nacionalización</li>
          <li>Entrega del vehículo en Lima, Perú</li>
        </ul>
      </>
    ),
  },
  {
    id: "cliente",
    titulo: "3. Responsabilidades del Cliente",
    contenido: (
      <>
        <p>El cliente se compromete a:</p>
        <ul>
          <li>Proporcionar información veraz y completa sobre sus requerimientos</li>
          <li>Realizar los pagos acordados en los plazos establecidos</li>
          <li>Revisar y aprobar la información del vehículo seleccionado</li>
          <li>Cumplir con la normativa peruana aplicable a la importación de vehículos</li>
        </ul>
      </>
    ),
  },
  {
    id: "precios",
    titulo: "4. Precios y Pagos",
    contenido: (
      <>
        <p>
          Los precios estimados en nuestra calculadora son referenciales y pueden variar según las condiciones del mercado, tipo de cambio, y determinación final de SUNAT. Todos los costos se detallarán claramente antes de proceder con la importación.
        </p>
        <p>Los pagos se realizarán de acuerdo al cronograma establecido en el contrato específico de servicio.</p>
      </>
    ),
  },
  {
    id: "cancelaciones",
    titulo: "5. Cancelaciones y Reembolsos",
    contenido: (
      <p>
        Las políticas de cancelación y reembolso se establecerán en el contrato específico de cada servicio. En general, los honorarios por servicios ya prestados no son reembolsables.
      </p>
    ),
  },
  {
    id: "responsabilidad",
    titulo: "6. Limitación de Responsabilidad",
    contenido: (
      <>
        <p>{marca} actúa como intermediario y no asume responsabilidad por:</p>
        <ul>
          <li>Defectos ocultos no detectables en la inspección</li>
          <li>Cambios en regulaciones aduaneras o tributarias</li>
          <li>Retrasos causados por terceros (navieras, aduanas, etc.)</li>
          <li>Variaciones en tipo de cambio</li>
        </ul>
      </>
    ),
  },
  {
    id: "propiedad-intelectual",
    titulo: "7. Propiedad Intelectual",
    contenido: (
      <p>
        Todo el contenido de este sitio web, incluyendo textos, gráficos, logos y software, es propiedad de {marca} y está protegido por las leyes de propiedad intelectual.
      </p>
    ),
  },
  {
    id: "modificaciones",
    titulo: "8. Modificaciones",
    contenido: (
      <p>
        Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigencia inmediatamente después de su publicación en el sitio web.
      </p>
    ),
  },
  {
    id: "ley",
    titulo: "9. Ley Aplicable y Jurisdicción",
    contenido: (
      <p>
        Estos términos se rigen por las leyes de la República del Perú. Cualquier disputa será resuelta en los tribunales de Lima, Perú.
      </p>
    ),
  },
];

export default function TerminosPage() {
  return (
    <PaginaLegal
      eyebrow="Legal · Condiciones del servicio"
      titulo="Términos y Condiciones"
      actualizada="15 de septiembre de 2026"
      intro="Lo que puedes esperar de Luxcars y lo que Luxcars espera de ti al importar, comprar, vender o consignar un vehículo con nosotros."
      resumen={[
        {
          icon: "handshake",
          titulo: "Somos intermediarios",
          texto: "Buscamos, inspeccionamos, embarcamos y nacionalizamos el auto por encargo tuyo.",
        },
        {
          icon: "calculator",
          titulo: "Estimados referenciales",
          texto: "La calculadora orienta; el costo final se detalla por escrito antes de empezar.",
        },
        {
          icon: "fileCheck",
          titulo: "Ley peruana",
          texto: "Estos términos se rigen por las leyes del Perú y los tribunales de Lima.",
        },
      ]}
      secciones={SECCIONES}
      contactoTitulo="10. Contacto"
      contactoTexto="Para cualquier consulta sobre estos términos, puede contactarnos en:"
    />
  );
}
