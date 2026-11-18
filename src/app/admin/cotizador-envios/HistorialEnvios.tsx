"use client";

import { Badge, EmptyState, PortalPanel, TableScroll, Td, Th, type BadgeTone } from "@/components/portal/CrmUI";
import { Button } from "@/components/Button";
import { formatCurrency } from "@/lib/utils";

import type { CotizacionEnvioResumen, EstadoCotizacionEnvio } from "./api";
import { ESTADOS_LABEL, ESTADOS_ORDEN } from "./api";

const TONO: Record<EstadoCotizacionEnvio, BadgeTone> = {
  borrador: "neutral",
  enviada: "info",
  aceptada: "ok",
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
  onAbrir: (id: string) => void;
  onCambiarEstado: (id: string, estado: EstadoCotizacionEnvio) => void;
  onRecargar: () => void;
};

export function HistorialEnvios({ cotizaciones, cargando, error, onAbrir, onCambiarEstado, onRecargar }: Props) {
  return (
    <PortalPanel
      title="Historial"
      description="Cada cotización guardada, con su estado. Abrir una la carga en el formulario."
      toolbar={
        <Button onClick={onRecargar} variant="ghost" size="sm" disabled={cargando}>
          {cargando ? "Cargando…" : "Actualizar"}
        </Button>
      }
    >
      {error ? (
        <p className="px-5 py-4 text-sm text-warn">{error}</p>
      ) : cotizaciones.length === 0 ? (
        <EmptyState title={cargando ? "Cargando…" : "Todavía no hay cotizaciones guardadas"} description="Completa el formulario y pulsa Guardar: la cotización aparecerá acá con fecha, cliente y estado." />
      ) : (
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
              {cotizaciones.map((c) => (
                <tr key={c.id}>
                  <Td className="font-mono text-xs text-ink">{c.numero}</Td>
                  <Td className="whitespace-nowrap">{fecha(c.createdAt)}</Td>
                  <Td>
                    <span className="block text-ink">{c.clienteNombre}</span>
                    <span className="block text-xs text-ink-4">{c.clienteWhatsapp}</span>
                  </Td>
                  <Td>{`${c.marca} ${c.modelo} ${c.anioModelo}`}</Td>
                  <Td>{REGIMEN_CORTO[c.regimen]}</Td>
                  <Td align="right" className="tabular-nums text-ink">{formatCurrency(c.totalUsd)}</Td>
                  <Td>
                    <label className="flex items-center gap-2">
                      <Badge tone={TONO[c.estado]}>{ESTADOS_LABEL[c.estado]}</Badge>
                      <select
                        aria-label={`Estado de ${c.numero}`}
                        value={c.estado}
                        onChange={(e) => onCambiarEstado(c.id, e.target.value as EstadoCotizacionEnvio)}
                        className="field-lux !min-h-8 !w-auto !py-1 !pl-2 !text-xs"
                      >
                        {ESTADOS_ORDEN.map((e) => (
                          <option key={e} value={e}>{ESTADOS_LABEL[e]}</option>
                        ))}
                      </select>
                    </label>
                  </Td>
                  <Td>
                    <Button onClick={() => onAbrir(c.id)} variant="secondary" size="sm">
                      Abrir
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </PortalPanel>
  );
}
