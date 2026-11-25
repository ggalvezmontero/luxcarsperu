"use client";

/**
 * Embarque del expediente: fechas, nave y master BL del contenedor
 * compartido, los otros expedientes que viajan en él, la proporción de flete
 * de este, enlace al detalle del embarque y el selector para asignar o
 * cambiar de embarque. La operación del contenedor (reparto, zarpe, arribo,
 * instrucciones) vive en /portal/embarques/[id].
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Badge, Notice, PortalPanel } from "@/components/portal/CrmUI";
import { Campo, Dato, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { EtapaBadge } from "@/components/portal/expedientes/Piezas";
import { estadoEmbarque, faltantesEmbarque } from "@/core/expedientes/embarques";
import type { ContextoExpediente, Embarque } from "@/core/expedientes/tipos";
import { asignarEmbarque, cargarEmbarque, listarEmbarques, type ExpedienteDelEmbarque } from "@/lib/expedientes/consultas";
import { CONTENEDOR_LABEL, MODALIDAD_LABEL, fecha, leerNumero, usd } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";
import { ESTADO_EMBARQUE_LABEL, ESTADO_EMBARQUE_TONE } from "../../embarques/EmbarquesScreen";

type Resultado = { ok: boolean; message: string };

export function PestanaEmbarque({ client, ctx, onResultado }: { client: PortalClient; ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const e = ctx.expediente;
  const b = ctx.embarque;
  const [grupo, setGrupo] = useState<ExpedienteDelEmbarque[]>([]);
  const [todos, setTodos] = useState<Embarque[]>([]);
  const [elegido, setElegido] = useState(b?.id ?? "");
  const [proporcion, setProporcion] = useState(String(e.proporcionFlete));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void listarEmbarques(client).then((r) => {
      if (!cancelado) setTodos(r.embarques.filter((x) => estadoEmbarque(x) !== "arribado" || x.id === b?.id));
    });
    if (b) {
      void cargarEmbarque(client, b.id).then((r) => {
        if (!cancelado) setGrupo(r.expedientes);
      });
    }
    return () => {
      cancelado = true;
    };
  }, [client, b]);

  // Sin embarque no hay grupo, aunque quede uno cargado de un embarque anterior.
  const otros = b ? grupo.filter((x) => x.id !== e.id && x.etapa !== "cancelado" && x.embarqueId === b.id) : [];
  const forwarder = b?.forwarderId ? ctx.contrapartes?.find((c) => c.id === b.forwarderId) ?? null : null;
  const terminal = e.etapa === "cerrado" || e.etapa === "cancelado";

  return (
    <div className="space-y-6">
      {b ? (
        <>
          <PortalPanel
            title={`Embarque ${b.codigo}`}
            description={`${MODALIDAD_LABEL[b.modalidad]}${b.contenedor ? ` · ${CONTENEDOR_LABEL[b.contenedor]}` : ""}`}
            toolbar={<Button size="sm" variant="secondary" href={`/portal/embarques/${b.id}`}>Abrir embarque</Button>}
          >
            <div className="space-y-4 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ESTADO_EMBARQUE_TONE[estadoEmbarque(b)]}>{ESTADO_EMBARQUE_LABEL[estadoEmbarque(b)]}</Badge>
                {faltantesEmbarque(b).length > 0 && estadoEmbarque(b) !== "arribado" ? <span className="text-xs text-warn">Falta: {faltantesEmbarque(b).join(", ")}</span> : null}
              </div>
              <Rejilla columnas={4}>
                <Dato label="Ruta">{b.puertoOrigen ?? "?"} → {b.puertoDestino}</Dato>
                <Dato label="Forwarder">{forwarder?.nombre ?? "—"}</Dato>
                <Dato label="Nave">{b.nave ?? "—"}</Dato>
                <Dato label="Master BL">{b.masterBl ? <span className="font-mono">{b.masterBl}</span> : "—"}</Dato>
                <Dato label="Release">{b.fechaReleaseReal ? fecha(b.fechaReleaseReal) : b.fechaReleaseEst ? `est. ${fecha(b.fechaReleaseEst)}` : "—"}</Dato>
                <Dato label="Carga">{b.fechaCarga ? fecha(b.fechaCarga) : "—"}</Dato>
                <Dato label="Zarpe">{b.fechaZarpeReal ? fecha(b.fechaZarpeReal) : b.fechaZarpeEst ? `est. ${fecha(b.fechaZarpeEst)}` : "—"}</Dato>
                <Dato label="Arribo">{b.fechaArriboReal ? fecha(b.fechaArriboReal) : b.fechaArriboEst ? `est. ${fecha(b.fechaArriboEst)}` : "—"}</Dato>
                <Dato label="Proporción del flete de este expediente">{e.proporcionFlete === 1 ? "100 % (exclusivo)" : `${(e.proporcionFlete * 100).toFixed(2)} %`}</Dato>
                <Dato label="Flete que le toca">{b.fleteTotalUsd !== null ? usd(b.fleteTotalUsd * e.proporcionFlete, 2) : "—"}</Dato>
                <Dato label="Flete total del contenedor">{usd(b.fleteTotalUsd, 2)}</Dato>
                <Dato label="Gastos del contenedor">{usd(b.gastosContenedorUsd, 2)}</Dato>
              </Rejilla>
            </div>
          </PortalPanel>

          <PortalPanel title="Otros expedientes del contenedor" description="Comparten flete, fechas y master BL; cada uno tiene su propio house BL y su consignatario.">
            {otros.length === 0 ? (
              <p className="px-5 py-6 text-sm text-ink-3">Este expediente viaja solo en el embarque.</p>
            ) : (
              <ul className="divide-y divide-line">
                {otros.map((x) => (
                  <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                    <div>
                      <Link href={`/portal/expedientes/${x.id}`} className="font-mono text-sm text-ink underline-offset-4 hover:underline">{x.codigo}</Link>
                      <span className="ml-2 text-sm text-ink-2">{x.auto}</span>
                      <p className="text-xs text-ink-4">{x.cliente}{x.vin ? ` · VIN ${x.vin}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-ink-3">{(x.proporcionFlete * 100).toFixed(2)} % del flete</span>
                      <EtapaBadge etapa={x.etapa} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PortalPanel>
        </>
      ) : (
        <Notice tone="info" label="Sin embarque">Este expediente no está en ningún contenedor. Asígnalo abajo o créalo en Embarques.</Notice>
      )}

      {!terminal ? (
        <PortalPanel title={b ? "Cambiar de embarque" : "Asignar embarque"} description="Al cambiar, el reparto del flete del contenedor anterior y del nuevo hay que fijarlo en el detalle del embarque.">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end">
            <Campo label="Embarque" className="flex-1">
              <Selector value={elegido} onChange={(ev) => setElegido(ev.target.value)}>
                <option value="">— Sin embarque —</option>
                {todos.map((x) => (
                  <option key={x.id} value={x.id}>{x.codigo} · {MODALIDAD_LABEL[x.modalidad].split(" (")[0]} · {x.puertoOrigen ?? "?"} → {x.puertoDestino}{x.fechaZarpeEst ? ` · zarpe est. ${fecha(x.fechaZarpeEst)}` : ""}</option>
                ))}
              </Selector>
            </Campo>
            <Campo label="Proporción" hint="1 = exclusivo; 0.5 = mitad.">
              <Entrada value={proporcion} onChange={(ev) => setProporcion(ev.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" className="w-28" disabled={!elegido} />
            </Campo>
            <Button
              size="sm"
              disabled={busy || (elegido === (b?.id ?? "") && (leerNumero(proporcion) ?? 1) === e.proporcionFlete)}
              onClick={async () => {
                setBusy(true);
                const prop = leerNumero(proporcion);
                onResultado(await asignarEmbarque(client, e.id, elegido || null, prop !== null && prop > 0 && prop <= 1 ? prop : undefined));
                setBusy(false);
              }}
            >
              {busy ? "Guardando…" : elegido ? "Asignar" : "Quitar del embarque"}
            </Button>
            <Button size="sm" variant="ghost" className="border border-line" href="/portal/embarques">Ver embarques</Button>
          </div>
        </PortalPanel>
      ) : null}
    </div>
  );
}
