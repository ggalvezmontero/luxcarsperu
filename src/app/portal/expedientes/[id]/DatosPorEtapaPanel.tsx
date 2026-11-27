"use client";

/**
 * "Datos que faltan para esta etapa y la siguiente": lo que calcula el core
 * (`datosPorEtapa`) con los documentos de las dos etapas y las columnas de la
 * compuerta siguiente, ya filtrado a lo que está vacío. Cada dato se guarda en
 * su tabla (expediente, parte reservada, cliente, embarque o contraparte) por
 * la Data API con la sesión del equipo; los de la empresa remiten a
 * /portal/configuracion y las contrapartes sin asignar, a Vehículo y compra.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Badge, Notice, PortalPanel } from "@/components/portal/CrmUI";
import { Campo, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { FICHA, type Campo as NombreCampo } from "@/core/expedientes/campos";
import { datosPorEtapa, type DatoFaltante } from "@/core/expedientes/datosPorEtapa";
import { nombreEtapaEquipo } from "@/core/expedientes/etapas";
import type { ContextoExpediente } from "@/core/expedientes/tipos";
import { MODALIDADES_EMBARQUE, TIPOS_CONTENEDOR } from "@/core/expedientes/tipos";
import type { ClienteRow, ContraparteRow, EmbarqueRow, ExpedienteReservadoRow, ExpedienteRow } from "@/lib/db/types";
import { actualizarCliente, actualizarContraparte, actualizarEmbarque, actualizarExpediente, actualizarReservado, cargarCamposFijos } from "@/lib/expedientes/consultas";
import { CONTENEDOR_LABEL, CONTRAPARTE_LABEL, MODALIDAD_LABEL, TIPO_DOCUMENTO_LABEL, leerNumero } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";

type Resultado = { ok: boolean; message: string };

const DESTINO_LABEL: Record<string, string> = {
  expediente: "Expediente y vehículo",
  reservado: "Reservado",
  cliente: "Cliente",
  embarque: "Embarque",
  contraparte: "Contrapartes",
};

/** El valor tal como lo guarda la columna: número, fecha o texto; vacío = no se guarda. */
function convertir(f: DatoFaltante, crudo: string): string | number | null {
  const t = crudo.trim();
  if (!t) return null;
  if (f.origen.tipo === "numero") return leerNumero(t);
  if (f.campo === "VEH_CATEGORIA") return t === "M1" || t === "N1" ? t : null;
  if (f.campo === "VEH_VIN") return t.toUpperCase();
  return t;
}

/** Id de la contraparte del expediente a la que apunta un campo. */
function contraparteId(ctx: ContextoExpediente, cual: DatoFaltante["origen"]["contraparte"]): string | null {
  const r = ctx.expediente.reservado;
  switch (cual) {
    case "vendedor":
      return r?.vendedorId ?? null;
    case "broker":
      return r?.brokerId ?? r?.vendedorId ?? null;
    case "inspector":
      return r?.inspectorId ?? null;
    case "agente_aduana":
      return r?.agenteAduanaId ?? null;
    case "forwarder":
      return ctx.embarque?.forwarderId ?? null;
    default:
      return null;
  }
}

