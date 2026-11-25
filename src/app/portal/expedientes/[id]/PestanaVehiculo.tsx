"use client";

/**
 * Vehículo y compra: ficha, compra y presupuesto; datos reservados (solo
 * equipo); y los "datos de avance" que las compuertas y alertas leen (fechas,
 * DAM, levante, placa, TIVe, zarpe y arribo del embarque). Se editan acá
 * porque sin ellos no hay forma de que la compuerta se cumpla.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { PortalPanel } from "@/components/portal/CrmUI";
import { AreaTexto, Campo, Dato, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { TablaPresupuesto } from "@/components/portal/expedientes/TablaPresupuesto";
import type { Contraparte, ContextoExpediente, TipoContraparte } from "@/core/expedientes/tipos";
import { TIPOS_CONTRAPARTE } from "@/core/expedientes/tipos";
import type { EmbarqueRow, ExpedienteRow } from "@/lib/db/types";
import { actualizarEmbarque, actualizarExpediente, actualizarReservado, crearContraparte, listarContrapartes } from "@/lib/expedientes/consultas";
import { CONTENEDOR_LABEL, CONTRAPARTE_LABEL, MODALIDAD_LABEL, fecha, leerNumero, usd } from "@/lib/expedientes/formato";
import { CATEGORY_LABEL } from "@/lib/stockLabels";
import type { PortalClient } from "@/lib/portal/portalClient";

type Resultado = { ok: boolean; message: string };

export function PestanaVehiculo({
  client,
  ctx,
  onResultado,
}: {
  client: PortalClient;
  ctx: ContextoExpediente;
  onResultado: (r: Resultado) => void;
}) {
  const e = ctx.expediente;
  const v = e.vehiculo;
  const [mostrarPresupuesto, setMostrarPresupuesto] = useState(false);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <PortalPanel title="Vehículo">
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Dato label="Marca y modelo">{v.marca} {v.modelo}{v.version ? ` ${v.version}` : ""}</Dato>
            <Dato label="Año modelo">{v.anio}</Dato>
            <Dato label="VIN">{v.vin ? <span className="font-mono">{v.vin}</span> : "Sin unidad asignada"}</Dato>
            <Dato label="Condición">{v.condicion === "nuevo" ? "Nuevo" : "Usado"}</Dato>
            <Dato label="Categoría">{CATEGORY_LABEL[v.categoria]}</Dato>
            <Dato label="Origen (ad valorem)">{v.origen === "originario-usa" ? "Originario de EE.UU. · 0 %" : "Otro · 6 %"}</Dato>
            <Dato label="Cilindrada">{v.cilindradaCc ? `${v.cilindradaCc} cc` : "—"}</Dato>
            <Dato label="Combustible">{v.combustible ?? "—"}</Dato>
            <Dato label="Transmisión">{v.transmision ?? "—"}</Dato>
            <Dato label="Color">{v.color ?? "—"}</Dato>
            <Dato label="Kilometraje">{v.km !== null ? `${v.km.toLocaleString("es-PE")} km` : "—"}</Dato>
            <Dato label="País de ensamblaje">{v.paisEnsamblaje ?? "—"}</Dato>
            <Dato label="Documento de propiedad">{v.docPropiedad ?? "—"}</Dato>
          </div>
        </PortalPanel>

        <PortalPanel title="Compra" toolbar={e.presupuesto ? <Button size="sm" variant="secondary" onClick={() => setMostrarPresupuesto((m) => !m)}>{mostrarPresupuesto ? "Ocultar Anexo B" : "Ver Anexo B"}</Button> : undefined}>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            <Dato label={`Precio (${e.monedaCompra})`}>{e.precioCompra !== null ? e.precioCompra.toLocaleString("en-US") : "—"}</Dato>
            <Dato label="Precio en USD">{usd(e.precioCompraUsd)}</Dato>
            <Dato label="Precio tope (reservado)">{usd(e.reservado?.precioTope ?? null)}</Dato>
            <Dato label="TC de referencia (reservado)">{e.reservado?.tcCompraRef ?? "—"}</Dato>
            <Dato label="Límite de compra">{fecha(e.fechaLimiteCompra) || "—"}</Dato>
            <Dato label="Origen y puerto">{[e.paisOrigen, e.puertoOrigen].filter(Boolean).join(" · ") || "—"}</Dato>
            <Dato label="Honorarios">{e.honorariosUsd !== null ? `${usd(e.honorariosUsd)} (base ${usd(e.honorariosBaseUsd)} + IGV ${usd(e.honorariosIgvUsd)})` : "—"}</Dato>
            <Dato label="Proporción del flete">{e.proporcionFlete === 1 ? "Exclusivo" : `${Math.round(e.proporcionFlete * 100)} % del contenedor`}</Dato>
          </div>
        </PortalPanel>
      </div>

      {mostrarPresupuesto && e.presupuesto ? <TablaPresupuesto presupuesto={e.presupuesto} /> : null}

      <DatosAvance client={client} ctx={ctx} onResultado={onResultado} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Embarque client={client} ctx={ctx} onResultado={onResultado} />
        <Reservado client={client} ctx={ctx} onResultado={onResultado} />
      </div>

      <Contrapartes client={client} ctx={ctx} onResultado={onResultado} />
    </div>
  );
}

function DatosAvance({ client, ctx, onResultado }: { client: PortalClient; ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const e = ctx.expediente;
  const [f, setF] = useState({
    fecha_firma: e.fechaFirma ?? "",
    loa_vence: e.loaVence ?? "",
    fecha_limite_h2: e.fechaLimiteH2 ?? "",
    fecha_est_embarque: e.fechaEstEmbarque ?? "",
    fecha_est_arribo: e.fechaEstArribo ?? "",
    fecha_est_entrega: e.fechaEstEntrega ?? "",
    fecha_inspeccion: e.fechaInspeccion ?? "",
    historial_ref: e.historialRef ?? "",
    dam_numero: e.damNumero ?? "",
    dam_fecha: e.damFecha ?? "",
    dam_canal: e.damCanal ?? "",
    levante_en: e.levanteEn ?? "",
    placa: e.placa ?? "",
    tive_numero: e.tiveNumero ?? "",
    fecha_entrega: e.fechaEntrega ?? "",
    km_entrega: e.kmEntrega !== null ? String(e.kmEntrega) : "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, valor: string) => setF((p) => ({ ...p, [k]: valor }));

  const guardar = async () => {
    setBusy(true);
    const cambios: Partial<ExpedienteRow> = {
      fecha_firma: f.fecha_firma || null,
      loa_vence: f.loa_vence || null,
      fecha_limite_h2: f.fecha_limite_h2 || null,
      fecha_est_embarque: f.fecha_est_embarque || null,
      fecha_est_arribo: f.fecha_est_arribo || null,
      fecha_est_entrega: f.fecha_est_entrega || null,
      fecha_inspeccion: f.fecha_inspeccion || null,
      historial_ref: f.historial_ref.trim() || null,
      dam_numero: f.dam_numero.trim() || null,
      dam_fecha: f.dam_fecha || null,
      dam_canal: f.dam_canal.trim() || null,
      levante_en: f.levante_en || null,
      placa: f.placa.trim().toUpperCase() || null,
      tive_numero: f.tive_numero.trim() || null,
      fecha_entrega: f.fecha_entrega || null,
      km_entrega: leerNumero(f.km_entrega),
    };
    onResultado(await actualizarExpediente(client, e.id, cambios));
    setBusy(false);
  };

  return (
    <PortalPanel title="Datos de avance" description="Las compuertas y las alertas leen estas fechas y registros. Sin ellos no se puede avanzar sin forzar.">
      <div className="space-y-4 px-5 py-4">
        <Rejilla columnas={4}>
          <Campo label="Firma del contrato"><Entrada type="date" value={f.fecha_firma} onChange={(x) => set("fecha_firma", x.target.value)} /></Campo>
          <Campo label="LOA vence"><Entrada type="date" value={f.loa_vence} onChange={(x) => set("loa_vence", x.target.value)} /></Campo>
          <Campo label="Límite H2"><Entrada type="date" value={f.fecha_limite_h2} onChange={(x) => set("fecha_limite_h2", x.target.value)} /></Campo>
          <Campo label="Inspección"><Entrada type="date" value={f.fecha_inspeccion} onChange={(x) => set("fecha_inspeccion", x.target.value)} /></Campo>
          <Campo label="Embarque estimado"><Entrada type="date" value={f.fecha_est_embarque} onChange={(x) => set("fecha_est_embarque", x.target.value)} /></Campo>
          <Campo label="Arribo estimado" hint="Decide el año de la regla de antigüedad."><Entrada type="date" value={f.fecha_est_arribo} onChange={(x) => set("fecha_est_arribo", x.target.value)} /></Campo>
          <Campo label="Entrega estimada"><Entrada type="date" value={f.fecha_est_entrega} onChange={(x) => set("fecha_est_entrega", x.target.value)} /></Campo>
          <Campo label="Historial (Carfax, AutoCheck…)"><Entrada value={f.historial_ref} onChange={(x) => set("historial_ref", x.target.value)} maxLength={200} /></Campo>
          <Campo label="DAM número"><Entrada value={f.dam_numero} onChange={(x) => set("dam_numero", x.target.value)} maxLength={40} /></Campo>
          <Campo label="DAM fecha"><Entrada type="date" value={f.dam_fecha} onChange={(x) => set("dam_fecha", x.target.value)} /></Campo>
          <Campo label="Canal"><Entrada value={f.dam_canal} onChange={(x) => set("dam_canal", x.target.value)} maxLength={20} placeholder="verde / naranja / rojo" /></Campo>
          <Campo label="Levante"><Entrada type="date" value={f.levante_en} onChange={(x) => set("levante_en", x.target.value)} /></Campo>
          <Campo label="Placa"><Entrada value={f.placa} onChange={(x) => set("placa", x.target.value)} maxLength={12} /></Campo>
          <Campo label="TIVe"><Entrada value={f.tive_numero} onChange={(x) => set("tive_numero", x.target.value)} maxLength={40} /></Campo>
          <Campo label="Fecha de entrega"><Entrada type="date" value={f.fecha_entrega} onChange={(x) => set("fecha_entrega", x.target.value)} /></Campo>
          <Campo label="Km a la entrega"><Entrada value={f.km_entrega} onChange={(x) => set("km_entrega", x.target.value.replace(/\D/g, ""))} inputMode="numeric" /></Campo>
        </Rejilla>
        <Button size="sm" disabled={busy} onClick={() => void guardar()}>{busy ? "Guardando…" : "Guardar datos de avance"}</Button>
      </div>
    </PortalPanel>
  );
}

function Embarque({ client, ctx, onResultado }: { client: PortalClient; ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const b = ctx.embarque;
  const [f, setF] = useState({
    fecha_zarpe_est: b?.fechaZarpeEst ?? "",
    fecha_zarpe_real: b?.fechaZarpeReal ?? "",
    fecha_arribo_est: b?.fechaArriboEst ?? "",
    fecha_arribo_real: b?.fechaArriboReal ?? "",
    nave: b?.nave ?? "",
    master_bl: b?.masterBl ?? "",
  });
  const [busy, setBusy] = useState(false);
  if (!b) {
    return (
      <PortalPanel title="Embarque">
        <p className="px-5 py-6 text-sm text-ink-3">Sin embarque asignado. La gestión de embarques completa llega en la fase 4; por ahora se asigna al crear el expediente.</p>
      </PortalPanel>
    );
  }
  const set = (k: keyof typeof f, valor: string) => setF((p) => ({ ...p, [k]: valor }));
  return (
    <PortalPanel title={`Embarque ${b.codigo}`} description={`${MODALIDAD_LABEL[b.modalidad]}${b.contenedor ? ` · ${CONTENEDOR_LABEL[b.contenedor]}` : ""} · ${b.puertoOrigen ?? "?"} → ${b.puertoDestino}`}>
      <div className="space-y-4 px-5 py-4">
        <Rejilla columnas={2}>
          <Campo label="Zarpe estimado"><Entrada type="date" value={f.fecha_zarpe_est} onChange={(x) => set("fecha_zarpe_est", x.target.value)} /></Campo>
          <Campo label="Zarpe real" hint="Compuerta para tránsito."><Entrada type="date" value={f.fecha_zarpe_real} onChange={(x) => set("fecha_zarpe_real", x.target.value)} /></Campo>
          <Campo label="Arribo estimado"><Entrada type="date" value={f.fecha_arribo_est} onChange={(x) => set("fecha_arribo_est", x.target.value)} /></Campo>
          <Campo label="Arribo real"><Entrada type="date" value={f.fecha_arribo_real} onChange={(x) => set("fecha_arribo_real", x.target.value)} /></Campo>
          <Campo label="Nave"><Entrada value={f.nave} onChange={(x) => set("nave", x.target.value)} maxLength={160} /></Campo>
          <Campo label="Master BL"><Entrada value={f.master_bl} onChange={(x) => set("master_bl", x.target.value)} maxLength={80} /></Campo>
        </Rejilla>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const cambios: Partial<EmbarqueRow> = {
              fecha_zarpe_est: f.fecha_zarpe_est || null,
              fecha_zarpe_real: f.fecha_zarpe_real || null,
              fecha_arribo_est: f.fecha_arribo_est || null,
              fecha_arribo_real: f.fecha_arribo_real || null,
              nave: f.nave.trim() || null,
              master_bl: f.master_bl.trim() || null,
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

function Reservado({ client, ctx, onResultado }: { client: PortalClient; ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const r = ctx.expediente.reservado;
  const [f, setF] = useState({
    precio_tope: r?.precioTope !== null && r?.precioTope !== undefined ? String(r.precioTope) : "",
    tc_compra_ref: r?.tcCompraRef !== null && r?.tcCompraRef !== undefined ? String(r.tcCompraRef) : "",
    notas_internas: r?.notasInternas ?? "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <PortalPanel title="Reservado" description="Solo lo ve el equipo: ni la vista del cliente ni ningún documento lo toman de acá.">
      <div className="space-y-4 px-5 py-4">
        <Rejilla columnas={2}>
          <Campo label={`Precio tope (${ctx.expediente.monedaCompra})`}>
            <Entrada value={f.precio_tope} onChange={(x) => setF((p) => ({ ...p, precio_tope: x.target.value.replace(/[^0-9.,]/g, "") }))} inputMode="decimal" />
          </Campo>
          <Campo label="Tipo de cambio de referencia → USD">
            <Entrada value={f.tc_compra_ref} onChange={(x) => setF((p) => ({ ...p, tc_compra_ref: x.target.value.replace(/[^0-9.,]/g, "") }))} inputMode="decimal" />
          </Campo>
        </Rejilla>
        <Campo label="Notas internas">
          <AreaTexto value={f.notas_internas} onChange={(x) => setF((p) => ({ ...p, notas_internas: x.target.value }))} rows={4} maxLength={8000} />
        </Campo>
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            onResultado(
              await actualizarReservado(client, ctx.expediente.id, {
                precio_tope: leerNumero(f.precio_tope),
                tc_compra_ref: leerNumero(f.tc_compra_ref),
                notas_internas: f.notas_internas.trim() || null,
              }),
            );
            setBusy(false);
          }}
        >
          {busy ? "Guardando…" : "Guardar reservado"}
        </Button>
      </div>
    </PortalPanel>
  );
}

/**
 * Terceros del expediente: vendedor, inspector y agente de aduana (en la parte
 * reservada) y el forwarder (en el embarque). Los documentos los nombran: sin
 * vendedor no hay Anexo A ni instrucciones. La gestión completa de
 * contrapartes (/portal/contrapartes, verificación bancaria) llega en la fase
 * 4; acá se eligen entre las existentes o se crea una con lo mínimo.
 */
