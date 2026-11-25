"use client";

/**
 * "Avisar al cliente": elegir la plantilla, completar sus datos, ver la vista
 * previa (la arma el core en el navegador: lo que se ve es lo que se manda) y
 * enviarla por correo o abrir WhatsApp con el texto. La ruta
 * `/api/portal/expedientes/[id]/notificaciones` registra cada envío.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Notice, PortalPanel } from "@/components/portal/CrmUI";
import { AreaTexto, Campo, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { nombreEtapaCliente } from "@/core/expedientes/etapas";
import { estadoHitos } from "@/core/expedientes/ledger";
import {
  PLANTILLAS_NOTIFICACION,
  PLANTILLA_NOTIFICACION_LABEL,
  construirNotificacion,
  enlaceCuenta,
  type DatosNotificacion,
  type PlantillaNotificacion,
} from "@/core/expedientes/notificaciones";
import type { ContextoExpediente } from "@/core/expedientes/tipos";
import { ETAPAS_CLIENTE } from "@/core/expedientes/tipos";
import { LUXCARS_CONFIG } from "@/lib/config";
import { enviarNotificacion } from "@/lib/expedientes/consultas";
import { hoyIso, leerNumero } from "@/lib/expedientes/formato";
import { normalizePhoneForWhatsapp } from "@/lib/whatsappPortal";

type Resultado = { ok: boolean; message: string };

export function AvisarPanel({ ctx, onCerrar, onHecho }: { ctx: ContextoExpediente; onCerrar: () => void; onHecho: (r: Resultado) => void }) {
  const e = ctx.expediente;
  const [plantilla, setPlantilla] = useState<PlantillaNotificacion>("etapa_alcanzada");
  const [f, setF] = useState({ etapa: e.etapa, tarea: "", venceEl: "", instrucciones: "", montoUsd: "", hito: "", fecha: hoyIso(), fechaLimite: "", documento: "", lugar: LUXCARS_CONFIG.contact.address, nota: "" });
  const [busy, setBusy] = useState<"email" | "whatsapp" | null>(null);
  const [ultimo, setUltimo] = useState<{ ok: boolean; texto: string; enlace?: string | null } | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const tareasCliente = ctx.tareas.filter((t) => t.responsable === "cliente" && t.estado === "pendiente");
  const docsVisibles = ctx.documentos.filter((d) => d.visibleCliente && d.estado !== "reemplazado" && d.estado !== "anulado");
  const hitos = useMemo(() => estadoHitos(ctx.hitos, ctx.movimientos, hoyIso()), [ctx.hitos, ctx.movimientos]);
  const h3 = ctx.hitos.find((h) => h.tipo === "H3");

  const datos: DatosNotificacion = useMemo(() => ({
    etapa: f.etapa,
    tarea: f.tarea || undefined,
    venceEl: f.venceEl || null,
    instrucciones: f.instrucciones || null,
    montoUsd: leerNumero(f.montoUsd),
    hito: (f.hito || null) as DatosNotificacion["hito"],
    fecha: f.fecha || null,
    fechaLimite: f.fechaLimite || null,
    documento: f.documento || undefined,
    lugar: f.lugar || null,
    nota: f.nota || null,
  }), [f]);

  const previa = useMemo(() => {
    const v = e.vehiculo;
    return construirNotificacion(plantilla, {
      codigo: e.codigo,
      cliente: ctx.cliente?.representante?.trim() || ctx.cliente?.razonSocial || "",
      auto: [v.marca, v.modelo, String(v.anio)].join(" "),
      etapa: e.etapa,
      enlace: enlaceCuenta(e.codigo, LUXCARS_CONFIG.contact.website),
    }, datos);
  }, [plantilla, datos, ctx.cliente, e]);

  const correo = ctx.cliente?.email ?? null;
  const telefono = normalizePhoneForWhatsapp(ctx.cliente?.telefono);

  const enviar = async (canal: "email" | "whatsapp") => {
    setBusy(canal);
    const r = await enviarNotificacion({ expedienteId: e.id, plantilla, canal, datos });
    setBusy(null);
    if (canal === "whatsapp" && r.enlaceWhatsApp) window.open(r.enlaceWhatsApp, "_blank", "noopener,noreferrer");
    setUltimo({ ok: r.ok, texto: r.message, enlace: r.enlaceWhatsApp });
    onHecho(r);
  };

  const elegirPlantilla = (p: PlantillaNotificacion) => {
    setPlantilla(p);
    if (p === "aviso_h3" && h3) setF((prev) => ({ ...prev, montoUsd: String(h3.montoEstimadoUsd), fechaLimite: h3.fechaLimite ?? "", hito: "H3" }));
    if (p === "tarea_pendiente" && tareasCliente[0]) setF((prev) => ({ ...prev, tarea: tareasCliente[0].titulo, venceEl: tareasCliente[0].venceEl ?? "", instrucciones: tareasCliente[0].descripcion ?? "" }));
    if (p === "documento_disponible" && docsVisibles[0]) setF((prev) => ({ ...prev, documento: docsVisibles[0].titulo }));
    if (p === "deposito_confirmado") {
      const ultimoDep = [...ctx.movimientos].reverse().find((m) => m.tipo === "deposito" && m.estado === "confirmado");
      if (ultimoDep) setF((prev) => ({ ...prev, montoUsd: String(ultimoDep.montoUsd), hito: ultimoDep.hito ?? "", fecha: ultimoDep.fecha }));
    }
  };

  return (
    <PortalPanel
      title="Avisar al cliente"
      description="Elige la plantilla, revisa la vista previa y envíala por correo o abre WhatsApp con el texto listo. Cada envío queda en Actividad."
      toolbar={<Button size="sm" variant="ghost" className="border border-line" onClick={onCerrar}>Cerrar</Button>}
    >
      <div className="grid gap-6 px-5 py-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Campo label="Plantilla">
            <Selector value={plantilla} onChange={(ev) => elegirPlantilla(ev.target.value as PlantillaNotificacion)}>
              {PLANTILLAS_NOTIFICACION.map((p) => <option key={p} value={p}>{PLANTILLA_NOTIFICACION_LABEL[p]}</option>)}
            </Selector>
          </Campo>

          {plantilla === "etapa_alcanzada" ? (
            <Campo label="Etapa">
              <Selector value={f.etapa} onChange={(ev) => set("etapa", ev.target.value)}>
                {ETAPAS_CLIENTE.map((et) => <option key={et} value={et}>{nombreEtapaCliente(et)}</option>)}
              </Selector>
            </Campo>
          ) : null}

          {plantilla === "tarea_pendiente" ? (
            <>
              <Campo label="Tarea" requerido>
                {tareasCliente.length > 0 ? (
                  <Selector value={f.tarea} onChange={(ev) => { const t = tareasCliente.find((x) => x.titulo === ev.target.value); set("tarea", ev.target.value); if (t) { set("venceEl", t.venceEl ?? ""); set("instrucciones", t.descripcion ?? ""); } }}>
                    <option value="">— Elegir —</option>
                    {tareasCliente.map((t) => <option key={t.id} value={t.titulo}>{t.titulo}</option>)}
                  </Selector>
                ) : <Entrada value={f.tarea} onChange={(ev) => set("tarea", ev.target.value)} maxLength={300} placeholder="Qué necesitamos que haga" />}
              </Campo>
              <Rejilla columnas={2}>
                <Campo label="Fecha límite"><Entrada type="date" value={f.venceEl} onChange={(ev) => set("venceEl", ev.target.value)} /></Campo>
              </Rejilla>
              <Campo label="Instrucciones"><AreaTexto value={f.instrucciones} onChange={(ev) => set("instrucciones", ev.target.value)} rows={3} maxLength={2000} /></Campo>
            </>
          ) : null}

          {plantilla === "deposito_confirmado" || plantilla === "aviso_h3" || plantilla === "diferencia_h3" ? (
            <Rejilla columnas={3}>
              <Campo label="Monto (USD)"><Entrada value={f.montoUsd} onChange={(ev) => set("montoUsd", ev.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" /></Campo>
              {plantilla === "deposito_confirmado" ? (
                <>
                  <Campo label="Hito">
                    <Selector value={f.hito} onChange={(ev) => set("hito", ev.target.value)}>
                      <option value="">—</option>
                      {hitos.map((h) => <option key={h.hito.tipo} value={h.hito.tipo}>{h.hito.tipo}</option>)}
                    </Selector>
                  </Campo>
                  <Campo label="Fecha de acreditación"><Entrada type="date" value={f.fecha} onChange={(ev) => set("fecha", ev.target.value)} /></Campo>
                </>
              ) : (
                <Campo label="Fecha límite"><Entrada type="date" value={f.fechaLimite} onChange={(ev) => set("fechaLimite", ev.target.value)} /></Campo>
              )}
            </Rejilla>
          ) : null}

          {plantilla === "documento_disponible" ? (
            <Campo label="Documento" requerido>
              {docsVisibles.length > 0 ? (
                <Selector value={f.documento} onChange={(ev) => set("documento", ev.target.value)}>
                  <option value="">— Elegir —</option>
                  {docsVisibles.map((d) => <option key={d.id} value={d.titulo}>{d.titulo}</option>)}
                </Selector>
              ) : <Entrada value={f.documento} onChange={(ev) => set("documento", ev.target.value)} maxLength={300} placeholder="Ningún documento es visible al cliente todavía" />}
            </Campo>
          ) : null}

          {plantilla === "auto_listo" ? (
            <Rejilla columnas={2}>
              <Campo label="Lugar de entrega"><Entrada value={f.lugar} onChange={(ev) => set("lugar", ev.target.value)} maxLength={300} /></Campo>
              <Campo label="Fecha propuesta"><Entrada type="date" value={f.fecha} onChange={(ev) => set("fecha", ev.target.value)} /></Campo>
            </Rejilla>
          ) : null}

          <Campo label="Nota adicional" hint="Se añade al final del mensaje."><AreaTexto value={f.nota} onChange={(ev) => set("nota", ev.target.value)} rows={2} maxLength={2000} /></Campo>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button size="sm" disabled={busy !== null || !correo} onClick={() => void enviar("email")} title={correo ? `A ${correo}` : "El cliente no tiene correo"}>
              {busy === "email" ? "Enviando…" : correo ? `Enviar correo a ${correo}` : "Sin correo del cliente"}
            </Button>
            <Button size="sm" variant="whatsapp" disabled={busy !== null || !telefono} onClick={() => void enviar("whatsapp")}>
              {busy === "whatsapp" ? "Preparando…" : telefono ? "Abrir WhatsApp" : "Sin teléfono del cliente"}
            </Button>
          </div>
          {ultimo ? (
            <Notice tone={ultimo.ok ? "info" : "danger"} label={ultimo.ok ? "Listo" : "No se pudo"}>
              {ultimo.texto}
              {ultimo.enlace ? <> <a href={ultimo.enlace} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Volver a abrir WhatsApp</a></> : null}
            </Notice>
          ) : null}
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-ink-4">Vista previa</p>
          <div className="mt-2 rounded-lux border border-line bg-surface-2/40 px-4 py-3">
            <p className="text-sm font-medium text-ink">{previa.asunto}</p>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-2">{previa.texto}</pre>
          </div>
        </div>
      </div>
    </PortalPanel>
  );
}
