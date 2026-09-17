"use client";

/**
 * /portal/solicitudes — lo que los clientes piden desde su cuenta.
 *
 * Dos listas: autos ofrecidos para consignación (se aprueban o rechazan acá,
 * y recién al aprobar se publican) y pedidos de búsqueda (se atienden y se
 * les deja una respuesta que el cliente ve en su cuenta).
 *
 * Lee y escribe desde el navegador con la sesión del administrador. Ver
 * `queries.ts`.
 */

import {
  Badge,
  EmptyState,
  Notice,
  PortalPageHeader,
  PortalPanel,
  StatCard,
  StatGrid,
  TableScroll,
  Td,
  Th,
  type BadgeTone,
} from "@/components/portal/CrmUI";
import { usePortalSession } from "@/components/portal/portalSession";
import { Button } from "@/components/Button";
import { LUXCARS_CONFIG } from "@/lib/config";
import {
  PURCHASE_CONDITION_LABEL,
  PURCHASE_STATUS_LABEL,
  SALE_STATUS_LABEL,
} from "@/lib/cuenta/solicitudes";
import {
  PURCHASE_REQUEST_STATUSES,
  type PurchaseRequestStatus,
  type SaleRequestStatus,
} from "@/lib/db/types";
import { CATEGORY_LABEL } from "@/lib/stockLabels";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  approveSaleRequest,
  fetchPurchaseRequests,
  fetchSaleRequests,
  rejectSaleRequest,
  updatePurchaseRequest,
  type AdminPurchaseRequest,
  type AdminSaleRequest,
} from "./queries";

const SALE_TONE: Record<SaleRequestStatus, BadgeTone> = {
  pendiente: "warn",
  aprobada: "ok",
  rechazada: "danger",
  retirada: "neutral",
};

const PURCHASE_TONE: Record<PurchaseRequestStatus, BadgeTone> = {
  nueva: "silver",
  en_busqueda: "info",
  propuesta_enviada: "ok",
  cerrada: "neutral",
  descartada: "danger",
};

const SETUP_STEPS = [
  "Aplica la migración 20260917100000_cuentas_y_roles.sql (supabase db push).",
  "Deja activo el registro por correo en Supabase → Authentication → Providers → Email.",
  "Las solicitudes las crean los clientes desde luxcars.pe/cuenta.",
];

