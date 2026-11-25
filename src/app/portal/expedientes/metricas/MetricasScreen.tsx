"use client";

/**
 * Métricas de expedientes: cuántos por mes y por etapa, cuánto dura cada
 * etapa, cuánto dinero hay en custodia, qué hitos están vencidos y qué autos
 * llegan pronto. Los cálculos viven en `src/core/expedientes/metricas.ts`;
 * acá solo se leen los datos (Data API, sesión del administrador) y se pintan
 * con barras CSS sobre los tokens del sistema. Sin librerías de gráficos.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Notice, PortalPageHeader, PortalPanel, StatCard, StatGrid, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import { EtapaBadge } from "@/components/portal/expedientes/Piezas";
import { usePortalSession } from "@/components/portal/portalSession";
import { nombreEtapaEquipo } from "@/core/expedientes/etapas";
import {
  dineroEnCustodia,
  duracionPorEtapa,
  expedientesPorEtapa,
  expedientesPorMes,
  hitosVencidos,
  proximosArribos,
} from "@/core/expedientes/metricas";
import { cargarDatosMetricas, type DatosMetricas } from "@/lib/expedientes/consultas";
import { HITO_LABEL, fecha, usd } from "@/lib/expedientes/formato";
import { SubNavExpedientes } from "../SubNav";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiquetaMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1] ?? mes} ${String(a).slice(2)}`;
}

/** Barra horizontal proporcional al máximo del grupo. `tono` elige el token. */
function Barra({ valor, maximo, tono = "silver", etiqueta }: { valor: number; maximo: number; tono?: "silver" | "ok" | "danger" | "warn"; etiqueta?: string }) {
  const ancho = maximo > 0 ? Math.max(valor > 0 ? 2 : 0, (valor / maximo) * 100) : 0;
  const color = tono === "ok" ? "bg-ok" : tono === "danger" ? "bg-danger" : tono === "warn" ? "bg-warn" : "bg-silver";
  return (
    <div className="flex items-center gap-2" title={etiqueta}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${ancho}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink-2">{valor}</span>
    </div>
  );
}

