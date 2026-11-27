"use client";

/**
 * "Mis cotizaciones" en /cuenta: las cotizaciones enviadas al cliente (vista
 * `cotizacion_cliente`, filtra por su ficha vinculada o por el correo de su
 * cuenta), con el PDF para bajar por `/api/cuenta/cotizaciones/[id]`. Si no
 * tiene ninguna, no pinta nada.
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { estadoEfectivo, usd, type EstadoCotizacion } from "@/core/cotizaciones";
import { fecha, hoyIso } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";

type Fila = { id: string; codigo: string; estado: EstadoCotizacion; fecha: string; vence_el: string | null; total_usd: number | string | null };

const ETIQUETA: Record<EstadoCotizacion, string> = {
  borrador: "Borrador",
  enviada: "Vigente",
  aceptada: "Aceptada",
  rechazada: "No aceptada",
  vencida: "Vencida",
};

export function MisCotizaciones({ client }: { client: PortalClient }) {
  const [lista, setLista] = useState<Fila[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await client
          .from("cotizacion_cliente")
          .select("id, codigo, estado, fecha, vence_el, total_usd")
          .order("created_at", { ascending: false })
          .limit(20);
        if (!cancelled) setLista(error ? [] : ((data ?? []) as unknown as Fila[]));
      } catch {
        if (!cancelled) setLista([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (!lista || lista.length === 0) return null;
  const hoy = hoyIso();

  return (
    <section className="mt-10" aria-labelledby="mis-cotizaciones">
      <h2 id="mis-cotizaciones" className="text-lg font-semibold text-ink">Mis cotizaciones</h2>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {lista.map((q) => {
          const estado = estadoEfectivo(q.estado, q.vence_el, hoy);
          return (
            <li key={q.id} className="rounded-[22px] border border-line bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-silver">{q.codigo}</p>
                  <p className="mt-1 font-semibold text-ink">{q.total_usd !== null ? usd(Number(q.total_usd)) : "Cotización"}</p>
                </div>
                <Badge tone={estado === "aceptada" ? "ok" : estado === "enviada" ? "info" : "neutral"} dot>{ETIQUETA[estado]}</Badge>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-ink-3">{estado === "enviada" && q.vence_el ? `Vale hasta el ${fecha(q.vence_el)}` : `Del ${fecha(q.fecha)}`}</span>
                <a href={`/api/cuenta/cotizaciones/${q.id}`} className="font-semibold text-ink hover:text-silver">Descargar PDF</a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