function fecha(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function waLink(phone: string | null, text: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function SolicitudesScreen() {
  const { status: sessionStatus, client } = usePortalSession();
  const [sales, setSales] = useState<AdminSaleRequest[]>([]);
  const [purchases, setPurchases] = useState<AdminPurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [tab, setTab] = useState<"venta" | "compra">("venta");

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setSales([]);
      setPurchases([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [s, p] = await Promise.all([fetchSaleRequests(client), fetchPurchaseRequests(client)]);
    setSales(s.requests);
    setPurchases(p.requests);
    setError(s.error ?? p.error);
    setLoading(false);
  }, [client, canQuery]);

  useEffect(() => {
    if (sessionStatus === "verificando") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load, sessionStatus]);

  const pendientes = useMemo(() => sales.filter((s) => s.status === "pendiente").length, [sales]);
  const nuevas = useMemo(() => purchases.filter((p) => p.status === "nueva").length, [purchases]);

  const notify = (r: { ok: boolean; message: string }) => {
    setFlash({ ok: r.ok, text: r.message });
    if (r.ok) void load();
  };

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Solicitudes"
        title="Lo que piden los clientes"
        description="Autos ofrecidos para consignación, que solo se publican cuando los apruebas, y pedidos de búsqueda de autos que no tenemos."
      />

      <StatGrid>
        <StatCard label="Autos por aprobar" value={pendientes} tone={pendientes > 0 ? "warn" : "default"} hint="No se publican hasta que los revises." />
        <StatCard label="Búsquedas nuevas" value={nuevas} tone={nuevas > 0 ? "accent" : "default"} hint="Nadie las tomó todavía." />
        <StatCard label="Autos ofrecidos" value={sales.length} />
        <StatCard label="Pedidos de búsqueda" value={purchases.length} />
      </StatGrid>

      {error ? (
        <Notice tone="warn" label="No se pudo leer">
          {error}
        </Notice>
      ) : null}
      {flash ? (
        <Notice tone={flash.ok ? "info" : "danger"} label={flash.ok ? "Listo" : "No se pudo"}>
          {flash.text}
        </Notice>
      ) : null}

      <div role="tablist" aria-label="Tipo de solicitud" className="inline-flex rounded-full border border-line bg-surface p-1">
        {(
          [
            ["venta", `Autos ofrecidos (${sales.length})`],
            ["compra", `Búsquedas (${purchases.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              tab === id ? "bg-ink text-void" : "text-ink-3 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "venta" ? (
        <PortalPanel title="Autos ofrecidos para consignación" description="Al aprobar se crea la consignación y la ficha pública en un solo paso. Las fotos se cargan después desde Vehículos.">
          {loading ? (
            <p className="px-5 py-10 text-sm text-ink-3">Cargando…</p>
          ) : sales.length === 0 ? (
            <EmptyState
              title="Ningún auto ofrecido todavía"
              description={canQuery ? "Cuando un cliente registre su auto en luxcars.pe/cuenta/vender, aparece acá." : "Sin sesión o sin base de datos no hay nada que listar."}
              steps={canQuery ? undefined : SETUP_STEPS}
            />
          ) : (
            <TableScroll>
              <table className="w-full min-w-[960px] border-collapse">
                <thead className="border-b border-line">
                  <tr>
                    <Th>Auto</Th>
                    <Th>Dueño</Th>
                    <Th align="right">Pide</Th>
                    <Th>Estado</Th>
                    <Th>Revisión</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sales.map((s) => (
                    <SaleRow key={s.id} request={s} onApprove={(input) => client && approveSaleRequest(client, input).then(notify)} onReject={(input) => client && rejectSaleRequest(client, input).then(notify)} />
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </PortalPanel>
      ) : (
        <PortalPanel title="Pedidos de búsqueda" description="La respuesta que escribas la ve el cliente en su cuenta. Lo demás, por WhatsApp.">
          {loading ? (
            <p className="px-5 py-10 text-sm text-ink-3">Cargando…</p>
          ) : purchases.length === 0 ? (
            <EmptyState
              title="Ningún pedido de búsqueda"
              description={canQuery ? "Cuando un cliente pida un auto desde luxcars.pe/cuenta/comprar, aparece acá." : "Sin sesión o sin base de datos no hay nada que listar."}
              steps={canQuery ? undefined : SETUP_STEPS}
            />
          ) : (
            <TableScroll>
              <table className="w-full min-w-[960px] border-collapse">
                <thead className="border-b border-line">
                  <tr>
                    <Th>Busca</Th>
                    <Th>Cliente</Th>
                    <Th align="right">Presupuesto</Th>
                    <Th>Estado</Th>
                    <Th>Atención</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {purchases.map((p) => (
                    <PurchaseRow key={p.id} request={p} onUpdate={(input) => client && updatePurchaseRequest(client, input).then(notify)} />
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </PortalPanel>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Requester({ name, email, phone, wa }: { name: string; email: string | null; phone: string | null; wa: string | null }) {
  return (
    <div className="text-sm">
      <p className="font-medium text-ink">{name}</p>
      {phone ? <p className="text-xs text-ink-3">{phone}</p> : null}
      {email ? <p className="truncate text-xs text-ink-4" title={email}>{email}</p> : null}
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium text-whatsapp underline-offset-4 hover:underline">
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}

function SaleRow({
  request: s,
  onApprove,
  onReject,
}: {
  request: AdminSaleRequest;
  onApprove: (input: { id: string; price: number | null; commissionRate: number; publish: boolean }) => void;
  onReject: (input: { id: string; reason: string }) => void;
}) {
  const [mode, setMode] = useState<"idle" | "aprobar" | "rechazar">("idle");
  const [price, setPrice] = useState(String(Math.round(s.askingPrice)));
  const [commission, setCommission] = useState("5");
  const [publish, setPublish] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const wa = waLink(
    s.contactPhone || s.requester.phone,
    `Hola ${s.requester.name.split(" ")[0]}, te escribimos de ${LUXCARS_CONFIG.brandName} por el ${s.brand} ${s.model} ${s.year} que registraste en la web.`,
  );

  return (
    <tr className="align-top">
      <Td>
        <p className="font-medium text-ink">
          {s.brand} {s.model} {s.trim ?? ""} <span className="text-ink-3">{s.year}</span>
        </p>
        <p className="mt-1 text-xs text-ink-3">
          {formatNumber(s.mileageKm)} km · {CATEGORY_LABEL[s.category]}
          {s.color ? ` · ${s.color}` : ""}
          {s.plate ? ` · ${s.plate}` : ""}
        </p>
        {s.declaredCondition ? <p className="mt-1 text-xs text-ink-4">Condición declarada: {s.declaredCondition}</p> : null}
        {s.description ? <p className="mt-2 max-w-md text-xs leading-relaxed text-ink-3">{s.description}</p> : null}
        <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-ink-4">{fecha(s.createdAt)}</p>
      </Td>
      <Td>
        <Requester name={s.requester.name} email={s.requester.email} phone={s.contactPhone || s.requester.phone} wa={wa} />
      </Td>
      <Td align="right">
        <span className="font-semibold tabular-nums text-ink">{formatCurrency(s.askingPrice, "en-US", s.currency)}</span>
      </Td>
      <Td>
        <Badge tone={SALE_TONE[s.status]}>{SALE_STATUS_LABEL[s.status]}</Badge>
        {s.status === "rechazada" && s.rejectionReason ? <p className="mt-2 max-w-xs text-xs text-ink-3">{s.rejectionReason}</p> : null}
        {s.status === "aprobada" && s.vehicleId ? (
          <Link href={`/portal/vehiculos/${s.vehicleId}/fotos`} className="mt-2 block text-xs font-medium text-silver underline-offset-4 hover:underline">
            Cargar fotos de la ficha
          </Link>
        ) : null}
      </Td>
      <Td>
        {s.status !== "pendiente" ? (
          <span className="text-xs text-ink-4">{s.reviewedAt ? `Revisada ${fecha(s.reviewedAt)}` : "—"}</span>
        ) : mode === "idle" ? (
          <div className="flex flex-col gap-2">
            <Button size="sm" onClick={() => setMode("aprobar")}>Aprobar y publicar</Button>
            <Button size="sm" variant="secondary" onClick={() => setMode("rechazar")}>Rechazar</Button>
          </div>
        ) : mode === "aprobar" ? (
          <form
            className="flex w-56 flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              await onApprove({
                id: s.id,
                price: price ? Number(price.replace(/[^0-9]/g, "")) : null,
                commissionRate: Number(commission) / 100,
                publish,
              });
              setBusy(false);
              setMode("idle");
            }}
          >
            <label className="text-[11px] uppercase tracking-[0.12em] text-ink-4">
              Precio de publicación ({s.currency})
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="field-lux mt-1 min-h-10 py-1.5 text-sm tabular-nums" />
            </label>
            <label className="text-[11px] uppercase tracking-[0.12em] text-ink-4">
              Comisión %
              <input value={commission} onChange={(e) => setCommission(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="field-lux mt-1 min-h-10 py-1.5 text-sm tabular-nums" />
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="h-4 w-4 accent-silver" />
              Publicar en la web ahora
            </label>
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={busy}>{busy ? "…" : "Confirmar"}</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setMode("idle")}>Cancelar</Button>
            </div>
          </form>
        ) : (
          <form
            className="flex w-56 flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              await onReject({ id: s.id, reason });
              setBusy(false);
              setMode("idle");
            }}
          >
            <label className="text-[11px] uppercase tracking-[0.12em] text-ink-4">
              Motivo (lo lee el cliente)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="field-lux mt-1 min-h-20 py-1.5 text-sm" />
            </label>
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={busy}>{busy ? "…" : "Rechazar"}</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setMode("idle")}>Cancelar</Button>
            </div>
          </form>
        )}
      </Td>
    </tr>
  );
}

function PurchaseRow({
  request: p,
  onUpdate,
}: {
  request: AdminPurchaseRequest;
  onUpdate: (input: { id: string; status: PurchaseRequestStatus; reply: string | null }) => void;
}) {
  const [status, setStatus] = useState<PurchaseRequestStatus>(p.status);
  const [reply, setReply] = useState(p.reply ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = status !== p.status || (reply.trim() || "") !== (p.reply ?? "");

  const wa = waLink(
    p.requester.phone,
    `Hola ${p.requester.name.split(" ")[0]}, te escribimos de ${LUXCARS_CONFIG.brandName} por el ${p.brand} ${p.model} que nos pediste buscar.`,
  );

  return (
    <tr className="align-top">
      <Td>
        <p className="font-medium text-ink">
          {p.brand} {p.model}
        </p>
        <p className="mt-1 text-xs text-ink-3">
          {p.yearMin || p.yearMax ? `${p.yearMin ?? "…"} – ${p.yearMax ?? "…"} · ` : ""}
          {PURCHASE_CONDITION_LABEL[p.condition]}
        </p>
        {p.notes ? <p className="mt-2 max-w-md text-xs leading-relaxed text-ink-3">{p.notes}</p> : null}
        <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-ink-4">{fecha(p.createdAt)}</p>
      </Td>
      <Td>
        <Requester name={p.requester.name} email={p.requester.email} phone={p.requester.phone} wa={wa} />
      </Td>
      <Td align="right">
        <span className="font-semibold tabular-nums text-ink">{p.budgetMaxUsd ? formatCurrency(p.budgetMaxUsd) : "—"}</span>
      </Td>
      <Td>
        <Badge tone={PURCHASE_TONE[p.status]}>{PURCHASE_STATUS_LABEL[p.status]}</Badge>
      </Td>
      <Td>
        <form
          className="flex w-64 flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await onUpdate({ id: p.id, status, reply: reply || null });
            setBusy(false);
          }}
        >
          <select value={status} onChange={(e) => setStatus(e.target.value as PurchaseRequestStatus)} className="field-lux select-lux min-h-10 py-1.5 text-sm">
            {PURCHASE_REQUEST_STATUSES.map((st) => (
              <option key={st} value={st}>{PURCHASE_STATUS_LABEL[st]}</option>
            ))}
          </select>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Respuesta visible para el cliente" className="field-lux min-h-16 py-1.5 text-sm" />
          <Button size="sm" type="submit" disabled={busy || !dirty}>{busy ? "…" : "Guardar"}</Button>
        </form>
      </Td>
    </tr>
  );
}
