"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { Badge, Notice, PortalPanel, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import { Icon } from "@/components/ui/Icon";
import { CONFIG_ENVIOS, CONFIG_ENVIOS_VERIFICADA } from "@/core/envios/configEnvios";
import type { DesgloseRegimen, EntradaCotizacionEnvio, ResultadoCotizacionEnvio } from "@/core/envios/tipos";
import { fechaCorta } from "@/core/envios/validaciones";
import { cn, formatCurrency, formatRate } from "@/lib/utils";
import { normalizePhoneForWhatsapp } from "@/lib/whatsappPortal";

const NOMBRE_CORTO: Record<DesgloseRegimen["regimen"], string> = {
  "ley-retorno": "Ley del Retorno",
  "importacion-regular": "Importación regular",
};

const usd = (n: number) => formatCurrency(n);

type Props = {
  entrada: EntradaCotizacionEnvio;
  resultado: ResultadoCotizacionEnvio;
  mensaje: string;
};

export function ResultadoEnvio({ entrada, resultado, mensaje }: Props) {
  const { elegido, retorno, regular, alertas, valorAduana } = resultado;
  const telefono = normalizePhoneForWhatsapp(entrada.cliente.whatsapp);
  const enlaceWa = telefono ? `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}` : null;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Alertas ──────────────────────────────────────────────────────── */}
      {alertas.length > 0 ? (
        <div className="flex flex-col gap-2">
          {alertas.map((a) => (
            <Notice key={a.clave} tone={a.nivel} label={a.titulo}>
              {a.detalle}
            </Notice>
          ))}
        </div>
      ) : null}

      {/* ── Desglose del régimen elegido ─────────────────────────────────── */}
      <PortalPanel
        title={`Desglose · ${NOMBRE_CORTO[elegido.regimen]}`}
        description={
          `Valor estimado para aduanas ${usd(valorAduana.valorUsd)}` +
          (valorAduana.metodo === "depreciacion"
            ? ` (factura menos ${Math.round(valorAduana.depreciacion * 100)}%)`
            : valorAduana.metodo === "referencia"
              ? " (valor de referencia)"
              : "") +
          ` · origen ${resultado.origen === "originario-usa" ? "EE.UU." : "otro"} · importación en ${resultado.anioImportacion}` +
          (resultado.fechaLimiteIngreso ? ` · ingreso hasta el ${fechaCorta(resultado.fechaLimiteIngreso)}` : "")
        }
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
                <Td align="right" className="text-base font-semibold tabular-nums text-ink">{usd(elegido.totalUsd)}</Td>
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
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <Th>Concepto</Th>
                <Th align="right">
                  <Encabezado activo={elegido.regimen === "ley-retorno"} beneficio={retorno.beneficioAplica}>Ley del Retorno</Encabezado>
                </Th>
                <Th align="right">
                  <Encabezado activo={elegido.regimen === "importacion-regular"}>Importación regular</Encabezado>
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
                <Td align="right" className={cn("font-semibold tabular-nums", elegido.regimen === "ley-retorno" ? "text-ink" : "text-ink-2")}>{usd(retorno.totalUsd)}</Td>
                <Td align="right" className={cn("font-semibold tabular-nums", elegido.regimen === "importacion-regular" ? "text-ink" : "text-ink-2")}>{regular.tributos ? usd(regular.totalUsd) : "No aplica"}</Td>
              </tr>
              <Comparada concepto="Percepción del IGV (adelanto, aparte)" a={0} b={regular.tributos?.percepcion ?? null} />
              <tr>
                <Td className="text-ink">Ahorro con la Ley del Retorno</Td>
                <Td align="right" className="font-semibold tabular-nums text-ok" >
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
        description="Texto plano, de usted, con el desglose y el total referencial. Cópialo o ábrelo en el chat."
        toolbar={
          <div className="flex gap-2">
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
          rows={Math.min(26, mensaje.split("\n").length + 1)}
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
      <Td align="right" className="tabular-nums">{usd(monto)}</Td>
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
      <Td align="right" className="tabular-nums">{a === null ? "—" : usd(a)}</Td>
      <Td align="right" className="tabular-nums">{b === null ? "—" : usd(b)}</Td>
    </tr>
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
