"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { Badge, EmptyState, Notice, PortalPanel, StatCard, TableScroll, Td, Th, type StatTone } from "@/components/portal/CrmUI";
import { Icon } from "@/components/ui/Icon";
import { CONFIG_ENVIOS, CONFIG_ENVIOS_VERIFICADA } from "@/core/envios/configEnvios";
import type { DesgloseRegimen, EntradaCotizacionEnvio, ResultadoCotizacionEnvio } from "@/core/envios/tipos";
import { fechaCorta } from "@/core/envios/validaciones";
import { cn, formatCurrency, formatRate } from "@/lib/utils";
import { normalizePhoneForWhatsapp } from "@/lib/whatsappPortal";

import { generarPdfEnvio } from "./pdfEnvio";

const NOMBRE_CORTO: Record<DesgloseRegimen["regimen"], string> = {
  "ley-retorno": "Ley del Retorno",
  "importacion-regular": "Importación regular",
};

const usd = (n: number) => formatCurrency(n);

type Props = {
  entrada: EntradaCotizacionEnvio;
  resultado: ResultadoCotizacionEnvio;
  mensaje: string;
  /** Número de la cotización abierta (EN-2026-0001), para el PDF. */
  numero?: string | null;
  /** Hay datos suficientes para que el estimado tenga sentido. */
  listo: boolean;
};

/**
 * Columna de resultado. Orden pensado para leerse de arriba abajo en 10
 * segundos: primero las tres cifras que importan, luego lo que puede frenar la
 * importación (alertas), después el detalle, la comparación y el mensaje.
 */
