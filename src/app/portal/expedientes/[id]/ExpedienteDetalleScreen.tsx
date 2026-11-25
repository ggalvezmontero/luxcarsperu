"use client";

/**
 * Detalle del expediente: cabecera con etapa, alertas y siguiente paso;
 * pestañas Resumen, Cliente, Vehículo y compra, Dinero, Documentos, Embarque,
 * Etapas y tareas, Actividad; avanzar con la lista de compuertas (forzar con
 * motivo), avisar al cliente (correo o WhatsApp) y cancelar.
 *
 * Todo desde el navegador con la sesión del administrador. Las reglas (qué
 * falta, qué tareas nacen, qué alertas hay) las calcula el core al leer.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Notice, PortalPanel } from "@/components/portal/CrmUI";
import { Pestanas } from "@/components/portal/expedientes/Formulario";
import { AlertasLista, BarraEtapas, EtapaBadge } from "@/components/portal/expedientes/Piezas";
import { usePortalSession } from "@/components/portal/portalSession";
import { alertas as calcularAlertas } from "@/core/expedientes/alertas";
import { siguienteTarea } from "@/core/expedientes/avance";
import { esEtapaTerminal } from "@/core/expedientes/etapas";
import type { ContextoExpediente, Evento, NotificacionRegistrada } from "@/core/expedientes/tipos";
import { cargarExpediente, cargarSolicitudOrigen, listarEventos, listarNotificaciones, type SolicitudOrigen } from "@/lib/expedientes/consultas";
import { RESPONSABLE_LABEL, autoDe, diasDesde, fecha } from "@/lib/expedientes/formato";
import { AvanzarPanel } from "./AvanzarPanel";
import { AvisarPanel } from "./AvisarPanel";
import { PestanaActividad } from "./PestanaActividad";
import { PestanaCliente } from "./PestanaCliente";
import { PestanaDinero } from "./PestanaDinero";
import { PestanaDocumentos } from "./PestanaDocumentos";
import { PestanaEmbarque } from "./PestanaEmbarque";
import { PestanaResumen } from "./PestanaResumen";
import { PestanaTareas } from "./PestanaTareas";
import { PestanaVehiculo } from "./PestanaVehiculo";

type Pestana = "resumen" | "cliente" | "vehiculo" | "dinero" | "documentos" | "embarque" | "tareas" | "actividad";

const PESTANAS: { id: Pestana; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "cliente", label: "Cliente" },
  { id: "vehiculo", label: "Vehículo y compra" },
  { id: "dinero", label: "Dinero" },
  { id: "documentos", label: "Documentos" },
  { id: "embarque", label: "Embarque" },
  { id: "tareas", label: "Etapas y tareas" },
  { id: "actividad", label: "Actividad" },
];

export type Flash = { ok: boolean; text: string } | null;

export function ExpedienteDetalleScreen({ id }: { id: string }) {
  const { status: sessionStatus, client } = usePortalSession();
  const [ctx, setCtx] = useState<ContextoExpediente | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [notificaciones, setNotificaciones] = useState<NotificacionRegistrada[]>([]);
  const [origen, setOrigen] = useState<SolicitudOrigen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [pestana, setPestana] = useState<Pestana>("resumen");
  const [panel, setPanel] = useState<"ninguno" | "avanzar" | "cancelar" | "avisar">("ninguno");

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setLoading(false);
      return;
    }
    const [r, ev, nt] = await Promise.all([cargarExpediente(client, id), listarEventos(client, id), listarNotificaciones(client, id)]);
    setCtx(r.ctx);
    setEventos(ev.eventos);
    setNotificaciones(nt.notificaciones);
    setOrigen(r.ctx?.expediente.origenSolicitudId ? await cargarSolicitudOrigen(client, r.ctx.expediente.origenSolicitudId) : null);
    setError(r.error ?? ev.error);
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

  const alertas = useMemo(() => (ctx ? calcularAlertas(ctx) : []), [ctx]);

  const notify = useCallback(
    (r: { ok: boolean; message: string }) => {
      setFlash({ ok: r.ok, text: r.message });
      if (r.ok) void load();
    },
    [load],
  );

  if (loading) return <p className="mt-8 text-sm text-ink-3">Cargando expediente…</p>;
  if (!canQuery) return <Notice tone="warn" label="Sin sesión">Hace falta una sesión de administrador.</Notice>;
  if (error && !ctx) return <div className="mt-8"><Notice tone="warn" label="No se pudo leer">{error}</Notice></div>;
  if (!ctx) {
    return (
      <div className="mt-8">
        <Notice tone="warn" label="No existe">Este expediente no existe o fue borrado.</Notice>
      </div>
    );
  }

  const e = ctx.expediente;
  const siguiente = siguienteTarea(ctx);
  const terminal = esEtapaTerminal(e.etapa);

  return (
    <div className="mt-6 space-y-6">
      <header className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-silver">{e.codigo}</p>
            <EtapaBadge etapa={e.etapa} />
            <span className="text-xs text-ink-4">
              {diasDesde(e.etapaDesde)} días en la etapa · abierto el {fecha(e.createdAt)}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{autoDe(e.vehiculo)}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {ctx.cliente?.razonSocial ?? "Sin cliente"}
            {e.vehiculo.vin ? <span className="font-mono text-ink-4"> · VIN {e.vehiculo.vin}</span> : null}
          </p>
          {e.origenSolicitudId ? (
            <p className="mt-1 text-xs text-ink-4">
              Origen:{" "}
              <Link href="/portal/solicitudes" className="text-ink-3 underline-offset-4 hover:text-ink hover:underline">
                solicitud de compra{origen ? ` del ${fecha(origen.createdAt)}` : ""}
              </Link>
              {origen?.nombre ? ` · ${origen.nombre}` : ""}
              {origen ? ` · ${origen.marca} ${origen.modelo}` : ""}
            </p>
          ) : null}
          {siguiente ? (
            <p className="mt-3 text-sm text-ink-2">
              <span className="text-[11px] uppercase tracking-[0.12em] text-ink-4">Siguiente paso · {RESPONSABLE_LABEL[siguiente.responsable]}</span>
              <br />
              {siguiente.titulo}
            </p>
          ) : null}
        </div>
        {!terminal ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" onClick={() => setPanel(panel === "avanzar" ? "ninguno" : "avanzar")}>Avanzar etapa</Button>
            {e.etapa !== "prospecto" ? (
              <Button size="sm" variant="secondary" onClick={() => setPanel(panel === "avisar" ? "ninguno" : "avisar")}>Avisar al cliente</Button>
            ) : null}
            <Button size="sm" variant="ghost" className="border border-line" onClick={() => setPanel(panel === "cancelar" ? "ninguno" : "cancelar")}>Cancelar expediente</Button>
          </div>
        ) : null}
      </header>

      {e.etapa !== "prospecto" ? <BarraEtapas actual={e.etapa} /> : null}

      {flash ? (
        <Notice tone={flash.ok ? "info" : "danger"} label={flash.ok ? "Listo" : "No se pudo"}>{flash.text}</Notice>
      ) : null}

      {(panel === "avanzar" || panel === "cancelar") && client ? (
        <AvanzarPanel client={client} ctx={ctx} modo={panel} onCerrar={() => setPanel("ninguno")} onHecho={(r) => { setPanel("ninguno"); notify(r); }} />
      ) : null}
      {panel === "avisar" ? (
        <AvisarPanel ctx={ctx} onCerrar={() => setPanel("ninguno")} onHecho={(r) => { if (r.ok) void load(); }} />
      ) : null}

      {alertas.length > 0 ? (
        <PortalPanel title="Alertas" description="Calculadas al leer: hitos vencidos, año modelo, tareas vencidas, cuenta sin vincular, LOA.">
          <div className="px-5 py-4">
            <AlertasLista alertas={alertas} />
          </div>
        </PortalPanel>
      ) : null}

      <Pestanas valor={pestana} opciones={PESTANAS} onChange={setPestana} label="Secciones del expediente" />

      {client ? (
        <>
          {pestana === "resumen" ? <PestanaResumen client={client} ctx={ctx} onResultado={notify} /> : null}
          {pestana === "cliente" ? <PestanaCliente client={client} ctx={ctx} onResultado={notify} /> : null}
          {pestana === "vehiculo" ? <PestanaVehiculo client={client} ctx={ctx} onResultado={notify} /> : null}
          {pestana === "dinero" ? <PestanaDinero client={client} ctx={ctx} onResultado={notify} /> : null}
          {pestana === "documentos" ? <PestanaDocumentos client={client} ctx={ctx} onResultado={notify} /> : null}
          {pestana === "embarque" ? <PestanaEmbarque client={client} ctx={ctx} onResultado={notify} /> : null}
          {pestana === "tareas" ? <PestanaTareas client={client} ctx={ctx} onResultado={notify} /> : null}
          {pestana === "actividad" ? <PestanaActividad client={client} ctx={ctx} eventos={eventos} notificaciones={notificaciones} onResultado={notify} /> : null}
        </>
      ) : null}
    </div>
  );
}
