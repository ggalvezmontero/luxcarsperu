import { CATEGORY_LABEL, STATUS_LABEL, type StockVehicle } from "@/lib/stockLabels";
import { findBrandLogo, LOGO_MODE_CLASS, type LogoMode } from "@/lib/brandLogos";
import { formatCurrency, formatNumber } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "./ui/Badge";
import { Icon } from "./ui/Icon";

const STATUS_TONE = {
  disponible: "ok",
  reservado: "warn",
  en_transito: "info",
  vendido: "neutral",
} as const;

/**
 * Tarjeta de vehículo, estándar de la industria: foto 4:3, estado, título,
 * tres especificaciones con icono, precio y una sola acción.
 */
export function VehicleCard({
  vehicle,
  priority = false,
}: {
  vehicle: StockVehicle;
  priority?: boolean;
}) {
  const href = `/comprar/${vehicle.slug ?? vehicle.id}`;
  const sold = vehicle.status === "vendido";
  const cover = vehicle.coverPhoto?.url ?? vehicle.photos[0]?.url ?? null;
  const logo = findBrandLogo(vehicle.brand);

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-line-strong hover:shadow-[var(--lux-shadow)] ${
        sold ? "opacity-60" : ""
      }`}
    >
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-surface-2">
        {cover ? (
          <Image
            src={cover}
            alt={vehicle.coverPhoto?.alt ?? vehicle.title}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <VehiclePlaceholder brand={vehicle.brand} logo={logo} />
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <Badge tone={STATUS_TONE[vehicle.status]} dot>
            {STATUS_LABEL[vehicle.status]}
          </Badge>
        </div>
        {vehicle.photos.length > 1 ? (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-void/70 px-2.5 py-1 text-[11px] font-medium text-silver-bright backdrop-blur">
            <Icon name="images" size={14} />
            {vehicle.photos.length}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
          {vehicle.brand}
        </p>
        <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">
          <Link href={href} className="after:absolute after:inset-0">
            {vehicle.model}
            {vehicle.trim ? <span className="text-ink-3"> {vehicle.trim}</span> : null}
          </Link>
        </h3>

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-ink-2">
          <li className="inline-flex items-center gap-1.5">
            <Icon name="calendar" size={15} className="text-ink-4" />
            {vehicle.year}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Icon name="gauge" size={15} className="text-ink-4" />
            {formatNumber(vehicle.mileageKm)} km
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Icon name="fuel" size={15} className="text-ink-4" />
            {CATEGORY_LABEL[vehicle.category]}
          </li>
        </ul>

        <div className="mt-5 flex items-end justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-4">Precio</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-ink">
              {vehicle.price !== null
                ? formatCurrency(vehicle.price, "en-US", vehicle.currency)
                : "A consultar"}
            </p>
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-2 transition-colors group-hover:border-silver group-hover:bg-ink group-hover:text-void">
            <Icon name="arrowRight" size={18} />
          </span>
        </div>
      </div>
    </article>
  );
}

/**
 * Sin foto propia se muestra el logo de la marca sobre un degradado.
 * Nunca una foto de otra unidad.
 */
export function VehiclePlaceholder({
  brand,
  logo,
  large = false,
}: {
  brand: string;
  logo: { src: string; mode: LogoMode } | null;
  large?: boolean;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(70%_60%_at_50%_40%,#2a2a2f_0%,#121214_100%)]">
      {logo ? (
        <Image
          src={logo.src}
          alt=""
          width={160}
          height={90}
          unoptimized
          className={`${large ? "h-14 sm:h-20" : "h-9 sm:h-11"} w-auto max-w-[60%] object-contain opacity-80 ${LOGO_MODE_CLASS[logo.mode]}`}
        />
      ) : (
        <span className={`${large ? "text-4xl sm:text-5xl" : "text-2xl"} font-semibold uppercase tracking-[0.2em] text-ink-3`}>{brand}</span>
      )}
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-void/50 px-3 py-1 text-[11px] font-medium text-ink-3">
        <Icon name="camera" size={14} />
        Fotos por WhatsApp
      </span>
    </div>
  );
}
