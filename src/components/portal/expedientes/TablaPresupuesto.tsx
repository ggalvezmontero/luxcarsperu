/**
 * Líneas del Anexo B y los cuatro hitos, tal como los devuelve `presupuestar()`.
 */

import { PortalPanel, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import type { Presupuesto } from "@/core/expedientes/tipos";
import { HITO_LABEL, usd } from "@/lib/expedientes/formato";
import { cn } from "@/lib/utils";

export function TablaPresupuesto({ presupuesto: p }: { presupuesto: Presupuesto }) {
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <PortalPanel title="Presupuesto (Anexo B)" description={`Motor ${p.motorVersion}.`}>
          <TableScroll>
            <table className="w-full border-collapse">
              <thead className="border-b border-line">
                <tr>
                  <Th>Concepto</Th>
                  <Th align="right">USD</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {p.lineas.map((l) => {
                  const total = l.clave === "total" || l.clave === "total_con_percepcion";
                  const informativa = l.grupo === "informativo" && !total;
                  return (
                    <tr key={l.clave} className={cn(total ? "bg-surface-2" : "")}>
                      <Td className={cn(informativa ? "text-ink-4" : "")}>
                        <span className={cn(total ? "font-semibold text-ink" : "")}>{l.concepto}</span>
                        {l.detalle ? <span className="block text-xs text-ink-4">{l.detalle}</span> : null}
                      </Td>
                      <Td align="right" className={cn("tabular-nums", total ? "font-semibold text-ink" : informativa ? "text-ink-4" : "")}>
                        {usd(l.montoUsd)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </PortalPanel>
      </div>
      <div className="lg:col-span-2">
        <PortalPanel title="Hitos de pago" description="Lo que el cliente deposita y cuándo.">
          <ul className="divide-y divide-line">
            {p.hitos.map((h) => (
              <li key={h.tipo} className="flex items-start justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{HITO_LABEL[h.tipo]}</p>
                  <p className="text-xs text-ink-4">{h.descripcion}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{usd(h.montoUsd)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3 text-xs text-ink-3">
            Honorarios {usd(p.honorarios)} (base {usd(p.honorariosBase)} + IGV {usd(p.honorariosIgv)}) · tasa efectiva {(p.tasas.honorariosTasaEfectiva * 100).toFixed(1)} %
          </div>
        </PortalPanel>
      </div>
    </div>
  );
}
