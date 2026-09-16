"use client";

/**
 * Tabla del embudo de leads.
 *
 * Presentación pura: no habla con Supabase. Recibe las filas ya mapeadas y dos
 * funciones (`onUpdateStatus`, `onWhatsappOpen`) que la pantalla resuelve con
 * la sesión del equipo. Así este archivo no puede, ni por accidente, terminar
 * consultando con una llave que salte RLS.
 *
 * La acción rápida de WhatsApp arma el mensaje con el patrón de
 * `src/lib/whatsapp.ts`, pero dirigido AL CLIENTE (ver `whatsappPortal.ts`).
 */

import {
  Badge,
  TableScroll,
  Td,
  Th,
  type BadgeTone,
} from "@/components/portal/CrmUI";
import { Button } from "@/components/Button";
import { formatCurrency } from "@/lib/utils";
import { buildLeadWhatsappLink } from "@/lib/whatsappPortal";
import { useState, useTransition } from "react";
import {
  LEAD_ORIGIN_LABEL,
  LEAD_STAGES,
  LEAD_STATUS_LABEL,
  type PortalLead,
} from "./model";
import type { LeadMutationResult } from "./queries";
import type { LeadStatus } from "@/lib/db/types";

const STATUS_TONE: Record<LeadStatus, BadgeTone> = {
  nuevo: "silver",
  contactado: "info",
  calificado: "info",
  cotizado: "warn",
  negociacion: "warn",
  ganado: "ok",
  perdido: "danger",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function interestOf(lead: PortalLead): string {
  if (lead.vehicleLabel) return lead.vehicleLabel;
  const parts = [
    lead.interestBrand,
    lead.interestModel,
    lead.interestYear ? String(lead.interestYear) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : "Sin vehículo definido";
}

export function LeadsTable({
  leads,
  canWrite,
  onUpdateStatus,
  onWhatsappOpen,
}: {
  leads: PortalLead[];
  /** `false` sin sesión o sin base de datos: se ve todo, pero en solo lectura. */
  canWrite: boolean;
  onUpdateStatus: (input: {
    id: string;
    status: LeadStatus;
    lostReason?: string | null;
  }) => Promise<LeadMutationResult>;
  onWhatsappOpen: (lead: PortalLead) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<
    { id: string; ok: boolean; message: string } | null
  >(null);
  const [lostFor, setLostFor] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");

  function submitStatus(id: string, status: LeadStatus, reason?: string) {
    setPendingId(id);
    setFeedback(null);
    startTransition(async () => {
      const result = await onUpdateStatus({
        id,
        status,
        lostReason: reason ?? null,
      });
      setPendingId(null);
      setFeedback({ id, ok: result.ok, message: result.message });
      if (result.ok) {
        setLostFor(null);
        setLostReason("");
      }
    });
  }

  function handleStatusChange(lead: PortalLead, next: LeadStatus) {
    if (next === lead.status) return;
    if (next === "perdido") {
      // La base exige motivo (`leads_perdido_exige_motivo`): se pide antes de
      // intentar el guardado, en vez de mostrar un error de Postgres.
      setLostFor(lead.id);
      setLostReason("");
      setFeedback(null);
      return;
    }
    submitStatus(lead.id, next);
  }

  return (
    <TableScroll>
      <table className="w-full min-w-[1040px] border-collapse text-left">
        <thead className="border-b border-line bg-surface-2">
          <tr>
            <Th>Contacto</Th>
            <Th>Origen</Th>
            <Th>Ingreso</Th>
            <Th>Vehículo de interés</Th>
            <Th align="right">Presupuesto</Th>
            <Th>Etapa del embudo</Th>
            <Th align="right">Acción rápida</Th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => {
            const whatsappHref = buildLeadWhatsappLink({
              phone: lead.phone,
              name: lead.name,
              vehicleLabel: lead.vehicleLabel,
              interestBrand: lead.interestBrand,
              interestModel: lead.interestModel,
              interestYear: lead.interestYear,
              budgetUsd: lead.budgetUsd,
              originLabel: LEAD_ORIGIN_LABEL[lead.origin],
            });
            const rowPending = isPending && pendingId === lead.id;
            const rowFeedback = feedback?.id === lead.id ? feedback : null;

            return (
              <tr
                key={lead.id}
                className="border-b border-line align-top last:border-b-0"
              >
                <Td>
                  <p className="font-medium text-ink">{lead.name}</p>
                  <p className="mt-1 text-xs text-ink-3">
                    {lead.phone ?? "Sin teléfono"}
                  </p>
                  {lead.email ? (
                    <p className="break-all text-xs text-ink-3">{lead.email}</p>
                  ) : null}
                  {lead.message ? (
                    <p className="mt-2 max-w-xs text-xs leading-relaxed text-ink-4">
                      “{lead.message}”
                    </p>
                  ) : null}
                </Td>

                <Td>
                  <Badge tone="neutral">{LEAD_ORIGIN_LABEL[lead.origin]}</Badge>
                  {lead.sourcePath ? (
                    <p className="mt-2 font-mono text-[11px] text-ink-4">
                      {lead.sourcePath}
                    </p>
                  ) : null}
                </Td>

                <Td>
                  <p className="whitespace-nowrap text-ink-2">
                    {formatDate(lead.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-ink-4">
                    {lead.ageDays === 0
                      ? "hoy"
                      : `hace ${lead.ageDays} ${
                          lead.ageDays === 1 ? "día" : "días"
                        }`}
                  </p>
                  {lead.whatsappSent ? (
                    <p className="mt-2 text-[11px] text-ok">WhatsApp enviado</p>
                  ) : null}
                </Td>

                <Td>
                  <p className="text-ink-2">{interestOf(lead)}</p>
                  <p className="mt-1 text-[11px] text-ink-4">
                    {lead.vehicleId
                      ? "Unidad del stock"
                      : "Importación a pedido"}
                  </p>
                </Td>

                <Td align="right">
                  <span className="tabular-nums text-ink-2">
                    {lead.budgetUsd ? formatCurrency(lead.budgetUsd) : "—"}
                  </span>
                </Td>

                <Td>
                  <Badge tone={STATUS_TONE[lead.status]}>
                    {LEAD_STATUS_LABEL[lead.status]}
                  </Badge>

                  <label className="mt-3 block">
                    <span className="sr-only">Cambiar etapa de {lead.name}</span>
                    <select
                      value={lead.status}
                      disabled={!canWrite || rowPending}
                      onChange={(event) =>
                        handleStatusChange(lead, event.target.value as LeadStatus)
                      }
                      className="w-full rounded-lux border border-line bg-surface-2 px-3 py-2 text-xs text-ink disabled:opacity-50"
                    >
                      {LEAD_STAGES.map((stage) => (
                        <option key={stage.id} value={stage.id}>
                          {stage.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {lostFor === lead.id ? (
                    <div className="mt-3 space-y-2 rounded-lux border border-danger/30 bg-danger/5 p-3">
                      <label
                        className="block text-[11px] font-medium uppercase tracking-[0.16em] text-danger"
                        htmlFor={`motivo-${lead.id}`}
                      >
                        Motivo de pérdida
                      </label>
                      <input
                        id={`motivo-${lead.id}`}
                        value={lostReason}
                        onChange={(event) => setLostReason(event.target.value)}
                        placeholder="Compró en otro lado, fuera de presupuesto…"
                        className="w-full rounded-lux border border-line bg-surface-2 px-3 py-2 text-xs text-ink placeholder:text-ink-4"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          className="px-4 py-2 text-[11px]"
                          disabled={!lostReason.trim() || rowPending}
                          onClick={() =>
                            submitStatus(lead.id, "perdido", lostReason)
                          }
                        >
                          Guardar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-4 py-2 text-[11px]"
                          onClick={() => {
                            setLostFor(null);
                            setLostReason("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {lead.status === "perdido" && lead.lostReason ? (
                    <p className="mt-2 text-[11px] text-ink-4">
                      Motivo: {lead.lostReason}
                    </p>
                  ) : null}

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
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => onWhatsappOpen(lead)}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-silver px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-void transition-colors hover:bg-silver-bright"
                    >
                      WhatsApp
                    </a>
                  ) : (
                    <span className="text-[11px] text-ink-4">
                      Sin teléfono válido
                    </span>
                  )}
                  {lead.email && !whatsappHref ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="mt-2 block text-[11px] text-silver underline underline-offset-4"
                    >
                      Escribir correo
                    </a>
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
