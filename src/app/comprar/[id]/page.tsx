import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/Button";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { VehicleCard, VehiclePlaceholder } from "@/components/VehicleCard";
import { Badge } from "@/components/ui/Badge";
import { Icon, WhatsAppIcon, type IconName } from "@/components/ui/Icon";
import { findBrandLogo } from "@/lib/brandLogos";
import { LUXCARS_CONFIG } from "@/lib/config";
import { CATEGORY_LABEL, STATUS_LABEL, getStock, getStockUnit } from "@/lib/stock";
import { CONSIGNMENT_LABEL, isConsignment } from "@/lib/stockLabels";
import { formatCurrency, formatNumber } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const v = await getStockUnit(id);
  if (!v) return { title: "Vehículo no encontrado" };
  return {
    title: `${v.title} · Stock en Lima`,
    description:
      v.description ??
      `${v.brand} ${v.model} ${v.year}, ${formatNumber(v.mileageKm)} km. ${isConsignment(v) ? "En consignación, disponible en Lima." : "Disponible en San Isidro, Lima."}`,
    alternates: { canonical: `/comprar/${v.slug ?? v.id}` },
  };
}

const STATUS_TONE = { disponible: "ok", reservado: "warn", en_transito: "info", vendido: "neutral" } as const;

export default async function VehiculoPage({ params }: Params) {
  const { id } = await params;
  const v = await getStockUnit(id);
  if (!v) notFound();

  const related = (await getStock(4)).filter((r) => r.id !== v.id).slice(0, 3);
  const photos = v.photos.length ? v.photos : v.coverPhoto?.url ? [{ id: "cover", url: v.coverPhoto.url, alt: v.coverPhoto.alt }] : [];
  const logo = findBrandLogo(v.brand);
  const sold = v.status === "vendido";
  const consigned = isConsignment(v);

  const wa = `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(
    [
      consigned
        ? `Hola LuxCars, me interesa el ${v.brand} ${v.model} ${v.year} que tienen en consignación.`
        : `Hola LuxCars, me interesa el ${v.brand} ${v.model} ${v.year} de su stock.`,
      `Referencia: ${(v.slug ?? v.id).toUpperCase()}`,
      "Quisiera coordinar una visita y conocer el precio final.",
    ].join("\n"),
  )}`;

  const specs: { icon: IconName; label: string; value: string }[] = [
    { icon: "calendar", label: "Año", value: String(v.year) },
    { icon: "gauge", label: "Kilometraje", value: `${formatNumber(v.mileageKm)} km` },
    { icon: "fuel", label: "Motor", value: CATEGORY_LABEL[v.category] },
    { icon: "gear", label: "Transmisión", value: v.transmission ?? "—" },
    { icon: "steering", label: "Tracción", value: v.drivetrain ?? "—" },
    { icon: "car", label: "Carrocería", value: v.bodyStyle ?? "—" },
    { icon: "sparkles", label: "Color", value: v.exteriorColor ?? "—" },
    { icon: "mapPin", label: "Ubicación", value: v.location ?? "Lima" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="contenido" className="w-full flex-1 pt-[var(--lux-nav-h)]">
        <div className="container-lux py-6 sm:py-8">
          <nav aria-label="Migas de pan" className="flex items-center gap-2 text-sm text-ink-4">
            <Link href="/comprar" className="hover:text-ink">Stock</Link>
            <Icon name="chevronRight" size={14} />
            <span className="text-ink-2">{v.brand} {v.model}</span>
          </nav>

          <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Galería */}
            <div className="lg:col-span-7">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] border border-line bg-surface-2">
                {photos[0]?.url ? (
                  <Image src={photos[0].url} alt={photos[0].alt ?? v.title} fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
                ) : (
                  <VehiclePlaceholder brand={v.brand} logo={logo} large />
                )}
                <div className="absolute left-4 right-4 top-4 flex flex-wrap gap-2">
                  <Badge tone={STATUS_TONE[v.status]} dot>{STATUS_LABEL[v.status]}</Badge>
                  {consigned ? <Badge tone="silver" className="bg-void/70 backdrop-blur">{CONSIGNMENT_LABEL}</Badge> : null}
                  {v.isDemo ? <Badge tone="warn">Demostración</Badge> : null}
                </div>
              </div>
              {photos.length > 1 ? (
                <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
                  {photos.slice(1, 7).map((p) => (
                    <li key={p.id} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-2">
                      {p.url ? <Image src={p.url} alt={p.alt ?? ""} fill sizes="120px" className="object-cover" /> : null}
                    </li>
                  ))}
                </ul>
              ) : null}

            </div>

            {/* Ficha de compra (sticky en desktop) */}
            <aside className="lg:col-span-5 lg:row-span-2">
              <div className="rounded-[22px] border border-line bg-surface p-6 sm:p-7 lg:sticky lg:top-[calc(var(--lux-nav-h)+1.5rem)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">{v.brand}</p>
                <h1 className="mt-1 text-3xl font-semibold leading-tight tracking-tight text-ink">
                  {v.model}{v.trim ? <span className="text-ink-3"> {v.trim}</span> : null}
                </h1>
                <p className="mt-1 text-sm text-ink-3">{v.year} · {formatNumber(v.mileageKm)} km · {CATEGORY_LABEL[v.category]}</p>

                <div className="mt-6 border-t border-line pt-5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-ink-4">Precio</p>
                  <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-ink">
                    {v.price !== null ? formatCurrency(v.price, "en-US", v.currency) : "A consultar"}
                  </p>
                  {v.priceNegotiable ? <p className="mt-1 text-xs text-ink-4">Precio negociable</p> : null}
                </div>

                <div className="mt-6 grid gap-3">
                  {sold ? (
                    <Button variant="secondary" size="lg" disabled className="w-full">Unidad vendida</Button>
                  ) : (
                    <Button href={wa} variant="whatsapp" size="lg" className="w-full">
                      <WhatsAppIcon size={20} />
                      {v.status === "reservado" ? "Avisarme si se libera" : "Coordinar visita"}
                    </Button>
                  )}
                  <Button href="/vender#tasacion" variant="secondary" size="lg" className="w-full">
                    Entregar mi auto como parte de pago
                  </Button>
                </div>

                {consigned ? (
                  <div className="mt-6 rounded-2xl border border-silver/30 bg-silver/5 p-4">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-silver-bright">
                      <Icon name="handshake" size={15} />
                      {CONSIGNMENT_LABEL}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                      Este auto es de un cliente que nos lo confió para venderlo. LuxCars verifica historial y documentos, coordina la visita con el dueño y acompaña la transferencia hasta la tarjeta de propiedad.
                    </p>
                  </div>
                ) : null}

                <ul className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm text-ink-3">
                  <li className="flex items-center gap-2"><Icon name="fileCheck" size={16} className="text-silver" />{consigned ? "Con placa y transferencia acompañada por LuxCars" : "Nacionalizado, con placa y transferencia incluida"}</li>
                  <li className="flex items-center gap-2"><Icon name="eye" size={16} className="text-silver" />{consigned ? "Se ve y se maneja en Lima, con cita coordinada" : "Se ve y se maneja en San Isidro"}</li>
                  <li className="flex items-center gap-2"><Icon name="shield" size={16} className="text-silver" />Historial y documentos a la vista antes de la visita</li>
                </ul>
                <p className="mt-5 text-xs leading-relaxed text-ink-4">
                  Precio referencial sujeto a verificación presencial. Ref. {(v.slug ?? v.id).toUpperCase()}.
                </p>
              </div>
            </aside>
            <div className="lg:col-span-7">
              {/* Especificaciones */}
              <h2 className="mt-10 text-xl font-semibold text-ink">Especificaciones</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {specs.map((s) => (
                  <div key={s.label} className="rounded-2xl border border-line bg-surface p-4">
                    <dt className="flex items-center gap-1.5 text-xs text-ink-4">
                      <Icon name={s.icon} size={14} />
                      {s.label}
                    </dt>
                    <dd className="mt-1.5 text-sm font-semibold text-ink">{s.value}</dd>
                  </div>
                ))}
              </dl>

              {v.highlights.length ? (
                <>
                  <h2 className="mt-10 text-xl font-semibold text-ink">Destacados</h2>
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                    {v.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok">
                          <Icon name="check" size={13} strokeWidth={2.5} />
                        </span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {v.description ? (
                <>
                  <h2 className="mt-10 text-xl font-semibold text-ink">Descripción</h2>
                  <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-ink-2">{v.description}</p>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {related.length ? (
          <section className="w-full border-t border-line bg-void py-14 sm:py-20">
            <div className="container-lux">
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">También en stock</h2>
                <Button href="/comprar" variant="secondary" size="sm">Ver todo</Button>
              </div>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((r) => <VehicleCard key={r.id} vehicle={r} />)}
              </div>
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
