import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite mover el directorio de build cuando `.next` no es escribible.
  // Sin la variable definida se comporta exactamente igual que antes.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  images: {
    // AVIF primero, WebP de respaldo. Next 16 sirve solo WebP por defecto;
    // AVIF suele pesar 20-30% menos en las fotos de vehículos, que son el
    // grueso de bytes de la home y lo que define el LCP. El primer pedido de
    // cada tamaño es más lento de codificar, pero Vercel lo cachea.
    formats: ["image/avif", "image/webp"],
    // 30 días de caché para la imagen ya optimizada (el default son 4 horas).
    // OJO: la URL optimizada no lleva hash del contenido. Si se reemplaza una
    // foto hay que cambiarle el nombre de archivo, no sobrescribirla.
    minimumCacheTTL: 2592000,
    // -----------------------------------------------------------------------
    // SIN DOMINIOS REMOTOS. Vacío a propósito: es una barrera, no un olvido.
    //
    // Aquí estaba images.unsplash.com, que es como el catálogo llegó a mostrar
    // un 4x4 genérico rotulado "Ford Bronco Raptor" y un pickup cualquiera
    // rotulado "Tesla Cybertruck". Toda foto de vehículo que se publique tiene
    // que ser de la unidad real, servida desde public/ o desde el bucket propio
    // de Supabase Storage.
    //
    // Y NO se habilitan aquí los CDN de MarketCheck, Auto.dev, eBay,
    // Autotrader, CarGurus, Cars.com, TrueCar, AutoTempest ni Facebook
    // Marketplace: sus contratos prohíben cachear, almacenar, indexar o
    // persistir su contenido ("cache, store, index or otherwise persist",
    // "derivative databases", borrado obligatorio a las 6 horas), y el
    // optimizador de next/image hace exactamente eso — descarga la imagen
    // ajena y la guarda optimizada en el caché de Vercel durante 30 días.
    // Agregar uno de esos hostnames es incumplimiento de contrato con
    // revocación de llave. La vía legal es carga manual en el portal.
    // -----------------------------------------------------------------------
    remotePatterns: [],
  },
};

export default nextConfig;
