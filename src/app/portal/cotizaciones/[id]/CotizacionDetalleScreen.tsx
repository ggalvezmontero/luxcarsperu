"use client";

/**
 * Detalle de una cotización.
 *   · Borrador: se edita, se genera el PDF/DOCX y se marca como enviada.
 *   · Enviada (o vencida): se acepta (abre un expediente por auto, en búsqueda,
 *     con las mismas cifras), se rechaza o vuelve a borrador.
 *   · Aceptada: enlaces a sus expedientes.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Badge, Notice, PortalPageHeader, PortalPanel } from "@/components/portal/CrmUI";
import { AreaTexto, Campo, Dato, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { EtapaBadge } from "@/components/portal/expedientes/Piezas";
import { usePortalSession } from "@/components/portal/portalSession";
import { calcularCotizacion, estadoEfectivo, importadorCompleto, importadorDe, usd, type ClienteCotizacion } from "@/core/cotizaciones";
import type { ImporterProfile } from "@/core/pricing/pricingConfig";
import {
  aceptarCotizacion,
  cambiarEstadoCotizacion,
  cargarCotizacion,
  completarImportadores,
  generarDocumentoCotizacion,
  guardarCotizacion,
  urlDescargaCotizacion,
  type Cotizacion,
  type ExpedienteDeCotizacion,
} from "@/lib/cotizaciones/consultas";
import { ESTADO_COTIZACION_LABEL, ESTADO_COTIZACION_TONE, hoyLimaIso } from "@/lib/cotizaciones/formato";
import { fecha, fechaHora } from "@/lib/expedientes/formato";
import { CotizacionEditor, TablaResultado } from "../CotizacionEditor";

export function CotizacionDetalleScreen({ id }: { id: string }) {
  const { status, client } = usePortalSession();
  const [q, setQ] = useState<Cotizacion | null>(null);
  const [expedientes, setExpedientes] = useState<ExpedienteDeCotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [aceptando, setAceptando] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [perfil, setPerfil] = useState<ImporterProfile>("primera-importacion");
  const [percepcionEnPago4, setPercepcionEnPago4] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [importadores, setImportadores] = useState<ClienteCotizacion[]>([]);

  const load = useCallback(async () => {
    if (!client) return;
    const r = await cargarCotizacion(client, id);
    setQ(r.cotizacion);
    setExpedientes(r.expedientes);
    setError(r.error ?? (r.cotizacion ? null : "La cotización no existe."));
    setLoading(false);
  }, [client, id]);

  useEffect(() => {
    if (status === "verificando" || !client) return;
    let cancelado = false;
    void cargarCotizacion(client, id).then((r) => {
      if (cancelado) return;
      setQ(r.cotizacion);
      setExpedientes(r.expedientes);
      setError(r.error ?? (r.cotizacion ? null : "La cotización no existe."));
      setLoading(false);
    });
    return () => {
      cancelado = true;
    };
  }, [client, id, status]);

  const resultado = useMemo(() => {
    if (!q) return null;
    try {
      return calcularCotizacion(q.datos);
    } catch {
      return null;
    }
  }, [q]);

  const ejecutar = async (clave: string, fn: () => Promise<{ ok: boolean; message: string }>) => {
    setBusy(clave);
    setFlash(null);
    const r = await fn();
    setBusy(null);
    setFlash({ ok: r.ok, text: r.message });
    if (r.ok) await load();
    return r;
  };

  if (loading && (status === "verificando" || client)) return <p className="mt-8 text-sm text-ink-3">Cargando…</p>;
  if (!q || !client) return <div className="mt-8"><Notice tone="warn" label="No se pudo leer">{error ?? "Hace falta una sesión de administrador."}</Notice></div>;

  const estado = estadoEfectivo(q.estado, q.venceEl, hoyLimaIso());
  const borrador = q.estado === "borrador";
  const aceptable = q.estado === "enviada" || q.estado === "vencida";

  return (
    <div className="mt-6 space-y-8">
      <PortalPageHeader
        eyebrow={q.codigo}
        title={q.cliente.nombre}
        description={q.datos.autos.map((a) => `${a.marca} ${a.modelo} ${a.anio}`).join(" · ")}
        actions={<Badge tone={ESTADO_COTIZACION_TONE[estado]}>{ESTADO_COTIZACION_LABEL[estado]}</Badge>}
      />

      {flash ? <Notice tone={flash.ok ? "info" : "danger"} label={flash.ok ? "Listo" : "No se pudo"}>{flash.text}</Notice> : null}
      {estado === "vencida" && q.estado === "enviada" ? (
        <Notice tone="warn" label="Vencida">La vigencia de 15 días terminó el {fecha(q.venceEl)}. Puedes aceptarla igual si el cliente la confirma, o volverla a borrador para actualizarla.</Notice>
      ) : null}

      <PortalPanel title="Resumen">
        <div className="px-5 py-4">
          <Rejilla columnas={4}>
            <Dato label="Total">{q.totalUsd !== null ? usd(q.totalUsd) : "—"}</Dato>
            <Dato label="Fecha">{fecha(q.fecha)}</Dato>
            <Dato label="Vigencia">{q.venceEl ? `Hasta el ${fecha(q.venceEl)}` : "15 días desde que se envía"}</Dato>
            <Dato label="Documento">{q.tienePdf ? `Versión ${q.documentoVersion} · ${fechaHora(q.documentoGeneradoEn)}` : "Sin generar"}</Dato>
            <Dato label="Cliente">{`${q.cliente.tipo === "empresa" ? "Empresa" : "Persona"}${q.cliente.documento ? ` · ${q.cliente.documento}` : ""}`}</Dato>
            <Dato label="Contacto">{[q.cliente.email, q.cliente.telefono].filter(Boolean).join(" · ") || "—"}</Dato>
            <Dato label="Importadores">{[...new Set(q.datos.autos.map((a) => importadorDe(a, q.cliente).nombre))].join(" · ")}</Dato>
            {q.motivo ? <Dato label="Motivo del rechazo">{q.motivo}</Dato> : null}
          </Rejilla>
          {q.notasInternas ? <p className="mt-4 text-xs text-ink-3">Notas internas: {q.notasInternas}</p> : null}
        </div>
      </PortalPanel>

      <PortalPanel title="Acciones">
        <div className="flex flex-wrap gap-3 px-5 py-4">
          {borrador ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditando((v) => !v)}>{editando ? "Cerrar edición" : "Editar"}</Button>
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void ejecutar("pdf", () => generarDocumentoCotizacion(q.id))}>
                {busy === "pdf" ? "Generando…" : q.tienePdf ? "Regenerar PDF y DOCX" : "Generar PDF y DOCX"}
              </Button>
            </>
          ) : null}
          {q.tienePdf ? (
            <>
              <Button size="sm" variant="ghost" href={urlDescargaCotizacion(q.id, "pdf")}>Descargar PDF</Button>
              <Button size="sm" variant="ghost" href={urlDescargaCotizacion(q.id, "docx")}>Descargar DOCX</Button>
            </>
          ) : null}
          {borrador ? (
            <Button size="sm" disabled={busy !== null || !q.tienePdf} onClick={() => void ejecutar("enviada", () => cambiarEstadoCotizacion(client, q.id, "enviada"))}>
              Marcar como enviada
            </Button>
          ) : null}
          {aceptable ? (
            <>
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() => {
                  setImportadores(q.datos.autos.map((a) => ({ ...importadorDe(a, q.cliente), clienteId: undefined })));
                  setAceptando((v) => !v);
                }}
              >
                Aceptar y abrir expedientes
              </Button>
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setRechazando((v) => !v)}>Rechazada</Button>
              {q.estado === "enviada" ? (
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void ejecutar("vencida", () => cambiarEstadoCotizacion(client, q.id, "vencida"))}>Marcar vencida</Button>
              ) : null}
            </>
          ) : null}
          {q.estado !== "borrador" && q.estado !== "aceptada" ? (
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void ejecutar("borrador", () => cambiarEstadoCotizacion(client, q.id, "borrador"))}>Volver a borrador</Button>
          ) : null}
          {borrador && !q.tienePdf ? <p className="w-full text-xs text-ink-4">Genera el PDF antes de marcarla como enviada.</p> : null}
        </div>

        {aceptando && aceptable ? (
          <div className="space-y-4 border-t border-line px-5 py-4">
            <p className="text-sm text-ink-2">
              Se abre un expediente por auto ({q.datos.autos.length}), en búsqueda, con el presupuesto, los cinco pagos y los datos del cliente de esta cotización.
              {q.datos.autos.length > 1 ? " Quedan juntos en un embarque consolidado nuevo." : ""} El contrato se prepara cuando el cliente aprueba la unidad desde su cuenta.
            </p>
            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-ink-4">Importador de cada auto (obligatorio para aceptar)</p>
              {importadores.map((imp, i) => {
                const cambiar = (c: Partial<ClienteCotizacion>) => setImportadores((p) => p.map((x, j) => (j === i ? { ...x, ...c } : x)));
                return (
                  <div key={i} className="rounded-lux border border-line px-4 py-3">
                    <p className="mb-2 text-sm text-ink">
                      Auto {i + 1} · {q.datos.autos[i].marca} {q.datos.autos[i].modelo}
                      {importadorCompleto(imp) ? null : <span className="ml-2 text-xs text-warn">falta completar</span>}
                    </p>
                    <Rejilla columnas={4}>
                      <Campo label="Tipo">
                        <Selector value={imp.tipo} onChange={(e) => cambiar({ tipo: e.target.value as ClienteCotizacion["tipo"] })}>
                          <option value="empresa">Empresa</option>
                          <option value="persona">Persona natural</option>
                        </Selector>
                      </Campo>
                      <Campo label={imp.tipo === "empresa" ? "Razón social" : "Nombre"} requerido><Entrada value={imp.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} /></Campo>
                      <Campo label={imp.tipo === "empresa" ? "RUC" : "DNI o carné"} requerido><Entrada inputMode="numeric" value={imp.documento} onChange={(e) => cambiar({ documento: e.target.value })} /></Campo>
                      <Campo label="Correo"><Entrada type="email" value={imp.email} onChange={(e) => cambiar({ email: e.target.value })} /></Campo>
                    </Rejilla>
                  </div>
                );
              })}
            </div>
            <Rejilla columnas={2}>
              <Campo label="Perfil del importador" hint="Fija la percepción del expediente.">
                <Selector value={perfil} onChange={(e) => setPerfil(e.target.value as ImporterProfile)}>
                  <option value="primera-importacion">Primera importación (10 %)</option>
                  <option value="recurrente">Importador recurrente (3.5 % nuevo, 5 % usado)</option>
                </Selector>
              </Campo>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-2">
                <input type="checkbox" checked={percepcionEnPago4} onChange={(e) => setPercepcionEnPago4(e.target.checked)} />
                Sumar la percepción al Pago 4 (la cotización la deja aparte)
              </label>
            </Rejilla>
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                void ejecutar("aceptar", async () => {
                  const falta = importadores.findIndex((imp) => !importadorCompleto(imp));
                  if (falta >= 0) return { ok: false, message: `Auto ${falta + 1}: completa la razón social o el nombre y el RUC (11 dígitos) o DNI del importador.` };
                  const c = await completarImportadores(client, q.id, importadores);
                  if (!c.ok) return c;
                  const fresca = await cargarCotizacion(client, q.id);
                  if (!fresca.cotizacion) return { ok: false, message: fresca.error ?? "No se pudo releer la cotización." };
                  const r = await aceptarCotizacion(client, fresca.cotizacion, { perfil, percepcionEnTributos: percepcionEnPago4 });
                  if (r.ok) setAceptando(false);
                  return r;
                })
              }
            >
              {busy === "aceptar" ? "Abriendo…" : "Confirmar aceptación"}
            </Button>
          </div>
        ) : null}

        {rechazando && aceptable ? (
          <div className="space-y-3 border-t border-line px-5 py-4">
            <Campo label="Motivo (opcional)"><AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy !== null}
              onClick={() =>
                void ejecutar("rechazada", async () => {
                  const r = await cambiarEstadoCotizacion(client, q.id, "rechazada", motivo);
                  if (r.ok) setRechazando(false);
                  return r;
                })
              }
            >
              Confirmar rechazo
            </Button>
          </div>
        ) : null}
      </PortalPanel>

      {expedientes.length > 0 ? (
        <PortalPanel title="Expedientes abiertos" description="Nacieron de esta cotización, con sus mismas cifras.">
          <ul className="divide-y divide-line">
            {expedientes.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <Link href={`/portal/expedientes/${e.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-silver">
                  <span>
                    <span className="font-mono text-xs text-silver">{e.codigo}</span>
                    <span className="block text-ink">Auto {e.auto ?? "?"} · {e.vehiculo}</span>
                  </span>
                  <EtapaBadge etapa={e.etapa} />
                </Link>
              </li>
            ))}
          </ul>
          {expedientes[0]?.embarqueId && expedientes.length > 1 ? (
            <p className="border-t border-line px-5 py-3 text-xs text-ink-3">
              Embarque consolidado: <Link href={`/portal/embarques/${expedientes[0].embarqueId}`} className="text-silver hover:text-ink">ver contenedor</Link>
            </p>
          ) : null}
        </PortalPanel>
      ) : null}

      {editando && borrador ? (
        <CotizacionEditor
          inicial={{ cliente: q.cliente, datos: q.datos, notasInternas: q.notasInternas ?? "" }}
          textoGuardar="Guardar cambios"
          onGuardar={async (e) => {
            const r = await ejecutar("guardar", () => guardarCotizacion(client, q.id, e));
            if (r.ok) setEditando(false);
            return r;
          }}
        />
      ) : (
        <PortalPanel title="Costo puesto en Lima y pagos" description="Calculado con las tasas vigentes. La percepción va aparte, fuera del total.">
          {resultado ? <TablaResultado resultado={resultado} /> : <p className="px-5 py-4 text-sm text-ink-3">No se pudo calcular.</p>}
        </PortalPanel>
      )}
    </div>
  );
}
