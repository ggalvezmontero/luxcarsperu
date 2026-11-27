"use client";

/** Lista de cotizaciones con su estado efectivo (una enviada con la vigencia pasada se ve vencida). */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Badge, EmptyState, Notice, PortalPageHeader, StatCard, StatGrid, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import { usePortalSession } from "@/components/portal/portalSession";
import { estadoEfectivo, usd } from "@/core/cotizaciones";
import { listarCotizaciones, type Cotizacion } from "@/lib/cotizaciones/consultas";
import { ESTADO_COTIZACION_LABEL, ESTADO_COTIZACION_TONE, hoyLimaIso } from "@/lib/cotizaciones/formato";
import { fecha } from "@/lib/expedientes/formato";

export function CotizacionesScreen() {
  const { status, client } = usePortalSession();
  const [lista, setLista] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "verificando" || !client) return;
    let cancelado = false;
    void listarCotizaciones(client).then((r) => {
      if (cancelado) return;
      setLista(r.cotizaciones);
      setError(r.error);
      setLoading(false);
    });
    return () => {
      cancelado = true;
    };
  }, [client, status]);

  const hoy = hoyLimaIso();
  const conEstado = useMemo(() => lista.map((q) => ({ q, estado: estadoEfectivo(q.estado, q.venceEl, hoy) })), [lista, hoy]);
  const cuenta = (e: string) => conEstado.filter((x) => x.estado === e).length;

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Cotizaciones"
        title="Cotizaciones de importación"
        description="Importación a pedido: el cliente ve el costo puesto en Lima de cada auto y los cinco pagos. Al aceptarla se abre el expediente."
        actions={<Button href="/portal/cotizaciones/nueva" size="sm">Nueva cotización</Button>}
      />
      <StatGrid>
        <StatCard label="Borradores" value={cuenta("borrador")} />
        <StatCard label="Enviadas vigentes" value={cuenta("enviada")} tone="accent" />
        <StatCard label="Aceptadas" value={cuenta("aceptada")} tone="ok" />
        <StatCard label="Vencidas" value={cuenta("vencida")} tone={cuenta("vencida") > 0 ? "warn" : "default"} />
      </StatGrid>
      {error ? <Notice tone="warn" label="No se pudo leer">{error}</Notice> : null}
      {loading && (status === "verificando" || client) ? (
        <p className="py-10 text-sm text-ink-3">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="rounded-lux-lg border border-line bg-surface">
          <EmptyState title="Ninguna cotización" description="Crea la primera con el botón Nueva cotización." />
        </div>
      ) : (
        <div className="rounded-lux-lg border border-line bg-surface">
          <TableScroll>
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Código</Th>
                  <Th>Cliente</Th>
                  <Th>Autos</Th>
                  <Th align="right">Total</Th>
                  <Th>Estado</Th>
                  <Th>Fecha</Th>
                </tr>
              </thead>
              <tbody>
                {conEstado.map(({ q, estado }) => (
                  <tr key={q.id} className="border-t border-line">
                    <Td>
                      <Link href={`/portal/cotizaciones/${q.id}`} className="font-mono text-xs text-silver hover:text-ink">{q.codigo}</Link>
                    </Td>
                    <Td className="text-ink">{q.cliente.nombre}</Td>
                    <Td>{q.datos.autos.map((a) => `${a.marca} ${a.modelo}`).join(" · ")}</Td>
                    <Td align="right" className="tabular-nums">{q.totalUsd !== null ? usd(q.totalUsd) : "—"}</Td>
                    <Td>
                      <Badge tone={ESTADO_COTIZACION_TONE[estado]}>{ESTADO_COTIZACION_LABEL[estado]}</Badge>
                      {estado === "enviada" && q.venceEl ? <span className="ml-2 text-xs text-ink-4">vence {fecha(q.venceEl)}</span> : null}
                    </Td>
                    <Td className="text-xs text-ink-4">{fecha(q.fecha)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      )}
    </div>
  );
}
