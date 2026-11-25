"use client";

/**
 * Detalle de un embarque: datos y edición, expedientes del grupo con su
 * proporción de flete (agregar, quitar, fijar el reparto por
 * `fijar_reparto_flete`), zarpe y arribo (`registrar_zarpe_arribo`, que avisa
 * a cada expediente del grupo), master BL y nave, e instrucciones al
 * forwarder por expediente (la ruta de documentos existente).
 *
 * Todo desde el navegador con la sesión del administrador; las dos funciones
 * SQL son la transacción. El reparto se valida acá con el core antes de
 * mandarlo y la base vuelve a validar.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Badge, Notice, PortalPanel, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import { AreaTexto, Campo, Dato, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { EtapaBadge } from "@/components/portal/expedientes/Piezas";
import { usePortalSession } from "@/components/portal/portalSession";
import { estadoEmbarque, faltantesEmbarque, repartoEquitativo, sumaReparto, validarReparto } from "@/core/expedientes/embarques";
import type { Contraparte, Embarque, ModalidadEmbarque, TipoContenedor } from "@/core/expedientes/tipos";
import { MODALIDADES_EMBARQUE, TIPOS_CONTENEDOR } from "@/core/expedientes/tipos";
import type { EmbarqueRow } from "@/lib/db/types";
import {
  actualizarEmbarque,
  asignarEmbarque,
  cargarEmbarque,
  fijarRepartoFlete,
  generarDocumento,
  listarContrapartes,
  listarExpedientesSinEmbarque,
  registrarZarpeArribo,
  type ExpedienteDelEmbarque,
} from "@/lib/expedientes/consultas";
import { CONTENEDOR_LABEL, MODALIDAD_LABEL, leerNumero, usd } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";
import { ESTADO_EMBARQUE_LABEL, ESTADO_EMBARQUE_TONE } from "../EmbarquesScreen";

type Resultado = { ok: boolean; message: string };

export function EmbarqueDetalleScreen({ id }: { id: string }) {
  const { status: sessionStatus, client } = usePortalSession();
  const [embarque, setEmbarque] = useState<Embarque | null>(null);
  const [grupo, setGrupo] = useState<ExpedienteDelEmbarque[]>([]);
  const [contrapartes, setContrapartes] = useState<Contraparte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setLoading(false);
      return;
    }
    const [r, c] = await Promise.all([cargarEmbarque(client, id), listarContrapartes(client)]);
    setEmbarque(r.embarque);
    setGrupo(r.expedientes);
    setContrapartes(c);
    setError(r.error);
    setLoading(false);
  }, [client, canQuery, id]);

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

  const notify = useCallback(
    (r: Resultado) => {
      setFlash({ ok: r.ok, text: r.message });
      if (r.ok) void load();
    },
    [load],
  );

  if (loading) return <p className="mt-8 text-sm text-ink-3">Cargando embarque…</p>;
  if (!canQuery) return <Notice tone="warn" label="Sin sesión">Hace falta una sesión de administrador.</Notice>;
  if (error && !embarque) return <div className="mt-8"><Notice tone="warn" label="No se pudo leer">{error}</Notice></div>;
  if (!embarque || !client) return <div className="mt-8"><Notice tone="warn" label="No existe">Este embarque no existe o fue borrado.</Notice></div>;

  const b = embarque;
  const estado = estadoEmbarque(b);
  const faltan = faltantesEmbarque(b);
  const activos = grupo.filter((x) => x.etapa !== "cancelado" && x.etapa !== "cerrado");
  const forwarder = contrapartes.find((c) => c.id === b.forwarderId) ?? null;

  return (
    <div className="mt-6 space-y-6">
      <header className="flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-silver">{b.codigo}</p>
            <Badge tone={ESTADO_EMBARQUE_TONE[estado]}>{ESTADO_EMBARQUE_LABEL[estado]}</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {MODALIDAD_LABEL[b.modalidad].split(" (")[0]}{b.contenedor ? ` · ${CONTENEDOR_LABEL[b.contenedor]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            {b.puertoOrigen ?? "Puerto por definir"} → {b.puertoDestino}
            {forwarder ? <span className="text-ink-4"> · {forwarder.nombre}</span> : null}
            {b.nave ? <span className="text-ink-4"> · {b.nave}</span> : null}
          </p>
        </div>
        <div className="text-right text-sm text-ink-3">
          <p>{activos.length} expediente{activos.length === 1 ? "" : "s"} activo{activos.length === 1 ? "" : "s"}</p>
          {b.fleteTotalUsd !== null ? <p>Flete total {usd(b.fleteTotalUsd, 2)}</p> : null}
        </div>
      </header>

      {flash ? <Notice tone={flash.ok ? "info" : "danger"} label={flash.ok ? "Listo" : "No se pudo"}>{flash.text}</Notice> : null}
      {estado !== "arribado" && faltan.length > 0 ? <Notice tone="warn" label="Incompleto">Falta: {faltan.join(", ")}. Sin esto el cliente no ve fechas en su cuenta y las instrucciones al forwarder salen con huecos.</Notice> : null}

      <Expedientes client={client} embarque={b} grupo={grupo} onResultado={notify} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ZarpeArribo client={client} embarque={b} onResultado={notify} />
        <DatosEmbarque client={client} embarque={b} contrapartes={contrapartes} onResultado={notify} />
      </div>

      <Instrucciones embarque={b} grupo={activos} forwarder={forwarder} onResultado={notify} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Expedientes del grupo y reparto                                            */
