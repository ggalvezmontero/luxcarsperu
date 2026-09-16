import type { MetadataRoute } from "next";
import { LUXCARS_CONFIG } from "@/lib/config";
import { TRENDING_VEHICLES } from "@/data/trendingVehicles";

const BASE = LUXCARS_CONFIG.contact.website;

export default function sitemap(): MetadataRoute.Sitemap {
  const ahora = new Date();

  const fijas: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: ahora, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/como-funciona`, lastModified: ahora, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/faq`, lastModified: ahora, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/terminos`, lastModified: ahora, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacidad`, lastModified: ahora, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/cookies`, lastModified: ahora, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Cada vehículo destacado entra con su simulación precargada: son las URLs
  // que capturan búsquedas de modelo concreto ("importar Tesla Cybertruck Perú").
  const vehiculos: MetadataRoute.Sitemap = TRENDING_VEHICLES.map((v) => ({
    url: `${BASE}/?simular=${v.id}`,
    lastModified: ahora,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...fijas, ...vehiculos];
}
