"use client";

/**
 * Tarjetas de "Mis importaciones" en /cuenta: una por expediente del cliente,
 * con el auto, la etapa, la próxima fecha y un aviso si hay algo pendiente de
 * él. Lee la vista `expediente_cliente` con su sesión (ver
 * `src/lib/cuenta/expedientes.ts`). Si no tiene expedientes, no pinta nada.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { nombreEtapaCliente } from "@/core/expedientes/etapas";
import { fetchMisImportaciones, type ResumenImportacion } from "@/lib/cuenta/expedientes";
import { autoDe, fecha, hoyIso } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";

export function MisImportaciones({ client }: { client: PortalClient }) {
  const [lista, setLista] = useState<ResumenImportacion[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMisImportaciones(client).then((r) => {
      if (cancelled) return;
      setLista(r.data);
      setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (error || !lista || lista.length === 0) return null;
  const hoy = hoyIso();

  return (
    <section className="mt-10" aria-labelledby="mis-importaciones">
      <h2 id="mis-importaciones" className="text-lg font-semibold text-ink">Mis importaciones</h2>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {lista.map(({ expediente: e, pendientes, hitos }) => {
          const proxima = hitos
            .map((h) => h.fechaLimite)
            .filter((f): f is string => Boolean(f) && (f as string) >= hoy)
            .sort()[0] ?? e.fechaEstArribo ?? e.fechaEstEntrega;
          return (
            <li key={e.id}>
              <Link href={`/cuenta/importaciones/${e.codigo}`} className="group block h-full rounded-[22px] border border-line bg-surface p-5 transition-colors hover:border-line-strong">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-silver">{e.codigo}</p>
                    <p className="mt-1 font-semibold text-ink">{autoDe(e.vehiculo)}</p>
                  </div>
                  <Badge tone={e.etapa === "cancelado" ? "danger" : e.etapa === "cerrado" ? "ok" : "info"} dot>
                    {nombreEtapaCliente(e.etapa)}
                  </Badge>
                </div>
                {pendientes.length > 0 ? (
                  <p className="mt-3 rounded-2xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-ink-2">
                    <span className="font-semibold text-ink">Necesitamos algo de ti:</span> {pendientes[0].titulo}
                    {pendientes.length > 1 ? ` y ${pendientes.length - 1} más` : ""}
                  </p>
                ) : null}
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-ink-3">{proxima ? `Próxima fecha: ${fecha(proxima)}` : "Sin fechas programadas"}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-ink">
                    Ver avance
                    <Icon name="arrowRight" size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
