"use client";

/**
 * Etapas y tareas: el historial de tramos (con forzados y motivos) y todas
 * las tareas agrupadas por etapa, con su estado.
 */

import { Button } from "@/components/Button";
import { Badge, PortalPanel, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import { EtapaBadge } from "@/components/portal/expedientes/Piezas";
import { nombreEtapaEquipo } from "@/core/expedientes/etapas";
import type { ContextoExpediente, EtapaExpediente } from "@/core/expedientes/tipos";
import { completarTarea } from "@/lib/expedientes/consultas";
import { ESTADO_TAREA_LABEL, RESPONSABLE_LABEL, fecha, fechaHora } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";

export function PestanaTareas({
  client,
  ctx,
  onResultado,
}: {
  client: PortalClient;
  ctx: ContextoExpediente;
  onResultado: (r: { ok: boolean; message: string }) => void;
}) {
  const etapasConTareas = Array.from(new Set(ctx.tareas.map((t) => t.etapa))) as EtapaExpediente[];

  return (
    <div className="space-y-6">
      <PortalPanel title="Historial de etapas">
        <TableScroll>
          <table className="w-full min-w-[640px] border-collapse">
            <thead className="border-b border-line">
              <tr>
                <Th>Etapa</Th>
                <Th>Desde</Th>
                <Th>Hasta</Th>
                <Th>Forzado</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ctx.etapas.map((t, i) => (
                <tr key={`${t.etapa}-${i}`}>
                  <Td><EtapaBadge etapa={t.etapa} /></Td>
                  <Td>{fechaHora(t.desde)}</Td>
                  <Td>{t.hasta ? fechaHora(t.hasta) : <span className="text-ink-4">en curso</span>}</Td>
                  <Td>{t.forzado ? <span className="text-warn">Sí{t.motivo ? ` · ${t.motivo}` : ""}</span> : t.motivo ? t.motivo : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </PortalPanel>

      {etapasConTareas.map((etapa) => (
        <PortalPanel key={etapa} title={nombreEtapaEquipo(etapa)}>
          <TableScroll>
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="border-b border-line">
                <tr>
                  <Th>Tarea</Th>
                  <Th>Responsable</Th>
                  <Th>Vence</Th>
                  <Th>Estado</Th>
                  <Th align="right">Acción</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ctx.tareas
                  .filter((t) => t.etapa === etapa)
                  .map((t) => (
                    <tr key={t.id}>
                      <Td>
                        <p className="text-ink">{t.titulo}</p>
                        {t.descripcion ? <p className="mt-0.5 max-w-md text-xs text-ink-4">{t.descripcion}</p> : null}
                        <p className="mt-0.5 font-mono text-[10px] text-ink-4">{t.clave}{t.visibleCliente ? " · visible al cliente" : ""}</p>
                      </Td>
                      <Td>{RESPONSABLE_LABEL[t.responsable]}</Td>
                      <Td>{t.venceEl ? fecha(t.venceEl) : "—"}</Td>
                      <Td>
                        <Badge tone={t.estado === "hecha" ? "ok" : t.estado === "no_aplica" ? "neutral" : "warn"}>{ESTADO_TAREA_LABEL[t.estado]}</Badge>
                        {t.hechaEn ? <p className="mt-1 text-xs text-ink-4">{fechaHora(t.hechaEn)}</p> : null}
                      </Td>
                      <Td align="right">
                        {t.estado === "pendiente" ? (
                          <Button size="sm" variant="secondary" onClick={async () => onResultado(await completarTarea(client, { tareaId: t.id, estado: "hecha" }))}>Hecha</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={async () => onResultado(await completarTarea(client, { tareaId: t.id, estado: "pendiente" }))}>Reabrir</Button>
                        )}
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableScroll>
        </PortalPanel>
      ))}
    </div>
  );
}
