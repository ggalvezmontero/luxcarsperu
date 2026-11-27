"use client";

/**
 * Dinero del expediente: los seis hitos agrupados en los cinco pagos con su
 * estado derivado del libro, depósitos declarados por el cliente (confirmar
 * emite la constancia; el pago directo a SUNAT se confirma sin constancia;
 * anular exige motivo), el libro por fecha con filtro por cuenta, el
 * formulario para registrar un movimiento (con comprobante y, en pagos al
 * exterior, la comisión bancaria que repone Luxcars) y los documentos que
 * nacen del libro: avisos de los Pagos 3, 4 y 5, liquidación definitiva y acta
 * de entrega y rendición.
 *
 * Una sola cuenta para el cliente (27 nov 2026): todo lo que paga entra a
 * Fondos de Clientes, salvo los tributos (directo a SUNAT). El panel
 * "Honorarios y detracción" aplica cada factura de honorarios de Fondos de
 * Clientes a Operaciones y registra la autodetracción (constancia del Banco de
 * la Nación) dentro de los cinco días hábiles de recibido el pago.
 *
 * Las reglas (saldo, estado de hitos, saldo de aduana y Pago 5 neto) las
 * calcula el core al leer (`ledger.ts`). Las escrituras van por la ruta
 * `/api/portal/expedientes/[id]/movimientos`, que llama a
 * `registrar_movimiento` y emite la constancia; los documentos por
 * `/api/portal/expedientes/[id]/documentos`.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Badge, Notice, PortalPanel, StatCard, StatGrid, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import { AreaTexto, Campo, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { FICHA, fechaEnLetras, monto as montoTexto, type Campo as NombreCampo } from "@/core/expedientes/campos";
import { plantillaDe } from "@/core/expedientes/documentos";
import { FACTURA_POR_HITO, HITOS_HONORARIOS, TAREA_AUTODETRACCION_POR_HITO, type HitoHonorarios } from "@/core/expedientes/etapas";
import { detraccionSugerida, importeFactura, llevaDetraccion } from "@/core/expedientes/honorarios";
import { CUENTA_POR_HITO, DIAS_HABILES_PAGO_TRIBUTOS, etiquetaPago, sumarDiasHabiles } from "@/core/expedientes/hitos";
import { CONCEPTOS_PAGO_TERCEROS, comisionesBancarias, conceptoDe, datosPago5, estadoHitos, ordenarLibro, saldoFondos, type HitoConAviso } from "@/core/expedientes/ledger";
import type { ContextoExpediente, CuentaMovimiento, Movimiento, TipoDocumento, TipoHito, TipoMovimiento } from "@/core/expedientes/tipos";
import { CUENTAS_MOVIMIENTO, PAGO_POR_HITO, TIPOS_HITO, TIPOS_MOVIMIENTO } from "@/core/expedientes/tipos";
import {
  anularDeposito,
  confirmarDeposito,
  emitirDocumentoDelLibro,
  registrarMovimiento,
  registrarOperacionHonorarios,
  subirComprobanteMovimiento,
  urlDescargaComprobante,
  type DatosMovimiento,
} from "@/lib/expedientes/consultas";
import {
  CUENTA_LABEL,
  ESTADO_HITO_LABEL,
  ESTADO_HITO_TONE,
  ESTADO_MOVIMIENTO_LABEL,
  ESTADO_MOVIMIENTO_TONE,
  HITO_LABEL,
  PAGO_LABEL,
  TIPO_DOCUMENTO_LABEL,
  TIPO_MOVIMIENTO_LABEL,
  dinero,
  fecha,
  hoyIso,
  leerNumero,
  usd,
} from "@/lib/expedientes/formato";
import { bancoSinVerificar } from "@/lib/expedientes/mapeo";
import type { PortalClient } from "@/lib/portal/portalClient";

type Resultado = { ok: boolean; message: string };

export function PestanaDinero({ ctx, onResultado }: { client: PortalClient; ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const declarados = ctx.movimientos.filter((m) => m.estado === "por_confirmar");
  return (
    <div className="space-y-6">
      <Hitos ctx={ctx} />
      {declarados.length > 0 ? <Declarados ctx={ctx} declarados={declarados} onResultado={onResultado} /> : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Libro ctx={ctx} onResultado={onResultado} />
        </div>
        <div className="space-y-6">
          <HonorariosYDetraccion ctx={ctx} onResultado={onResultado} />
          <RegistrarMovimiento ctx={ctx} onResultado={onResultado} />
          <DocumentosDelLibro ctx={ctx} onResultado={onResultado} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hitos y saldos                                                             */
/* -------------------------------------------------------------------------- */