/* -------------------------------------------------------------------------- */

function Expedientes({ client, embarque, grupo, onResultado }: { client: PortalClient; embarque: Embarque; grupo: ExpedienteDelEmbarque[]; onResultado: (r: Resultado) => void }) {
  const activos = useMemo(() => grupo.filter((x) => x.etapa !== "cancelado" && x.etapa !== "cerrado"), [grupo]);
  // Lo escrito en las casillas de proporción; lo que no se tocó muestra el valor guardado.
  const [editado, setEditado] = useState<Record<string, string>>({});
  const reparto = useMemo(() => Object.fromEntries(activos.map((x) => [x.id, editado[x.id] ?? String(x.proporcionFlete)])), [activos, editado]);
  const setReparto = (valor: Record<string, string>) => setEditado(valor);
  const [candidatos, setCandidatos] = useState<ExpedienteDelEmbarque[]>([]);
  const [elegido, setElegido] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void listarExpedientesSinEmbarque(client).then((lista) => {
      if (!cancelado) setCandidatos(lista);
    });
    return () => {
      cancelado = true;
    };
  }, [client, grupo]);

  const lineas = activos.map((x) => ({ expedienteId: x.id, proporcion: leerNumero(reparto[x.id] ?? "") ?? 0 }));
  const problema = validarReparto(lineas);
  const suma = sumaReparto(lineas);
  const sumaActual = sumaReparto(activos.map((x) => ({ expedienteId: x.id, proporcion: x.proporcionFlete })));
  const descuadrado = activos.length > 0 && Math.abs(sumaActual - 1) > 0.001;

  return (
    <PortalPanel
      title="Expedientes del grupo"
      description="Cada expediente paga una proporción del flete y de los gastos del contenedor. En exclusivo es 1; en consolidado la suma debe dar 1."
      toolbar={
        activos.length > 1 ? (
          <Button size="sm" variant="secondary" onClick={() => setReparto(Object.fromEntries(repartoEquitativo(activos.map((x) => x.id)).map((l) => [l.expedienteId, String(l.proporcion)])))}>
            Partes iguales
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4 px-5 py-4">
        {descuadrado ? <Notice tone="warn" label="Reparto descuadrado">Las proporciones guardadas suman {sumaActual.toFixed(4)}. Corrígelas abajo y fija el reparto.</Notice> : null}
        {grupo.length === 0 ? (
          <p className="text-sm text-ink-3">Todavía no hay expedientes en este embarque.</p>
        ) : (
          <TableScroll>
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="border-b border-line">
                <tr>
                  <Th>Expediente</Th>
                  <Th>Vehículo</Th>
                  <Th>Cliente</Th>
                  <Th>Etapa</Th>
                  <Th align="right">Proporción</Th>
                  <Th align="right">Flete</Th>
                  <Th><span className="sr-only">Acciones</span></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {grupo.map((x) => {
                  const activo = x.etapa !== "cancelado" && x.etapa !== "cerrado";
                  const prop = leerNumero(reparto[x.id] ?? "") ?? x.proporcionFlete;
                  return (
                    <tr key={x.id}>
                      <Td><Link href={`/portal/expedientes/${x.id}`} className="font-mono text-sm text-ink underline-offset-4 hover:underline">{x.codigo}</Link></Td>
                      <Td>
                        <p className="text-ink">{x.auto}</p>
                        {x.vin ? <p className="font-mono text-xs text-ink-4">{x.vin}</p> : null}
                      </Td>
                      <Td>{x.cliente}</Td>
                      <Td><EtapaBadge etapa={x.etapa} /></Td>
                      <Td align="right">
                        {activo ? (
                          <Entrada
                            value={reparto[x.id] ?? ""}
                            onChange={(e) => setEditado((p) => ({ ...p, [x.id]: e.target.value.replace(/[^0-9.,]/g, "") }))}
                            inputMode="decimal"
                            className="w-24 text-right"
                            aria-label={`Proporción de ${x.codigo}`}
                          />
                        ) : <span className="text-ink-4">—</span>}
                      </Td>
                      <Td align="right"><span className="tabular-nums text-ink-3">{embarque.fleteTotalUsd !== null && activo ? usd(embarque.fleteTotalUsd * prop, 2) : "—"}</span></Td>
                      <Td align="right">
                        {activo ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="border border-line"
                            disabled={busy}
                            onClick={async () => {
                              if (!window.confirm(`¿Quitar ${x.codigo} de este embarque? Su proporción vuelve a 1.`)) return;
                              setBusy(true);
                              onResultado(await asignarEmbarque(client, x.id, null));
                              setBusy(false);
                            }}
                          >
                            Quitar
                          </Button>
                        ) : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}

        {activos.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <p className={`text-sm ${problema ? "text-warn" : "text-ink-3"}`}>{problema ?? `Suma ${suma.toFixed(4)}.`}</p>
            <Button
              size="sm"
              disabled={busy || Boolean(problema)}
              onClick={async () => {
                setBusy(true);
                onResultado(await fijarRepartoFlete(client, embarque.id, lineas));
                setBusy(false);
              }}
            >
              {busy ? "Guardando…" : "Fijar reparto"}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end">
          <Campo label="Agregar expediente" hint="Sin embarque, en búsqueda, compra o embarque." className="flex-1">
            <Selector value={elegido} onChange={(e) => setElegido(e.target.value)}>
              <option value="">— Elegir —</option>
              {candidatos.map((x) => <option key={x.id} value={x.id}>{x.codigo} · {x.auto} · {x.cliente}</option>)}
            </Selector>
          </Campo>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !elegido}
            onClick={async () => {
              setBusy(true);
              const n = activos.length + 1;
              const prop = embarque.modalidad === "consolidado" && n > 1 ? Math.round((1 / n) * 10000) / 10000 : 1;
              const r = await asignarEmbarque(client, elegido, embarque.id, prop);
              setBusy(false);
              setElegido("");
              onResultado(r.ok && n > 1 ? { ok: true, message: `${r.message} Revisa el reparto del flete y fíjalo.` } : r);
            }}
          >
            Agregar
          </Button>
        </div>
      </div>
    </PortalPanel>
  );
}

/* -------------------------------------------------------------------------- */
/* Zarpe y arribo                                                             */
/* -------------------------------------------------------------------------- */

function ZarpeArribo({ client, embarque: b, onResultado }: { client: PortalClient; embarque: Embarque; onResultado: (r: Resultado) => void }) {
  const [f, setF] = useState({
    fecha_carga: b.fechaCarga ?? "",
    fecha_zarpe_est: b.fechaZarpeEst ?? "",
    fecha_zarpe_real: b.fechaZarpeReal ?? "",
    fecha_arribo_est: b.fechaArriboEst ?? "",
    fecha_arribo_real: b.fechaArriboReal ?? "",
    nave: b.nave ?? "",
    master_bl: b.masterBl ?? "",
    precinto: b.precinto ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const zarpeNuevo = f.fecha_zarpe_real && f.fecha_zarpe_real !== (b.fechaZarpeReal ?? "");
  const arriboNuevo = f.fecha_arribo_real && f.fecha_arribo_real !== (b.fechaArriboReal ?? "");

  return (
    <PortalPanel title="Zarpe, arribo y BL" description="Al registrar un zarpe o un arribo real, cada expediente del grupo recibe el evento en la cuenta del cliente y actualiza sus fechas estimadas.">
      <div className="space-y-4 px-5 py-4">
        <Rejilla columnas={2}>
          <Campo label="Carga en origen"><Entrada type="date" value={f.fecha_carga} onChange={(e) => set("fecha_carga", e.target.value)} /></Campo>
          <Campo label="Nave"><Entrada value={f.nave} onChange={(e) => set("nave", e.target.value)} maxLength={160} /></Campo>
          <Campo label="Zarpe estimado"><Entrada type="date" value={f.fecha_zarpe_est} onChange={(e) => set("fecha_zarpe_est", e.target.value)} /></Campo>
          <Campo label="Zarpe real" hint="Compuerta a tránsito; avisa al cliente."><Entrada type="date" value={f.fecha_zarpe_real} onChange={(e) => set("fecha_zarpe_real", e.target.value)} /></Campo>
          <Campo label="Arribo estimado"><Entrada type="date" value={f.fecha_arribo_est} onChange={(e) => set("fecha_arribo_est", e.target.value)} /></Campo>
          <Campo label="Arribo real" hint="Avisa al cliente."><Entrada type="date" value={f.fecha_arribo_real} onChange={(e) => set("fecha_arribo_real", e.target.value)} /></Campo>
          <Campo label="Master BL"><Entrada value={f.master_bl} onChange={(e) => set("master_bl", e.target.value)} maxLength={80} /></Campo>
          <Campo label="Precinto"><Entrada value={f.precinto} onChange={(e) => set("precinto", e.target.value)} maxLength={80} /></Campo>
        </Rejilla>
        {zarpeNuevo || arriboNuevo ? (
          <p className="text-xs text-ink-3">
            Se publicará en la cuenta de cada cliente del grupo: {zarpeNuevo ? `"Zarpó de ${b.puertoOrigen ?? "origen"}"` : ""}{zarpeNuevo && arriboNuevo ? " y " : ""}{arriboNuevo ? `"Arribó al ${b.puertoDestino}"` : ""}.
          </p>
        ) : null}
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            onResultado(await registrarZarpeArribo(client, b.id, f));
            setBusy(false);
          }}
        >
          {busy ? "Guardando…" : zarpeNuevo || arriboNuevo ? "Registrar y avisar al grupo" : "Guardar fechas"}
        </Button>
      </div>
    </PortalPanel>
  );
}

/* -------------------------------------------------------------------------- */
/* Datos del embarque                                                         */
/* -------------------------------------------------------------------------- */

function DatosEmbarque({ client, embarque: b, contrapartes, onResultado }: { client: PortalClient; embarque: Embarque; contrapartes: Contraparte[]; onResultado: (r: Resultado) => void }) {
  const [f, setF] = useState({
    modalidad: b.modalidad as ModalidadEmbarque,
    contenedor: (b.contenedor ?? "") as TipoContenedor | "",
    forwarder_id: b.forwarderId ?? "",
    aseguradora_id: b.aseguradoraId ?? "",
    almacen_consolidacion: b.almacenConsolidacion ?? "",
    puerto_origen: b.puertoOrigen ?? "",
    puerto_destino: b.puertoDestino,
    fecha_release_est: b.fechaReleaseEst ?? "",
    fecha_release_real: b.fechaReleaseReal ?? "",
    flete_total_usd: b.fleteTotalUsd !== null ? String(b.fleteTotalUsd) : "",
    gastos_contenedor_usd: b.gastosContenedorUsd !== null ? String(b.gastosContenedorUsd) : "",
    declaracion_exportacion: b.declaracionExportacion ?? "",
    notas_internas: b.notasInternas ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const forwarders = contrapartes.filter((c) => c.tipo === "forwarder");
  const aseguradoras = contrapartes.filter((c) => c.tipo === "aseguradora");

  return (
    <PortalPanel title="Datos del embarque" description="Modalidad, terceros, puertos, release y costos del contenedor.">
      <div className="space-y-4 px-5 py-4">
        <Rejilla columnas={2}>
          <Campo label="Modalidad">
            <Selector value={f.modalidad} onChange={(e) => set("modalidad", e.target.value)}>
              {MODALIDADES_EMBARQUE.map((m) => <option key={m} value={m}>{MODALIDAD_LABEL[m]}</option>)}
            </Selector>
          </Campo>
          <Campo label="Contenedor">
            <Selector value={f.contenedor} onChange={(e) => set("contenedor", e.target.value)}>
              <option value="">—</option>
              {TIPOS_CONTENEDOR.map((t) => <option key={t} value={t}>{CONTENEDOR_LABEL[t]}</option>)}
            </Selector>
          </Campo>
          <Campo label="Forwarder">
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
          <Campo label="Puerto de origen"><Entrada value={f.puerto_origen} onChange={(e) => set("puerto_origen", e.target.value)} maxLength={120} /></Campo>
          <Campo label="Puerto de destino"><Entrada value={f.puerto_destino} onChange={(e) => set("puerto_destino", e.target.value)} maxLength={120} /></Campo>
          <Campo label="Almacén de consolidación"><Entrada value={f.almacen_consolidacion} onChange={(e) => set("almacen_consolidacion", e.target.value)} maxLength={200} /></Campo>
          <Campo label="Declaración de exportación"><Entrada value={f.declaracion_exportacion} onChange={(e) => set("declaracion_exportacion", e.target.value)} maxLength={120} /></Campo>
          <Campo label="Release estimado"><Entrada type="date" value={f.fecha_release_est} onChange={(e) => set("fecha_release_est", e.target.value)} /></Campo>
          <Campo label="Release real"><Entrada type="date" value={f.fecha_release_real} onChange={(e) => set("fecha_release_real", e.target.value)} /></Campo>
          <Campo label="Flete total (USD)"><Entrada value={f.flete_total_usd} onChange={(e) => set("flete_total_usd", e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" /></Campo>
          <Campo label="Gastos del contenedor (USD)"><Entrada value={f.gastos_contenedor_usd} onChange={(e) => set("gastos_contenedor_usd", e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" /></Campo>
        </Rejilla>
        <Campo label="Notas internas"><AreaTexto value={f.notas_internas} onChange={(e) => set("notas_internas", e.target.value)} rows={3} maxLength={4000} /></Campo>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const cambios: Partial<EmbarqueRow> = {
              modalidad: f.modalidad,
              contenedor: f.contenedor || null,
              forwarder_id: f.forwarder_id || null,
              aseguradora_id: f.aseguradora_id || null,
              almacen_consolidacion: f.almacen_consolidacion.trim() || null,
              puerto_origen: f.puerto_origen.trim() || null,
              puerto_destino: f.puerto_destino.trim() || "Callao",
              declaracion_exportacion: f.declaracion_exportacion.trim() || null,
              fecha_release_est: f.fecha_release_est || null,
              fecha_release_real: f.fecha_release_real || null,
              flete_total_usd: leerNumero(f.flete_total_usd),
              gastos_contenedor_usd: leerNumero(f.gastos_contenedor_usd),
              notas_internas: f.notas_internas.trim() || null,
            };
            onResultado(await actualizarEmbarque(client, b.id, cambios));
            setBusy(false);
          }}
        >
          {busy ? "Guardando…" : "Guardar embarque"}
        </Button>
      </div>
    </PortalPanel>
  );
}

/* -------------------------------------------------------------------------- */
/* Instrucciones al forwarder                                                 */
/* -------------------------------------------------------------------------- */

function Instrucciones({ embarque: b, grupo, forwarder, onResultado }: { embarque: Embarque; grupo: ExpedienteDelEmbarque[]; forwarder: Contraparte | null; onResultado: (r: Resultado) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Record<string, { faltantes?: string[]; pdf?: string | null; docx?: string | null; version?: number }>>({});

  return (
    <PortalPanel
      title="Instrucciones al forwarder"
      description="Una por expediente (cada auto tiene su consignatario y su house BL). Se generan con la plantilla de la fase 2: si faltan datos, salen listados y se completan en el expediente."
    >
      <div className="space-y-3 px-5 py-4">
        {!forwarder ? <Notice tone="warn" label="Sin forwarder">Asigna el forwarder del embarque antes de generar: las instrucciones van dirigidas a él.</Notice> : null}
        {grupo.length === 0 ? <p className="text-sm text-ink-3">Sin expedientes activos.</p> : null}
        {grupo.map((x) => {
          const r = resultados[x.id];
          return (
            <div key={x.id} className="flex flex-col gap-2 rounded-lux border border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-ink"><span className="font-mono">{x.codigo}</span> · {x.auto}</p>
                <p className="text-xs text-ink-4">{x.cliente}{x.vin ? ` · VIN ${x.vin}` : ""}</p>
                {r?.faltantes && r.faltantes.length > 0 ? (
                  <p className="mt-1 text-xs text-warn">
                    Faltan: {r.faltantes.map((c) => c.replace(/_/g, " ").toLowerCase()).join(", ")}. <Link href={`/portal/expedientes/${x.id}`} className="underline underline-offset-4">Completar en el expediente</Link>
                  </p>
                ) : null}
                {r?.version ? (
                  <p className="mt-1 text-xs text-ink-3">
                    Versión {r.version} generada.
                    {r.pdf ? <> <a href={r.pdf} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">PDF</a></> : null}
                    {r.docx ? <> · <a href={r.docx} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">DOCX</a></> : null}
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy !== null || !forwarder}
                onClick={async () => {
                  setBusy(x.id);
                  const r = await generarDocumento({ expedienteId: x.id, tipo: "instrucciones_forwarder", extra: {}, visibleCliente: false });
                  setBusy(null);
                  if (r.ok) setResultados((p) => ({ ...p, [x.id]: { pdf: r.urls.pdf, docx: r.urls.docx, version: r.version } }));
                  else setResultados((p) => ({ ...p, [x.id]: { faltantes: r.faltantes ?? [] } }));
                  onResultado(r.ok ? { ok: true, message: `Instrucciones al forwarder de ${x.codigo}: ${r.message}` } : { ok: false, message: r.faltantes?.length ? `${x.codigo}: faltan datos para las instrucciones.` : r.message });
                }}
              >
                {busy === x.id ? "Generando…" : "Generar instrucciones"}
              </Button>
            </div>
          );
        })}
        {b.fechaZarpeReal ? <Dato label="Nota">El embarque ya zarpó: regenerar las instrucciones solo tiene sentido para corregir el BL.</Dato> : null}
      </div>
    </PortalPanel>
  );
}
