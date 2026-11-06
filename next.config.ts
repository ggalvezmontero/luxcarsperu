import type { NextConfig } from "next";

type RemotePattern = {
  protocol: "https";
  hostname: string;
  pathname: string;
};

/**
 * El único origen remoto permitido para next/image: el bucket propio de Neon
 * Object Storage donde el portal sube las fotos del stock. Las fotos quedan
 * guardadas como URL absoluta `${NEXT_PUBLIC_NEON_STORAGE_URL}/<bucket>/<ruta>`
 * (ver src/lib/db/storage.ts), así que el patrón se arma con la MISMA variable y
 * el MISMO nombre de bucket. Sin la variable, o si no es una URL https válida,
 * la lista queda vacía como antes: mejor una foto que no carga que abrir el
 * optimizador a un host que no es nuestro.
 */
function bucketPropioDeFotos(): RemotePattern[] {
  const raw = (process.env.NEXT_PUBLIC_NEON_STORAGE_URL ?? "").trim();
  if (!raw) return [];
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return [];
  }
  if (url.protocol !== "https:" || !url.hostname) return [];

  const bucket =
    (process.env.NEXT_PUBLIC_VEHICLE_PHOTOS_BUCKET ?? "").trim() || "vehiculos";
  // Si la dirección S3 trae un prefijo de ruta, las fotos cuelgan de él.
  const prefijo = url.pathname.replace(/\/+$/, "");
  return [
    {
      protocol: "https",
      hostname: url.hostname,
      pathname: `${prefijo}/${bucket}/**`,
    },
  ];
}

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
    // UN SOLO DOMINIO REMOTO: el bucket propio. Es una barrera, no un olvido.
    //
    // Aquí estaba images.unsplash.com, que es como el catálogo llegó a mostrar
    // un 4x4 genérico rotulado "Ford Bronco Raptor" y un pickup cualquiera
    // rotulado "Tesla Cybertruck". Toda foto de vehículo que se publique tiene
    // que ser de la unidad real, servida desde public/ o desde el bucket propio
    // de Neon Object Storage.
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
    //
    // LA ÚNICA EXCEPCIÓN es ese bucket propio (bucketPropioDeFotos, arriba):
    // ahí solo hay fotos que el equipo subió a mano desde el portal, de
    // unidades reales, así que optimizarlas y cachearlas es legítimo. Sin esta
    // entrada next/image responde 400 a esas URLs absolutas y el primer auto
    // publicado saldría con la foto rota. Se habilita únicamente ese hostname
    // y la carpeta del bucket, nunca un comodín ni otro host.
    // -----------------------------------------------------------------------
    remotePatterns: bucketPropioDeFotos(),
  },
  // Cabeceras de seguridad para todo el sitio. La CSP lleva SOLO
  // `frame-ancestors` (nadie ajeno puede incrustar el sitio en un iframe):
  // políticas de script, estilo o imagen romperían los scripts y estilos en
  // línea que Next inyecta (y el JSON-LD), así que no se agregan aquí.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
