"use client";

/**
 * Tablero del cliente: sus solicitudes de compra y de venta, con estado.
 * Lee desde el navegador con su sesión; RLS devuelve solo sus filas.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { useCuentaSession } from "@/components/cuenta/cuentaSession";
import { SinCuentas } from "@/components/cuenta/SinCuentas";
import { CATEGORY_LABEL } from "@/lib/stockLabels";
import {
  PURCHASE_CONDITION_LABEL,
  PURCHASE_STATUS_LABEL,
  SALE_STATUS_LABEL,
  closePurchaseRequest,
  fetchMyPurchaseRequests,
  fetchMySaleRequests,
  withdrawSaleRequest,
  type PurchaseRequest,
  type SaleRequest,
} from "@/lib/cuenta/solicitudes";
import type { PurchaseRequestStatus, SaleRequestStatus } from "@/lib/db/types";
import { LUXCARS_CONFIG } from "@/lib/config";
import { formatCurrency, formatNumber } from "@/lib/utils";

const PURCHASE_TONE: Record<PurchaseRequestStatus, "ok" | "info" | "warn" | "neutral" | "danger" | "silver"> = {
  nueva: "silver",
  en_busqueda: "info",
  propuesta_enviada: "ok",
  cerrada: "neutral",
  descartada: "danger",
};

const SALE_TONE: Record<SaleRequestStatus, "ok" | "info" | "warn" | "neutral" | "danger" | "silver"> = {
  pendiente: "warn",
  aprobada: "ok",
  rechazada: "danger",
  retirada: "neutral",
};

function fecha(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function CuentaScreen() {
  const router = useRouter();
  const { status, profile, email, client, signOut } = useCuentaSession();
  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [sales, setSales] = useState<SaleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (status === "anonimo") router.replace("/cuenta/login?next=/cuenta");
  }, [status, router]);

  const load = useCallback(async () => {
    if (!client || status !== "autenticado") {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [p, s] = await Promise.all([fetchMyPurchaseRequests(client), fetchMySaleRequests(client)]);
    setPurchases(p);
    setSales(s);
    setLoading(false);
  }, [client, status]);

  useEffect(() => {
    if (status === "verificando") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load, status]);

  const handleClose = async (id: string) => {
    if (!client) return;
    const r = await closePurchaseRequest(client, id);
    setFlash(r.message);
    if (r.ok) void load();
  };

  const handleWithdraw = async (id: string) => {
    if (!client) return;
    const r = await withdrawSaleRequest(client, id);
    setFlash(r.message);
    if (r.ok) void load();
  };

  if (status === "sin-configurar") return <SinCuentas />;

  if (status !== "autenticado") {
    return (
      <Section tone="bg" padding="tight">
        <p className="py-16 text-center text-sm text-ink-3">Cargando tu cuenta…</p>
      </Section>
    );
  }

  const nombre = profile?.name?.trim() || email || "Hola";
  const wa = `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(
    `Hola LuxCars, soy ${nombre} y tengo una consulta sobre mis solicitudes.`,
  )}`;

  return (
    <Section tone="bg" padding="tight">
      <SectionHeader
        eyebrow="Mi cuenta"
        title={`Hola, ${nombre.split(" ")[0]}`}
        description="Pide un auto que no tenemos y lo buscamos, o publica el tuyo para venderlo en consignación. Acá ves el estado de cada solicitud."
        action={
          <div className="flex flex-wrap gap-2">
            {profile?.role === "admin" ? (
              <Button href="/portal" variant="secondary" size="sm">
                Ir al portal
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="border border-line"
              onClick={async () => {
                await signOut();
                router.replace("/");
              }}
            >
              Cerrar sesión
            </Button>
          </div>
        }
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <ActionCard
          href="/cuenta/comprar"
          icon="search"
          title="Quiero un auto que no tienen"
          text="Dinos marca, modelo, año y presupuesto. Lo buscamos en EE.UU. o en Lima y te proponemos opciones."
          cta="Pedir búsqueda"
        />
        <ActionCard
          href="/cuenta/vender"
          icon="handshake"
          title="Quiero vender mi auto"
          text="Regístralo y lo revisamos. Cuando lo aprobamos, sale publicado en la web como consignación, sin exclusividad."
          cta="Publicar mi auto"
        />
      </div>

      {flash ? (
        <p role="status" className="mt-6 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">
          {flash}
        </p>
      ) : null}

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">Autos que me están buscando</h2>
          {loading ? (
            <p className="mt-4 text-sm text-ink-4">Cargando…</p>
          ) : purchases.length === 0 ? (
            <Empty text="Todavía no pediste ninguna búsqueda." href="/cuenta/comprar" cta="Pedir un auto" />
          ) : (
            <ul className="mt-4 grid gap-3">
              {purchases.map((p) => (
                <li key={p.id} className="rounded-[22px] border border-line bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {p.brand} {p.model}
                      </p>
                      <p className="mt-1 text-xs text-ink-4">
                        {p.yearMin || p.yearMax
                          ? `${p.yearMin ?? "…"} – ${p.yearMax ?? "…"} · `
                          : ""}
                        {PURCHASE_CONDITION_LABEL[p.condition]}
                        {p.budgetMaxUsd ? ` · hasta ${formatCurrency(p.budgetMaxUsd)}` : ""}
                        {" · "}
                        {fecha(p.createdAt)}
                      </p>
                    </div>
                    <Badge tone={PURCHASE_TONE[p.status]} dot>
                      {PURCHASE_STATUS_LABEL[p.status]}
                    </Badge>
                  </div>
                  {p.reply ? (
                    <p className="mt-3 rounded-2xl border border-line bg-void/40 p-3 text-sm leading-relaxed text-ink-2">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-silver">Respuesta de LuxCars</span>
                      {p.reply}
                    </p>
                  ) : null}
                  {p.status === "nueva" || p.status === "en_busqueda" || p.status === "propuesta_enviada" ? (
                    <button
                      type="button"
                      onClick={() => handleClose(p.id)}
                      className="mt-3 text-xs font-semibold text-ink-3 underline underline-offset-4 hover:text-ink"
                    >
                      Ya no lo necesito
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink">Autos que ofrecí</h2>
          {loading ? (
            <p className="mt-4 text-sm text-ink-4">Cargando…</p>
          ) : sales.length === 0 ? (
            <Empty text="Todavía no registraste ningún auto para vender." href="/cuenta/vender" cta="Publicar mi auto" />
          ) : (
            <ul className="mt-4 grid gap-3">
              {sales.map((s) => (
                <li key={s.id} className="rounded-[22px] border border-line bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">
                        {s.brand} {s.model} {s.trim ?? ""} {s.year}
                      </p>
                      <p className="mt-1 text-xs text-ink-4">
                        {formatNumber(s.mileageKm)} km · {CATEGORY_LABEL[s.category]} ·{" "}
                        {formatCurrency(s.askingPrice, "en-US", s.currency)} · {fecha(s.createdAt)}
                      </p>
                    </div>
                    <Badge tone={SALE_TONE[s.status]} dot>
                      {SALE_STATUS_LABEL[s.status]}
                    </Badge>
                  </div>
                  {s.status === "pendiente" ? (
                    <p className="mt-3 text-sm text-ink-3">
                      Lo está revisando el equipo. Te avisamos por WhatsApp; las fotos te las pedimos por ahí.
                    </p>
                  ) : null}
                  {s.status === "aprobada" && s.vehicleId ? (
                    <Link
                      href={`/comprar/${s.vehicleId}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline underline-offset-4"
                    >
                      Ver mi auto publicado
                      <Icon name="arrowRight" size={14} />
                    </Link>
                  ) : null}
                  {s.status === "rechazada" && s.rejectionReason ? (
                    <p className="mt-3 rounded-2xl border border-line bg-void/40 p-3 text-sm leading-relaxed text-ink-2">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-silver">Motivo</span>
                      {s.rejectionReason}
                    </p>
                  ) : null}
                  {s.status === "pendiente" ? (
                    <button
                      type="button"
                      onClick={() => handleWithdraw(s.id)}
                      className="mt-3 text-xs font-semibold text-ink-3 underline underline-offset-4 hover:text-ink"
                    >
                      Retirar solicitud
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-10 text-sm text-ink-3">
        ¿Dudas?{" "}
        <a href={wa} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-4">
          Escríbenos por WhatsApp
        </a>
        .
      </p>
    </Section>
  );
}

function ActionCard({
  href,
  icon,
  title,
  text,
  cta,
}: {
  href: string;
  icon: "search" | "handshake";
  title: string;
  text: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[22px] border border-line bg-surface p-6 transition-colors hover:border-line-strong"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-silver-bright">
        <Icon name={icon} size={22} />
      </span>
      <span className="mt-4 text-lg font-semibold text-ink">{title}</span>
      <span className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-3">{text}</span>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
        {cta}
        <Icon name="arrowRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="mt-4 rounded-[22px] border border-dashed border-line-strong p-6 text-center">
      <p className="text-sm text-ink-3">{text}</p>
      <Button href={href} variant="secondary" size="sm" className="mt-4">
        {cta}
      </Button>
    </div>
  );
}
