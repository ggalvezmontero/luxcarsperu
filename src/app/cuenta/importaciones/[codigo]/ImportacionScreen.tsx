"use client";

/**
 * Avance de la importación para el cliente: barra de nueve etapas, texto de
 * la etapa, "Qué necesitamos de ti" con botones para las acciones del portal
 * (van a `cliente_accion_expediente`), hitos, documentos visibles (se bajan por
 * `/api/cuenta/expedientes/archivos`, que firma la URL), vehículo y embarque,
 * actividad visible y WhatsApp al asesor con el código del expediente.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { useCuentaSession } from "@/components/cuenta/cuentaSession";
import { SinCuentas } from "@/components/cuenta/SinCuentas";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { accionDeTarea, definicionEtapa, nombreEtapaCliente } from "@/core/expedientes/etapas";
import type { ContextoExpediente, EtapaExpediente, Evento, Tarea, TipoAprobacion } from "@/core/expedientes/tipos";
import { ETAPAS_CLIENTE } from "@/core/expedientes/tipos";
import { LUXCARS_CONFIG } from "@/lib/config";
import { accionCliente, cargarMiImportacion, urlDescargaDocumentoCliente } from "@/lib/cuenta/expedientes";
import { normalizarCodigo } from "@/core/expedientes/codigo";
import { CONTENEDOR_LABEL, HITO_LABEL, TIPO_DOCUMENTO_LABEL, autoDe, fecha, fechaHora, hoyIso, usd } from "@/lib/expedientes/formato";
import { cn } from "@/lib/utils";

export function ImportacionScreen({ codigo }: { codigo: string }) {
  const router = useRouter();
  const { status, client } = useCuentaSession();
  const [ctx, setCtx] = useState<ContextoExpediente | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const codigoNormal = normalizarCodigo(codigo);

  useEffect(() => {
    if (status === "anonimo") router.replace(`/cuenta/login?next=${encodeURIComponent(`/cuenta/importaciones/${codigoNormal}`)}`);
  }, [status, router, codigoNormal]);

  const load = useCallback(async () => {
    if (!client || status !== "autenticado") {
      setLoading(false);
      return;
    }
    const r = await cargarMiImportacion(client, codigoNormal);
    setCtx(r.ctx);
    setEventos(r.eventos);
    setError(r.error);
    setLoading(false);
  }, [client, status, codigoNormal]);

  useEffect(() => {
    if (status === "verificando") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load, status]);

  if (status === "sin-configurar") return <SinCuentas />;
  if (status !== "autenticado" || loading) {
    return (
      <Section tone="bg" padding="tight">
        <p className="py-16 text-center text-sm text-ink-3">Cargando tu importación…</p>
      </Section>
    );
  }

  if (error) {
    return (
      <Section tone="bg" padding="tight">
        <div role="alert" className="rounded-[22px] border border-danger/30 bg-danger/10 p-6 text-center">
          <p className="text-sm text-ink-2">No se pudo cargar tu importación.</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => void load()}>Reintentar</Button>
        </div>
      </Section>
    );
  }

  if (!ctx) {
    return (
      <Section tone="bg" padding="tight">
        <div className="rounded-[22px] border border-line bg-surface p-6 text-center">
          <p className="text-sm font-semibold text-ink">No encontramos esta importación en tu cuenta</p>
          <p className="mt-2 text-sm text-ink-3">
            Revisa el código ({codigoNormal}) o escríbenos: puede que tu cuenta todavía no esté vinculada al expediente.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button href="/cuenta" variant="secondary" size="sm">Volver a mi cuenta</Button>
            <Button href={waLink(`Hola Luxcars, no veo el expediente ${codigoNormal} en mi cuenta.`)} variant="whatsapp" size="sm">WhatsApp</Button>
          </div>
        </div>
      </Section>
    );
  }

  const e = ctx.expediente;
  const def = definicionEtapa(e.etapa);
  const pendientes = ctx.tareas.filter((t) => t.estado === "pendiente" && t.responsable === "cliente");
  const hoy = hoyIso();
  const wa = waLink(`Hola Luxcars, les escribo por mi expediente ${e.codigo} (${autoDe(e.vehiculo)}).`);

  const notify = (r: { ok: boolean; message: string }) => {
    setFlash({ ok: r.ok, text: r.message });
    if (r.ok) void load();
  };

  return (
    <Section tone="bg" padding="tight">
      <Link href="/cuenta" className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-ink-4 hover:text-ink-2">
        <Icon name="chevronRight" size={12} className="rotate-180" /> Mi cuenta
      </Link>
      <div className="mt-4">
        <SectionHeader
          as="h1"
          eyebrow={e.codigo}
          title={autoDe(e.vehiculo)}
          description={def.descripcionCliente}
          action={<Button href={wa} variant="whatsapp" size="sm">Escribir a mi asesor</Button>}
        />
      </div>

      <div className="mt-8">
        <BarraEtapasCliente actual={e.etapa} />
      </div>

      {flash ? (
        <p role="status" className={cn("mt-6 rounded-2xl border px-4 py-3 text-sm text-ink-2", flash.ok ? "border-ok/30 bg-ok/10" : "border-danger/30 bg-danger/10")}>
          {flash.text}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <article className="rounded-[22px] border border-line bg-surface p-6">
            <h2 className="text-lg font-semibold text-ink">Qué necesitamos de ti</h2>
            <p className="mt-1 text-sm text-ink-3">{def.queNecesitamos}</p>
            {pendientes.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ink-2">Por ahora nada pendiente de tu lado. Te avisamos cuando haga falta.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {pendientes.map((t) => (
                  <TareaCliente key={t.id} tarea={t} hoy={hoy} onAccion={async (tipo, payload) => client ? notify(await accionCliente(client, { expedienteId: e.id, tipo, payload })) : undefined} />
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-[22px] border border-line bg-surface p-6">
            <h2 className="text-lg font-semibold text-ink">Documentos</h2>
            {ctx.documentos.length === 0 ? (
              <p className="mt-3 text-sm text-ink-3">Cuando generemos tu contrato y sus anexos, los verás aquí para descargarlos.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {ctx.documentos.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{TIPO_DOCUMENTO_LABEL[d.tipo]}</p>
                      <p className="text-xs text-ink-4">
                        {d.estado === "firmado" && d.firmadoEn ? `Firmado el ${fecha(d.firmadoEn)}` : `Emitido el ${fecha(d.emitidoEn ?? d.createdAt)}`}
                        {d.version > 1 ? ` · versión ${d.version}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={d.estado === "firmado" ? "ok" : "info"} dot>{d.estado === "firmado" ? "Firmado" : "Emitido"}</Badge>
                      {d.tienePdf || d.tieneFirmado ? (
                        <Button href={urlDescargaDocumentoCliente(d.id)} variant="secondary" size="sm">
                          <Icon name="download" size={14} /> Descargar
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-4">Los enlaces de descarga son personales y duran cinco minutos.</p>
          </article>

          <article className="rounded-[22px] border border-line bg-surface p-6">
            <h2 className="text-lg font-semibold text-ink">Actividad</h2>
            {eventos.length === 0 ? (
              <p className="mt-3 text-sm text-ink-3">Todavía no hay movimientos.</p>
            ) : (
              <ol className="mt-4 divide-y divide-line">
                {eventos.map((ev) => (
                  <li key={ev.id} className="py-3">
                    <p className="text-sm font-medium text-ink">
                      {ev.titulo}{ev.tipo === "etapa" && ev.etapa ? `: ${nombreEtapaCliente(ev.etapa)}` : ""}
                    </p>
                    {ev.detalle ? <p className="mt-1 whitespace-pre-line text-sm text-ink-2">{ev.detalle}</p> : null}
                    <p className="mt-1 text-xs text-ink-4">{fechaHora(ev.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </div>

        <div className="space-y-6">
          {ctx.hitos.length > 0 ? (
            <article className="rounded-[22px] border border-line bg-surface p-6">
              <h2 className="text-base font-semibold text-ink">Pagos previstos</h2>
              <ul className="mt-3 divide-y divide-line">
                {ctx.hitos.map((h) => (
                  <li key={h.tipo} className="py-2.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink">{HITO_LABEL[h.tipo]}</span>
                      <span className="font-semibold tabular-nums text-ink">{usd(h.montoEstimadoUsd)}</span>
                    </div>
                    <p className="text-xs text-ink-4">{h.fechaLimite ? `Hasta el ${fecha(h.fechaLimite)}` : "Fecha por confirmar"}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-4">Montos estimados del Anexo B. Transfiere solo a las cuentas que confirmaste por teléfono.</p>
            </article>
          ) : null}

          <article className="rounded-[22px] border border-line bg-surface p-6">
            <h2 className="text-base font-semibold text-ink">Tu vehículo</h2>
            <dl className="mt-3 grid gap-2 text-sm">
              <Fila k="Modelo" v={autoDe(e.vehiculo)} />
              <Fila k="VIN" v={e.vehiculo.vin ? <span className="font-mono">{e.vehiculo.vin}</span> : "Por asignar"} />
              <Fila k="Condición" v={e.vehiculo.condicion === "nuevo" ? "Nuevo" : "Usado"} />
              {e.vehiculo.color ? <Fila k="Color" v={e.vehiculo.color} /> : null}
              {e.vehiculo.paisEnsamblaje ? <Fila k="Ensamblado en" v={e.vehiculo.paisEnsamblaje} /> : null}
              {e.puertoOrigen ? <Fila k="Sale desde" v={[e.puertoOrigen, e.paisOrigen].filter(Boolean).join(", ")} /> : null}
              {e.placa ? <Fila k="Placa" v={e.placa} /> : null}
            </dl>
          </article>

          <article className="rounded-[22px] border border-line bg-surface p-6">
            <h2 className="text-base font-semibold text-ink">Embarque</h2>
            {ctx.embarque ? (
              <dl className="mt-3 grid gap-2 text-sm">
                <Fila k="Modalidad" v={ctx.embarque.modalidad === "consolidado" ? "Contenedor compartido" : ctx.embarque.modalidad === "roro" ? "Ro-Ro" : "Contenedor exclusivo"} />
                {ctx.embarque.contenedor ? <Fila k="Contenedor" v={CONTENEDOR_LABEL[ctx.embarque.contenedor]} /> : null}
                <Fila k="Ruta" v={`${ctx.embarque.puertoOrigen ?? "—"} → ${ctx.embarque.puertoDestino}`} />
                {ctx.embarque.nave ? <Fila k="Nave" v={ctx.embarque.nave} /> : null}
                <Fila k="Zarpe" v={ctx.embarque.fechaZarpeReal ? fecha(ctx.embarque.fechaZarpeReal) : ctx.embarque.fechaZarpeEst ? `${fecha(ctx.embarque.fechaZarpeEst)} (estimado)` : "Por definir"} />
                <Fila k="Arribo al Callao" v={ctx.embarque.fechaArriboReal ? fecha(ctx.embarque.fechaArriboReal) : ctx.embarque.fechaArriboEst ? `${fecha(ctx.embarque.fechaArriboEst)} (estimado)` : "Por definir"} />
              </dl>
            ) : (
              <dl className="mt-3 grid gap-2 text-sm">
                <Fila k="Embarque estimado" v={e.fechaEstEmbarque ? fecha(e.fechaEstEmbarque) : "Por definir"} />
                <Fila k="Arribo estimado" v={e.fechaEstArribo ? fecha(e.fechaEstArribo) : "Por definir"} />
                <Fila k="Entrega estimada" v={e.fechaEstEntrega ? fecha(e.fechaEstEntrega) : "Por definir"} />
              </dl>
            )}
          </article>
        </div>
      </div>
    </Section>
  );
}

function waLink(texto: string) {
  return `https://wa.me/${LUXCARS_CONFIG.contact.whatsappNumber}?text=${encodeURIComponent(texto)}`;
}

function Fila({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-4">{k}</dt>
      <dd className="text-right text-ink">{v}</dd>
    </div>
  );
}

function BarraEtapasCliente({ actual }: { actual: EtapaExpediente }) {
  const indice = ETAPAS_CLIENTE.indexOf(actual);
  const cancelado = actual === "cancelado";
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-9" aria-label="Etapas de tu importación">
      {ETAPAS_CLIENTE.map((etapa, i) => {
        const pasada = !cancelado && indice > i;
        const activa = etapa === actual;
        return (
          <li key={etapa} className="flex flex-col gap-1.5">
            <span className={cn("h-1.5 rounded-full", activa ? "bg-silver-bright" : pasada ? "bg-silver-dim" : "bg-surface-3")} />
            <span className={cn("text-[11px] leading-tight", activa ? "font-semibold text-ink" : pasada ? "text-ink-3" : "text-ink-4")}>{nombreEtapaCliente(etapa)}</span>
          </li>
        );
      })}
      {cancelado ? (
        <li className="col-span-full">
          <Badge tone="danger" dot>Cancelado</Badge>
        </li>
      ) : null}
    </ol>
  );
}

function TareaCliente({
  tarea: t,
  hoy,
  onAccion,
}: {
  tarea: Tarea;
  hoy: string;
  onAccion: (tipo: TipoAprobacion, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const accion = accionDeTarea(t.clave);
  const [busy, setBusy] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const correr = async (tipo: TipoAprobacion, payload?: Record<string, unknown>) => {
    setBusy(true);
    await onAccion(tipo, payload);
    setBusy(false);
    setConfirmando(false);
  };
  const vencida = Boolean(t.venceEl && t.venceEl < hoy);

  return (
    <li className="rounded-2xl border border-line bg-void/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold text-ink">{t.titulo}</p>
        {t.venceEl ? (
          <Badge tone={vencida ? "danger" : "warn"} dot>
            {vencida ? "Venció" : "Hasta"} el {fecha(t.venceEl)}
          </Badge>
        ) : null}
      </div>
      {t.descripcion ? <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{t.descripcion}</p> : null}

      {accion === "elegir_consolidado" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void correr("elegir_consolidado", { eleccion: "esperar" })}>Esperar al consolidado</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void correr("elegir_consolidado", { eleccion: "embarcar_solo" })}>Embarcar solo</Button>
        </div>
      ) : accion ? (
        confirmando ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-2">¿Confirmas? Queda registrado con fecha y hora.</span>
            <Button size="sm" disabled={busy} onClick={() => void correr(accion)}>{busy ? "…" : "Sí, confirmo"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmando(false)}>Todavía no</Button>
          </div>
        ) : (
          <Button size="sm" className="mt-3" onClick={() => setConfirmando(true)}>
            {ETIQUETA_ACCION[accion]}
          </Button>
        )
      ) : (
        <p className="mt-2 text-xs text-ink-4">Este paso se hace fuera del portal; coordinamos los detalles por WhatsApp.</p>
      )}
    </li>
  );
}

const ETIQUETA_ACCION: Record<TipoAprobacion, string> = {
  aprobar_inspeccion: "Aprobar inspección y precio",
  elegir_consolidado: "Elegir",
  declarar_deposito: "Ya transferí",
  conformidad_rendicion: "Doy conformidad a la rendición",
  confirmar_cuentas: "Confirmo las cuentas",
};
