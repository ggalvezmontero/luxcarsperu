"use client";

/**
 * Tablero del cliente: sus solicitudes de compra y de venta, con estado.
 * Lee desde el navegador con su sesión; RLS devuelve solo sus filas.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  fetchMyPublishedVehicleIds,
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

/** Enlace de WhatsApp de LuxCars con un texto ya escrito. */
function enlaceWhatsApp(texto: string) {
  return `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(texto)}`;
}

/**
 * Aviso de cuenta suspendida (`profiles.activo = false`). Un cliente suspendido
 * ya no puede crear ni cambiar solicitudes (la base lo rechaza); esto evita que
 * lo descubra con un error al enviar. También lo usan los formularios.
 */
export function AvisoCuentaSuspendida() {
  return (
    <div role="status" className="rounded-[22px] border border-warn/30 bg-warn/10 p-5">
      <p className="text-sm font-semibold text-ink">Tu cuenta está suspendida</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
        Por ahora no puedes crear ni cambiar solicitudes. Para reactivarla,{" "}
        <a
          href={enlaceWhatsApp("Hola LuxCars, mi cuenta aparece suspendida y quisiera saber cómo reactivarla.")}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-ink underline underline-offset-4"
        >
          escríbenos por WhatsApp
        </a>
        .
      </p>
    </div>
  );
}

/**
 * Confirmación de una vez tras enviar un formulario: los formularios redirigen
 * a `/cuenta?enviada=compra|venta`. Se muestra el mensaje y se quita el
 * parámetro de la URL para que no reaparezca al recargar. Lleva su propio
 * `Suspense` (lo exige `useSearchParams` en el prerender) porque la página
 * `/cuenta` no lo trae.
 */
function ConfirmacionEnvio() {
  return (
    <Suspense fallback={null}>
      <ConfirmacionEnvioInterna />
    </Suspense>
  );
}

const MENSAJE_ENVIADA = {
  compra:
    "Recibimos tu pedido. Lo buscamos y te escribimos por WhatsApp en cuanto tengamos opciones.",
  venta:
    "Recibimos tu auto, lo revisamos y te avisamos por WhatsApp. Las fotos te las pedimos por ahí.",
} as const;

function ConfirmacionEnvioInterna() {
  const router = useRouter();
  const enviada = useSearchParams()?.get("enviada") ?? null;
  const [visto, setVisto] = useState<keyof typeof MENSAJE_ENVIADA | null>(null);

  // Se guarda el valor la primera vez que aparece: al quitarlo de la URL el
  // parámetro desaparece, pero el mensaje se queda hasta salir de la pantalla.
  if (enviada === "compra" || enviada === "venta") {
    if (visto !== enviada) setVisto(enviada);
  }

  useEffect(() => {
    if (enviada) router.replace("/cuenta", { scroll: false });
  }, [enviada, router]);

  if (!visto) return null;
  return (
    <p role="status" className="mt-6 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ink-2">
      {MENSAJE_ENVIADA[visto]}
    </p>
  );
}

