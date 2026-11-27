"use client";

/**
 * Avance de la importación para el cliente: barra de nueve etapas, texto de
 * la etapa, "Qué necesitamos de ti" con botones para las acciones del portal
 * (van a `cliente_accion_expediente`: aprobar la unidad, "Ya transferí" que
 * sube el comprobante y declara el depósito, "Ya pagué a SUNAT" para el Pago
 * 4), dinero (los cinco pagos en la misma tabla del contrato: Pago, Cuándo,
 * Qué cubre, Monto y Dónde pagas, sin códigos internos, y el estado de su
 * cuenta Fondos de Clientes desde el libro), documentos visibles (se bajan por
 * `/api/cuenta/expedientes/archivos`, que firma la URL), vehículo y embarque,
 * actividad visible y WhatsApp al asesor con el código del expediente.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { useCuentaSession } from "@/components/cuenta/cuentaSession";
import { SinCuentas } from "@/components/cuenta/SinCuentas";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Section, SectionHeader } from "@/components/ui/Section";
import { accionDeTarea, definicionEtapa, hitoDeTarea, nombreEtapaCliente } from "@/core/expedientes/etapas";
import { etiquetaPago, queCubrePago } from "@/core/expedientes/hitos";
import { conceptoDe, datosPago5, estadoPagos, ordenarLibro, saldoCuenta, type PagoDerivado } from "@/core/expedientes/ledger";
import type { ContextoExpediente, EtapaExpediente, Evento, Movimiento, NumeroPago, Tarea, TipoAprobacion } from "@/core/expedientes/tipos";
import { ETAPAS_CLIENTE, PAGO_POR_HITO } from "@/core/expedientes/tipos";
import { LUXCARS_CONFIG } from "@/lib/config";
import { accionCliente, cargarMiImportacion, declararDeposito, urlDescargaComprobanteCliente, urlDescargaDocumentoCliente, type DeclaracionDeposito } from "@/lib/cuenta/expedientes";
import { normalizarCodigo } from "@/core/expedientes/codigo";
import { CONTENEDOR_LABEL, TIPO_DOCUMENTO_LABEL, autoDe, fecha, fechaHora, hoyIso, leerNumero, usd } from "@/lib/expedientes/formato";
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
                  <TareaCliente
                    key={t.id}
                    tarea={t}
                    hoy={hoy}
                    ctx={ctx}
                    onAccion={async (tipo, payload) => client ? notify(await accionCliente(client, { expedienteId: e.id, tipo, payload })) : undefined}
                    onDeclarar={async (datos) => client ? notify(await declararDeposito(client, { expedienteId: e.id, datos })) : undefined}
                  />
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
          <Dinero ctx={ctx} hoy={hoy} />

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
  ctx,
  onAccion,
  onDeclarar,
}: {
  tarea: Tarea;
  hoy: string;
  ctx: ContextoExpediente;
  onAccion: (tipo: TipoAprobacion, payload?: Record<string, unknown>) => Promise<void>;
  onDeclarar: (datos: DeclaracionDeposito) => Promise<void>;
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

      {accion === "declarar_deposito" ? (
        <YaTransferi tarea={t} ctx={ctx} onDeclarar={onDeclarar} />
      ) : accion === "elegir_consolidado" ? (
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
            {accion === "aprobar_unidad" && ctx.expediente.vehiculo.condicion === "usado" ? "Apruebo la unidad, el informe y el precio" : ETIQUETA_ACCION[accion]}
          </Button>
        )
      ) : (
        <p className="mt-2 text-xs text-ink-4">Este paso se hace fuera del portal; coordinamos los detalles por WhatsApp.</p>
      )}
    </li>
  );
}

const ETIQUETA_ACCION: Record<TipoAprobacion, string> = {
  aprobar_unidad: "Apruebo la unidad y el precio",
  aprobar_inspeccion: "Aprobar inspección y precio",
  elegir_consolidado: "Elegir",
  declarar_deposito: "Ya transferí",
  conformidad_rendicion: "Doy conformidad a la rendición",
  confirmar_cuentas: "Confirmo las cuentas",
};

/* -------------------------------------------------------------------------- */
/* Dinero                                                                     */
/* -------------------------------------------------------------------------- */