function Hitos({ ctx }: { ctx: ContextoExpediente }) {
  const hoy = hoyIso();
  const derivados = useMemo(() => estadoHitos(ctx.hitos, ctx.movimientos, hoy), [ctx.hitos, ctx.movimientos, hoy]);
  const saldo = useMemo(() => saldoFondos(ctx.movimientos), [ctx.movimientos]);
  const p5 = useMemo(() => datosPago5(ctx), [ctx]);
  const comisiones = useMemo(() => comisionesBancarias(ctx.movimientos), [ctx.movimientos]);

  return (
    <div className="space-y-4">
      <StatGrid>
        <StatCard label="Fondos de clientes" value={usd(saldo.fondos_clientes, 2)} hint="Depósitos menos pagos y devoluciones" tone={saldo.fondos_clientes < -0.01 ? "danger" : "accent"} />
        <StatCard
          label="Operaciones"
          value={usd(saldo.operaciones, 2)}
          hint={`Honorarios aplicados desde Fondos de Clientes, menos la detracción depositada${saldo.detracciones > 0.005 ? ` · detracciones ${usd(saldo.detracciones, 2)}` : ""}`}
        />
        <StatCard label="Pagado directo a SUNAT" value={usd(saldo.directo, 2)} hint="Pago 4 (H5): no pasa por Luxcars" />
        <StatCard
          label="Saldo de aduana"
          value={p5.aduana.recibido > 0 || p5.aduana.pagado > 0 ? `${p5.aduana.saldo < 0 ? "−" : ""}${usd(Math.abs(p5.aduana.saldo), 2)}` : "—"}
          hint={`Pago 3 recibido menos pagado; Pago 5 neto ${usd(p5.neto, 2)}${comisiones.cargadas > 0 ? ` · comisiones repuestas ${usd(comisiones.repuestas, 2)} de ${usd(comisiones.cargadas, 2)}` : ""}`}
          tone={p5.aduana.saldo < -0.01 || Math.abs(comisiones.efecto) > 0.01 ? "warn" : "default"}
        />
      </StatGrid>

      <PortalPanel title="Pagos y hitos" description="Cinco pagos, seis hitos. El cliente paga todo a Fondos de Clientes, salvo el Pago 4, que paga directo a SUNAT. El Pago 2 es una sola transferencia (H2 + H3): se reparte primero al H2 y el resto al H3. Estado derivado de los depósitos confirmados; la tarea del cliente queda hecha al confirmar el pago completo.">
        {derivados.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-3">Sin presupuesto: el expediente se abrió sin hitos.</p>
        ) : (
          <TableScroll>
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="border-b border-line">
                <tr>
                  <Th>Pago</Th>
                  <Th>Hito</Th>
                  <Th>Cuenta</Th>
                  <Th>Fecha límite</Th>
                  <Th align="right">Estimado</Th>
                  <Th align="right">Acreditado</Th>
                  <Th align="right">Por confirmar</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {derivados.map((d) => (
                  <tr key={d.hito.tipo}>
                    <Td><span className="whitespace-nowrap text-xs text-ink-3">{PAGO_LABEL[PAGO_POR_HITO[d.hito.tipo]].split(" · ")[0]}</span></Td>
                    <Td>
                      <p className="text-ink">{HITO_LABEL[d.hito.tipo]}</p>
                      {d.hito.nota ? <p className="mt-0.5 text-xs text-ink-4">{d.hito.nota}</p> : null}
                    </Td>
                    <Td>{CUENTA_LABEL[d.hito.cuenta]}</Td>
                    <Td>
                      {d.hito.fechaLimite ? fecha(d.hito.fechaLimite) : "—"}
                      {d.vencido ? <Badge tone="danger" className="ml-2">Vencido</Badge> : null}
                    </Td>
                    <Td align="right"><span className="tabular-nums">{usd(d.hito.montoEstimadoUsd, 2)}</span></Td>
                    <Td align="right"><span className="tabular-nums text-ink">{usd(d.acreditado, 2)}</span></Td>
                    <Td align="right"><span className="tabular-nums text-ink-3">{d.porConfirmar > 0 ? usd(d.porConfirmar, 2) : "—"}</span></Td>
                    <Td>
                      <Badge tone={ESTADO_HITO_TONE[d.estado]}>{ESTADO_HITO_LABEL[d.estado]}</Badge>
                      {d.estado === "parcial" ? <p className="mt-1 text-xs text-ink-4">Faltan {usd(d.pendiente, 2)}</p> : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </PortalPanel>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Depósitos declarados por el cliente                                        */
/* -------------------------------------------------------------------------- */

function Declarados({ ctx, declarados, onResultado }: { ctx: ContextoExpediente; declarados: Movimiento[]; onResultado: (r: Resultado) => void }) {
  return (
    <PortalPanel
      title={`Depósitos declarados por el cliente (${declarados.length})`}
      description="El cliente los declaró desde su cuenta. Confirmar los acredita en el libro, emite la constancia de fondos visible para él y, con el pago completo, cierra su tarea. Anular exige un motivo que el cliente verá."
    >
      <ul className="divide-y divide-line">
        {declarados.map((m) => (
          <Declarado key={m.id} ctx={ctx} m={m} onResultado={onResultado} />
        ))}
      </ul>
    </PortalPanel>
  );
}

function Declarado({ ctx, m, onResultado }: { ctx: ContextoExpediente; m: Movimiento; onResultado: (r: Resultado) => void }) {
  const [modo, setModo] = useState<"ninguno" | "confirmar" | "anular">("ninguno");
  const [monto, setMonto] = useState(String(m.montoUsd));
  const [fechaMov, setFechaMov] = useState(m.fecha);
  const [hito, setHito] = useState<TipoHito | "">(m.hito ?? "");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const directo = m.cuenta === "directo";
  const confirmar = async () => {
    const n = leerNumero(monto);
    if (n === null || n <= 0) return onResultado({ ok: false, message: "El monto debe ser mayor que cero." });
    setBusy(true);
    // Pago directo a SUNAT: el monto del movimiento es el de soles; se corrige solo el equivalente en USD.
    const cambios = directo ? { monto_usd: n, fecha: fechaMov, hito: hito || null } : { monto: n, fecha: fechaMov, hito: hito || null };
    const r = await confirmarDeposito({ expedienteId: ctx.expediente.id, movimientoId: m.id, cambios });
    setBusy(false);
    if (r.ok) setModo("ninguno");
    onResultado(r);
  };
  const anular = async () => {
    setBusy(true);
    const r = await anularDeposito({ expedienteId: ctx.expediente.id, movimientoId: m.id, motivo });
    setBusy(false);
    if (r.ok) setModo("ninguno");
    onResultado(r);
  };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink">
            {usd(m.montoUsd, 2)} · {m.hito ? HITO_LABEL[m.hito] : "Sin hito"}
            {directo ? <Badge tone="info" className="ml-2">Pagado directo a SUNAT{m.moneda === "PEN" && m.monto ? ` · S/ ${m.monto.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : ""}</Badge> : null}
          </p>
          <p className="mt-0.5 text-xs text-ink-4">
            Transferido el {fecha(m.fecha)}{m.documentoRef ? ` · ${m.documentoRef}` : ""} · declarado {fecha(m.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.tieneComprobante ? <Button size="sm" variant="ghost" className="border border-line" href={urlDescargaComprobante(m.id)}>Comprobante</Button> : <Badge tone="neutral">Sin comprobante</Badge>}
          <Button size="sm" onClick={() => setModo(modo === "confirmar" ? "ninguno" : "confirmar")}>Confirmar</Button>
          <Button size="sm" variant="ghost" className="border border-line" onClick={() => setModo(modo === "anular" ? "ninguno" : "anular")}>Anular</Button>
        </div>
      </div>
      {modo === "confirmar" ? (
        <div className="mt-3 rounded-lux border border-line bg-surface-2 p-4">
          <p className="text-xs text-ink-3">{directo ? "Revisa el comprobante de SUNAT o del banco. El monto es el equivalente en USD según la DAM; no se emite constancia (no pasó por Luxcars)." : "Corrige el monto o la fecha con lo que realmente llegó a la cuenta. Al confirmar se emite la constancia."}</p>
          <div className="mt-3">
            <Rejilla columnas={3}>
              <Campo label={directo ? "Monto según la DAM (USD)" : "Monto acreditado (USD)"}><Entrada inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Campo>
              <Campo label="Fecha de acreditación"><Entrada type="date" value={fechaMov} onChange={(e) => setFechaMov(e.target.value)} /></Campo>
              <Campo label="Hito">
                <Selector value={hito} onChange={(e) => setHito(e.target.value as TipoHito | "")}>
                  <option value="">Sin hito</option>
                  {TIPOS_HITO.map((h) => <option key={h} value={h}>{HITO_LABEL[h]}</option>)}
                </Selector>
              </Campo>
            </Rejilla>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => void confirmar()}>{busy ? "Confirmando…" : directo ? "Confirmar el pago a SUNAT" : "Confirmar y emitir constancia"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setModo("ninguno")}>Cancelar</Button>
          </div>
        </div>
      ) : null}
      {modo === "anular" ? (
        <div className="mt-3 rounded-lux border border-line bg-surface-2 p-4">
          <Campo label="Motivo (el cliente lo verá en su actividad)" requerido>
            <AreaTexto value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. El depósito no llegó a la cuenta de Fondos de Clientes; verifica el CCI y vuelve a declararlo." maxLength={2000} />
          </Campo>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="secondary" disabled={busy || motivo.trim().length < 5} onClick={() => void anular()}>{busy ? "Anulando…" : "Anular depósito"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setModo("ninguno")}>Cancelar</Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Libro                                                                      */
/* -------------------------------------------------------------------------- */

function Libro({ ctx, onResultado }: { ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const [cuenta, setCuenta] = useState<CuentaMovimiento | "todas">("todas");
  const [conAnulados, setConAnulados] = useState(false);
  const terceros = ctx.contrapartes ?? [];
  // Filas con el saldo acumulado de la cuenta filtrada (solo confirmados).
  const filas = useMemo(() => {
    const base = conAnulados ? [...ctx.movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha)) : ordenarLibro(ctx.movimientos);
    const salida: { m: Movimiento; saldo: number }[] = [];
    let acumulado = 0;
    for (const m of base) {
      if (cuenta !== "todas" && m.cuenta !== cuenta) continue;
      if (m.estado === "confirmado") acumulado += (m.tipo === "pago" || m.tipo === "devolucion" ? -1 : 1) * m.montoUsd;
      salida.push({ m, saldo: acumulado });
    }
    return salida;
  }, [ctx.movimientos, cuenta, conAnulados]);

  return (
    <PortalPanel
      title="Libro del expediente"
      description="Por fecha. Solo los confirmados mueven el saldo; los por confirmar se listan aparte y los anulados quedan ocultos."
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          <Selector value={cuenta} onChange={(e) => setCuenta(e.target.value as CuentaMovimiento | "todas")} aria-label="Cuenta">
            <option value="todas">Todas las cuentas</option>
            {CUENTAS_MOVIMIENTO.map((c) => <option key={c} value={c}>{CUENTA_LABEL[c]}</option>)}
          </Selector>
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={conAnulados} onChange={(e) => setConAnulados(e.target.checked)} className="h-4 w-4 accent-silver" />
            Ver anulados
          </label>
        </div>
      }
    >
      {filas.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-3">Todavía no hay movimientos. Registra el primer depósito o pago a la derecha.</p>
      ) : (
        <TableScroll>
          <table className="w-full min-w-[860px] border-collapse">
            <thead className="border-b border-line">
              <tr>
                <Th>Fecha</Th>
                <Th>Movimiento</Th>
                <Th>Cuenta</Th>
                <Th align="right">Monto</Th>
                <Th align="right">USD</Th>
                {cuenta !== "todas" ? <Th align="right">Saldo</Th> : null}
                <Th align="right">Comprobante</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filas.map(({ m, saldo }) => {
                const confirmado = m.estado === "confirmado";
                const tercero = m.contraparteId ? terceros.find((t) => t.id === m.contraparteId) : null;
                return (
                  <tr key={m.id} className={m.estado === "anulado" ? "opacity-50" : ""}>
                    <Td>{fecha(m.fecha)}</Td>
                    <Td>
                      <p className="text-ink">
                        {TIPO_MOVIMIENTO_LABEL[m.tipo]}
                        {m.hito ? <span className="ml-2 font-mono text-xs text-silver">{m.hito}</span> : null}
                        {m.estado !== "confirmado" ? <Badge tone={ESTADO_MOVIMIENTO_TONE[m.estado]} className="ml-2">{ESTADO_MOVIMIENTO_LABEL[m.estado]}</Badge> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-4">
                        {[m.concepto, tercero?.nombre, m.documentoRef].filter(Boolean).join(" · ") || (m.declaradoPorCliente ? "Declarado por el cliente" : "—")}
                        {m.tipo === "pago" && bancoSinVerificar(tercero) ? <Badge tone="warn" className="ml-2">Cuenta sin verificar</Badge> : null}
                      </p>
                      {m.notaInterna ? <p className="mt-0.5 text-xs italic text-ink-4">{m.notaInterna}</p> : null}
                    </Td>
                    <Td>{CUENTA_LABEL[m.cuenta]}</Td>
                    <Td align="right">
                      <span className="tabular-nums text-ink-3">{(m.moneda ?? "USD") !== "USD" ? `${dinero(m.moneda ?? "USD", m.monto)} × ${m.tipoCambio}` : "—"}</span>
                    </Td>
                    <Td align="right">
                      <span className={`tabular-nums ${m.tipo === "pago" || m.tipo === "devolucion" ? "text-ink-2" : "text-ink"}`}>
                        {m.tipo === "pago" || m.tipo === "devolucion" ? "−" : "+"}{usd(m.montoUsd, 2)}
                      </span>
                    </Td>
                    {cuenta !== "todas" ? <Td align="right"><span className="tabular-nums text-ink-3">{confirmado ? usd(saldo, 2) : ""}</span></Td> : null}
                    <Td align="right">
                      <CeldaComprobante ctx={ctx} m={m} onResultado={onResultado} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
    </PortalPanel>
  );
}

function CeldaComprobante({ ctx, m, onResultado }: { ctx: ContextoExpediente; m: Movimiento; onResultado: (r: Resultado) => void }) {
  const [subiendo, setSubiendo] = useState(false);
  if (m.estado === "anulado") return <span className="text-xs text-ink-4">—</span>;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {m.tieneComprobante ? <Button size="sm" variant="ghost" className="border border-line" href={urlDescargaComprobante(m.id)}>Ver</Button> : null}
      <label className="cursor-pointer text-xs text-silver-bright underline">
        {subiendo ? "Subiendo…" : m.tieneComprobante ? "Reemplazar" : "Subir"}
        <input
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          disabled={subiendo}
          onChange={async (e) => {
            const archivo = e.target.files?.[0];
            if (!archivo) return;
            setSubiendo(true);
            const r = await subirComprobanteMovimiento({ expedienteId: ctx.expediente.id, movimientoId: m.id, archivo });
            setSubiendo(false);
            onResultado(r);
          }}
        />
      </label>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Honorarios y detracción                                                    */
/* -------------------------------------------------------------------------- */

/** Asientos internos confirmados de una factura (aplicación o autodetracción), por la marca "factura N" del concepto. */
function asientosDeFactura(ctx: ContextoExpediente, clave: "aplicacion_honorarios" | "autodetraccion", factura: number): Movimiento[] {
  const marca = new RegExp(`factura ${factura}\\b`, "i");
  return ctx.movimientos.filter((m) => m.estado === "confirmado" && conceptoDe(m).clave === clave && marca.test(m.concepto ?? ""));
}

type Operacion = { hito: HitoHonorarios; tipo: "aplicar_honorarios" | "autodetraccion" };

function HonorariosYDetraccion({ ctx, onResultado }: { ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const [abierta, setAbierta] = useState<Operacion | null>(null);
  const conDetraccion = llevaDetraccion(ctx.cliente);
  const importe = importeFactura(ctx);
  const detraccionUsd = detraccionSugerida(ctx);
  const hoy = hoyIso();

  return (
    <PortalPanel
      title="Honorarios y detracción"
      description={
        conDetraccion
          ? "El cliente paga todo a Fondos de Clientes. Al emitir cada factura, aplica su importe a Operaciones. Luego deposita la detracción en el Banco de la Nación dentro de cinco días hábiles de recibido el pago (autodetracción) y envía la constancia al cliente."
          : "El cliente paga todo a Fondos de Clientes. Al emitir cada boleta o factura, aplica su importe a Operaciones. Persona natural con boleta: no hay detracción."
      }
    >
      <ul className="divide-y divide-line">
        {HITOS_HONORARIOS.map((h) => {
          const factura = FACTURA_POR_HITO[h];
          const pago = factura === 1 ? 2 : 5;
          const aplicada = asientosDeFactura(ctx, "aplicacion_honorarios", factura).find((m) => m.tipo === "pago");
          const detraida = asientosDeFactura(ctx, "autodetraccion", factura).find((m) => m.tipo === "deposito");
          const clienteDetrajo = ctx.movimientos.some((m) => m.tipo === "deposito" && m.cuenta === "detracciones" && m.estado === "confirmado" && m.hito !== null && PAGO_POR_HITO[m.hito] === pago);
          const tarea = ctx.tareas.find((t) => t.clave === TAREA_AUTODETRACCION_POR_HITO[h] && t.estado === "pendiente");
          const vencida = Boolean(tarea?.venceEl && tarea.venceEl < hoy);
          const esta = (tipo: Operacion["tipo"]) => abierta?.hito === h && abierta.tipo === tipo;
          return (
            <li key={h} className="px-5 py-4">
              <p className="text-sm font-medium text-ink">Factura {factura} · con el {etiquetaPago(pago)}</p>
              <p className="mt-0.5 text-xs text-ink-4">Importe {importe > 0 ? usd(importe, 2) : "sin honorarios en el expediente"} (la mitad, IGV incluido)</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {aplicada ? (
                  <Badge tone="ok">Aplicada el {fecha(aplicada.fecha)}{aplicada.documentoRef ? ` · ${aplicada.documentoRef}` : ""}</Badge>
                ) : (
                  <Badge tone="neutral">Sin aplicar</Badge>
                )}
                {!conDetraccion ? null : detraida ? (
                  <Badge tone="ok">Detracción depositada el {fecha(detraida.fecha)}{detraida.documentoRef ? ` · ${detraida.documentoRef}` : ""}</Badge>
                ) : clienteDetrajo ? (
                  <Badge tone="info">El cliente depositó la detracción</Badge>
                ) : tarea ? (
                  <Badge tone={vencida ? "danger" : "warn"}>Detracción pendiente · vence el {fecha(tarea.venceEl)}</Badge>
                ) : (
                  <Badge tone="neutral">Detracción: nace al confirmar el {etiquetaPago(pago)}</Badge>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant={aplicada ? "ghost" : "secondary"} className={aplicada ? "border border-line" : ""} onClick={() => setAbierta(esta("aplicar_honorarios") ? null : { hito: h, tipo: "aplicar_honorarios" })}>
                  {aplicada ? "Aplicar otra vez" : `Aplicar factura ${factura}`}
                </Button>
                {conDetraccion && !clienteDetrajo ? (
                  <Button size="sm" variant={detraida ? "ghost" : "secondary"} className={detraida ? "border border-line" : ""} onClick={() => setAbierta(esta("autodetraccion") ? null : { hito: h, tipo: "autodetraccion" })}>
                    {detraida ? "Registrar otra constancia" : "Registrar autodetracción"}
                  </Button>
                ) : null}
              </div>
              {esta("aplicar_honorarios") || esta("autodetraccion") ? (
                <FormularioOperacion
                  key={`${h}-${abierta?.tipo}`}
                  ctx={ctx}
                  operacion={abierta!}
                  importe={importe}
                  detraccionUsd={detraccionUsd}
                  onCerrar={() => setAbierta(null)}
                  onResultado={onResultado}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </PortalPanel>
  );
}

function FormularioOperacion({
  ctx,
  operacion,
  importe,
  detraccionUsd,
  onCerrar,
  onResultado,
}: {
  ctx: ContextoExpediente;
  operacion: Operacion;
  importe: number;
  detraccionUsd: number;
  onCerrar: () => void;
  onResultado: (r: Resultado) => void;
}) {
  const aplicar = operacion.tipo === "aplicar_honorarios";
  const factura = FACTURA_POR_HITO[operacion.hito];
  // La detracción se deposita en soles en el Banco de la Nación; la factura suele estar en dólares.
  const [moneda, setMoneda] = useState(aplicar ? "USD" : "PEN");
  const [monto, setMonto] = useState(aplicar && importe > 0 ? importe.toFixed(2) : "");
  const [tc, setTc] = useState("");
  const [fechaOp, setFechaOp] = useState(hoyIso());
  const [referencia, setReferencia] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);

  const n = leerNumero(monto);
  const tcN = moneda === "USD" ? 1 : leerNumero(tc);
  const montoUsd = n !== null && tcN !== null ? Math.round(n * tcN * 100) / 100 : null;

  const enviar = async () => {
    if (n === null || n <= 0) return onResultado({ ok: false, message: "Escribe un monto mayor que cero." });
    if (moneda !== "USD" && (tcN === null || tcN <= 0)) return onResultado({ ok: false, message: `Falta el tipo de cambio ${moneda} → USD.` });
    setBusy(true);
    const r = await registrarOperacionHonorarios({
      expedienteId: ctx.expediente.id,
      operacion: {
        operacion: operacion.tipo,
        factura: factura as 1 | 2,
        fecha: fechaOp,
        moneda: moneda.toUpperCase(),
        monto: n,
        tipo_cambio: tcN,
        monto_usd: montoUsd,
        documento_ref: referencia.trim(),
        nota_interna: nota.trim() || null,
      },
    });
    setBusy(false);
    if (r.ok) onCerrar();
    onResultado(r);
  };

  return (
    <div className="mt-3 rounded-lux border border-line bg-surface-2 p-4">
      <p className="text-xs text-ink-3">
        {aplicar
          ? `Pasa el importe de la factura ${factura} de Fondos de Clientes a Operaciones, con fecha de emisión de la factura. El cliente lo ve como "Factura ${factura} de honorarios aplicada".`
          : `Detracción de la factura ${factura}, depositada desde Operaciones en la cuenta de detracciones de LUXCARS en el Banco de la Nación.${detraccionUsd > 0 ? ` Referencia: ≈ ${usd(detraccionUsd, 2)} (${ctx.expediente.porcentajeDetraccion ?? 0} % de ${usd(importe, 2)}), en soles al tipo de cambio de la factura.` : " Sin porcentaje de detracción en el expediente: usa el que fije el contador."}`}
      </p>
      <div className="mt-3">
        <Rejilla columnas={2}>
          <Campo label={aplicar ? `Número de la factura ${factura}` : "Número de la constancia del Banco de la Nación"} requerido>
            <Entrada value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={120} placeholder={aplicar ? "ej. F001-000123" : "ej. 123456789"} />
          </Campo>
          <Campo label={aplicar ? "Fecha de emisión" : "Fecha del depósito"}><Entrada type="date" value={fechaOp} onChange={(e) => setFechaOp(e.target.value)} /></Campo>
          <Campo label="Moneda"><Entrada value={moneda} maxLength={3} onChange={(e) => setMoneda(e.target.value.toUpperCase())} placeholder={aplicar ? "USD" : "PEN"} /></Campo>
          <Campo label={`Monto en ${moneda || "USD"}`} requerido><Entrada inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" /></Campo>
          {moneda !== "USD" ? (
            <Campo label={`Tipo de cambio (USD por 1 ${moneda})`} requerido hint={montoUsd !== null ? `= ${usd(montoUsd, 2)}` : undefined}>
              <Entrada inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value)} placeholder="ej. 0.27" />
            </Campo>
          ) : null}
        </Rejilla>
      </div>
      <div className="mt-3">
        <Campo label="Nota interna (el cliente no la ve)"><AreaTexto value={nota} onChange={(e) => setNota(e.target.value)} maxLength={2000} /></Campo>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || n === null || !referencia.trim()} onClick={() => void enviar()}>
          {busy ? "Registrando…" : aplicar ? `Aplicar factura ${factura}` : "Registrar autodetracción"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCerrar}>Cancelar</Button>
        {montoUsd !== null ? <span className="text-xs text-ink-4">{usd(montoUsd, 2)} al libro</span> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Registrar movimiento                                                       */
/* -------------------------------------------------------------------------- */

const HITO_POR_DEFECTO: Record<TipoMovimiento, TipoHito | ""> = { deposito: "H1", pago: "H1", devolucion: "", ajuste: "" };

function RegistrarMovimiento({ ctx, onResultado }: { ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const terceros = ctx.contrapartes ?? [];
  const [tipo, setTipo] = useState<TipoMovimiento>("deposito");
  const [cuenta, setCuenta] = useState<CuentaMovimiento>("fondos_clientes");
  const [hito, setHito] = useState<TipoHito | "">("H1");
  const [comision, setComision] = useState("");
  const [fechaMov, setFechaMov] = useState(hoyIso());
  const [moneda, setMoneda] = useState("USD");
  const [monto, setMonto] = useState("");
  const [tc, setTc] = useState("");
  const [contraparte, setContraparte] = useState("");
  const [conceptoClave, setConceptoClave] = useState("precio_vehiculo");
  const [conceptoLibre, setConceptoLibre] = useState("");
  const [referencia, setReferencia] = useState("");
  const [nota, setNota] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [emitido, setEmitido] = useState<{ pdf: string | null; version: number } | null>(null);

  const cambiarTipo = (t: TipoMovimiento) => {
    setTipo(t);
    setHito(HITO_POR_DEFECTO[t]);
    if (t === "deposito") setCuenta("fondos_clientes");
    if (t === "pago") {
      const c = CONCEPTOS_PAGO_TERCEROS.find((x) => x.clave === conceptoClave);
      setHito(c?.hito ?? "");
      setCuenta("fondos_clientes");
    }
  };
  const cambiarHito = (h: TipoHito | "") => {
    setHito(h);
    // El cliente paga todo a Fondos de Clientes; el H5 (tributos) va directo a SUNAT.
    if (tipo === "deposito") setCuenta(h ? CUENTA_POR_HITO[h] : "fondos_clientes");
  };
  const cambiarConcepto = (clave: string) => {
    setConceptoClave(clave);
    const c = CONCEPTOS_PAGO_TERCEROS.find((x) => x.clave === clave);
    if (c && c.hito) setHito(c.hito);
  };

  const n = leerNumero(monto);
  const tcN = moneda === "USD" ? 1 : leerNumero(tc);
  const montoUsd = n !== null && tcN !== null ? n * tcN : null;

  const registrar = async () => {
    if (n === null || n <= 0) return onResultado({ ok: false, message: "Escribe un monto mayor que cero." });
    if (moneda !== "USD" && (tcN === null || tcN <= 0)) return onResultado({ ok: false, message: `Falta el tipo de cambio ${moneda} → USD.` });
    const concepto = tipo === "pago"
      ? conceptoClave === "otro" ? conceptoLibre.trim() || "Otros autorizados por el Mandante" : CONCEPTOS_PAGO_TERCEROS.find((c) => c.clave === conceptoClave)?.etiqueta ?? null
      : conceptoLibre.trim() || null;
    const comisionN = leerNumero(comision);
    const datos: DatosMovimiento = {
      tipo,
      cuenta,
      hito: hito || null,
      fecha: fechaMov,
      moneda: moneda.toUpperCase(),
      monto: n,
      tipo_cambio: tcN,
      contraparte_id: tipo === "pago" && contraparte ? contraparte : null,
      concepto,
      documento_ref: referencia.trim() || null,
      nota_interna: nota.trim() || null,
      comision_bancaria_usd: tipo === "pago" && cuenta === "fondos_clientes" && comisionN !== null && comisionN > 0 ? comisionN : null,
    };
    setBusy(true);
    const r = await registrarMovimiento({ expedienteId: ctx.expediente.id, movimiento: datos });
    if (r.ok && r.movimientoId && archivo) {
      const s = await subirComprobanteMovimiento({ expedienteId: ctx.expediente.id, movimientoId: r.movimientoId, archivo });
      if (!s.ok) r.message = `${r.message} ${s.message}`;
    }
    setBusy(false);
    if (r.ok) {
      setMonto("");
      setReferencia("");
      setNota("");
      setComision("");
      setArchivo(null);
      setEmitido(r.constancia ? { pdf: r.constancia.urls.pdf, version: r.constancia.version } : null);
    }
    onResultado(r);
  };

  return (
    <PortalPanel title="Registrar movimiento" description="Un depósito con hito en Fondos de Clientes emite la constancia de fondos y, con el pago completo, cierra la tarea del cliente (el pago directo a SUNAT, H5, no lleva constancia). Los pagos a terceros salen en la liquidación y la rendición por su concepto. La aplicación de honorarios y la autodetracción van en su panel.">
      <div className="space-y-4 px-5 py-4">
        <Rejilla columnas={2}>
          <Campo label="Tipo">
            <Selector value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoMovimiento)}>
              {TIPOS_MOVIMIENTO.map((t) => <option key={t} value={t}>{TIPO_MOVIMIENTO_LABEL[t]}</option>)}
            </Selector>
          </Campo>
          <Campo label="Cuenta">
            <Selector value={cuenta} onChange={(e) => setCuenta(e.target.value as CuentaMovimiento)}>
              {CUENTAS_MOVIMIENTO.map((c) => <option key={c} value={c}>{CUENTA_LABEL[c]}</option>)}
            </Selector>
          </Campo>
          <Campo label="Hito" hint={tipo === "pago" ? "H1 precio · H2 flete y seguro · H4 gastos de aduana · H5 tributos (si Luxcars los paga)" : undefined}>
            <Selector value={hito} onChange={(e) => cambiarHito(e.target.value as TipoHito | "")}>
              <option value="">Sin hito</option>
              {TIPOS_HITO.map((h) => <option key={h} value={h}>{HITO_LABEL[h]}</option>)}
            </Selector>
          </Campo>
          <Campo label="Fecha"><Entrada type="date" value={fechaMov} onChange={(e) => setFechaMov(e.target.value)} /></Campo>
          <Campo label="Moneda"><Entrada value={moneda} maxLength={3} onChange={(e) => setMoneda(e.target.value.toUpperCase())} placeholder="USD" /></Campo>
          <Campo label={`Monto en ${moneda || "USD"}`} requerido><Entrada inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" /></Campo>
          {moneda !== "USD" ? (
            <Campo label={`Tipo de cambio (USD por 1 ${moneda})`} requerido hint={montoUsd !== null ? `= ${usd(montoUsd, 2)}` : undefined}>
              <Entrada inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value)} placeholder="ej. 0.72" />
            </Campo>
          ) : null}
        </Rejilla>

        {tipo === "pago" ? (
          <Rejilla columnas={2}>
            <Campo label="Concepto">
              <Selector value={conceptoClave} onChange={(e) => cambiarConcepto(e.target.value)}>
                {CONCEPTOS_PAGO_TERCEROS.map((c) => <option key={c.clave} value={c.clave}>{c.etiqueta}</option>)}
              </Selector>
            </Campo>
            <Campo label="Beneficiario (contraparte)">
              <Selector value={contraparte} onChange={(e) => setContraparte(e.target.value)}>
                <option value="">— SUNAT u otro sin ficha —</option>
                {terceros.map((t) => <option key={t.id} value={t.id}>{t.nombre}{bancoSinVerificar(t) ? " · cuenta sin verificar" : ""}</option>)}
              </Selector>
            </Campo>
            {bancoSinVerificar(terceros.find((t) => t.id === contraparte)) ? (
              <div className="sm:col-span-2">
                <Notice tone="warn" label="Cuenta bancaria sin verificar">
                  Nadie confirmó por teléfono la cuenta de esta contraparte. Antes de girar, verifícala en Contrapartes; el pago se puede registrar igual.
                </Notice>
              </div>
            ) : null}
            {conceptoClave === "otro" ? (
              <Campo label="Detalle del concepto" className="sm:col-span-2"><Entrada value={conceptoLibre} onChange={(e) => setConceptoLibre(e.target.value)} maxLength={200} /></Campo>
            ) : null}
            {cuenta === "fondos_clientes" ? (
              <Campo label="Comisión bancaria (la repone Luxcars)" hint="Lo que el banco debitó de Fondos de Clientes por este wire. Se registran el cargo y la reposición: el saldo del cliente no cambia." className="sm:col-span-2">
                <Entrada inputMode="decimal" value={comision} onChange={(e) => setComision(e.target.value)} placeholder="ej. 45.00 (USD)" />
              </Campo>
            ) : null}
          </Rejilla>
        ) : (
          <Campo label="Concepto (opcional)"><Entrada value={conceptoLibre} onChange={(e) => setConceptoLibre(e.target.value)} maxLength={200} placeholder={tipo === "deposito" ? "ej. Pago 2 · BCP" : "ej. Devolución del saldo"} /></Campo>
        )}

        <Rejilla columnas={2}>
          <Campo label="Referencia" hint="Factura, SWIFT, DAM, número de operación o banco de origen">
            <Entrada value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={200} placeholder={tipo === "deposito" ? "ej. BCP · op. 00123456" : "ej. Factura F001-123"} />
          </Campo>
          <Campo label="Comprobante (PDF o imagen, hasta 10 MB)">
            <input
              type="file"
              accept="application/pdf,image/*"
              className="block text-xs text-ink-2 file:mr-3 file:rounded-full file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-ink"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </Campo>
        </Rejilla>
        <Campo label="Nota interna (el cliente no la ve)"><AreaTexto value={nota} onChange={(e) => setNota(e.target.value)} maxLength={2000} /></Campo>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={busy || n === null} onClick={() => void registrar()}>
            {busy ? "Registrando…" : tipo === "deposito" && hito ? "Registrar y emitir constancia" : "Registrar"}
          </Button>
          {montoUsd !== null ? <span className="text-xs text-ink-4">{usd(montoUsd, 2)} al libro</span> : null}
        </div>
        {emitido?.pdf ? (
          <Notice tone="info" label={`Constancia emitida (versión ${emitido.version})`}>
            Visible para el cliente. <a className="underline text-silver-bright" href={emitido.pdf} target="_blank" rel="noopener noreferrer">Abrir PDF</a> (el enlace dura cinco minutos; después, desde Documentos).
          </Notice>
        ) : null}
      </div>
    </PortalPanel>
  );
}

/* -------------------------------------------------------------------------- */
/* Documentos que nacen del libro                                             */
/* -------------------------------------------------------------------------- */

type DocumentoLibro = {
  clave: string;
  tipo: TipoDocumento;
  /** Aviso de pago: de qué hito (el documento guarda `hito`). */
  hito?: HitoConAviso;
  etiqueta: string;
  titulo: string;
  manuales: NombreCampo[];
  ayuda: string;
};

const DOCUMENTOS_LIBRO: DocumentoLibro[] = [
  { clave: "aviso_h4", tipo: "aviso_h3", hito: "H4", titulo: "Aviso del Pago 3 · gastos de aduana (H4)", etiqueta: "Emitir aviso del Pago 3", manuales: ["FECHA_AVISO", "MONTO_AVISO"], ayuda: "Con la pro forma del agente de aduana, antes del arribo. El monto del hito H4 pasa a ser el del aviso. Gasto reembolsable: el saldo se compensa en el Pago 5." },
  { clave: "aviso_h5", tipo: "aviso_h3", hito: "H5", titulo: "Aviso del Pago 4 · tributos a SUNAT (H5)", etiqueta: "Emitir aviso del Pago 4", manuales: ["FECHA_AVISO", "LIQUIDACION_NUMERO", "TRIBUTOS_USD", "TRIBUTOS_SOLES", "TC_REFERENCIAL"], ayuda: "Con la liquidación de SUNAT. El cliente paga directo a SUNAT dentro de dos días hábiles: la fecha límite del hito H5 y de su tarea se fija al emitir." },
  { clave: "aviso_h6", tipo: "aviso_h3", hito: "H6", titulo: "Aviso del Pago 5 · honorarios netos (H6)", etiqueta: "Emitir aviso del Pago 5", manuales: ["FECHA_AVISO"], ayuda: "Con el levante. Segunda mitad de los honorarios menos el sobrante (o más el faltante) de los gastos de aduana del libro, a Fondos de Clientes como siempre; el hito H6 queda por el neto." },
  { clave: "liquidacion", tipo: "liquidacion_definitiva", titulo: "Liquidación definitiva", etiqueta: "Emitir liquidación definitiva", manuales: [], ayuda: "Toma la DAM del expediente, los tributos pagados (directo por el cliente o por Luxcars) y los gastos de aduana del libro, con el saldo para el Pago 5. Visible para el cliente." },
  { clave: "acta", tipo: "acta_rendicion", titulo: "Acta de entrega y rendición de cuentas", etiqueta: "Emitir acta de entrega y rendición", manuales: [], ayuda: "Placa, TIVe, kilometraje y fecha de entrega del expediente; todo el libro, lo pagado directo a SUNAT, el saldo de aduana aplicado al Pago 5 y las comisiones repuestas. Se firma simple con el auto delante y abre la tarea de conformidad del cliente." },
];

/** Valores que el formulario propone para cada aviso (se pueden corregir). */
function propuestos(ctx: ContextoExpediente, d: DocumentoLibro): Record<string, string> {
  const hoy = hoyIso();
  if (!d.hito) return {};
  const base: Record<string, string> = { FECHA_AVISO: fechaEnLetras(hoy) };
  if (d.hito === "H4") {
    const h4 = ctx.hitos.find((h) => h.tipo === "H4");
    if (h4) base.MONTO_AVISO = montoTexto(h4.montoEstimadoUsd);
  }
  if (d.hito === "H5") base.FECHA_LIMITE_PAGO = fechaEnLetras(sumarDiasHabiles(hoy, DIAS_HABILES_PAGO_TRIBUTOS));
  return base;
}

function DocumentosDelLibro({ ctx, onResultado }: { ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const [emitido, setEmitido] = useState<{ clave: string; pdf: string | null; version: number } | null>(null);

  const abrir = (d: DocumentoLibro) => {
    if (abierto === d.clave) return setAbierto(null);
    setAbierto(d.clave);
    setFaltantes([]);
    setExtra(propuestos(ctx, d));
  };

  const emitir = async (d: DocumentoLibro) => {
    setBusy(d.clave);
    setFaltantes([]);
    const r = await emitirDocumentoDelLibro({ expedienteId: ctx.expediente.id, tipo: d.tipo, extra: d.hito ? { ...extra, HITO: d.hito } : extra });
    setBusy(null);
    if (r.ok) {
      setEmitido({ clave: d.clave, pdf: r.urls.pdf, version: r.version });
      setAbierto(null);
    } else if (r.faltantes) {
      setFaltantes(r.faltantes);
      setAbierto(d.clave);
    }
    onResultado(r);
  };

  return (
    <PortalPanel title="Documentos del libro" description="Se arman con el libro y el expediente. Regenerar crea una versión nueva (cada aviso de pago se versiona por su hito).">
      <ul className="divide-y divide-line">
        {DOCUMENTOS_LIBRO.map((d) => {
          const vigente = ctx.documentos.find((x) => x.tipo === d.tipo && x.estado !== "reemplazado" && x.estado !== "anulado" && (!d.hito || x.hito === d.hito));
          const plantilla = plantillaDe(d.tipo);
          const esteAbierto = abierto === d.clave;
          return (
            <li key={d.clave} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-ink">{d.titulo ?? TIPO_DOCUMENTO_LABEL[d.tipo]}</p>
                  <p className="text-xs text-ink-4">{vigente ? `Versión ${vigente.version} · ${fecha(vigente.emitidoEn ?? vigente.createdAt)}` : "Sin emitir"}</p>
                </div>
                <Button size="sm" variant={vigente ? "ghost" : "secondary"} className={vigente ? "border border-line" : ""} onClick={() => abrir(d)}>
                  {vigente ? "Nueva versión" : d.etiqueta}
                </Button>
              </div>
              {esteAbierto ? (
                <div className="mt-3 rounded-lux border border-line bg-surface-2 p-4">
                  <p className="text-xs text-ink-3">{d.ayuda}</p>
                  {faltantes.length > 0 ? (
                    <Notice tone="warn" label={`Faltan ${faltantes.length} datos`}>
                      Complétalos en el expediente o escríbelos aquí para este documento.
                    </Notice>
                  ) : null}
                  {d.manuales.length > 0 || faltantes.length > 0 ? (
                    <div className="mt-3">
                      <Rejilla columnas={2}>
                        {[...new Set([...d.manuales, ...faltantes])].map((k) => (
                          <Campo key={k} label={k.replace(/_/g, " ").toLowerCase()} hint={FICHA[k as NombreCampo]?.descripcion} requerido={faltantes.includes(k)}>
                            <Entrada value={extra[k] ?? ""} placeholder={`ej. ${FICHA[k as NombreCampo]?.ejemplo ?? ""}`} maxLength={500} onChange={(e) => setExtra((p) => ({ ...p, [k]: e.target.value }))} />
                          </Campo>
                        ))}
                      </Rejilla>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy !== null} onClick={() => void emitir(d)}>
                      {busy === d.clave ? "Emitiendo…" : vigente ? `Emitir versión ${vigente.version + 1}` : "Emitir PDF y DOCX"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setAbierto(null)}>Cerrar</Button>
                    {plantilla?.seFirma ? <span className="self-center text-xs text-ink-4">Se firma: súbelo firmado desde Documentos.</span> : null}
                  </div>
                </div>
              ) : null}
              {emitido?.clave === d.clave && emitido.pdf ? (
                <p className="mt-2 text-xs text-ink-3">
                  Versión {emitido.version} emitida. <a className="underline text-silver-bright" href={emitido.pdf} target="_blank" rel="noopener noreferrer">Abrir PDF</a> (cinco minutos).
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="px-5 pb-4 text-xs text-ink-4">Las constancias de fondos se emiten al confirmar o registrar un depósito con hito.</p>
    </PortalPanel>
  );
}
