import { rutaCalculadora, rutaModelo, tienePaginaPropia } from "@/lib/importExamples/modelo";
import { getImportExamplesForIsr } from "@/lib/importExamples/servidor";
import { formatCurrency } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./Button";
import { CreditoFoto } from "./CreditoFoto";
import { Badge } from "./ui/Badge";
import { Icon } from "./ui/Icon";
import { Section, SectionHeader } from "./ui/Section";

function priceLabel(min: number, max: number) {
  return min === max
    ? formatCurrency(min, "en-US")
    : `${formatCurrency(min, "en-US")} – ${formatCurrency(max, "en-US")}`;
}

type Props = {
  limite?: number;
  verTodosHref?: string;
  eyebrow?: string;
  titulo?: string;
  descripcion?: string;
  id?: string;
  tone?: "bg" | "void" | "surface";
  /**
   * A dónde lleva una tarjeta.
   * - `calculadora` (por defecto): abre la calculadora de la portada con los
   *   datos del modelo. Es lo que toca en la home, donde la calculadora está
   *   justo debajo. Debajo de las tarjetas va una línea de enlaces de texto a
   *   la página de cada modelo, para que Google las alcance desde la portada.
   * - `pagina`: lleva a la página del modelo (`/importar/<id>`), con el número
   *   ya calculado. Es lo que toca en /importar, que no tiene calculadora.
   */
  destino?: "calculadora" | "pagina";
};

/**
 * Catálogo de referencia: modelos que más nos piden importar, con precio
 * referencial de EE.UU. Al tocar una tarjeta se abre la calculadora con los
 * datos cargados o la página del modelo, según `destino`.
 *
 * Los autos salen de la base (se editan en /portal/ejemplos) con la lista del
 * repositorio como respaldo: ver `lib/importExamples/servidor.ts`. Lo que NO
 * sale de la base, a propósito, es todo lo demás: los títulos de la sección,
 * los enlaces y el marcado de la tarjeta se quedan acá, iguales para cualquier
 * fuente, porque este bloque posiciona en Google.
 */
export async function MostSoughtVehiclesSection({
  limite,
  verTodosHref,
  eyebrow = "Los más pedidos",
  titulo = "Ejemplos con precio real de referencia",
  descripcion,
  id = "mas-buscados",
  tone = "bg",
  destino = "calculadora",
}: Props = {}) {
  const { vehiculos: todos } = await getImportExamplesForIsr();
  const vehiculos = limite ? todos.slice(0, limite) : todos;
  const aPagina = destino === "pagina";
  const conPagina = todos.filter(tienePaginaPropia);
  const textoDescripcion =
    descripcion ??
    (aPagina
      ? "Toca un modelo para ver su precio en Estados Unidos, los tributos y el costo final puesto en Lima."
      : "Toca un modelo y la calculadora se abre con sus datos para ver el costo puesto en Lima.");

  return (
    <Section id={id} tone={tone}>
      <SectionHeader
        eyebrow={eyebrow}
        title={titulo}
        description={textoDescripcion}
        action={
          verTodosHref ? (
            <Button href={verTodosHref} variant="secondary">
              Ver los {todos.length} modelos
              <Icon name="arrowRight" size={16} />
            </Button>
          ) : undefined
        }
      />

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vehiculos.map((v) => {
          const noConviene = v.importViability === "no-conviene-importar";
          const advertencia = v.importViability === "importable-con-advertencia";
          // Un ejemplo que no se puede cotizar no tiene página propia: se
          // queda con el enlace de siempre.
          const vaAPagina = aPagina && tienePaginaPropia(v);
          return (
            <div key={v.id} className="flex flex-col">
              <Link
                href={vaAPagina ? rutaModelo(v.id) : rutaCalculadora(v.id)}
                scroll={vaAPagina ? undefined : false}
                className="group relative flex flex-1 flex-col overflow-hidden rounded-[22px] border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-[var(--lux-shadow)]"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
                  {v.imageSrc ? (
                    <Image
                      src={v.imageSrc}
                      alt={v.imageAlt}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(70%_60%_at_50%_40%,#2a2a2f_0%,#121214_100%)] text-ink-4">
                      <Icon name="camera" size={26} />
                      <span className="text-xs">Foto por WhatsApp</span>
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <Badge>{v.segment.split("·")[0].trim()}</Badge>
                    {noConviene ? <Badge tone="danger">No conviene</Badge> : null}
                    {advertencia ? <Badge tone="warn">Con aviso</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-semibold leading-snug text-ink">{v.name}</h3>
                  <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-ink-4">
                        {v.priceBasis === "lista-peru" ? "Precio lista Perú" : "Precio EE.UU. (ref.)"}
                      </p>
                      <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-ink">
                        {priceLabel(v.priceMinUsd, v.priceMaxUsd)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-silver transition-colors group-hover:text-ink">
                      {vaAPagina ? "Ver costo" : "Simular"}
                      <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </Link>
              <CreditoFoto
                credito={v.imageCredit}
                licencia={v.imageLicense}
                fuenteUrl={v.imageSourceUrl}
                className="mt-2 px-1"
              />
            </div>
          );
        })}
      </div>

      {!aPagina && conPagina.length > 0 ? (
        <nav aria-label="Costo de importación por modelo" className="mt-8 border-t border-line pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
            Costo de importación por modelo
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {conPagina.map((v) => (
              <li key={v.id}>
                <Link href={rutaModelo(v.id)} className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
                  {v.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </Section>
  );
}
