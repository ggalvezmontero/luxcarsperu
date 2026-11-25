"use client";

/**
 * Resumen: compuerta de la próxima etapa con lo que falta, tareas pendientes
 * por responsable (se marcan hechas acá), hitos y fechas.
 */

import { Button } from "@/components/Button";
import { Badge, PortalPanel } from "@/components/portal/CrmUI";
import { Dato } from "@/components/portal/expedientes/Formulario";
import { evaluarAvance, siguienteEtapa } from "@/core/expedientes/avance";
import { definicionEtapa } from "@/core/expedientes/etapas";
import type { ContextoExpediente, ResponsableTarea, Tarea } from "@/core/expedientes/tipos";
import { RESPONSABLES_TAREA } from "@/core/expedientes/tipos";
import { completarTarea } from "@/lib/expedientes/consultas";
import { HITO_LABEL, RESPONSABLE_LABEL, fecha, hoyIso, usd } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";

export function PestanaResumen({
  client,
  ctx,
  onResultado,
}: {
  client: PortalClient;
  ctx: ContextoExpediente;
  onResultado: (r: { ok: boolean; message: string }) => void;
}) {
  const e = ctx.expediente;
  const destino = siguienteEtapa(e.etapa);
  const evaluacion = destino ? evaluarAvance(ctx, destino) : null;
  const pendientes = ctx.tareas.filter((t) => t.estado === "pendiente" && t.etapa === e.etapa);
  const hoy = hoyIso();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {destino && evaluacion ? (
          <PortalPanel title={`Para pasar a ${definicionEtapa(destino).nombreEquipo}`} description={evaluacion.permitido ? "Todas las condiciones se cumplen." : "Lo que falta, en orden."}>
            <ul className="divide-y divide-line">
              {definicionEtapa(destino).compuerta.map((c) => {
                const falta = evaluacion.faltantes.some((f) => f.clave === c.clave);
                return (
                  <li key={c.clave} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className={falta ? "text-ink" : "text-ink-3"}>{c.descripcion}</span>
                    <Badge tone={falta ? "warn" : "ok"}>{falta ? "Falta" : "Cumple"}</Badge>
                  </li>
                );
              })}
              {definicionEtapa(destino).compuerta.length === 0 ? (
                <li className="px-5 py-3 text-sm text-ink-3">Sin condiciones de entrada.</li>
              ) : null}
            </ul>
          </PortalPanel>
        ) : null}

        <PortalPanel title="Tareas pendientes de la etapa" description="Marcar hecha deja constancia en la actividad; las del cliente se ven en su cuenta.">
          {pendientes.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-3">No queda nada pendiente en esta etapa.</p>
          ) : (
            RESPONSABLES_TAREA.map((r) => <GrupoTareas key={r} responsable={r} tareas={pendientes.filter((t) => t.responsable === r)} hoy={hoy} client={client} onResultado={onResultado} />)
          )}
        </PortalPanel>
      </div>

      <div className="space-y-6">
        <PortalPanel title="Hitos de pago">
          {ctx.hitos.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-3">Sin presupuesto: el expediente se abrió sin hitos.</p>
          ) : (
            <ul className="divide-y divide-line">
              {ctx.hitos.map((h) => (
                <li key={h.tipo} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink">{HITO_LABEL[h.tipo]}</span>
                    <span className="text-sm tabular-nums text-ink">{usd(h.montoEstimadoUsd)}</span>
                  </div>
                  <p className="text-xs text-ink-4">
                    {h.fechaLimite ? `Límite ${fecha(h.fechaLimite)}` : "Sin fecha límite"} · {h.cuenta === "operaciones" ? "Operaciones" : "Fondos de clientes"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </PortalPanel>

        <PortalPanel title="Fechas">
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-1">
            <Dato label="Firma del contrato">{fecha(e.fechaFirma) || "—"}</Dato>
            <Dato label="Límite H2">{fecha(e.fechaLimiteH2) || "—"}</Dato>
            <Dato label="Embarque estimado">{fecha(e.fechaEstEmbarque) || "—"}</Dato>
            <Dato label="Arribo estimado">{fecha(e.fechaEstArribo) || fecha(ctx.embarque?.fechaArriboEst) || "—"}</Dato>
            <Dato label="Entrega estimada">{fecha(e.fechaEstEntrega) || "—"}</Dato>
            <Dato label="LOA vence">{fecha(e.loaVence) || "—"}</Dato>
          </div>
        </PortalPanel>
      </div>
    </div>
  );
}

function GrupoTareas({
  responsable,
  tareas,
  hoy,
  client,
  onResultado,
}: {
  responsable: ResponsableTarea;
  tareas: Tarea[];
  hoy: string;
  client: PortalClient;
  onResultado: (r: { ok: boolean; message: string }) => void;
}) {
  if (tareas.length === 0) return null;
  return (
    <div className="border-b border-line last:border-b-0">
      <p className="px-5 pt-3 text-[11px] uppercase tracking-[0.16em] text-ink-4">{RESPONSABLE_LABEL[responsable]}</p>
      <ul className="divide-y divide-line">
        {tareas.map((t) => (
          <li key={t.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-ink">{t.titulo}</p>
              {t.venceEl ? (
                <p className={`text-xs ${t.venceEl < hoy ? "text-danger" : "text-ink-4"}`}>
                  {t.venceEl < hoy ? "Venció" : "Vence"} el {fecha(t.venceEl)}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="secondary" onClick={async () => onResultado(await completarTarea(client, { tareaId: t.id, estado: "hecha" }))}>Hecha</Button>
              <Button size="sm" variant="ghost" onClick={async () => onResultado(await completarTarea(client, { tareaId: t.id, estado: "no_aplica" }))}>No aplica</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
