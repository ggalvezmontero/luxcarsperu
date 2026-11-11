import { breadcrumbSchema } from "@/lib/structuredData";

/**
 * Migas de pan como dato estructurado (BreadcrumbList), sin nada visible.
 *
 * Para las páginas de primer nivel (/importar, /vender, /comprar…), que no
 * pintan migas porque cuelgan directo del menú. Con esto Google puede mostrar
 * "luxcars.pe › Importar" en el resultado en lugar de la URL cruda. Las páginas
 * con migas visibles (fichas, modelos, marcas, guías) ya emiten las suyas.
 *
 * `Inicio` se antepone solo: se pasa únicamente lo que cuelga de la portada.
 */
export function BreadcrumbJsonLd({ items }: { items: { nombre: string; ruta: string }[] }) {
  const jsonLd = breadcrumbSchema([{ nombre: "Inicio", ruta: "/" }, ...items]);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
