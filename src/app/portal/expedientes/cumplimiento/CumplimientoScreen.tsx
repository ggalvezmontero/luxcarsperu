"use client";

/**
 * Cumplimiento: vista previa y descarga del Registro de Operaciones para la
 * UIF. Las reglas (qué operación supera el umbral individual, cuáles suman el
 * acumulado del mes por cliente) están en `src/core/expedientes/uif.ts`; la
 * ruta `/api/portal/expedientes/uif` las aplica sobre el libro y entrega el
 * CSV. Esta pantalla solo elige el rango y muestra lo que saldría.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { EmptyState, Notice, PortalPageHeader, PortalPanel, StatCard, StatGrid, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import { Campo, Entrada } from "@/components/portal/expedientes/Formulario";
import { usePortalSession } from "@/components/portal/portalSession";
import { cargarPreviaUif, urlDescargaUif, type PreviaUif } from "@/lib/expedientes/consultas";
import { fecha, hoyIso, usd } from "@/lib/expedientes/formato";
import { SubNavExpedientes } from "../SubNav";

function primerDiaDelMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function CumplimientoScreen() {
  const { status: sessionStatus } = usePortalSession();
  const [desde, setDesde] = useState(() => primerDiaDelMes(hoyIso()));
  const [hasta, setHasta] = useState(() => hoyIso());
  const [previa, setPrevia] = useState<PreviaUif | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canQuery = sessionStatus === "autenticado";

  const consultar = useCallback(async () => {
    if (!canQuery) return;
    if (desde > hasta) return setError("La fecha inicial es posterior a la final.");
    setLoading(true);
    setError(null);
    const r = await cargarPreviaUif(desde, hasta);
    setPrevia(r.previa);
    setError(r.error);
    setLoading(false);
  }, [canQuery, desde, hasta]);

  useEffect(() => {
    if (sessionStatus !== "autenticado") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void consultar();
    });
    return () => {
      cancelled = true;
    };
    // Solo al entrar: después se consulta con el botón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  const filas = previa?.filas ?? [];
  const totalUsd = filas.reduce((s, f) => s + f.monto_usd, 0);
  const individuales = filas.filter((f) => f.motivo_registro.startsWith("Individual")).length;
  const clientes = new Set(filas.map((f) => f.cliente_documento || f.cliente_nombre)).size;

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Expedientes · Cumplimiento"
        title="Registro de operaciones (UIF)"
        description="Operaciones del libro de los expedientes que superan los umbrales de la Ley 27693: individuales desde USD 10,000 y las múltiples de un mismo cliente que suman USD 50,000 en el mes. Se exporta para llenar el Registro de Operaciones."
      />

      <SubNavExpedientes />

      <PortalPanel title="Rango de fechas" description="Por fecha de la operación (la del depósito o del pago). El acumulado mensual se calcula con el mes completo aunque el rango lo recorte.">
        <form
          className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void consultar();
          }}
        >
          <Campo label="Desde">
            <Entrada type="date" value={desde} onChange={(e) => setDesde(e.target.value)} required />
          </Campo>
          <Campo label="Hasta">
            <Entrada type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required />
          </Campo>
          <Button type="submit" size="sm" disabled={loading || !canQuery}>{loading ? "Consultando…" : "Consultar"}</Button>
          {filas.length > 0 ? (
            <Button href={urlDescargaUif(desde, hasta)} size="sm" variant="secondary">
              Descargar CSV ({filas.length})
            </Button>
          ) : null}
        </form>
      </PortalPanel>

      {error ? <Notice tone="warn" label="No se pudo leer">{error}</Notice> : null}

      <StatGrid>
        <StatCard label="Operaciones reportables" value={filas.length} hint={previa ? `Del ${fecha(previa.desde)} al ${fecha(previa.hasta)}.` : undefined} />
        <StatCard label="Individuales ≥ umbral" value={individuales} hint={previa ? `Umbral USD ${usd(previa.umbrales.individualUsd)}.` : undefined} />
        <StatCard label="Por acumulado del mes" value={filas.length - individuales} hint={previa ? `Clientes con ≥ USD ${usd(previa.umbrales.acumuladoMensualUsd)} en el mes.` : undefined} />
        <StatCard label="Total USD" value={usd(totalUsd)} hint={`${clientes} cliente${clientes === 1 ? "" : "s"}.`} />
      </StatGrid>

      <PortalPanel title="Vista previa" description="Las mismas columnas que el archivo. Los ajustes contables, los depósitos sin confirmar y los anulados no cuentan.">
        {loading ? (
          <p className="px-5 py-10 text-sm text-ink-3">Consultando…</p>
        ) : filas.length === 0 ? (
          <EmptyState title="Sin operaciones reportables en el rango" description={previa ? "Ninguna operación confirmada supera los umbrales en estas fechas." : "Elige el rango y consulta."} />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead className="border-b border-line">
                <tr>
                  <Th>Fecha</Th>
                  <Th>Expediente</Th>
                  <Th>Operación</Th>
                  <Th>Cliente</Th>
                  <Th>Contraparte</Th>
                  <Th>Referencia</Th>
                  <Th align="right">Monto</Th>
                  <Th align="right">USD</Th>
                  <Th>Motivo</Th>
                  <Th>Registró</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filas.map((f, i) => (
                  <tr key={`${f.expediente}-${f.fecha}-${i}`} className="align-top">
                    <Td><span className="tabular-nums">{fecha(f.fecha)}</span></Td>
                    <Td><span className="font-mono text-xs text-silver">{f.expediente}</span></Td>
                    <Td>
                      <p className="text-ink">{f.tipo_operacion}</p>
                      <p className="text-xs text-ink-4">{f.origen} · {f.cuenta}</p>
                    </Td>
                    <Td>
                      <p className="text-ink">{f.cliente_nombre || "—"}</p>
                      <p className="text-xs text-ink-4">{[f.cliente_tipo, f.cliente_documento].filter(Boolean).join(" · ")}</p>
                    </Td>
                    <Td>{f.contraparte || "—"}</Td>
                    <Td>
                      <p>{f.referencia_documental || "—"}</p>
                      {f.concepto ? <p className="text-xs text-ink-4">{f.concepto}</p> : null}
                    </Td>
                    <Td align="right"><span className="tabular-nums">{f.moneda} {f.monto.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span></Td>
                    <Td align="right"><span className="font-semibold tabular-nums text-ink">{usd(f.monto_usd, 2)}</span></Td>
                    <Td>
                      <p className="text-xs">{f.motivo_registro}</p>
                      <p className="text-xs text-ink-4">Mes: {usd(f.acumulado_mes_usd)}</p>
                    </Td>
                    <Td><span className="text-xs text-ink-3">{f.registrado_por || "—"}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </PortalPanel>

      <Notice tone="info" label="Recordatorio">
        El Registro de Operaciones se lleva en el plazo que fija la norma vigente de la SBS para los sujetos obligados y se conserva a disposición de la UIF. Este archivo sirve para llenarlo; no es el registro ni la declaración. Decidir si una operación es inusual o sospechosa, y presentar el ROS, es tarea del oficial de cumplimiento, no del sistema. Los umbrales están parametrizados: si la norma cambia, se ajustan en el core sin tocar los datos.
      </Notice>
    </div>
  );
}