export function ResultadoEnvio({ entrada, resultado, mensaje, numero = null, listo }: Props) {
  if (!listo) {
    return (
      <PortalPanel>
        <EmptyState
          title="El estimado aparece aquí"
          description="Se calcula al escribir. Basta con la marca, el modelo y el valor de factura; el resto afina las alertas y el régimen."
          steps={[
            "Cliente: nombre y WhatsApp, para el mensaje y el PDF.",
            "Vehículo: valor de factura, condición y país de fabricación.",
            "Régimen: Ley del Retorno o importación regular; los dos se comparan siempre.",
          ]}
        />
      </PortalPanel>
    );
  }

  const { elegido, retorno, regular, alertas, valorAduana } = resultado;
  const telefono = normalizePhoneForWhatsapp(entrada.cliente.whatsapp);
  const enlaceWa = telefono ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}` : null;
  const esRetorno = elegido.regimen === "ley-retorno";
  const aplica = Boolean(elegido.tributos) || esRetorno;

  const criticas = alertas.filter((a) => a.nivel !== "info");
  const informativas = alertas.filter((a) => a.nivel === "info");

  const margen = valorAduana.margenTopeUsd;
  const tonoMargen: StatTone = margen < 0 ? "danger" : margen < CONFIG_ENVIOS.valorAduana.margenAlertaUsd ? "warn" : "default";

  return (
    <div className="flex flex-col gap-5">
      {/* ── Las tres cifras ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={`Total · ${NOMBRE_CORTO[elegido.regimen]}`}
          value={aplica ? usd(elegido.totalUsd) : "No aplica"}
          hint={esRetorno ? "Sin tributos, por la Ley del Retorno." : "Sin la percepción, que va aparte."}
          tone={aplica ? "default" : "danger"}
        />
        {esRetorno ? (
          <StatCard
            label="Ahorro frente a la regular"
            value={regular.tributos ? usd(regular.totalUsd - retorno.totalUsd) : "—"}
            hint={regular.tributos ? `Regular: ${usd(regular.totalUsd)} + percepción.` : "Como regular no podría nacionalizarse."}
            tone={retorno.beneficioAplica ? "ok" : "warn"}
          />
        ) : (
          <StatCard
            label="Efectivo a desembolsar"
            value={elegido.tributos ? usd(elegido.efectivoUsd) : "—"}
            hint={elegido.tributos ? `Incluye percepción ${formatRate(elegido.tributos.tasas.percepcion)}, recuperable.` : "No puede nacionalizarse por esta vía."}
          />
        )}
        <StatCard
          label="Valor para aduanas"
          value={usd(valorAduana.valorUsd)}
          hint={
            esRetorno
              ? margen < 0
                ? `Supera el tope de ${usd(CONFIG_ENVIOS.leyRetorno.valorMaximoUsd)} por ${usd(-margen)}.`
                : `Margen frente al tope: ${usd(margen)}.`
              : valorAduana.metodo === "depreciacion"
                ? `Factura menos ${Math.round(valorAduana.depreciacion * 100)}% por ${valorAduana.aniosUso} año(s) de uso.`
                : valorAduana.metodo === "referencia"
                  ? "Valor de referencia indicado."
                  : "Igual a la factura (nuevo)."
          }
          tone={esRetorno ? tonoMargen : "default"}
        />
      </div>

      {/* ── Lo que puede frenar la importación ───────────────────────────── */}
      {criticas.length > 0 ? (
        <div className="flex flex-col gap-2">
          {criticas.map((a) => (
            <Notice key={a.clave} tone={a.nivel} label={a.titulo}>
              {a.detalle}
            </Notice>
          ))}
        </div>
      ) : null}

      {informativas.length > 0 ? (
        <details className="group rounded-lux border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-silver">
            <span>Condiciones y plazos ({informativas.length})</span>
            <Icon name="chevronDown" size={14} className="transition-transform group-open:rotate-180" />
          </summary>
          <ul className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            {informativas.map((a) => (
              <li key={a.clave}>
                <span className="font-semibold text-ink">{a.titulo}.</span> {a.detalle}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* ── Desglose del régimen elegido ─────────────────────────────────── */}
      <PortalPanel
        title={`Desglose · ${NOMBRE_CORTO[elegido.regimen]}`}
        description={
          `Importación en ${resultado.anioImportacion} · origen ${resultado.origen === "originario-usa" ? "EE.UU." : "otro"}` +
          (resultado.fechaLimiteIngreso ? ` · ingreso como usado hasta el ${fechaCorta(resultado.fechaLimiteIngreso)}` : "")
        }
        toolbar={<BotonPdf entrada={entrada} resultado={resultado} numero={numero} />}
      >
        <TableScroll>
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <Th>Concepto</Th>
                <Th align="right">US$</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <Fila concepto="Transporte interno en EE.UU." monto={elegido.transporteInternoUsd} />
              <Fila concepto={`Flete marítimo ${entrada.origen.puertoSalida}–Callao`} monto={elegido.fleteUsd} />
              <Fila concepto="Seguro internacional" monto={elegido.seguroUsd} nota={`${(CONFIG_ENVIOS.seguroTasaEfectiva * 100).toFixed(2)}% del valor de factura (0.5% sobre el 110%)`} />
              <FilasTributos d={elegido} />
              <Fila concepto="Gastos de aduana y puerto" monto={elegido.gastosAduanaUsd} />
              <Fila
                concepto="Servicio Luxcars"
                monto={elegido.servicioUsd}
                nota={entrada.costos.servicio.tipo === "porcentaje" ? `${formatRate(entrada.costos.servicio.tasa)} del valor de factura` : undefined}
              />
              <tr className="bg-surface-2">
                <Td className="font-semibold text-ink">Total referencial</Td>
                <Td align="right" className="text-base font-semibold tabular-nums text-ink">{aplica ? usd(elegido.totalUsd) : "No aplica"}</Td>
              </tr>
              {elegido.tributos && elegido.tributos.percepcion > 0 ? (
                <tr>
                  <Td>
                    Percepción del IGV ({formatRate(elegido.tributos.tasas.percepcion)})
                    <span className="block text-xs text-ink-4">Adelanto recuperable, aparte del total. Efectivo a desembolsar: {usd(elegido.efectivoUsd)}.</span>
                  </Td>
                  <Td align="right" className="tabular-nums">{usd(elegido.tributos.percepcion)}</Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableScroll>
        <p className="border-t border-line px-5 py-3 text-xs text-ink-4">
          {resultado.nota} Parámetros verificados el {fechaCorta(CONFIG_ENVIOS_VERIFICADA)}.
        </p>
      </PortalPanel>

      {/* ── Comparación lado a lado ──────────────────────────────────────── */}
      <PortalPanel title="Ley del Retorno vs. importación regular" description="Mismos costos; cambia solo lo tributario.">
        <TableScroll>
          <table className="w-full min-w-[30rem] table-fixed">
            <thead className="border-b border-line">
              <tr>
                <Th>Concepto</Th>
                <Th align="right" className="w-28">
                  <Encabezado activo={esRetorno} beneficio={retorno.beneficioAplica}>Ley del Retorno</Encabezado>
                </Th>
                <Th align="right" className="w-28">
                  <Encabezado activo={!esRetorno}>Importación regular</Encabezado>
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <Comparada concepto="Transporte interno, flete y seguro" a={retorno.transporteInternoUsd + retorno.fleteUsd + retorno.seguroUsd} b={regular.transporteInternoUsd + regular.fleteUsd + regular.seguroUsd} />
              <Comparada concepto="Ad valorem" a={retorno.tributos?.adValorem ?? null} b={regular.tributos?.adValorem ?? null} tasaB={regular.tributos?.tasas.adValorem} />
              <Comparada concepto="ISC" a={retorno.tributos?.isc ?? null} b={regular.tributos?.isc ?? null} tasaB={regular.tributos?.tasas.isc} />
              <Comparada concepto="IGV + IPM" a={retorno.tributos ? retorno.tributos.igv + retorno.tributos.ipm : null} b={regular.tributos ? regular.tributos.igv + regular.tributos.ipm : null} tasaB={regular.tributos ? regular.tributos.tasas.igv + regular.tributos.tasas.ipm : undefined} />
              <Comparada concepto="Gastos de aduana y servicio" a={retorno.gastosAduanaUsd + retorno.servicioUsd} b={regular.gastosAduanaUsd + regular.servicioUsd} />
              <tr className="bg-surface-2">
                <Td className="font-semibold text-ink">Total referencial</Td>
                <Td align="right" className={cn("whitespace-nowrap font-semibold tabular-nums", esRetorno ? "text-ink" : "text-ink-2")}>{usd(retorno.totalUsd)}</Td>
                <Td align="right" className={cn("whitespace-nowrap font-semibold tabular-nums", !esRetorno ? "text-ink" : "text-ink-2")}>{regular.tributos ? usd(regular.totalUsd) : "No aplica"}</Td>
              </tr>
              <Comparada concepto="Percepción del IGV (adelanto, aparte)" a={0} b={regular.tributos?.percepcion ?? null} />
              <tr>
                <Td className="text-ink">Ahorro con la Ley del Retorno</Td>
                <Td align="right" className="font-semibold tabular-nums text-ok">
                  {regular.tributos ? usd(regular.totalUsd - retorno.totalUsd) : "—"}
                </Td>
                <Td align="right" className="text-ink-4">—</Td>
              </tr>
            </tbody>
          </table>
        </TableScroll>
      </PortalPanel>

      {/* ── Mensaje para WhatsApp ────────────────────────────────────────── */}
      <PortalPanel
        title="Mensaje para WhatsApp"
        description="Texto plano, de usted, con el desglose y el total referencial."
        toolbar={
          <div className="flex flex-wrap gap-2">
            <BotonCopiar texto={mensaje} />
            {enlaceWa ? (
              <Button href={enlaceWa} variant="whatsapp" size="sm">
                Abrir en WhatsApp
              </Button>
            ) : null}
          </div>
        }
      >
        <textarea
          readOnly
          value={mensaje}
          rows={Math.min(14, mensaje.split("\n").length + 1)}
          onFocus={(e) => e.currentTarget.select()}
          className="field-lux w-full resize-y rounded-none border-0 bg-transparent font-mono text-xs leading-relaxed"
          aria-label="Mensaje para el cliente"
        />
      </PortalPanel>
    </div>
  );
}

function Encabezado({ children, activo, beneficio = true }: { children: React.ReactNode; activo: boolean; beneficio?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      {children}
      {activo ? <Badge tone="silver">Elegido</Badge> : null}
      {!beneficio ? <Badge tone="danger">Sin beneficio</Badge> : null}
    </span>
  );
}

function Fila({ concepto, monto, nota }: { concepto: string; monto: number; nota?: string }) {
  return (
    <tr>
      <Td>
        {concepto}
        {nota ? <span className="block text-xs text-ink-4">{nota}</span> : null}
      </Td>
      <Td align="right" className="w-32 whitespace-nowrap tabular-nums">{usd(monto)}</Td>
    </tr>
  );
}

function FilasTributos({ d }: { d: DesgloseRegimen }) {
  if (d.regimen === "ley-retorno") {
    return <Fila concepto="Tributos de importación" monto={0} nota={d.beneficioAplica ? "Exonerados por la Ley del Retorno" : "Con el beneficio. OJO: según las alertas, se perdería"} />;
  }
  if (!d.tributos) {
    return (
      <tr>
        <Td>Tributos de importación<span className="block text-xs text-danger">No aplica: el vehículo no puede nacionalizarse por esta vía.</span></Td>
        <Td align="right">—</Td>
      </tr>
    );
  }
  const t = d.tributos;
  return (
    <>
      <Fila concepto="Ad valorem" monto={t.adValorem} nota={`${formatRate(t.tasas.adValorem)} sobre el CIF (${usd(d.cifUsd)})`} />
      <Fila concepto="ISC" monto={t.isc} nota={`${formatRate(t.tasas.isc)} sobre CIF + ad valorem`} />
      <Fila concepto="IGV + IPM" monto={t.igv + t.ipm} nota={`${formatRate(t.tasas.igv)} + ${formatRate(t.tasas.ipm)} sobre CIF + ad valorem + ISC`} />
    </>
  );
}

function Comparada({ concepto, a, b, tasaB }: { concepto: string; a: number | null; b: number | null; tasaB?: number }) {
  return (
    <tr>
      <Td>
        {concepto}
        {tasaB !== undefined ? <span className="block text-xs text-ink-4">{formatRate(tasaB)} en la regular</span> : null}
      </Td>
      <Td align="right" className="w-28 whitespace-nowrap tabular-nums">{a === null ? "—" : usd(a)}</Td>
      <Td align="right" className="w-28 whitespace-nowrap tabular-nums">{b === null ? "—" : usd(b)}</Td>
    </tr>
  );
}

function BotonPdf({ entrada, resultado, numero }: { entrada: EntradaCotizacionEnvio; resultado: ResultadoCotizacionEnvio; numero: string | null }) {
  const [estado, setEstado] = useState<"reposo" | "generando" | "error">("reposo");

  async function descargar() {
    setEstado("generando");
    try {
      await generarPdfEnvio(entrada, resultado, numero);
      setEstado("reposo");
    } catch {
      setEstado("error");
    }
  }

  return (
    <Button onClick={descargar} variant="secondary" size="sm" disabled={estado === "generando"}>
      <Icon name="download" size={14} />
      {estado === "generando" ? "Generando…" : estado === "error" ? "No se pudo generar" : "Descargar PDF"}
    </Button>
  );
}

function BotonCopiar({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<"reposo" | "copiado" | "error">("reposo");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado("copiado");
    } catch {
      setEstado("error");
    }
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado("reposo"), 2500);
  }

  return (
    <>
      <Button onClick={copiar} variant="secondary" size="sm">
        <Icon name={estado === "copiado" ? "check" : "share"} size={14} />
        {estado === "copiado" ? "Copiado" : estado === "error" ? "Selecciona y copia" : "Copiar mensaje"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {estado === "copiado" ? "Mensaje copiado al portapapeles." : ""}
      </span>
    </>
  );
}
