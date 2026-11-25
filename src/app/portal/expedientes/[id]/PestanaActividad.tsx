"use client";

/**
 * Actividad: todos los eventos (los del cliente también) y notas internas o
 * mensajes visibles para el cliente.
 */

import { useState } from "react";
import { Button } from "@/components/Button";
import { Badge, PortalPanel } from "@/components/portal/CrmUI";
import { AreaTexto } from "@/components/portal/expedientes/Formulario";
import { nombreEtapaEquipo } from "@/core/expedientes/etapas";
import type { ContextoExpediente, Evento } from "@/core/expedientes/tipos";
import { agregarNota } from "@/lib/expedientes/consultas";
import { fechaHora } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";

export function PestanaActividad({
  client,
  ctx,
  eventos,
  onResultado,
}: {
  client: PortalClient;
  ctx: ContextoExpediente;
  eventos: Evento[];
  onResultado: (r: { ok: boolean; message: string }) => void;
}) {
  const [texto, setTexto] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <PortalPanel title="Actividad" description="Cambios de etapa, tareas, acciones del cliente y notas.">
          {eventos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-3">Todavía no hay actividad.</p>
          ) : (
            <ol className="divide-y divide-line">
              {eventos.map((ev) => (
                <li key={ev.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{ev.titulo}{ev.tipo === "etapa" && ev.etapa ? `: ${nombreEtapaEquipo(ev.etapa)}` : ""}</span>
                    <Badge tone={ev.actorTipo === "cliente" ? "info" : ev.visibleCliente ? "silver" : "neutral"}>
                      {ev.actorTipo === "cliente" ? "Cliente" : ev.visibleCliente ? "Visible al cliente" : "Interno"}
                    </Badge>
                  </div>
                  {ev.detalle ? <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{ev.detalle}</p> : null}
                  <p className="mt-1 text-xs text-ink-4">{fechaHora(ev.createdAt)}</p>
                </li>
              ))}
            </ol>
          )}
        </PortalPanel>
      </div>
      <div>
        <PortalPanel title="Agregar nota">
          <form
            className="space-y-3 px-5 py-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const r = await agregarNota(client, { expedienteId: ctx.expediente.id, texto, visibleCliente: visible });
              setBusy(false);
              if (r.ok) setTexto("");
              onResultado(r);
            }}
          >
            <AreaTexto value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={4000} placeholder="Qué pasó, con quién se habló, qué se acordó…" />
            <label className="flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4 accent-silver" />
              Visible para el cliente en su cuenta
            </label>
            <Button type="submit" size="sm" disabled={busy || texto.trim().length < 2}>{busy ? "Guardando…" : visible ? "Publicar mensaje" : "Guardar nota interna"}</Button>
          </form>
        </PortalPanel>
      </div>
    </div>
  );
}
