import { CookieBanner } from "@/components/CookieBanner";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { ScrollPrevention } from "@/components/ScrollPrevention";
import { SkipLink } from "@/components/SkipLink";
import { BRAND_THEME_COLOR, LUXCARS_CONFIG } from "@/lib/config";
import {
  autoDealerSchema,
  faqSchema,
  websiteSchema,
} from "@/lib/structuredData";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/* ---------------------------------------------------------------------------
   FUENTES
   ---------------------------------------------------------------------------
   Geist y Geist Mono son fuentes VARIABLES. Declarar `weight: [...]` obligaba
   a next/font a bajar una instancia estática por peso —cuatro archivos woff2
   para el sans— en lugar del único archivo variable que cubre todo el eje
   100–900.

   Además era un error funcional: el proyecto usa `font-light` (300) en ocho
   sitios y 300 no estaba en la lista, así que el navegador lo sintetizaba
   desde 400 en vez de usar el peso real.

   Sin `weight` se descarga la variable y se acabaron los dos problemas.
   `display: "swap"` va en las dos: el texto se pinta de inmediato con la
   fuente de respaldo y cambia al cargar la real. Sin eso hay un bloque
   invisible que castiga LCP.

   `subsets: ["latin"]` es lo único que hace falta para es-PE.
   ------------------------------------------------------------------------- */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const BASE = LUXCARS_CONFIG.contact.website;

/**
 * Todo el sitio se regenera como mucho una vez al día. Hace falta porque hay
 * copy que depende de la fecha: la regla de antigüedad de los usados ("en 2026
 * entran modelos 2025 en adelante") está en el FAQ, y el FAQ va en el JSON-LD
 * de TODAS las páginas. Sin esto, una página sin `revalidate` propio seguiría
 * diciendo el año viejo hasta el siguiente despliegue.
 *
 * Gana el valor más bajo de cada ruta: la portada y /comprar, que ya se
 * regeneran cada cinco minutos, no cambian.
 */
export const revalidate = 86400;

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    // SEO (2026-11-10, pedido del dueño): la búsqueda genérica en la que ya
    // aparece la portada ("autos de lujo en Lima / Perú") va al frente; la
    // marca cierra el título para las búsquedas de marca ("luxcars").
    default: `Autos de lujo en Lima · Importación, compra y venta | ${LUXCARS_CONFIG.brandName}`,
    template: `%s | ${LUXCARS_CONFIG.brandName}`,
  },
  description:
    "Autos de lujo en Lima, Perú: stock de alta gama en San Isidro, importación a pedido desde Estados Unidos y venta en consignación sin exclusividad. Calcula impuestos SUNAT, flete y honorarios al instante.",
  applicationName: LUXCARS_CONFIG.brandName,
  authors: [{ name: LUXCARS_CONFIG.legalName }],
  creator: LUXCARS_CONFIG.legalName,
  publisher: LUXCARS_CONFIG.legalName,
  keywords: [
    "importar auto de USA a Perú",
    "importación de autos de lujo Perú",
    "compra venta de autos Lima",
    "calculadora impuestos importación vehículos SUNAT",
    "consignación de autos Lima",
    "tasación de vehículos Perú",
    "broker automotriz Perú",
    "autos exóticos Miami Lima",
    LUXCARS_CONFIG.brandName,
  ],
  alternates: {
    canonical: "/",
    languages: { "es-PE": "/" },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: BASE,
    siteName: LUXCARS_CONFIG.brandName,
    locale: "es_PE",
    title: `${LUXCARS_CONFIG.brandName} · Importación y compra venta premium`,
    description:
      "Broker boutique de autos de lujo en Lima. Importación a pedido desde Miami, stock propio, tasación y consignación sin exclusividad.",
    // Sin `images` a proposito: apuntaba a /brand/social-1024.png, un archivo
    // que no existe en public/, asi que toda vista previa compartida salia en
    // blanco. Al omitir la clave, Next toma la imagen de la convencion de
    // archivo src/app/opengraph-image.tsx, que se genera y no se puede romper
    // por un borrado o un rename.
  },
  twitter: {
    card: "summary_large_image",
    title: `${LUXCARS_CONFIG.brandName} | Autos de lujo en Perú`,
    description:
      "Importación, compra y venta de autos premium. Calculadora pública de impuestos de importación.",
    // Idem: hereda la imagen generada en src/app/opengraph-image.tsx.
  },
  category: "automotive",
};

export const viewport = {
  themeColor: BRAND_THEME_COLOR,
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Un solo bloque JSON-LD con los tres esquemas: es lo que permite que Google
  // muestre a Luxcars como negocio local con dirección, servicios y preguntas.
  const jsonLd = [autoDealerSchema(), websiteSchema(), faqSchema()];

  return (
    <html lang="es-PE">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-bg text-ink antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Primer elemento enfocable del documento: tiene que ir antes que
            cualquier otra cosa para que la primera tabulación lo alcance. */}
        <SkipLink />
        <ScrollPrevention />
        {children}
        <CookieBanner />
        {/* Solo se monta en producción y tras aceptar el banner: ver el componente. */}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