function Contrapartes({ client, ctx, onResultado }: { client: PortalClient; ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const r = ctx.expediente.reservado;
  const [todas, setTodas] = useState<Contraparte[]>([]);
  const [f, setF] = useState({
    vendedor_id: r?.vendedorId ?? "",
    inspector_id: r?.inspectorId ?? "",
    agente_aduana_id: r?.agenteAduanaId ?? "",
    forwarder_id: ctx.embarque?.forwarderId ?? "",
  });
  const [nueva, setNueva] = useState({ tipo: "vendedor" as TipoContraparte, nombre: "", pais: "", direccion: "", contacto: "", email: "", telefono: "", ruc_o_tax_id: "" });
  const [busy, setBusy] = useState(false);

  const recargar = async () => setTodas(await listarContrapartes(client));
  useEffect(() => {
    let cancelado = false;
    void listarContrapartes(client).then((lista) => {
      if (!cancelado) setTodas(lista);
    });
    return () => {
      cancelado = true;
    };
  }, [client]);

  const opciones = (tipo: TipoContraparte) => todas.filter((c) => c.tipo === tipo);
  const selector = (label: string, clave: keyof typeof f, tipo: TipoContraparte) => (
    <Campo label={label}>
      <Selector value={f[clave]} onChange={(e) => setF((p) => ({ ...p, [clave]: e.target.value }))}>
        <option value="">— Sin asignar —</option>
        {opciones(tipo).map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}{c.pais ? ` · ${c.pais}` : ""}</option>
        ))}
      </Selector>
    </Campo>
  );

  const guardar = async () => {
    setBusy(true);
    const r1 = await actualizarReservado(client, ctx.expediente.id, {
      vendedor_id: f.vendedor_id || null,
      inspector_id: f.inspector_id || null,
      agente_aduana_id: f.agente_aduana_id || null,
    });
    if (!r1.ok) {
      setBusy(false);
      return onResultado(r1);
    }
    if (ctx.embarque && (ctx.embarque.forwarderId ?? "") !== f.forwarder_id) {
      const r2 = await actualizarEmbarque(client, ctx.embarque.id, { forwarder_id: f.forwarder_id || null });
      setBusy(false);
      return onResultado(r2.ok ? { ok: true, message: "Contrapartes del expediente actualizadas." } : r2);
    }
    setBusy(false);
    onResultado({ ok: true, message: "Contrapartes del expediente actualizadas." });
  };

  const crear = async () => {
    setBusy(true);
    const r = await crearContraparte(client, {
      tipo: nueva.tipo,
      nombre: nueva.nombre,
      pais: nueva.pais,
      direccion: nueva.direccion,
      contacto: nueva.contacto,
      email: nueva.email,
      telefono: nueva.telefono,
      ruc_o_tax_id: nueva.ruc_o_tax_id,
    });
    setBusy(false);
    if (r.ok && r.id) {
      await recargar();
      const clave = nueva.tipo === "vendedor" ? "vendedor_id" : nueva.tipo === "inspector" ? "inspector_id" : nueva.tipo === "agente_aduana" ? "agente_aduana_id" : nueva.tipo === "forwarder" ? "forwarder_id" : null;
      if (clave) setF((p) => ({ ...p, [clave]: r.id as string }));
      setNueva({ tipo: nueva.tipo, nombre: "", pais: "", direccion: "", contacto: "", email: "", telefono: "", ruc_o_tax_id: "" });
    }
    onResultado(r.ok ? { ok: true, message: `${r.message} Elígela arriba y guarda.` } : r);
  };

  return (
    <PortalPanel title="Contrapartes" description="Vendedor, inspector, agente de aduana y forwarder. Los documentos (Anexo A, LOA, instrucciones) toman de aquí nombre, dirección, contacto y RUC.">
      <div className="space-y-5 px-5 py-4">
        <Rejilla columnas={4}>
          {selector("Vendedor", "vendedor_id", "vendedor")}
          {selector("Inspector", "inspector_id", "inspector")}
          {selector("Agente de aduana", "agente_aduana_id", "agente_aduana")}
          {ctx.embarque ? selector("Forwarder (del embarque)", "forwarder_id", "forwarder") : <Dato label="Forwarder">Sin embarque asignado</Dato>}
        </Rejilla>
        <Button size="sm" disabled={busy} onClick={() => void guardar()}>{busy ? "Guardando…" : "Guardar contrapartes"}</Button>

        <div className="border-t border-line pt-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-ink-4">Nueva contraparte</p>
          <div className="mt-3 space-y-3">
            <Rejilla columnas={4}>
              <Campo label="Tipo">
                <Selector value={nueva.tipo} onChange={(e) => setNueva((p) => ({ ...p, tipo: e.target.value as TipoContraparte }))}>
                  {TIPOS_CONTRAPARTE.map((t) => (
                    <option key={t} value={t}>{CONTRAPARTE_LABEL[t]}</option>
                  ))}
                </Selector>
              </Campo>
              <Campo label="Nombre o razón social" requerido><Entrada value={nueva.nombre} onChange={(e) => setNueva((p) => ({ ...p, nombre: e.target.value }))} maxLength={200} /></Campo>
              <Campo label="País"><Entrada value={nueva.pais} onChange={(e) => setNueva((p) => ({ ...p, pais: e.target.value }))} maxLength={80} /></Campo>
              <Campo label="RUC o tax ID"><Entrada value={nueva.ruc_o_tax_id} onChange={(e) => setNueva((p) => ({ ...p, ruc_o_tax_id: e.target.value }))} maxLength={40} /></Campo>
              <Campo label="Dirección completa"><Entrada value={nueva.direccion} onChange={(e) => setNueva((p) => ({ ...p, direccion: e.target.value }))} maxLength={300} /></Campo>
              <Campo label="Contacto"><Entrada value={nueva.contacto} onChange={(e) => setNueva((p) => ({ ...p, contacto: e.target.value }))} maxLength={160} /></Campo>
              <Campo label="Correo"><Entrada type="email" value={nueva.email} onChange={(e) => setNueva((p) => ({ ...p, email: e.target.value }))} maxLength={160} /></Campo>
              <Campo label="Teléfono público"><Entrada value={nueva.telefono} onChange={(e) => setNueva((p) => ({ ...p, telefono: e.target.value }))} maxLength={40} /></Campo>
            </Rejilla>
            <Button size="sm" variant="secondary" disabled={busy || nueva.nombre.trim().length < 2} onClick={() => void crear()}>Crear contraparte</Button>
          </div>
        </div>
      </div>
    </PortalPanel>
  );
}
