"use client";

/**
 * Embarques: lista con modalidad, contenedor, forwarder, puertos, fechas y
 * cuántos expedientes lleva cada uno; alta de un embarque nuevo.
 *
 * Lee desde el navegador con la sesión del administrador
 * (`src/lib/expedientes/consultas.ts`). El estado (planificado, en tránsito,
 * arribado) y lo que le falta a cada embarque lo deriva el core al leer.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Badge, EmptyState, Notice, PortalPageHeader, PortalPanel, StatCard, StatGrid, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import { Campo, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { usePortalSession } from "@/components/portal/portalSession";
import { estadoEmbarque, faltantesEmbarque, type EstadoEmbarque } from "@/core/expedientes/embarques";
import type { Contraparte, Embarque, ModalidadEmbarque, TipoContenedor } from "@/core/expedientes/tipos";
import { MODALIDADES_EMBARQUE, TIPOS_CONTENEDOR } from "@/core/expedientes/tipos";
import { crearEmbarque, listarContrapartes, listarEmbarquesConExpedientes, type ExpedienteDelEmbarque } from "@/lib/expedientes/consultas";
import { CONTENEDOR_LABEL, MODALIDAD_LABEL, fecha } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";

export const ESTADO_EMBARQUE_LABEL: Record<EstadoEmbarque, string> = {
  planificado: "Planificado",
  en_transito: "En tránsito",
  arribado: "Arribado",
};

export const ESTADO_EMBARQUE_TONE: Record<EstadoEmbarque, "neutral" | "info" | "ok"> = {
  planificado: "neutral",
  en_transito: "info",
  arribado: "ok",
};

export function EmbarquesScreen() {
  const { status: sessionStatus, client } = usePortalSession();
  const [embarques, setEmbarques] = useState<Embarque[]>([]);
  const [porEmbarque, setPorEmbarque] = useState<Map<string, ExpedienteDelEmbarque[]>>(new Map());
  const [contrapartes, setContrapartes] = useState<Contraparte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [creando, setCreando] = useState(false);
  const [soloActivos, setSoloActivos] = useState(true);

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [r, c] = await Promise.all([listarEmbarquesConExpedientes(client), listarContrapartes(client)]);
    setEmbarques(r.embarques);
    setPorEmbarque(r.porEmbarque);
    setContrapartes(c);
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

  const nombreDe = (id: string | null) => (id ? contrapartes.find((c) => c.id === id)?.nombre ?? "—" : "—");

  const visibles = useMemo(() => embarques.filter((b) => !soloActivos || estadoEmbarque(b) !== "arribado"), [embarques, soloActivos]);
  const enTransito = embarques.filter((b) => estadoEmbarque(b) === "en_transito").length;
  const incompletos = embarques.filter((b) => estadoEmbarque(b) !== "arribado" && faltantesEmbarque(b).length > 0).length;

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Embarques"
        title="Contenedores y Ro-Ro"
        description="Un embarque agrupa los expedientes que viajan juntos: reparto del flete, fechas compartidas, master BL e instrucciones al forwarder."
        actions={<Button size="sm" onClick={() => setCreando((v) => !v)}>{creando ? "Cerrar" : "Nuevo embarque"}</Button>}
      />

      <StatGrid>
        <StatCard label="Embarques" value={embarques.length} />
        <StatCard label="En tránsito" value={enTransito} tone={enTransito > 0 ? "accent" : "default"} />
        <StatCard label="Incompletos" value={incompletos} tone={incompletos > 0 ? "warn" : "default"} hint="Sin forwarder, puerto o fechas." />
        <StatCard label="Expedientes embarcados" value={[...porEmbarque.values()].reduce((s, l) => s + l.length, 0)} />
      </StatGrid>

      {flash ? <Notice tone={flash.ok ? "info" : "danger"} label={flash.ok ? "Listo" : "No se pudo"}>{flash.text}</Notice> : null}
      {error ? <Notice tone="warn" label="No se pudo leer">{error}</Notice> : null}

      {creando && client ? (
        <NuevoEmbarque
          client={client}
          contrapartes={contrapartes}
          onHecho={(r) => {
            setFlash({ ok: r.ok, text: r.message });
            if (r.ok) {
              setCreando(false);
              void load();
            }
          }}
        />
      ) : null}

      <PortalPanel
        title="Embarques"
        toolbar={
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} className="h-4 w-4 accent-silver" />
            Ocultar arribados
          </label>
        }
      >
        {loading ? (
          <p className="px-5 py-6 text-sm text-ink-3">Cargando…</p>
        ) : !canQuery ? (
          <div className="p-5"><Notice tone="warn" label="Sin sesión">Hace falta una sesión de administrador.</Notice></div>
        ) : visibles.length === 0 ? (
          <EmptyState title="Sin embarques" description="Crea el primero con el botón de arriba o desde el asistente de un expediente nuevo." />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[960px] border-collapse">
              <thead className="border-b border-line">
                <tr>
                  <Th>Código</Th>
                  <Th>Modalidad</Th>
                  <Th>Forwarder</Th>
                  <Th>Ruta</Th>
                  <Th>Zarpe</Th>
                  <Th>Arribo</Th>
                  <Th>Expedientes</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibles.map((b) => {
                  const estado = estadoEmbarque(b);
                  const faltan = faltantesEmbarque(b);
                  const grupo = porEmbarque.get(b.id) ?? [];
                  return (
                    <tr key={b.id} className="hover:bg-surface-2/40">
                      <Td>
                        <Link href={`/portal/embarques/${b.id}`} className="font-mono text-sm text-ink underline-offset-4 hover:underline">{b.codigo}</Link>
                        {b.masterBl ? <p className="mt-0.5 text-xs text-ink-4">BL {b.masterBl}</p> : null}
                      </Td>
                      <Td>
                        <p className="text-ink">{MODALIDAD_LABEL[b.modalidad].split(" (")[0]}</p>
                        <p className="text-xs text-ink-4">{b.contenedor ? CONTENEDOR_LABEL[b.contenedor] : "—"}</p>
                      </Td>
                      <Td>{nombreDe(b.forwarderId)}</Td>
                      <Td>{b.puertoOrigen ?? "?"} → {b.puertoDestino}</Td>
                      <Td>
                        {b.fechaZarpeReal ? <span className="text-ink">{fecha(b.fechaZarpeReal)}</span> : b.fechaZarpeEst ? <span className="text-ink-3">est. {fecha(b.fechaZarpeEst)}</span> : "—"}
                      </Td>
                      <Td>
                        {b.fechaArriboReal ? <span className="text-ink">{fecha(b.fechaArriboReal)}</span> : b.fechaArriboEst ? <span className="text-ink-3">est. {fecha(b.fechaArriboEst)}</span> : "—"}
                      </Td>
                      <Td>
                        {grupo.length === 0 ? <span className="text-ink-4">0</span> : (
                          <div className="flex flex-wrap gap-1">
                            {grupo.map((x) => (
                              <Link key={x.id} href={`/portal/expedientes/${x.id}`} className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-ink-2 hover:text-ink" title={`${x.auto} · ${x.cliente}`}>
                                {x.codigo}
                              </Link>
                            ))}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={ESTADO_EMBARQUE_TONE[estado]}>{ESTADO_EMBARQUE_LABEL[estado]}</Badge>
                        {estado !== "arribado" && faltan.length > 0 ? <p className="mt-1 text-xs text-warn">Falta: {faltan.join(", ")}</p> : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </PortalPanel>
    </div>
  );
}

function NuevoEmbarque({ client, contrapartes, onHecho }: { client: PortalClient; contrapartes: Contraparte[]; onHecho: (r: { ok: boolean; message: string; id?: string }) => void }) {
  const [f, setF] = useState({
    modalidad: "consolidado" as ModalidadEmbarque,
    contenedor: "c40hc" as TipoContenedor | "",
    forwarder_id: "",
    aseguradora_id: "",
    almacen_consolidacion: "",
    puerto_origen: "",
    puerto_destino: "Callao",
    fecha_release_est: "",
    fecha_zarpe_est: "",
    fecha_arribo_est: "",
    flete_total_usd: "",
    notas_internas: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const forwarders = contrapartes.filter((c) => c.tipo === "forwarder");
  const aseguradoras = contrapartes.filter((c) => c.tipo === "aseguradora");

  return (
    <PortalPanel title="Nuevo embarque" description="El código EMB-AAAA-NN lo asigna la base. Los expedientes se agregan después, desde el detalle.">
      <form
        className="space-y-4 px-5 py-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const flete = f.flete_total_usd.trim() ? Number(f.flete_total_usd.replace(",", ".")) : null;
          const r = await crearEmbarque(client, {
            modalidad: f.modalidad,
            contenedor: f.modalidad === "roro" ? "roro" : f.contenedor || null,
            forwarder_id: f.forwarder_id || null,
            aseguradora_id: f.aseguradora_id || null,
            almacen_consolidacion: f.almacen_consolidacion,
            puerto_origen: f.puerto_origen,
            puerto_destino: f.puerto_destino || "Callao",
            fecha_release_est: f.fecha_release_est || null,
            fecha_zarpe_est: f.fecha_zarpe_est || null,
            fecha_arribo_est: f.fecha_arribo_est || null,
            flete_total_usd: flete !== null && Number.isFinite(flete) && flete >= 0 ? flete : null,
            notas_internas: f.notas_internas,
          });
          setBusy(false);
          onHecho(r);
        }}
      >
        <Rejilla columnas={4}>
          <Campo label="Modalidad" requerido>
            <Selector value={f.modalidad} onChange={(e) => set("modalidad", e.target.value)}>
              {MODALIDADES_EMBARQUE.map((m) => <option key={m} value={m}>{MODALIDAD_LABEL[m]}</option>)}
            </Selector>
          </Campo>
          <Campo label="Contenedor">
            <Selector value={f.modalidad === "roro" ? "roro" : f.contenedor} disabled={f.modalidad === "roro"} onChange={(e) => set("contenedor", e.target.value)}>
              <option value="">—</option>
              {TIPOS_CONTENEDOR.map((t) => <option key={t} value={t}>{CONTENEDOR_LABEL[t]}</option>)}
            </Selector>
          </Campo>
          <Campo label="Forwarder" hint={forwarders.length === 0 ? "Créalo en Contrapartes." : undefined}>
            <Selector value={f.forwarder_id} onChange={(e) => set("forwarder_id", e.target.value)}>
              <option value="">— Sin asignar —</option>
              {forwarders.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.pais ? ` · ${c.pais}` : ""}</option>)}
            </Selector>
          </Campo>
          <Campo label="Aseguradora">
            <Selector value={f.aseguradora_id} onChange={(e) => set("aseguradora_id", e.target.value)}>
              <option value="">— Sin asignar —</option>
              {aseguradoras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Selector>
          </Campo>
          <Campo label="Almacén de consolidación"><Entrada value={f.almacen_consolidacion} onChange={(e) => set("almacen_consolidacion", e.target.value)} maxLength={200} /></Campo>
          <Campo label="Puerto de origen" requerido><Entrada value={f.puerto_origen} onChange={(e) => set("puerto_origen", e.target.value)} maxLength={120} placeholder="Vancouver, BC" /></Campo>
          <Campo label="Puerto de destino"><Entrada value={f.puerto_destino} onChange={(e) => set("puerto_destino", e.target.value)} maxLength={120} /></Campo>
          <Campo label="Flete total (USD)"><Entrada value={f.flete_total_usd} onChange={(e) => set("flete_total_usd", e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" /></Campo>
          <Campo label="Release estimado"><Entrada type="date" value={f.fecha_release_est} onChange={(e) => set("fecha_release_est", e.target.value)} /></Campo>
          <Campo label="Zarpe estimado"><Entrada type="date" value={f.fecha_zarpe_est} onChange={(e) => set("fecha_zarpe_est", e.target.value)} /></Campo>
          <Campo label="Arribo estimado"><Entrada type="date" value={f.fecha_arribo_est} onChange={(e) => set("fecha_arribo_est", e.target.value)} /></Campo>
          <Campo label="Notas internas"><Entrada value={f.notas_internas} onChange={(e) => set("notas_internas", e.target.value)} maxLength={4000} /></Campo>
        </Rejilla>
        <Button type="submit" size="sm" disabled={busy || !f.puerto_origen.trim()}>{busy ? "Creando…" : "Crear embarque"}</Button>
      </form>
    </PortalPanel>
  );
}
