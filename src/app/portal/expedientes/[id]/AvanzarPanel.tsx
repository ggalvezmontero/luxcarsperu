"use client";

/**
 * Avanzar a la siguiente etapa (con la compuerta evaluada por el core y la
 * opción de forzar con motivo) o cancelar el expediente (motivo obligatorio).
 * Las tareas de la etapa nueva las genera el core y viajan en la RPC.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Notice, PortalPanel } from "@/components/portal/CrmUI";
import { AreaTexto, Campo } from "@/components/portal/expedientes/Formulario";
import { evaluarAvance, siguienteEtapa, tareasParaEtapa } from "@/core/expedientes/avance";
import { definicionEtapa } from "@/core/expedientes/etapas";
import type { ContextoExpediente } from "@/core/expedientes/tipos";
import { avanzarExpediente } from "@/lib/expedientes/consultas";
import type { PortalClient } from "@/lib/portal/portalClient";
import { cn } from "@/lib/utils";

export function AvanzarPanel({
  client,
  ctx,
  modo,
  onCerrar,
  onHecho,
}: {
  client: PortalClient;
  ctx: ContextoExpediente;
  modo: "avanzar" | "cancelar";
  onCerrar: () => void;
  onHecho: (r: { ok: boolean; message: string }) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destino = modo === "cancelar" ? "cancelado" : siguienteEtapa(ctx.expediente.etapa);
  const evaluacion = useMemo(() => (destino ? evaluarAvance(ctx, destino) : null), [ctx, destino]);
  const def = destino ? definicionEtapa(destino) : null;
  const faltan = new Set(evaluacion?.faltantes.map((f) => f.clave) ?? []);

  if (!destino || !def) {
    return <Notice tone="info" label="Sin siguiente etapa">El expediente ya está en la última etapa.</Notice>;
  }

  const ejecutar = async (forzado: boolean) => {
    setError(null);
    if ((forzado || modo === "cancelar") && motivo.trim().length < 5) {
      return setError(modo === "cancelar" ? "Escribe el motivo de la cancelación (mínimo cinco caracteres)." : "Para forzar la compuerta escribe el motivo (mínimo cinco caracteres).");
    }
    setBusy(true);
    const r = await avanzarExpediente(client, {
      id: ctx.expediente.id,
      destino,
      tareas: tareasParaEtapa(destino, ctx),
      forzado,
      motivo: motivo.trim() || null,
    });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    onHecho(r);
  };

  if (modo === "cancelar") {
    return (
      <PortalPanel title="Cancelar el expediente" description="Terminal: después no se mueve. Nacen las tareas de devolución y rendición de cierre (cláusula 15).">
        <div className="space-y-4 px-5 py-4">
          <Campo label="Motivo (queda en la actividad interna)" requerido>
            <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={2000} />
          </Campo>
          {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void ejecutar(false)}>{busy ? "…" : "Confirmar cancelación"}</Button>
            <Button size="sm" variant="ghost" onClick={onCerrar}>Volver</Button>
          </div>
        </div>
      </PortalPanel>
    );
  }

  return (
    <PortalPanel title={`Avanzar a: ${def.nombreEquipo}`} description="Compuerta de entrada evaluada ahora con lo que hay en el expediente.">
      <div className="space-y-4 px-5 py-4">
        {def.compuerta.length === 0 ? (
          <p className="text-sm text-ink-3">Esta etapa no tiene condiciones de entrada.</p>
        ) : (
          <ul className="space-y-2">
            {def.compuerta.map((c) => {
              const falta = faltan.has(c.clave);
              return (
                <li key={c.clave} className="flex items-start gap-3 text-sm">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                      falta ? "border-warn/50 text-warn" : "border-ok/50 bg-ok/10 text-ok",
                    )}
                  >
                    {falta ? "!" : "✓"}
                  </span>
                  <span className={falta ? "text-ink-2" : "text-ink-3"}>{c.descripcion}</span>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-ink-4">
          Al entrar nacen {tareasParaEtapa(destino, ctx).length} tareas de la etapa; el cliente ve el cambio en su cuenta.
        </p>

        {!evaluacion?.permitido ? (
          <Campo label="Forzar: motivo (queda en el historial, no lo ve el cliente)" requerido>
            <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={2000} />
          </Campo>
        ) : null}

        {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          {evaluacion?.permitido ? (
            <Button size="sm" disabled={busy} onClick={() => void ejecutar(false)}>{busy ? "…" : `Avanzar a ${def.nombreEquipo}`}</Button>
          ) : (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void ejecutar(true)}>{busy ? "…" : "Forzar el avance con motivo"}</Button>
          )}
          <Button size="sm" variant="ghost" onClick={onCerrar}>Cerrar</Button>
        </div>
      </div>
    </PortalPanel>
  );
}
