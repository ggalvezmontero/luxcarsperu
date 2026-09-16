import { CookieBanner } from "@/components/CookieBanner";
import { ScrollPrevention } from "@/components/ScrollPrevention";
import { LUXCARS_CONFIG } from "@/lib/config";
import {
  autoDealerSchema,
  faqSchema,
  websiteSchema,
} from "@/lib/structuredData";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const BASE = LUXCARS_CONFIG.contact.website;

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: {
    default: `${LUXCARS_CONFIG.brandName} | Importación y compra venta de autos de lujo`,
    template: `%s | ${LUXCARS_CONFIG.brandName}`,
  },
  description:
    "Importamos, compramos y vendemos autos de lujo en Perú. Calcula impuestos SUNAT, flete y honorarios al instante. Consignación sin exclusividad. Oficina en San Isidro, Lima.",
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
    images: [
      {
        url: "/brand/social-1024.png",
        width: 1024,
        height: 1024,
        alt: LUXCARS_CONFIG.brandName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${LUXCARS_CONFIG.brandName} | Autos de lujo en Perú`,
    description:
      "Importación, compra y venta de autos premium. Calculadora pública de impuestos de importación.",
    images: ["/brand/social-1024.png"],
  },
  category: "automotive",
};

export const viewport = {
  themeColor: "#050505",
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
  // muestre a LuxCars como negocio local con dirección, servicios y preguntas.
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
        <ScrollPrevention />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
