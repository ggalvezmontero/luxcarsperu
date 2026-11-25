/**
 * Piezas visuales del módulo de expedientes para el portal: etiqueta de
 * etapa, lista de alertas, barra de etapas.
 */

import { Badge } from "@/components/portal/CrmUI";
import { nombreEtapaCliente, nombreEtapaEquipo } from "@/core/expedientes/etapas";
import type { Alerta, EtapaExpediente } from "@/core/expedientes/tipos";
import { ETAPAS_ORDEN } from "@/core/expedientes/tipos";
import { ETAPA_TONE } from "@/lib/expedientes/formato";
import { cn } from "@/lib/utils";

export function EtapaBadge({ etapa }: { etapa: EtapaExpediente }) {
  return <Badge tone={ETAPA_TONE[etapa]}>{nombreEtapaEquipo(etapa)}</Badge>;
}

export function AlertasLista({ alertas, compacta = false }: { alertas: readonly Alerta[]; compacta?: boolean }) {
  if (alertas.length === 0) return null;
  if (compacta) {
    return (
      <ul className="flex flex-wrap gap-1.5">
        {alertas.map((a) => (
          <li key={a.clave}>
            <Badge tone={a.nivel === "alta" ? "danger" : "warn"}>{a.titulo}</Badge>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="space-y-2">
      {alertas.map((a) => (
        <li
          key={a.clave}
          className={cn(
            "rounded-lux border px-4 py-3 text-xs leading-relaxed",
            a.nivel === "alta" ? "border-danger/30 bg-danger/5" : "border-warn/30 bg-warn/5",
          )}
        >
          <p className={cn("font-semibold", a.nivel === "alta" ? "text-danger" : "text-warn")}>{a.titulo}</p>
          <p className="mt-0.5 text-ink-2">{a.detalle}</p>
        </li>
      ))}
    </ul>
  );
}

/** Barra horizontal de etapas (sin prospecto) con la actual resaltada. */
export function BarraEtapas({ actual, nombres = "equipo" }: { actual: EtapaExpediente; nombres?: "equipo" | "cliente" }) {
  const etapas: EtapaExpediente[] = ETAPAS_ORDEN.filter((e) => e !== "prospecto");
  const indice = etapas.indexOf(actual);
  return (
    <ol className="flex gap-1 overflow-x-auto no-scrollbar" aria-label="Etapas">
      {etapas.map((e, i) => {
        const pasada = indice > i || actual === "cerrado";
        const activa = e === actual;
        return (
          <li key={e} className="flex min-w-[5.5rem] flex-1 flex-col gap-1.5">
            <span
              className={cn(
                "h-1.5 rounded-full",
                activa ? "bg-silver-bright" : pasada ? "bg-silver-dim" : "bg-surface-3",
              )}
            />
            <span className={cn("text-[10px] leading-tight", activa ? "font-semibold text-ink" : pasada ? "text-ink-3" : "text-ink-4")}>
              {nombres === "equipo" ? nombreEtapaEquipo(e) : nombreEtapaCliente(e)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