const CAMPO = "field-lux min-h-10 w-full py-1.5 text-sm";

function YaTransferi({ tarea: t, ctx, onDeclarar }: { tarea: Tarea; ctx: ContextoExpediente; onDeclarar: (datos: DeclaracionDeposito) => Promise<void> }) {
  // El primer hito del pago: el Pago 2 se declara como una sola transferencia (flete, seguro y primera mitad de los honorarios).
  const hito = hitoDeTarea(t.clave) ?? "H2";
  const pago = PAGO_POR_HITO[hito];
  const directo = hito === "H5";
  const derivado = useMemo(() => estadoPagos(ctx.hitos, ctx.movimientos).find((d) => d.pago === pago), [ctx.hitos, ctx.movimientos, pago]);
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(derivado ? String(derivado.pendiente > 0 ? derivado.pendiente : derivado.montoEstimadoUsd) : "");
  const [fechaDep, setFechaDep] = useState(hoyIso());
  const [banco, setBanco] = useState("");
  const [operacion, setOperacion] = useState("");
  const [soles, setSoles] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const porConfirmar = derivado?.porConfirmar ?? 0;

  const enviar = async () => {
    const n = leerNumero(monto);
    if (n === null || n <= 0) return;
    setBusy(true);
    await onDeclarar({ hito, monto: n, fecha: fechaDep, banco, operacion, soles: directo ? leerNumero(soles) : null, comprobante: archivo });
    setBusy(false);
    setAbierto(false);
  };

  return (
    <div className="mt-3">
      {derivado ? (
        <p className="text-xs text-ink-3">
          {derivado.etiqueta}: {usd(derivado.montoEstimadoUsd, 2)}{derivado.directo ? " en soles, al tipo de cambio de SUNAT" : ""} · {derivado.donde}.
          {derivado.acreditado > 0 ? ` Acreditado ${usd(derivado.acreditado, 2)}${derivado.pendiente > 0 ? `; faltan ${usd(derivado.pendiente, 2)}` : ""}.` : ""}
        </p>
      ) : null}
      {porConfirmar > 0 ? (
        <p className="mt-1 rounded-2xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-ink-2">
          Ya declaraste {usd(porConfirmar, 2)}; lo confirmamos en cuanto se acredite en la cuenta.
        </p>
      ) : null}
      {!abierto ? (
        <Button size="sm" className="mt-2" onClick={() => setAbierto(true)}>{directo ? "Ya pagué a SUNAT" : "Ya transferí"}</Button>
      ) : (
        <div className="mt-2 space-y-3 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-ink-2">
            {directo
              ? "Cuéntanos cuánto pagaste a SUNAT con el número de liquidación y adjunta el comprobante. Lo revisamos y seguimos con el levante."
              : `Cuéntanos qué transferiste a la cuenta Fondos de Clientes y adjunta el comprobante.${pago === 2 ? " Es una sola transferencia por todo el Pago 2." : ""} Queda pendiente hasta que la veamos acreditada.`}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[11px] uppercase tracking-[0.12em] text-ink-4">
              {directo ? "Tributos según la DAM (USD)" : "Monto transferido (USD)"}
              <input className={`${CAMPO} mt-1`} inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} />
            </label>
            {directo ? (
              <label className="block text-[11px] uppercase tracking-[0.12em] text-ink-4">
                Pagado en soles (S/)
                <input className={`${CAMPO} mt-1`} inputMode="decimal" value={soles} onChange={(e) => setSoles(e.target.value)} placeholder="ej. 103,920.02" />
              </label>
            ) : null}
            <label className="block text-[11px] uppercase tracking-[0.12em] text-ink-4">
              Fecha de la transferencia
              <input className={`${CAMPO} mt-1`} type="date" value={fechaDep} max={hoyIso()} onChange={(e) => setFechaDep(e.target.value)} />
            </label>
            <label className="block text-[11px] uppercase tracking-[0.12em] text-ink-4">
              {directo ? "Dónde pagaste" : "Banco desde el que transferiste"}
              <input className={`${CAMPO} mt-1`} value={banco} maxLength={120} placeholder={directo ? "ej. Clave SOL o BCP ventanilla" : "ej. BCP"} onChange={(e) => setBanco(e.target.value)} />
            </label>
            <label className="block text-[11px] uppercase tracking-[0.12em] text-ink-4">
              {directo ? "Número de liquidación u operación" : "Número de operación (opcional)"}
              <input className={`${CAMPO} mt-1`} value={operacion} maxLength={60} onChange={(e) => setOperacion(e.target.value)} />
            </label>
          </div>
          <label className="block text-[11px] uppercase tracking-[0.12em] text-ink-4">
            Comprobante (PDF o imagen, hasta 10 MB)
            <input
              type="file"
              accept="application/pdf,image/*"
              className="mt-1 block text-xs normal-case tracking-normal text-ink-2 file:mr-3 file:rounded-full file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-ink"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || leerNumero(monto) === null || banco.trim().length < 2} onClick={() => void enviar()}>
              {busy ? "Enviando…" : directo ? "Declarar mi pago a SUNAT" : "Declarar mi depósito"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}

const COLUMNAS_PAGOS = "sm:grid-cols-[6.5rem_minmax(0,1.1fr)_minmax(0,1.5fr)_7.5rem_minmax(0,1fr)]";

/** Estado de un pago en palabras del cliente. */
function EstadoPago({ p }: { p: PagoDerivado }) {
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      <Badge tone={p.estado === "acreditado" ? "ok" : p.estado === "parcial" ? "warn" : p.vencido ? "danger" : "neutral"} dot>
        {p.estado === "acreditado" ? "Pagado" : p.estado === "parcial" ? `Parcial · ${usd(p.acreditado)}` : p.vencido ? "Vencido" : "Pendiente"}
      </Badge>
      {p.porConfirmar > 0 ? <Badge tone="warn">Por confirmar · {usd(p.porConfirmar)}</Badge> : null}
    </span>
  );
}

/** Nota del monto: exacto si ya hay aviso (Pagos 3 a 5) o si es el precio; estimado si no. */
function notaMonto(ctx: ContextoExpediente, p: PagoDerivado): string {
  if (p.pago === 1 || p.estado === "acreditado") return p.directo ? "en soles" : "";
  const hito = p.hitos[p.hitos.length - 1]?.tipo;
  const aviso = p.pago >= 3 ? ctx.documentos.find((d) => d.tipo === "aviso_h3" && d.hito === hito && d.estado !== "reemplazado" && d.estado !== "anulado") : undefined;
  const base = aviso ? "exacto, según el aviso" : p.pago === 5 ? "antes del ajuste de aduana" : "estimado";
  return p.directo ? `${base}; en soles` : base;
}

function Dinero({ ctx, hoy }: { ctx: ContextoExpediente; hoy: string }) {
  const pagosCliente = useMemo(() => estadoPagos(ctx.hitos, ctx.movimientos, hoy), [ctx.hitos, ctx.movimientos, hoy]);
  const libro = useMemo(() => ordenarLibro(ctx.movimientos), [ctx.movimientos]);
  const confirmados = libro.filter((m) => m.estado === "confirmado");
  const enFondos = confirmados.filter((m) => m.cuenta === "fondos_clientes");
  const suma = (lista: Movimiento[]) => lista.reduce((s, m) => s + m.montoUsd, 0);
  const depositos = enFondos.filter((m) => m.tipo === "deposito");
  const honorarios = enFondos.filter((m) => m.tipo === "pago" && conceptoDe(m).clave === "aplicacion_honorarios");
  const pagosTerceros = enFondos.filter((m) => m.tipo === "pago" && conceptoDe(m).clave !== "aplicacion_honorarios");
  const devoluciones = enFondos.filter((m) => m.tipo === "devolucion");
  const ajustes = enFondos.filter((m) => m.tipo === "ajuste");
  const aSunat = confirmados.filter((m) => m.tipo === "deposito" && m.cuenta === "directo");
  const detraccionCliente = confirmados.filter((m) => m.tipo === "deposito" && m.cuenta === "detracciones");
  const porConfirmar = libro.filter((m) => m.estado === "por_confirmar");
  const saldo = saldoCuenta(ctx.movimientos, "fondos_clientes");
  const hayLiquidacion = ctx.documentos.some((d) => d.tipo === "liquidacion_definitiva");
  const p5 = datosPago5(ctx);
  const usado = ctx.expediente.vehiculo.condicion === "usado";
  if (ctx.hitos.length === 0 && libro.length === 0) return null;

  return (
    <article className="rounded-[22px] border border-line bg-surface p-6">
      <h2 className="text-base font-semibold text-ink">Tus cinco pagos</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">Pagas todo a una sola cuenta: Fondos de Clientes de LUXCARS. Solo el Pago 4 va directo a SUNAT.</p>
      {pagosCliente.length > 0 ? (
        <div role="table" aria-label="Calendario de pagos" className="mt-4 text-sm">
          <div role="row" className={cn("hidden gap-3 border-b border-line pb-2 text-[11px] uppercase tracking-[0.12em] text-ink-4 sm:grid", COLUMNAS_PAGOS)}>
            <span role="columnheader">Pago</span>
            <span role="columnheader">Cuándo</span>
            <span role="columnheader">Qué cubre</span>
            <span role="columnheader" className="text-right">Monto</span>
            <span role="columnheader">Dónde pagas</span>
          </div>
          {pagosCliente.map((p) => {
            const nota = notaMonto(ctx, p);
            return (
              <div role="row" key={p.pago} className={cn("grid gap-1.5 border-b border-line/70 py-3 sm:gap-3", COLUMNAS_PAGOS)}>
                <div role="cell">
                  <p className="font-semibold text-ink">{p.etiqueta}</p>
                  <EstadoPago p={p} />
                </div>
                <div role="cell" className="text-ink-2">
                  <span className="mr-1 text-[11px] uppercase tracking-[0.12em] text-ink-4 sm:hidden">Cuándo:</span>
                  {p.cuando}
                  {p.fechaLimite && p.estado !== "acreditado" ? <span className={cn("block text-xs", p.vencido ? "text-danger" : "text-ink-4")}>{p.vencido ? "Venció" : "Hasta"} el {fecha(p.fechaLimite)}</span> : null}
                </div>
                <div role="cell" className="text-ink-2">
                  <span className="mr-1 text-[11px] uppercase tracking-[0.12em] text-ink-4 sm:hidden">Qué cubre:</span>
                  {queCubrePago(p.pago as NumeroPago, usado)}
                </div>
                <div role="cell" className="sm:text-right">
                  <span className="mr-1 text-[11px] uppercase tracking-[0.12em] text-ink-4 sm:hidden">Monto:</span>
                  <span className="font-semibold tabular-nums text-ink">{usd(p.montoEstimadoUsd)}</span>
                  {nota ? <span className="block text-xs text-ink-4">{nota}</span> : null}
                </div>
                <div role="cell" className="text-ink-2">
                  <span className="mr-1 text-[11px] uppercase tracking-[0.12em] text-ink-4 sm:hidden">Dónde pagas:</span>
                  {p.donde}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      <p className="mt-3 text-xs leading-relaxed text-ink-4">Los montos exactos de los Pagos 3, 4 y 5 te llegan en un aviso: qué pago es, cuánto, dónde pagar y hasta cuándo. Transfiere solo a la cuenta Fondos de Clientes que confirmaste por teléfono.</p>

      {libro.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">Tu cuenta Fondos de Clientes</h3>
          <dl className="mt-2 grid gap-2 text-sm">
            <Fila k="Lo que depositaste" v={usd(suma(depositos), 2)} />
            {porConfirmar.length > 0 ? <Fila k="Por confirmar" v={<span className="text-warn">{usd(suma(porConfirmar), 2)}</span>} /> : null}
            <Fila k="Pagos a terceros por tu cuenta" v={`− ${usd(suma(pagosTerceros), 2)}`} />
            {honorarios.length > 0 ? <Fila k="Honorarios de LUXCARS (facturas emitidas)" v={`− ${usd(suma(honorarios), 2)}`} /> : null}
            {ajustes.length > 0 ? <Fila k="Reposiciones de LUXCARS" v={`+ ${usd(suma(ajustes), 2)}`} /> : null}
            {devoluciones.length > 0 ? <Fila k="Devuelto a ti" v={`− ${usd(suma(devoluciones), 2)}`} /> : null}
            <Fila k="Saldo" v={<span className={cn("font-semibold", saldo < -0.01 ? "text-danger" : "text-ink")}>{usd(saldo, 2)}</span>} />
            {aSunat.length > 0 ? <Fila k="Pagado por ti directo a SUNAT" v={usd(suma(aSunat), 2)} /> : null}
            {detraccionCliente.length > 0 ? <Fila k="Detracción que depositaste en el Banco de la Nación" v={usd(suma(detraccionCliente), 2)} /> : null}
          </dl>
          {hayLiquidacion && (p5.aduana.recibido > 0 || p5.aduana.pagado > 0) ? (
            <p className={cn("mt-3 rounded-2xl border px-3 py-2 text-xs text-ink-2", p5.aduana.saldo < -0.01 ? "border-warn/30 bg-warn/10" : "border-ok/30 bg-ok/10")}>
              {p5.aduana.saldo < -0.01
                ? `Gastos de aduana: se pagaron ${usd(Math.abs(p5.aduana.saldo), 2)} más de lo que depositaste en el Pago 3. Se suman al Pago 5, que queda en ${usd(p5.neto, 2)}.`
                : `Gastos de aduana: sobraron ${usd(p5.aduana.saldo, 2)} del Pago 3. Se descuentan del Pago 5, que queda en ${usd(p5.neto, 2)}.`}
            </p>
          ) : null}
          <ol className="mt-3 divide-y divide-line">
            {[...libro].reverse().map((m) => <MovimientoCliente key={m.id} m={m} />)}
          </ol>
          <p className="mt-3 text-xs text-ink-4">Cada pago a terceros va con el documento a tu nombre. Al emitir cada factura de honorarios tomamos su importe de esta cuenta. Los comprobantes se descargan con un enlace personal de cinco minutos.</p>
        </div>
      ) : null}
    </article>
  );
}

function MovimientoCliente({ m }: { m: Movimiento }) {
  const resta = m.tipo === "pago" || m.tipo === "devolucion";
  const delPago = m.hito ? ` · ${etiquetaPago(PAGO_POR_HITO[m.hito])}` : "";
  const factura = /factura (\d)/i.exec(m.concepto ?? "")?.[1];
  const titulo =
    m.tipo === "deposito"
      ? m.cuenta === "directo" ? `Tu pago directo a SUNAT${delPago}` : m.cuenta === "detracciones" ? `Tu depósito de la detracción${delPago}` : `Tu depósito${delPago}`
      : m.tipo === "pago"
        ? conceptoDe(m).clave === "aplicacion_honorarios" ? `Honorarios de LUXCARS${factura ? ` · factura ${factura}` : ""}` : `Pago por tu cuenta${m.concepto ? `: ${m.concepto}` : ""}`
        : m.tipo === "devolucion" ? "Devolución a tu cuenta" : `Ajuste${m.concepto ? `: ${m.concepto}` : ""}`;
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="text-ink">
          {titulo}
          {m.estado === "por_confirmar" ? <Badge tone="warn" className="ml-2">Por confirmar</Badge> : null}
        </p>
        <p className="text-xs text-ink-4">
          {fecha(m.fecha)}
          {m.documentoRef ? ` · ${m.documentoRef}` : ""}
          {(m.moneda ?? "USD") !== "USD" && m.monto ? ` · ${m.moneda} ${m.monto.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""}
          {m.tieneComprobante ? <> · <a className="underline" href={urlDescargaComprobanteCliente(m.id)}>comprobante</a></> : null}
        </p>
      </div>
      <span className={cn("tabular-nums", resta ? "text-ink-2" : "font-medium text-ink")}>{resta ? "−" : "+"}{usd(m.montoUsd, 2)}</span>
    </li>
  );
}
