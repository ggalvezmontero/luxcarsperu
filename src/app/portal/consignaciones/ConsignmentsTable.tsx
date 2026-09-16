"use client";

/**
 * Tabla de autos en consignación.
 *
 * Dos decisiones de esta pantalla que no son cosméticas:
 *
 *  1. EL PRECIO MÍNIMO VA OCULTO. Es el piso que autorizó el dueño y es
 *     información reservada de la negociación: se revela con un clic explícito,
 *     para que no quede a la vista de quien pase por detrás de la pantalla ni
 *     aparezca en una captura compartida por WhatsApp.
 *
 *  2. “VENDIDO POR EL DUEÑO” ES UNA ACCIÓN DE PRIMER NIVEL, no un estado
 *     escondido en un desplegable. LuxCars trabaja SIN exclusividad: que el
 *     dueño venda su propio auto es un desenlace previsto y se cierra en cero,
 *     sin comisión y sin fricción. Ponerlo a mano es reflejar el negocio.
 *
 * Presentación pura: no habla con Supabase. Recibe las filas ya mapeadas y dos
 * funciones que la pantalla resuelve con la sesión del equipo, para que este
 * archivo no pueda terminar consultando con una llave que salte RLS.
 */

import {
  Badge,
  Td,
  Th,
  TableScroll,
  type BadgeTone,
} from "@/components/portal/CrmUI";
import { Button } from "@/components/Button";
import { formatCurrency, formatNumber, formatPercentage } from "@/lib/utils";
import { buildConsignmentOwnerWhatsappLink } from "@/lib/whatsappPortal";
import { useState, useTransition } from "react";
import {
  CONSIGNMENT_STATUS_LABEL,
  MANAGEABLE_CONSIGNMENT_STATUSES,
  isClosedConsignment,
  type ConsignmentStatus,
  type PortalConsignment,
} from "./model";
import type { ConsignmentMutationResult } from "./queries";

