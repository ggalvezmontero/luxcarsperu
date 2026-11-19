"use client";

import { Badge, EmptyState, PortalPanel, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import { Button } from "@/components/Button";
import { Icon } from "@/components/ui/Icon";
import { cn, formatCurrency } from "@/lib/utils";

import type { CotizacionEnvioResumen, EstadoCotizacionEnvio } from "./api";
import { ESTADOS_LABEL, ESTADOS_ORDEN } from "./api";

/** El color del estado va en el propio selector: un control, no dos. */
const CLASE_ESTADO: Record<EstadoCotizacionEnvio, string> = {
  borrador: "text-ink-2",
  enviada: "!border-info/35 text-info",
  aceptada: "!border-ok/35 text-ok",
};

const REGIMEN_CORTO = {
  "ley-retorno": "Retorno",
  "importacion-regular": "Regular",
} as const;

function fecha(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Lima" }).format(d);
}

type Props = {
  cotizaciones: CotizacionEnvioResumen[];
  cargando: boolean;
  error: string | null;
  /** Id de la cotización cargada en el formulario, para resaltarla. */
  abiertaId: string | null;
  /** Id cuyo PDF se está generando, para el estado del botón. */
  pdfDe: string | null;
  onAbrir: (id: string) => void;
  onPdf: (id: string) => void;
  onCambiarEstado: (id: string, estado: EstadoCotizacionEnvio) => void;
  onRecargar: () => void;
};

export function HistorialEnvios({ cotizaciones, cargando, error, abiertaId, pdfDe, onAbrir, onPdf, onCambiarEstado, onRecargar }: Props) {
  return (
    <PortalPanel
      title="Historial"
      description="Abrir carga la cotización en el formulario para corregirla; el PDF sale tal como se guardó."
      toolbar={
        <Button onClick={onRecargar} variant="ghost" size="sm" disabled={cargando}>
          <Icon name="refresh" size={14} />
          {cargando ? "Cargando…" : "Actualizar"}
        </Button>
      }
    >
      {error ? (
        <p className="px-5 py-4 text-sm text-warn">{error}</p>
      ) : cotizaciones.length === 0 ? (
        <EmptyState title={cargando ? "Cargando…" : "Todavía no hay cotizaciones guardadas"} description="Completa el formulario y pulsa Guardar: la cotización aparecerá acá con fecha, cliente y estado." />
      ) : (
        <>
          {/* Tarjetas en pantallas angostas: una tabla de ocho columnas no cabe. */}
          <ul className="divide-y divide-line md:hidden">
            {cotizaciones.map((c) => {
              const abierta = c.id === abiertaId;
              return (
                <li key={c.id} className={cn("flex flex-col gap-3 px-5 py-4", abierta && "bg-surface-2")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-ink">
                        {c.numero}
                        {abierta ? <Badge tone="silver">Abierta</Badge> : null}
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-ink">{c.clienteNombre}</p>
                      <p className="text-sm text-ink-2">{`${c.marca} ${c.modelo} ${c.anioModelo}`}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-ink">{formatCurrency(c.totalUsd)}</p>
                      <p className="mt-1 text-xs text-ink-4">{REGIMEN_CORTO[c.regimen]} · {fecha(c.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SelectorEstado c={c} onCambiarEstado={onCambiarEstado} />
                    <Acciones c={c} pdfDe={pdfDe} onAbrir={onAbrir} onPdf={onPdf} />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden md:block">
            <TableScroll>
              <table className="w-full">
                <thead className="border-b border-line">
                  <tr>
                    <Th>Número</Th>
                    <Th>Fecha</Th>
                    <Th>Cliente</Th>
                    <Th>Vehículo</Th>
                    <Th>Régimen</Th>
                    <Th align="right">Total</Th>
                    <Th>Estado</Th>
                    <Th>
                      <span className="sr-only">Acciones</span>
                    </Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {cotizaciones.map((c) => {
                    const abierta = c.id === abiertaId;
                    return (
                      <tr key={c.id} className={cn(abierta && "bg-surface-2")}>
                        <Td className="font-mono text-xs text-ink">
                          {c.numero}
                          {abierta ? <span className="mt-1 block"><Badge tone="silver">Abierta</Badge></span> : null}
                        </Td>
                        <Td className="whitespace-nowrap">{fecha(c.createdAt)}</Td>
                        <Td>
                          <span className="block text-ink">{c.clienteNombre}</span>
                          <span className="block text-xs text-ink-4">{c.clienteWhatsapp}</span>
                        </Td>
                        <Td>{`${c.marca} ${c.modelo} ${c.anioModelo}`}</Td>
                        <Td>{REGIMEN_CORTO[c.regimen]}</Td>
                        <Td align="right" className="whitespace-nowrap tabular-nums text-ink">{formatCurrency(c.totalUsd)}</Td>
                        <Td>
                          <SelectorEstado c={c} onCambiarEstado={onCambiarEstado} />
                        </Td>
                        <Td>
                          <div className="flex justify-end gap-2">
                            <Acciones c={c} pdfDe={pdfDe} onAbrir={onAbrir} onPdf={onPdf} />
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          </div>
        </>
      )}
    </PortalPanel>
  );
}

function SelectorEstado({ c, onCambiarEstado }: { c: CotizacionEnvioResumen; onCambiarEstado: Props["onCambiarEstado"] }) {
  return (
    <select
      aria-label={`Estado de ${c.numero}`}
      value={c.estado}
      onChange={(e) => onCambiarEstado(c.id, e.target.value as EstadoCotizacionEnvio)}
      className={cn("field-lux !min-h-9 !w-auto !py-1 !pl-3 !pr-8 !text-xs font-semibold", CLASE_ESTADO[c.estado])}
    >
      {ESTADOS_ORDEN.map((e) => (
        <option key={e} value={e}>{ESTADOS_LABEL[e]}</option>
      ))}
    </select>
  );
}

function Acciones({ c, pdfDe, onAbrir, onPdf }: { c: CotizacionEnvioResumen; pdfDe: string | null; onAbrir: Props["onAbrir"]; onPdf: Props["onPdf"] }) {
  return (
    <>
      <Button onClick={() => onPdf(c.id)} variant="ghost" size="sm" disabled={pdfDe === c.id} aria-label={`PDF de ${c.numero}`}>
        <Icon name="download" size={14} />
        {pdfDe === c.id ? "Generando…" : "PDF"}
      </Button>
      <Button onClick={() => onAbrir(c.id)} variant="secondary" size="sm">
        Abrir
      </Button>
    </>
  );
}
