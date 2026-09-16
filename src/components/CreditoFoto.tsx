import { licenciaExigeAtribucion } from "@/data/trendingVehicles";
import { cn } from "@/lib/utils";

/**
 * Crédito fotográfico discreto para las tarjetas del catálogo.
 *
 * POR QUÉ EXISTE: las fotos del catálogo salen de Wikimedia Commons. Las que
 * están en CC0 no obligan a nada, pero las de la familia CC BY SÍ: la cláusula
 * 3(a)(1) de la licencia exige nombrar al autor, enlazar la licencia y enlazar
 * la obra, e indicar si la imagen fue modificada. Si eso no se publica, el
 * sitio está infringiendo la licencia — no es un detalle de cortesía.
 *
 * Por eso el componente NO se pinta cuando la licencia no lo exige: un crédito
 * bajo cada tarjeta sería ruido visual. Se pinta solo donde es obligatorio.
 *
 * El respaldo completo (fuente, licencia y URL de origen de CADA foto) está en
 * `docs/FOTOS.md`.
 */
type CreditoFotoProps = {
  /** Autor de la foto, tal como lo declara la fuente. */
  credito?: string;
  /** Licencia declarada por la fuente: "CC BY 4.0", "CC0 1.0", etc. */
  licencia?: string;
  /** Página de origen del archivo. Es el "enlace a la obra" que pide CC BY. */
  fuenteUrl?: string;
  /**
   * La imagen se recortó o reencodeó respecto del original. Las fotos del
   * catálogo se recortan a 16:10 y se convierten a WebP, así que por defecto
   * es `true`: CC BY obliga a declarar la modificación.
   */
  modificada?: boolean;
  className?: string;
};

/**
 * Deed de la licencia a partir de su nombre corto. CC BY exige un enlace a la
 * licencia, no solo su nombre.
 */
function urlDeLicencia(licencia: string): string | null {
  const m = licencia
    .trim()
    .toUpperCase()
    .match(/^CC\s+(BY(?:-(?:SA|NC|ND|NC-SA|NC-ND))?)\s+(\d(?:\.\d)?)$/);
  if (!m) return null;
  return `https://creativecommons.org/licenses/${m[1].toLowerCase()}/${m[2]}/`;
}

export function CreditoFoto({
  credito,
  licencia,
  fuenteUrl,
  modificada = true,
  className,
}: CreditoFotoProps) {
  // Sin licencia que lo exija no se pinta nada: CC0 no obliga a atribuir.
  if (!licenciaExigeAtribucion(licencia) || !credito || !licencia) {
    return null;
  }

  const deed = urlDeLicencia(licencia);
  const enlace =
    "underline decoration-line-strong underline-offset-2 transition-colors hover:text-ink-3";

  return (
    <p
      className={cn(
        "text-[10px] leading-relaxed text-ink-4 text-pretty",
        className,
      )}
    >
      <span>Foto: </span>
      {fuenteUrl ? (
        <a
          href={fuenteUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={enlace}
        >
          {credito}
        </a>
      ) : (
        <span>{credito}</span>
      )}
      <span> · </span>
      {deed ? (
        <a
          href={deed}
          target="_blank"
          rel="license noopener noreferrer nofollow"
          className={enlace}
        >
          {licencia}
        </a>
      ) : (
        <span>{licencia}</span>
      )}
      {modificada ? <span> · imagen recortada</span> : null}
    </p>
  );
}