const STATUS_TONE: Record<ConsignmentStatus, BadgeTone> = {
  activa: "ok",
  pausada: "warn",
  vendida_por_luxcars: "info",
  vendida_por_dueno: "silver",
  retirada: "neutral",
  vencida: "danger",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function commissionLabel(item: PortalConsignment): string {
  if (item.soldByOwner) return "Sin comisión";
  if (item.commissionType === "monto_fijo") {
    return item.commissionAmount
      ? formatCurrency(item.commissionAmount, "es-PE", item.currency)
      : "Monto fijo sin definir";
  }
  return item.commissionPercent !== null
    ? formatPercentage(item.commissionPercent, "es-PE", 1)
    : "Porcentaje sin definir";
}

export function ConsignmentsTable({
  consignments,
  canWrite,
  onMarkSoldByOwner,
  onChangeStatus,
}: {
  consignments: PortalConsignment[];
  /** `false` sin sesión o sin base de datos: se ve todo, pero en solo lectura. */
  canWrite: boolean;
  onMarkSoldByOwner: (input: {
    id: string;
    notes?: string | null;
  }) => Promise<ConsignmentMutationResult>;
  onChangeStatus: (input: {
    id: string;
    status: ConsignmentStatus;
  }) => Promise<ConsignmentMutationResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { id: string; ok: boolean; message: string } | null
  >(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [ownerSaleFor, setOwnerSaleFor] = useState<string | null>(null);
  const [ownerSaleNotes, setOwnerSaleNotes] = useState("");

  function confirmOwnerSale(id: string) {
    setPendingId(id);
    setFeedback(null);
    startTransition(async () => {
      const result = await onMarkSoldByOwner({ id, notes: ownerSaleNotes });
      setPendingId(null);
      setFeedback({ id, ok: result.ok, message: result.message });
      if (result.ok) {
        setOwnerSaleFor(null);
        setOwnerSaleNotes("");
      }
    });
  }

  function changeStatus(id: string, status: ConsignmentStatus) {
    setPendingId(id);
    setFeedback(null);
    startTransition(async () => {
      const result = await onChangeStatus({ id, status });
      setPendingId(null);
      setFeedback({ id, ok: result.ok, message: result.message });
    });
  }

  return (
    <TableScroll>
      <table className="w-full min-w-[1160px] border-collapse text-left">
        <thead className="border-b border-line bg-surface-2">
          <tr>
            <Th>Dueño</Th>
            <Th>Vehículo</Th>
            <Th align="right">Precio pedido</Th>
            <Th align="right">Precio mínimo</Th>
            <Th align="right">Comisión</Th>
            <Th align="right">Días</Th>
            <Th>Estado</Th>
            <Th align="right">Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {consignments.map((item) => {
            const rowPending = isPending && pendingId === item.id;
            const rowFeedback = feedback?.id === item.id ? feedback : null;
            const closed = isClosedConsignment(item.status);
            const whatsappHref = buildConsignmentOwnerWhatsappLink({
              phone: item.ownerPhone,
              ownerName: item.ownerName,
              vehicleLabel: item.vehicleLabel,
              askingPrice: item.askingPrice,
              currency: item.currency,
              daysOnConsignment: item.daysOnConsignment,
            });

            return (
              <tr
                key={item.id}
                className="border-b border-line align-top last:border-b-0"
              >
                <Td>
                  <p className="font-medium text-ink">{item.ownerName}</p>
                  <p className="mt-1 text-xs text-ink-3">{item.ownerPhone}</p>
                  {item.ownerEmail ? (
                    <p className="text-xs text-ink-3 break-all">
                      {item.ownerEmail}
                    </p>
                  ) : null}
                  {item.ownerDocument ? (
                    <p className="mt-1 text-[11px] text-ink-4">
                      {item.ownerDocumentType ?? "Doc."} {item.ownerDocument}
                    </p>
                  ) : null}
                </Td>

                <Td>
                  <p className="text-ink-2">{item.vehicleLabel}</p>
                  <p className="mt-1 text-[11px] text-ink-4">
                    {[
                      item.plate,
                      item.mileageKm !== null
                        ? `${formatNumber(item.mileageKm)} km`
                        : null,
                      item.color,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos adicionales"}
                  </p>
                  {item.appraisal ? (
                    <p className="mt-1 text-[11px] text-ink-4">
                      Tasación LuxCars:{" "}
                      {formatCurrency(item.appraisal, "es-PE", item.currency)}
                    </p>
                  ) : null}
                </Td>

                <Td align="right">
                  <span className="tabular-nums text-ink">
                    {formatCurrency(item.askingPrice, "es-PE", item.currency)}
                  </span>
                  {item.finalSalePrice ? (
                    <p className="mt-1 text-[11px] text-ink-4">
                      Vendido en{" "}
                      {formatCurrency(
                        item.finalSalePrice,
                        "es-PE",
                        item.currency,
                      )}
                    </p>
                  ) : null}
                </Td>

                <Td align="right">
                  {item.minimumPrice === null ? (
                    <span className="text-xs text-ink-4">Sin piso pactado</span>
                  ) : revealed[item.id] ? (
                    <>
                      <span className="tabular-nums text-warn">
                        {formatCurrency(
                          item.minimumPrice,
                          "es-PE",
                          item.currency,
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealed((prev) => ({ ...prev, [item.id]: false }))
                        }
                        className="mt-1 block w-full text-right text-[11px] text-ink-4 underline underline-offset-4"
                      >
                        Ocultar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setRevealed((prev) => ({ ...prev, [item.id]: true }))
                      }
                      className="text-[11px] text-silver underline underline-offset-4"
                      title="Dato reservado: no se comparte con el comprador"
                    >
                      Ver piso (reservado)
                    </button>
                  )}
                </Td>

                <Td align="right">
                  <span
                    className={
                      item.soldByOwner
                        ? "text-xs text-silver"
                        : "text-xs text-ink-2"
                    }
                  >
                    {commissionLabel(item)}
                  </span>
                  {!item.soldByOwner && item.estimatedCommission > 0 ? (
                    <p className="mt-1 tabular-nums text-[11px] text-ink-4">
                      ≈{" "}
                      {formatCurrency(
                        item.estimatedCommission,
                        "es-PE",
                        item.currency,
                      )}
                    </p>
                  ) : null}
                </Td>

                <Td align="right">
                  <span className="tabular-nums text-ink-2">
                    {item.daysOnConsignment}
                  </span>
                  <p className="mt-1 whitespace-nowrap text-[11px] text-ink-4">
                    desde {formatDate(item.startDate)}
                  </p>
                  {item.endDate ? (
                    <p className="whitespace-nowrap text-[11px] text-ink-4">
                      hasta {formatDate(item.endDate)}
                    </p>
                  ) : (
                    <p className="text-[11px] text-ink-4">sin plazo</p>
                  )}
                </Td>

                <Td>
                  <Badge tone={STATUS_TONE[item.status]}>
                    {CONSIGNMENT_STATUS_LABEL[item.status]}
                  </Badge>

                  {item.withoutExclusivity ? (
                    <p className="mt-2 text-[11px] text-ink-4">
                      Sin exclusividad
                    </p>
                  ) : null}

                  {!item.soldByOwner ? (
                    <label className="mt-3 block">
                      <span className="sr-only">
                        Cambiar estado de la consignación de {item.ownerName}
                      </span>
                      <select
                        value={
                          MANAGEABLE_CONSIGNMENT_STATUSES.includes(item.status)
                            ? item.status
                            : ""
                        }
                        disabled={!canWrite || rowPending || closed}
                        onChange={(event) =>
                          changeStatus(
                            item.id,
                            event.target.value as ConsignmentStatus,
                          )
                        }
                        className="w-full rounded-lux border border-line bg-surface-2 px-3 py-2 text-xs text-ink disabled:opacity-50"
                      >
                        {!MANAGEABLE_CONSIGNMENT_STATUSES.includes(item.status) ? (
                          <option value="">
                            {CONSIGNMENT_STATUS_LABEL[item.status]}
                          </option>
                        ) : null}
                        {MANAGEABLE_CONSIGNMENT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {CONSIGNMENT_STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
                      Cerrada el {formatDate(item.soldByOwnerAt)} sin comisión.
                      {item.soldByOwnerNotes
                        ? ` ${item.soldByOwnerNotes}`
                        : ""}
                    </p>
                  )}

                  {rowFeedback ? (
                    <p
                      className={`mt-2 text-[11px] ${
                        rowFeedback.ok ? "text-ok" : "text-danger"
                      }`}
                      role="status"
                    >
                      {rowFeedback.message}
                    </p>
                  ) : null}
                </Td>

                <Td align="right">
                  <div className="flex flex-col items-end gap-2">
                    {whatsappHref ? (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-full bg-silver px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-void transition-colors hover:bg-silver-bright"
                      >
                        WhatsApp
                      </a>
                    ) : (
                      <span className="text-[11px] text-ink-4">
                        Sin teléfono válido
                      </span>
                    )}

                    {!item.soldByOwner && !closed ? (
                      <button
                        type="button"
                        disabled={!canWrite || rowPending}
                        onClick={() => {
                          setOwnerSaleFor(item.id);
                          setOwnerSaleNotes("");
                          setFeedback(null);
                        }}
                        className="rounded-full border border-line-strong px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink transition-colors hover:border-silver hover:bg-surface-2 disabled:opacity-45"
                      >
                        Vendido por el dueño
                      </button>
                    ) : null}
                  </div>

                  {ownerSaleFor === item.id ? (
                    <div className="mt-3 max-w-xs rounded-lux border border-line-strong bg-surface-2 p-3 text-left">
                      <p className="text-xs font-semibold text-ink">
                        Cerrar sin comisión
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
                        El dueño vendió su {item.vehicleLabel} por su cuenta. No
                        hay exclusividad, así que la consignación se cierra en
                        cero: LuxCars no cobra comisión.
                      </p>
                      <label
                        className="mt-3 block text-[11px] text-ink-3"
                        htmlFor={`nota-${item.id}`}
                      >
                        Nota interna (opcional)
                      </label>
                      <input
                        id={`nota-${item.id}`}
                        value={ownerSaleNotes}
                        onChange={(event) =>
                          setOwnerSaleNotes(event.target.value)
                        }
                        placeholder="Lo vendió a un familiar, avisó el 12/09…"
                        className="mt-1 w-full rounded-lux border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-4"
                      />
                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          size="md"
                          variant="primary"
                          className="px-4 py-2 text-[11px]"
                          disabled={rowPending}
                          onClick={() => confirmOwnerSale(item.id)}
                        >
                          {rowPending ? "Guardando…" : "Confirmar"}
                        </Button>
                        <Button
                          type="button"
                          size="md"
                          variant="ghost"
                          className="px-4 py-2 text-[11px]"
                          onClick={() => {
                            setOwnerSaleFor(null);
                            setOwnerSaleNotes("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}