export function MetricasScreen() {
  const { status: sessionStatus, client } = usePortalSession();
  const [datos, setDatos] = useState<DatosMetricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = await cargarDatosMetricas(client);
    setDatos(r.datos);
    setError(r.error);
    setLoading(false);
  }, [client, canQuery]);

  useEffect(() => {
    if (sessionStatus === "verificando") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load, sessionStatus]);

  const hoy = useMemo(() => new Date(), []);
  const calculo = useMemo(() => {
    if (!datos) return null;
    const porMes = expedientesPorMes(datos.expedientes).slice(-12);
    return {
      porMes,
      porEtapa: expedientesPorEtapa(datos.expedientes).filter((f) => f.etapa !== "cerrado" && f.etapa !== "cancelado"),
      duracion: duracionPorEtapa(datos.etapas, hoy),
      custodia: dineroEnCustodia(datos.expedientes, datos.movimientosPorExpediente),
      vencidos: hitosVencidos(datos.expedientes, datos.hitosPorExpediente, datos.movimientosPorExpediente, hoy),
      arribos: proximosArribos(datos.expedientes, hoy, 5),
      activos: datos.expedientes.filter((e) => e.etapa !== "cerrado" && e.etapa !== "cancelado").length,
      cerrados: datos.expedientes.filter((e) => e.etapa === "cerrado").length,
      cancelados: datos.expedientes.filter((e) => e.etapa === "cancelado").length,
    };
  }, [datos, hoy]);

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Expedientes · Métricas"
        title="Números del negocio"
        description="Expedientes por mes y por etapa, días que toma cada etapa, dinero de clientes en custodia, hitos vencidos y próximos arribos. Todo calculado al leer; nada se guarda."
      />

      <SubNavExpedientes />

      {error ? <Notice tone="warn" label="No se pudo leer">{error}</Notice> : null}

      {loading ? (
        <p className="py-10 text-sm text-ink-3">Cargando…</p>
      ) : !calculo || datos?.expedientes.length === 0 ? (
        <div className="rounded-lux-lg border border-line bg-surface">
          <EmptyState title="Todavía no hay expedientes" description="Las métricas aparecen con el primer expediente abierto." />
        </div>
      ) : (
        <>
          <StatGrid>
            <StatCard label="Activos" value={calculo.activos} hint={`${calculo.cerrados} cerrados · ${calculo.cancelados} cancelados.`} />
            <StatCard label="En custodia (USD)" value={usd(calculo.custodia.totalUsd)} hint="Saldo de Fondos de Clientes en expedientes activos." tone="accent" />
            <StatCard label="Depósitos por confirmar" value={calculo.custodia.porConfirmar} tone={calculo.custodia.porConfirmar > 0 ? "warn" : "default"} hint={calculo.custodia.porConfirmar > 0 ? `USD ${usd(calculo.custodia.porConfirmarUsd)} declarados por clientes.` : "Nada declarado sin confirmar."} />
            <StatCard label="Hitos vencidos" value={calculo.vencidos.length} tone={calculo.vencidos.length > 0 ? "danger" : "default"} hint={calculo.vencidos.length > 0 ? `Falta USD ${usd(calculo.vencidos.reduce((s, v) => s + v.faltaUsd, 0))}.` : "Ningún pago del cliente fuera de fecha."} />
          </StatGrid>

          <div className="grid gap-6 lg:grid-cols-2">
            <PortalPanel title="Expedientes por mes" description="Abiertos por fecha de alta; cerrados y cancelados por fecha de cierre. Últimos doce meses con movimiento.">
              <div className="space-y-3 px-5 py-4">
                {calculo.porMes.length === 0 ? (
                  <p className="text-sm text-ink-4">Sin datos.</p>
                ) : (
                  (() => {
                    const max = Math.max(1, ...calculo.porMes.flatMap((f) => [f.abiertos, f.cerrados, f.cancelados]));
                    return calculo.porMes.map((f) => (
                      <div key={f.mes} className="grid grid-cols-[3.5rem_1fr] items-center gap-3">
                        <span className="text-xs uppercase tracking-[0.12em] text-ink-4">{etiquetaMes(f.mes)}</span>
                        <div className="space-y-1">
                          <Barra valor={f.abiertos} maximo={max} etiqueta="Abiertos" />
                          <Barra valor={f.cerrados} maximo={max} tono="ok" etiqueta="Cerrados" />
                          {f.cancelados > 0 ? <Barra valor={f.cancelados} maximo={max} tono="danger" etiqueta="Cancelados" /> : null}
                        </div>
                      </div>
                    ));
                  })()
                )}
                <p className="flex gap-4 pt-2 text-[11px] text-ink-4">
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-silver" />Abiertos</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-ok" />Cerrados</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-danger" />Cancelados</span>
                </p>
              </div>
            </PortalPanel>

            <PortalPanel title="Activos por etapa" description="Dónde está cada expediente hoy.">
              <div className="space-y-2 px-5 py-4">
                {(() => {
                  const max = Math.max(1, ...calculo.porEtapa.map((f) => f.cantidad));
                  return calculo.porEtapa.map((f) => (
                    <div key={f.etapa} className="grid grid-cols-[9rem_1fr] items-center gap-3">
                      <span className="truncate text-xs text-ink-2">{nombreEtapaEquipo(f.etapa)}</span>
                      <Barra valor={f.cantidad} maximo={max} />
                    </div>
                  ));
                })()}
              </div>
            </PortalPanel>
          </div>

          <PortalPanel title="Días por etapa" description="Desde el historial de etapas. La etapa en curso cuenta hasta hoy, así una demora se ve antes de cerrarse.">
            <TableScroll>
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="border-b border-line">
                  <tr>
                    <Th>Etapa</Th>
                    <Th align="right">Tramos</Th>
                    <Th align="right">Promedio</Th>
                    <Th align="right">Mediana</Th>
                    <Th align="right">Máximo</Th>
                    <Th>Comparación</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(() => {
                    const max = Math.max(1, ...calculo.duracion.map((d) => d.promedioDias ?? 0));
                    return calculo.duracion.map((d) => (
                      <tr key={d.etapa}>
                        <Td>{nombreEtapaEquipo(d.etapa)}</Td>
                        <Td align="right"><span className="tabular-nums">{d.tramos}</span></Td>
                        <Td align="right"><span className="tabular-nums text-ink">{d.promedioDias ?? "—"}</span></Td>
                        <Td align="right"><span className="tabular-nums">{d.medianaDias ?? "—"}</span></Td>
                        <Td align="right"><span className="tabular-nums">{d.maxDias ?? "—"}</span></Td>
                        <Td>
                          <div className="min-w-40">
                            <Barra valor={Math.round(d.promedioDias ?? 0)} maximo={max} />
                          </div>
                        </Td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </TableScroll>
          </PortalPanel>

          <div className="grid gap-6 lg:grid-cols-2">
            <PortalPanel title="Dinero en custodia por expediente" description="Saldo de Fondos de Clientes (depósitos confirmados menos pagos y devoluciones).">
              {calculo.custodia.filas.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-4">Sin expedientes activos.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {calculo.custodia.filas.map((f) => (
                    <li key={f.expediente.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <Link href={`/portal/expedientes/${f.expediente.id}`} className="font-mono text-xs text-silver hover:underline">{f.expediente.codigo}</Link>
                        <p className="truncate text-sm text-ink">{f.expediente.auto}</p>
                        <p className="truncate text-xs text-ink-4">{f.expediente.clienteNombre ?? "Sin cliente"}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold tabular-nums ${f.saldoUsd < 0 ? "text-danger" : "text-ink"}`}>{usd(f.saldoUsd, 2)}</p>
                        {f.porConfirmar > 0 ? <p className="text-xs text-warn">+{usd(f.porConfirmarUsd)} por confirmar</p> : null}
                      </div>
                    </li>
                  ))}
                  <li className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-ink-3">Total en custodia</span>
                    <span className="font-semibold tabular-nums text-ink">{usd(calculo.custodia.totalUsd, 2)}</span>
                  </li>
                </ul>
              )}
              {calculo.custodia.fueraDeActivos.length > 0 ? (
                <div className="border-t border-line px-5 py-3">
                  <Notice tone="warn" label="Cerrados con saldo">
                    {calculo.custodia.fueraDeActivos.map((f) => `${f.expediente.codigo} (${usd(f.saldoUsd, 2)})`).join(", ")}. Un expediente cerrado o cancelado debería rendir a cero.
                  </Notice>
                </div>
              ) : null}
            </PortalPanel>

            <div className="space-y-6">
              <PortalPanel title="Hitos vencidos" description="Pagos del cliente con fecha límite pasada y monto sin acreditar.">
                {calculo.vencidos.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-ink-4">Nada vencido.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {calculo.vencidos.map((v) => (
                      <li key={`${v.expediente.id}-${v.hito.tipo}`} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <Link href={`/portal/expedientes/${v.expediente.id}`} className="font-mono text-xs text-silver hover:underline">{v.expediente.codigo}</Link>
                          <p className="text-sm text-ink">{HITO_LABEL[v.hito.tipo]} · venció el {fecha(v.hito.fechaLimite)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums text-danger">{usd(v.faltaUsd)}</p>
                          <p className="text-xs text-ink-4">{v.diasVencido} día{v.diasVencido === 1 ? "" : "s"}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </PortalPanel>

              <PortalPanel title="Próximos arribos" description="Fecha estimada de arribo al Callao de los expedientes activos.">
                {calculo.arribos.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-ink-4">Ningún arribo estimado por delante.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {calculo.arribos.map((a) => (
                      <li key={a.expediente.id} className="flex items-center justify-between gap-3 px-5 py-3">
                        <div className="min-w-0">
                          <Link href={`/portal/expedientes/${a.expediente.id}`} className="font-mono text-xs text-silver hover:underline">{a.expediente.codigo}</Link>
                          <p className="truncate text-sm text-ink">{a.expediente.auto}</p>
                          <div className="mt-1"><EtapaBadge etapa={a.expediente.etapa} /></div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-ink">{fecha(a.fecha)}</p>
                          <p className="text-xs text-ink-4">{a.enDias === 0 ? "hoy" : `en ${a.enDias} día${a.enDias === 1 ? "" : "s"}`}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </PortalPanel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
