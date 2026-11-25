"use client";

/**
 * Tablero de expedientes: tarjetas agrupadas por etapa, con alertas del core,
 * filtro por etapa y búsqueda por código, VIN o cliente.
 *
 * Lee desde el navegador con la sesión del administrador (ver
 * `src/lib/expedientes/consultas.ts`). Las alertas se calculan acá con el
 * core; no se guardan.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { EmptyState, Notice, PortalPageHeader, StatCard, StatGrid } from "@/components/portal/CrmUI";
import { AlertasLista, EtapaBadge } from "@/components/portal/expedientes/Piezas";
import { Entrada, Selector } from "@/components/portal/expedientes/Formulario";
import { usePortalSession } from "@/components/portal/portalSession";
import { alertas as calcularAlertas } from "@/core/expedientes/alertas";
import { siguienteTarea } from "@/core/expedientes/avance";
import { nombreEtapaEquipo } from "@/core/expedientes/etapas";
import type { ContextoExpediente, EtapaExpediente } from "@/core/expedientes/tipos";
import { ETAPAS_ORDEN } from "@/core/expedientes/tipos";
import { listarExpedientes } from "@/lib/expedientes/consultas";
import { RESPONSABLE_LABEL, autoDe, diasDesde, fecha } from "@/lib/expedientes/formato";

const SETUP_STEPS = [
  "Aplica la migración 20261125090000_expedientes.sql (node scripts/aplicar-migracion.mjs …).",
  "Refresca la caché de esquema de la Data API (ver db/README.md).",
  "Abre el primer expediente con el botón Nuevo.",
];

type Fila = { ctx: ContextoExpediente; alertas: ReturnType<typeof calcularAlertas> };

export function ExpedientesScreen() {
  const { status: sessionStatus, client } = usePortalSession();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<EtapaExpediente | "todas">("todas");
  const [incluirCerrados, setIncluirCerrados] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setFilas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = await listarExpedientes(client, { incluirCerrados });
    const hoy = new Date();
    setFilas(r.expedientes.map((ctx) => ({ ctx, alertas: calcularAlertas(ctx, hoy) })));
    setError(r.error);
    setLoading(false);
  }, [client, canQuery, incluirCerrados]);

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

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter(({ ctx }) => {
      if (etapa !== "todas" && ctx.expediente.etapa !== etapa) return false;
      if (!q) return true;
      const e = ctx.expediente;
      const texto = [e.codigo, e.vehiculo.vin ?? "", autoDe(e.vehiculo), ctx.cliente?.razonSocial ?? "", ctx.cliente?.ruc ?? ""].join(" ").toLowerCase();
      return texto.includes(q);
    });
  }, [filas, etapa, busqueda]);

  const activos = filas.filter((f) => f.ctx.expediente.etapa !== "cerrado" && f.ctx.expediente.etapa !== "cancelado").length;
  const conAlertas = filas.filter((f) => f.alertas.some((a) => a.nivel === "alta")).length;
  const esperandoCliente = filas.filter((f) =>
    f.ctx.tareas.some((t) => t.estado === "pendiente" && t.responsable === "cliente" && t.etapa === f.ctx.expediente.etapa),
  ).length;

  const porEtapa = useMemo(() => {
    const grupos = new Map<EtapaExpediente, Fila[]>();
    for (const f of visibles) {
      const lista = grupos.get(f.ctx.expediente.etapa) ?? [];
      lista.push(f);
      grupos.set(f.ctx.expediente.etapa, lista);
    }
    const orden: EtapaExpediente[] = [...ETAPAS_ORDEN, "cancelado"];
    return orden.filter((e) => grupos.has(e)).map((e) => ({ etapa: e, filas: grupos.get(e)! }));
  }, [visibles]);

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Expedientes"
        title="Importaciones a pedido"
        description="Cada expediente es un auto, un cliente y un mandato. Se avanza etapa por etapa; el cliente sigue el suyo desde su cuenta."
        actions={<Button href="/portal/expedientes/nuevo" size="sm">Nuevo expediente</Button>}
      />

      <StatGrid>
        <StatCard label="Activos" value={activos} hint="Sin contar cerrados ni cancelados." />
        <StatCard label="Con alerta" value={conAlertas} tone={conAlertas > 0 ? "danger" : "default"} hint="Hitos vencidos, año modelo, LOA, tareas vencidas." />
        <StatCard label="Esperando al cliente" value={esperandoCliente} tone={esperandoCliente > 0 ? "warn" : "default"} hint="Con una tarea del cliente pendiente en la etapa actual." />
        <StatCard label="Listados" value={visibles.length} />
      </StatGrid>

      {error ? (
        <Notice tone="warn" label="No se pudo leer">{error}</Notice>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Entrada
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código (LC-2026-001), VIN o cliente"
            aria-label="Buscar expediente"
          />
        </div>
        <div className="sm:w-64">
          <Selector value={etapa} onChange={(e) => setEtapa(e.target.value as EtapaExpediente | "todas")} aria-label="Filtrar por etapa">
            <option value="todas">Todas las etapas</option>
            {[...ETAPAS_ORDEN, "cancelado" as const].map((e) => (
              <option key={e} value={e}>{nombreEtapaEquipo(e)}</option>
            ))}
          </Selector>
        </div>
        <label className="flex min-h-10 items-center gap-2 text-xs text-ink-2">
          <input type="checkbox" checked={incluirCerrados} onChange={(e) => setIncluirCerrados(e.target.checked)} className="h-4 w-4 accent-silver" />
          Incluir cerrados y cancelados
        </label>
      </div>

      {loading ? (
        <p className="py-10 text-sm text-ink-3">Cargando…</p>
      ) : filas.length === 0 ? (
        <div className="rounded-lux-lg border border-line bg-surface">
          <EmptyState
            title="Todavía no hay expedientes"
            description={canQuery ? "Abre el primero con el botón Nuevo expediente: cliente, vehículo, compra y presupuesto en cuatro pasos." : "Sin sesión o sin base de datos no hay nada que listar."}
            steps={canQuery ? undefined : SETUP_STEPS}
          />
        </div>
      ) : visibles.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-3">Ningún expediente coincide con el filtro.</p>
      ) : (
        <div className="space-y-8">
          {porEtapa.map((grupo) => (
            <section key={grupo.etapa} aria-label={nombreEtapaEquipo(grupo.etapa)}>
              <div className="mb-3 flex items-center gap-3">
                <EtapaBadge etapa={grupo.etapa} />
                <span className="text-xs text-ink-4">{grupo.filas.length} {grupo.filas.length === 1 ? "expediente" : "expedientes"}</span>
              </div>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {grupo.filas.map((f) => (
                  <TarjetaExpediente key={f.ctx.expediente.id} fila={f} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaExpediente({ fila }: { fila: Fila }) {
  const { ctx, alertas } = fila;
  const e = ctx.expediente;
  const siguiente = siguienteTarea(ctx);
  const dias = diasDesde(e.etapaDesde);
  const proximaFecha = ctx.hitos
    .map((h) => h.fechaLimite)
    .filter((f): f is string => Boolean(f))
    .sort()
    .find((f) => f >= new Date().toISOString().slice(0, 10));

  return (
    <li>
      <Link
        href={`/portal/expedientes/${e.id}`}
        className="block h-full rounded-lux-lg border border-line bg-surface p-5 transition-colors hover:border-line-strong"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-silver">{e.codigo}</p>
            <p className="mt-1 font-semibold text-ink">{autoDe(e.vehiculo)}</p>
            <p className="mt-0.5 truncate text-xs text-ink-3">{ctx.cliente?.razonSocial ?? "Sin cliente"}</p>
          </div>
          <span className="shrink-0 text-right text-[11px] uppercase tracking-[0.12em] text-ink-4">
            {dias} {dias === 1 ? "día" : "días"}
            <span className="block normal-case tracking-normal">en la etapa</span>
          </span>
        </div>
        {alertas.length > 0 ? (
          <div className="mt-3">
            <AlertasLista alertas={alertas} compacta />
          </div>
        ) : null}
        <div className="mt-4 border-t border-line pt-3 text-xs text-ink-2">
          {siguiente ? (
            <p>
              <span className="text-ink-4">Siguiente ({RESPONSABLE_LABEL[siguiente.responsable]}):</span> {siguiente.titulo}
            </p>
          ) : (
            <p className="text-ink-4">Sin tareas pendientes en esta etapa.</p>
          )}
          {proximaFecha ? <p className="mt-1 text-ink-4">Próximo hito: {fecha(proximaFecha)}</p> : null}
        </div>
      </Link>
    </li>
  );
}
