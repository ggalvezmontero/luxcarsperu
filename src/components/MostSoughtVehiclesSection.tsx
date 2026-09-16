import { TRENDING_VEHICLES } from "@/data/trendingVehicles";
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
};

/**
 * Catálogo de referencia: modelos que más nos piden importar, con precio
 * referencial de EE.UU. Al tocar una tarjeta la calculadora se abre con
 * los datos cargados.
 */
export function MostSoughtVehiclesSection({
  limite,
  verTodosHref,
  eyebrow = "Los más pedidos",
  titulo = "Ejemplos con precio real de referencia",
  descripcion = "Toca un modelo y la calculadora se abre con sus datos para ver el costo puesto en Lima.",
  id = "mas-buscados",
  tone = "bg",
}: Props = {}) {
  const vehiculos = limite ? TRENDING_VEHICLES.slice(0, limite) : TRENDING_VEHICLES;

  return (
    <Section id={id} tone={tone}>
      <SectionHeader
        eyebrow={eyebrow}
        title={titulo}
        description={descripcion}
        action={
          verTodosHref ? (
            <Button href={verTodosHref} variant="secondary">
              Ver los {TRENDING_VEHICLES.length} modelos
              <Icon name="arrowRight" size={16} />
            </Button>
          ) : undefined
        }
      />

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {vehiculos.map((v) => {
          const noConviene = v.importViability === "no-conviene-importar";
          const advertencia = v.importViability === "importable-con-advertencia";
          return (
            <div key={v.id} className="flex flex-col">
              <Link
                href={`/?simular=${v.id}#calculator`}
                scroll={false}
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
                      Simular
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
    </Section>
  );
}
