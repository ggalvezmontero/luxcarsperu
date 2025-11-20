import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LUXCARS_CONFIG } from "@/lib/config";
import { CookieBanner } from "@/components/CookieBanner";
import { ScrollPrevention } from "@/components/ScrollPrevention";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${LUXCARS_CONFIG.brandName} | Importación de autos de lujo y exóticos`,
  description:
    "Concierge premium Miami → Lima para importar autos exóticos y de lujo. Calcula impuestos SUNAT, flete y honorarios en segundos con LuxCars.pe.",
  keywords: [
    "LuxCars Perú",
    "LuxCars.pe",
    "importación autos de lujo",
    "autos exóticos Miami",
    "broker automotriz Perú",
    "LuxCars Broker",
    "LuxAutoCars",
  ],
  openGraph: {
    title: `${LUXCARS_CONFIG.brandName} · Importación premium Miami → Perú`,
    description:
      "Importamos autos de lujo y exóticos con transparencia total. Calculadora pública, inspección en Miami y concierge 360° hasta la entrega en Lima.",
    url: "https://luxcars.pe",
    siteName: LUXCARS_CONFIG.brandName,
    locale: "es_PE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${LUXCARS_CONFIG.brandName} | Autos de lujo Miami → Lima`,
    description:
      "Servicio concierge para importar autos exóticos y SUVs de lujo a Perú. Calculadora pública y acompañamiento total.",
  },
  metadataBase: new URL("https://luxcars.pe"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-950 text-white`}
      >
        <ScrollPrevention />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