export function CuentaScreen() {
  const router = useRouter();
  const { status, profile, email, client, signOut } = useCuentaSession();
  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [sales, setSales] = useState<SaleRequest[]>([]);
  // Ids de autos del cliente que están realmente publicados en el sitio.
  const [publicados, setPublicados] = useState<ReadonlySet<string>>(new Set());
  // `true` = la lectura falló (no es lo mismo que "no hay solicitudes").
  const [purchasesError, setPurchasesError] = useState(false);
  const [salesError, setSalesError] = useState(false);
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
    const [p, s, ids] = await Promise.all([
      fetchMyPurchaseRequests(client),
      fetchMySaleRequests(client),
      fetchMyPublishedVehicleIds(client),
    ]);
    setPurchases(p.data);
    setSales(s.data);
    setPublicados(ids);
    setPurchasesError(p.error);
    setSalesError(s.error);
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
  const wa = enlaceWhatsApp(`Hola LuxCars, soy ${nombre} y tengo una consulta sobre mis solicitudes.`);
  // Solo con el perfil leído: si la lectura falló (`profile` nulo) no se asume
  // nada y la base sigue siendo quien decide.
  const suspendida = profile ? !profile.active : false;

  return (
    <Section tone="bg" padding="tight">
      <SectionHeader
        eyebrow="Mi cuenta"
        title={`Hola, ${nombre.split(" ")[0]}`}
        description="Pide un auto que no tenemos y lo buscamos, o publica el tuyo para venderlo en consignación. Acá ves el estado de cada solicitud."
        action={
          <div className="flex flex-wrap gap-2">
            {/* Solo lo ve un administrador activo. Para un cliente no existe:
                aunque escribiera /portal a mano, el portal lo rechaza por rol. */}
            {profile?.role === "admin" && profile.active ? (
              <Button
                href="/portal"
                variant="secondary"
                size="sm"
                title="Stock, leads, consignaciones y solicitudes. Solo para el equipo de LuxCars."
              >
                <Icon name="shield" size={14} />
                Panel de administración
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

      {suspendida ? (
        <div className="mt-8">
          <AvisoCuentaSuspendida />
        </div>
      ) : (
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
      )}

      <ConfirmacionEnvio />

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
          ) : purchasesError ? (
            <LoadError onRetry={() => void load()} />
          ) : purchases.length === 0 ? (
            <Empty
              text="Todavía no pediste ninguna búsqueda."
              action={suspendida ? undefined : { href: "/cuenta/comprar", cta: "Pedir un auto" }}
            />
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
                  {!suspendida &&
                  (p.status === "nueva" || p.status === "en_busqueda" || p.status === "propuesta_enviada") ? (
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
          ) : salesError ? (
            <LoadError onRetry={() => void load()} />
          ) : sales.length === 0 ? (
            <Empty
              text="Todavía no registraste ningún auto para vender."
              action={suspendida ? undefined : { href: "/cuenta/vender", cta: "Publicar mi auto" }}
            />
          ) : (
            <ul className="mt-4 grid gap-3">
              {sales.map((s) => {
                // Aprobar no es publicar: solo está publicada si la base lo dice.
                const publicada = s.status === "aprobada" && !!s.vehicleId && publicados.has(s.vehicleId);
                const aprobadaSinPublicar = s.status === "aprobada" && !publicada;
                return (
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
                    <Badge tone={aprobadaSinPublicar ? "info" : SALE_TONE[s.status]} dot>
                      {aprobadaSinPublicar ? "Aprobada" : SALE_STATUS_LABEL[s.status]}
                    </Badge>
                  </div>
                  {s.status === "pendiente" ? (
                    <p className="mt-3 text-sm text-ink-3">
                      Lo está revisando el equipo. Te avisamos por WhatsApp; las fotos te las pedimos por ahí.
                    </p>
                  ) : null}
                  {aprobadaSinPublicar ? (
                    <p className="mt-3 text-sm text-ink-3">
                      Tu auto fue aprobado. Lo publicamos en cuanto las fotos estén listas.
                    </p>
                  ) : null}
                  {publicada ? (
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
                  {!suspendida && s.status === "pendiente" ? (
                    <button
                      type="button"
                      onClick={() => handleWithdraw(s.id)}
                      className="mt-3 text-xs font-semibold text-ink-3 underline underline-offset-4 hover:text-ink"
                    >
                      Retirar solicitud
                    </button>
                  ) : null}
                </li>
                );
              })}
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

function Empty({ text, action }: { text: string; action?: { href: string; cta: string } }) {
  return (
    <div className="mt-4 rounded-[22px] border border-dashed border-line-strong p-6 text-center">
      <p className="text-sm text-ink-3">{text}</p>
      {action ? (
        <Button href={action.href} variant="secondary" size="sm" className="mt-4">
          {action.cta}
        </Button>
      ) : null}
    </div>
  );
}

/** La lectura falló: no se muestra el estado vacío (parecería que no hay solicitudes). */
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="mt-4 rounded-[22px] border border-danger/30 bg-danger/10 p-6 text-center">
      <p className="text-sm text-ink-2">No se pudieron cargar tus solicitudes.</p>
      <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}