export function DatosPorEtapaPanel({ client, ctx, onResultado }: { client: PortalClient; ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const [fijos, setFijos] = useState<Record<string, string> | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void cargarCamposFijos(ctx.expediente.id).then((f) => {
      if (!cancelado) setFijos(f ?? {});
    });
    return () => {
      cancelado = true;
    };
  }, [ctx.expediente.id]);

  const r = useMemo(() => datosPorEtapa(ctx, (fijos ?? {}) as Partial<Record<NombreCampo, string>>), [ctx, fijos]);
  const porDestino = useMemo(() => {
    const grupos = new Map<string, DatoFaltante[]>();
    for (const f of r.faltantes) grupos.set(f.origen.destino, [...(grupos.get(f.origen.destino) ?? []), f]);
    return [...grupos.entries()];
  }, [r.faltantes]);

  if (ctx.expediente.etapa === "cerrado" || ctx.expediente.etapa === "cancelado") return null;

  const guardar = async () => {
    setBusy(true);
    const e = ctx.expediente;
    const exp: Record<string, unknown> = {};
    const res: Record<string, unknown> = {};
    const cli: Record<string, unknown> = {};
    const emb: Record<string, unknown> = {};
    const contra = new Map<string, Record<string, unknown>>();
    for (const f of r.faltantes) {
      const valor = convertir(f, valores[f.campo] ?? "");
      if (valor === null || !f.origen.columna) continue;
      if (f.origen.destino === "expediente") exp[f.origen.columna] = valor;
      else if (f.origen.destino === "reservado") res[f.origen.columna] = valor;
      else if (f.origen.destino === "cliente") cli[f.origen.columna] = valor;
      else if (f.origen.destino === "embarque") emb[f.origen.columna] = valor;
      else if (f.origen.destino === "contraparte") {
        const id = contraparteId(ctx, f.origen.contraparte);
        if (id) contra.set(id, { ...(contra.get(id) ?? {}), [f.origen.columna]: valor });
      }
    }
    const resultados: Resultado[] = [];
    if (Object.keys(exp).length) resultados.push(await actualizarExpediente(client, e.id, exp as Partial<ExpedienteRow>));
    if (Object.keys(res).length) resultados.push(await actualizarReservado(client, e.id, res as Partial<ExpedienteReservadoRow>));
    if (Object.keys(cli).length && ctx.cliente) resultados.push(await actualizarCliente(client, ctx.cliente.id, cli as Partial<ClienteRow>));
    if (Object.keys(emb).length && ctx.embarque) resultados.push(await actualizarEmbarque(client, ctx.embarque.id, emb as Partial<EmbarqueRow>));
    for (const [id, cambios] of contra) resultados.push(await actualizarContraparte(client, id, cambios as Partial<ContraparteRow>));
    setBusy(false);
    if (resultados.length === 0) return onResultado({ ok: false, message: "Escribe al menos un dato antes de guardar." });
    const fallo = resultados.find((x) => !x.ok);
    if (fallo) return onResultado(fallo);
    setValores({});
    onResultado({ ok: true, message: `Guardado: ${resultados.length === 1 ? "un registro" : `${resultados.length} registros`} actualizados.` });
  };

  const control = (f: DatoFaltante) => {
    const v = valores[f.campo] ?? "";
    const set = (x: string) => setValores((p) => ({ ...p, [f.campo]: x }));
    if (f.campo === "VEH_CATEGORIA") {
      return (
        <Selector value={v} onChange={(x) => set(x.target.value)}>
          <option value="">— Elegir —</option>
          <option value="M1">M1 · autos y SUV</option>
          <option value="N1">N1 · pickups y camionetas</option>
        </Selector>
      );
    }
    if (f.campo === "MODALIDAD_EMBARQUE") {
      return (
        <Selector value={v} onChange={(x) => set(x.target.value)}>
          <option value="">— Elegir —</option>
          {MODALIDADES_EMBARQUE.map((m) => <option key={m} value={m}>{MODALIDAD_LABEL[m]}</option>)}
        </Selector>
      );
    }
    if (f.campo === "TIPO_CONTENEDOR") {
      return (
        <Selector value={v} onChange={(x) => set(x.target.value)}>
          <option value="">— Elegir —</option>
          {TIPOS_CONTENEDOR.map((t) => <option key={t} value={t}>{CONTENEDOR_LABEL[t]}</option>)}
        </Selector>
      );
    }
    return (
      <Entrada
        type={f.origen.tipo === "fecha" ? "date" : "text"}
        inputMode={f.origen.tipo === "numero" ? "decimal" : undefined}
        value={v}
        placeholder={f.origen.tipo === "fecha" ? undefined : `ej. ${FICHA[f.campo].ejemplo}`}
        maxLength={300}
        onChange={(x) => set(x.target.value)}
      />
    );
  };

  const nada = r.faltantes.length === 0 && r.empresa.length === 0 && r.contrapartesSinAsignar.length === 0;
  const etapas = r.etapaSiguiente ? `${nombreEtapaEquipo(r.etapaActual)} y ${nombreEtapaEquipo(r.etapaSiguiente)}` : nombreEtapaEquipo(r.etapaActual);
  const docs = r.documentos.flatMap((d) => d.tipos).filter((t, i, a) => a.indexOf(t) === i);

  return (
    <PortalPanel
      title="Datos que faltan para esta etapa y la siguiente"
      description={`${etapas}: los datos que usan ${docs.length ? docs.map((t) => TIPO_DOCUMENTO_LABEL[t]).join(", ") : "sus documentos"} y los que pide la compuerta siguiente. Cada dato se pide una sola vez y se guarda donde corresponde.`}
    >
      <div className="space-y-4 px-5 py-4">
        {fijos === null ? <p className="text-xs text-ink-4">Leyendo los datos de la empresa…</p> : null}
        {nada && fijos !== null ? <p className="rounded-2xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ink-2">No falta ningún dato para emitir los documentos de estas dos etapas ni para la compuerta siguiente.</p> : null}

        {porDestino.map(([destino, lista]) => (
          <div key={destino}>
            <p className="text-[11px] uppercase tracking-[0.16em] text-ink-4">{DESTINO_LABEL[destino] ?? destino}</p>
            <div className="mt-2">
              <Rejilla columnas={3}>
                {lista.map((f) => (
                  <Campo
                    key={f.campo}
                    label={f.origen.etiqueta}
                    requerido={f.urgente}
                    hint={[f.compuertas.length ? "Lo pide la compuerta siguiente" : null, f.documentos.length ? `Lo usa: ${f.documentos.map((t) => TIPO_DOCUMENTO_LABEL[t]).join(", ")}` : null].filter(Boolean).join(" · ")}
                  >
                    {control(f)}
                  </Campo>
                ))}
              </Rejilla>
            </div>
          </div>
        ))}
        {r.faltantes.length > 0 ? (
          <Button size="sm" disabled={busy} onClick={() => void guardar()}>{busy ? "Guardando…" : "Guardar los datos escritos"}</Button>
        ) : null}

        {r.contrapartesSinAsignar.length > 0 ? (
          <Notice tone="warn" label="Contrapartes sin asignar">
            Los documentos necesitan {r.contrapartesSinAsignar.map((t) => CONTRAPARTE_LABEL[t].toLowerCase()).join(", ")}. Asígnalas en la pestaña Vehículo y compra (sección Contrapartes) y sus datos dejarán de faltar.
          </Notice>
        ) : null}
        {r.empresa.length > 0 ? (
          <Notice tone="warn" label={`${r.empresa.length === 1 ? "Falta un dato" : `Faltan ${r.empresa.length} datos`} de la empresa`}>
            {r.empresa.map((k) => k.replace(/_/g, " ").toLowerCase()).join(", ")}. Se fijan una vez en{" "}
            <Link href="/portal/configuracion" className="underline text-silver-bright">Configuración</Link> y valen para todos los expedientes.
          </Notice>
        ) : null}
        {r.faltantes.some((f) => f.urgente) ? <p className="text-xs text-ink-4"><Badge tone="warn">*</Badge> Urgente: lo usa un documento de esta etapa o lo pide la compuerta siguiente.</p> : null}
      </div>
    </PortalPanel>
  );
}
