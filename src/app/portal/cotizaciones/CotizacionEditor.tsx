"use client";

/**
 * Formulario de una cotización (nueva o en borrador): cliente, autos con su
 * importador, costos totales del contenedor con su reparto, y la vista previa
 * del cálculo al vuelo. Propone el seguro y los honorarios con la regla de
 * `src/core/pricing` (botón "Usar"); se pueden escribir otras cifras.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Notice, PortalPanel, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import { AreaTexto, Campo, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import {
  PLAZO_POR_DEFECTO,
  calcularCotizacion,
  honorariosPropuestos,
  seguroPropuesto,
  usd,
  type AutoCotizacion,
  type ClienteCotizacion,
  type DatosCotizacion,
  type ResultadoCotizacion,
} from "@/core/cotizaciones";
import { PRICING_CONFIG, type VehicleCondition, type VehicleOrigin } from "@/core/pricing/pricingConfig";
import type { VehicleCategoryId } from "@/core/pricing/vehicleCategories";
import type { EntradaGuardar } from "@/lib/cotizaciones/consultas";
import { PROPULSION_LABEL } from "@/lib/cotizaciones/formato";
import { leerNumero } from "@/lib/expedientes/formato";

type ClienteForm = { tipo: "persona" | "empresa"; nombre: string; documento: string; email: string; telefono: string };

type AutoForm = {
  marca: string;
  modelo: string;
  version: string;
  anio: string;
  color: string;
  condicion: VehicleCondition;
  propulsion: VehicleCategoryId;
  cilindrada: string;
  origen: VehicleOrigin;
  clase: "M1" | "N1";
  precio: string;
  otroImportador: boolean;
  importador: ClienteForm;
};

type Form = {
  cliente: ClienteForm;
  autos: AutoForm[];
  flete: string;
  seguro: string;
  aduana: string;
  honorarios: string;
  reparto: "iguales" | "porcentaje";
  porcentajes: string[];
  plazo: string;
  notas: string;
};

const CLIENTE_VACIO: ClienteForm = { tipo: "persona", nombre: "", documento: "", email: "", telefono: "" };

const AUTO_VACIO: AutoForm = {
  marca: "",
  modelo: "",
  version: "",
  anio: String(new Date().getFullYear()),
  color: "",
  condicion: "nuevo",
  propulsion: "gasolina",
  cilindrada: "",
  origen: "originario-usa",
  clase: "M1",
  precio: "",
  otroImportador: false,
  importador: { ...CLIENTE_VACIO, tipo: "empresa" },
};

function aCliente(c: ClienteForm): ClienteCotizacion {
  return { tipo: c.tipo, nombre: c.nombre.trim(), documento: c.documento.replace(/\s/g, ""), email: c.email.trim(), telefono: c.telefono.trim() };
}

function deCliente(c: ClienteCotizacion): ClienteForm {
  return { tipo: c.tipo, nombre: c.nombre, documento: c.documento, email: c.email, telefono: c.telefono };
}

function formDesde(inicial: EntradaGuardar | null): Form {
  if (!inicial) {
    return {
      cliente: CLIENTE_VACIO,
      autos: [{ ...AUTO_VACIO }],
      flete: String(PRICING_CONFIG.freightByCategory.gasolina),
      seguro: "",
      aduana: String(PRICING_CONFIG.customsCostsUsd),
      honorarios: "",
      reparto: "iguales",
      porcentajes: ["100"],
      plazo: "",
      notas: "",
    };
  }
  const d = inicial.datos;
  return {
    cliente: deCliente(inicial.cliente),
    autos: d.autos.map((a) => ({
      marca: a.marca,
      modelo: a.modelo,
      version: a.version ?? "",
      anio: String(a.anio),
      color: a.color,
      condicion: a.condicion,
      propulsion: a.propulsion,
      cilindrada: a.cilindradaCc ? String(a.cilindradaCc) : "",
      origen: a.origen,
      clase: a.clase ?? "M1",
      precio: String(a.precio),
      otroImportador: Boolean(a.importador),
      importador: a.importador ? deCliente(a.importador) : { ...CLIENTE_VACIO, tipo: "empresa" },
    })),
    flete: String(d.costos.flete),
    seguro: String(d.costos.seguro),
    aduana: String(d.costos.gastosAduana),
    honorarios: String(d.costos.honorarios),
    reparto: d.reparto.modo,
    porcentajes: d.reparto.modo === "porcentaje" ? d.reparto.porcentajes.map(String) : d.autos.map(() => String(Math.round((100 / d.autos.length) * 100) / 100)),
    plazo: d.plazo ?? "",
    notas: inicial.notasInternas,
  };
}

/** Datos para el core; los montos vacíos cuentan como 0 solo para la vista previa. */
function datosDesde(f: Form): DatosCotizacion {
  const autos: AutoCotizacion[] = f.autos.map((a) => ({
    marca: a.marca.trim(),
    modelo: a.modelo.trim(),
    version: a.version.trim() || undefined,
    anio: Number(a.anio),
    color: a.color.trim(),
    condicion: a.condicion,
    propulsion: a.propulsion,
    cilindradaCc: a.propulsion === "gasolina" ? leerNumero(a.cilindrada) : null,
    origen: a.origen,
    clase: a.clase,
    precio: leerNumero(a.precio) ?? 0,
    importador: a.otroImportador ? aCliente(a.importador) : null,
  }));
  return {
    autos,
    costos: {
      flete: leerNumero(f.flete) ?? 0,
      seguro: leerNumero(f.seguro) ?? 0,
      gastosAduana: leerNumero(f.aduana) ?? 0,
      honorarios: leerNumero(f.honorarios) ?? 0,
    },
    reparto: f.reparto === "iguales" ? { modo: "iguales" } : { modo: "porcentaje", porcentajes: f.porcentajes.map((p) => leerNumero(p) ?? 0) },
    perfil: "primera-importacion",
    plazo: f.plazo.trim() || undefined,
  };
}

function validarForm(f: Form): string | null {
  if (f.cliente.nombre.trim().length < 2) return "Falta el nombre o la razón social del cliente.";
  if (f.cliente.tipo === "empresa" && f.cliente.documento.trim() && !/^\d{11}$/.test(f.cliente.documento.replace(/\s/g, ""))) return "El RUC del cliente tiene 11 dígitos.";
  for (const [k, v] of Object.entries({ flete: f.flete, seguro: f.seguro, "gastos de aduana": f.aduana, honorarios: f.honorarios })) {
    if (leerNumero(v) === null) return `Escribe el monto de ${k} (puede ser 0).`;
  }
  return null;
}

export function CotizacionEditor({
  inicial,
  onGuardar,
  textoGuardar,
}: {
  inicial: EntradaGuardar | null;
  onGuardar: (e: EntradaGuardar) => Promise<{ ok: boolean; message: string }>;
  textoGuardar: string;
}) {
  const [f, setF] = useState<Form>(() => formDesde(inicial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const datos = useMemo(() => datosDesde(f), [f]);
  const calculo = useMemo((): { resultado: ResultadoCotizacion | null; error: string | null } => {
    try {
      return { resultado: calcularCotizacion(datos), error: null };
    } catch (e) {
      return { resultado: null, error: e instanceof Error ? e.message : "No se pudo calcular." };
    }
  }, [datos]);
  const propuestaSeguro = useMemo(() => seguroPropuesto(datos), [datos]);
  const propuestaHonorarios = useMemo(() => honorariosPropuestos(datos), [datos]);

  const set = (cambios: Partial<Form>) => setF((p) => ({ ...p, ...cambios }));
  const setAuto = (i: number, cambios: Partial<AutoForm>) => setF((p) => ({ ...p, autos: p.autos.map((a, j) => (j === i ? { ...a, ...cambios } : a)) }));
  const setImportador = (i: number, cambios: Partial<ClienteForm>) =>
    setF((p) => ({ ...p, autos: p.autos.map((a, j) => (j === i ? { ...a, importador: { ...a.importador, ...cambios } } : a)) }));
  const agregarAuto = () =>
    setF((p) => {
      const autos = [...p.autos, { ...AUTO_VACIO }];
      return { ...p, autos, porcentajes: autos.map(() => String(Math.round((100 / autos.length) * 100) / 100)) };
    });
  const quitarAuto = (i: number) =>
    setF((p) => {
      const autos = p.autos.filter((_, j) => j !== i);
      return { ...p, autos, porcentajes: autos.map(() => String(Math.round((100 / autos.length) * 100) / 100)) };
    });

  const guardar = async () => {
    setError(null);
    const e = validarForm(f) ?? calculo.error;
    if (e) return setError(e);
    setBusy(true);
    const r = await onGuardar({ cliente: aCliente(f.cliente), datos, notasInternas: f.notas });
    setBusy(false);
    if (!r.ok) setError(r.message);
  };

  const r = calculo.resultado;
  const varios = f.autos.length > 1;

  return (
    <div className="space-y-6">
      <PortalPanel title="Cliente" description="A quien va dirigida la cotización. Si un auto lo importa otra persona o empresa, se indica en ese auto.">
        <div className="space-y-4 px-5 py-4">
          <ClienteCampos valor={f.cliente} onChange={(c) => set({ cliente: { ...f.cliente, ...c } })} prefijo="cliente" />
        </div>
      </PortalPanel>

      {f.autos.map((a, i) => (
        <PortalPanel
          key={i}
          title={`Auto ${i + 1}`}
          toolbar={varios ? <Button type="button" size="sm" variant="ghost" onClick={() => quitarAuto(i)}>Quitar</Button> : undefined}
        >
          <div className="space-y-4 px-5 py-4">
            <Rejilla columnas={4}>
              <Campo label="Marca" requerido><Entrada value={a.marca} onChange={(e) => setAuto(i, { marca: e.target.value })} placeholder="Marca" /></Campo>
              <Campo label="Modelo" requerido><Entrada value={a.modelo} onChange={(e) => setAuto(i, { modelo: e.target.value })} placeholder="Modelo" /></Campo>
              <Campo label="Año" requerido><Entrada inputMode="numeric" value={a.anio} onChange={(e) => setAuto(i, { anio: e.target.value })} /></Campo>
              <Campo label="Color"><Entrada value={a.color} onChange={(e) => setAuto(i, { color: e.target.value })} /></Campo>
              <Campo label="Condición">
                <Selector value={a.condicion} onChange={(e) => setAuto(i, { condicion: e.target.value as VehicleCondition })}>
                  <option value="nuevo">Nuevo</option>
                  <option value="usado">Usado</option>
                </Selector>
              </Campo>
              <Campo label="Propulsión">
                <Selector value={a.propulsion} onChange={(e) => setAuto(i, { propulsion: e.target.value as VehicleCategoryId })}>
                  {(Object.keys(PROPULSION_LABEL) as VehicleCategoryId[]).map((k) => <option key={k} value={k}>{PROPULSION_LABEL[k]}</option>)}
                </Selector>
              </Campo>
              <Campo label="Origen" hint="El TLC da 0 % de ad valorem solo a nuevos originarios con certificado.">
                <Selector value={a.origen} onChange={(e) => setAuto(i, { origen: e.target.value as VehicleOrigin })}>
                  <option value="originario-usa">Originario de EE.UU. (TLC)</option>
                  <option value="otro">Otro origen (6 %)</option>
                </Selector>
              </Campo>
              <Campo label="Precio (USD)" requerido><Entrada inputMode="decimal" value={a.precio} onChange={(e) => setAuto(i, { precio: e.target.value })} placeholder="0.00" /></Campo>
              <Campo label="Versión" hint="Opcional"><Entrada value={a.version} onChange={(e) => setAuto(i, { version: e.target.value })} /></Campo>
              <Campo label="Clase" hint="Va al Anexo A del expediente.">
                <Selector value={a.clase} onChange={(e) => setAuto(i, { clase: e.target.value as "M1" | "N1" })}>
                  <option value="M1">M1 · auto o SUV</option>
                  <option value="N1">N1 · pickup</option>
                </Selector>
              </Campo>
              {a.propulsion === "gasolina" && a.condicion === "nuevo" ? (
                <Campo label="Cilindrada (cc)" hint="Sin dato se asume más de 1,500 cc (ISC 10 %)."><Entrada inputMode="numeric" value={a.cilindrada} onChange={(e) => setAuto(i, { cilindrada: e.target.value })} /></Campo>
              ) : null}
            </Rejilla>
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={a.otroImportador} onChange={(e) => setAuto(i, { otroImportador: e.target.checked })} />
              Lo importa otra persona o empresa (no el cliente)
            </label>
            {a.otroImportador ? (
              <div className="rounded-lux border border-line px-4 py-3">
                <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-ink-4">Importador del auto {i + 1}</p>
                <ClienteCampos valor={a.importador} onChange={(c) => setImportador(i, c)} prefijo={`imp-${i}`} />
              </div>
            ) : null}
          </div>
        </PortalPanel>
      ))}

      <div>
        <Button type="button" size="sm" variant="secondary" onClick={agregarAuto} disabled={f.autos.length >= 10}>Agregar otro auto</Button>
      </div>

      <PortalPanel title="Costos del contenedor" description={varios ? "Totales del contenedor, en USD. Se reparten entre los autos." : "En USD."}>
        <div className="space-y-4 px-5 py-4">
          <Rejilla columnas={4}>
            <Campo label="Flete" requerido><Entrada inputMode="decimal" value={f.flete} onChange={(e) => set({ flete: e.target.value })} /></Campo>
            <Campo label="Seguro" requerido hint={propuestaSeguro > 0 ? `Regla: ${usd(propuestaSeguro)}` : undefined}>
              <div className="flex gap-2">
                <Entrada inputMode="decimal" value={f.seguro} onChange={(e) => set({ seguro: e.target.value })} />
                {propuestaSeguro > 0 ? <Button type="button" size="sm" variant="ghost" onClick={() => set({ seguro: String(propuestaSeguro) })}>Usar</Button> : null}
              </div>
            </Campo>
            <Campo label="Gastos de aduana" requerido><Entrada inputMode="decimal" value={f.aduana} onChange={(e) => set({ aduana: e.target.value })} /></Campo>
            <Campo label="Honorarios, IGV incl." requerido hint={propuestaHonorarios > 0 ? `Regla de precios: ${usd(propuestaHonorarios)}` : undefined}>
              <div className="flex gap-2">
                <Entrada inputMode="decimal" value={f.honorarios} onChange={(e) => set({ honorarios: e.target.value })} />
                {propuestaHonorarios > 0 ? <Button type="button" size="sm" variant="ghost" onClick={() => set({ honorarios: String(propuestaHonorarios) })}>Usar</Button> : null}
              </div>
            </Campo>
          </Rejilla>
          {varios ? (
            <Rejilla columnas={4}>
              <Campo label="Reparto">
                <Selector value={f.reparto} onChange={(e) => set({ reparto: e.target.value as Form["reparto"] })}>
                  <option value="iguales">En partes iguales</option>
                  <option value="porcentaje">Por porcentaje</option>
                </Selector>
              </Campo>
              {f.reparto === "porcentaje"
                ? f.autos.map((_, i) => (
                    <Campo key={i} label={`% del auto ${i + 1}`}>
                      <Entrada inputMode="decimal" value={f.porcentajes[i] ?? ""} onChange={(e) => set({ porcentajes: f.autos.map((__, j) => (j === i ? e.target.value : f.porcentajes[j] ?? "")) })} />
                    </Campo>
                  ))
                : null}
            </Rejilla>
          ) : null}
          <Rejilla columnas={2}>
            <Campo label="Plazo estimado" hint={`Por defecto: ${PLAZO_POR_DEFECTO} desde el Pago 1.`}><Entrada value={f.plazo} onChange={(e) => set({ plazo: e.target.value })} placeholder={PLAZO_POR_DEFECTO} /></Campo>
            <Campo label="Notas internas" hint="No salen en el PDF."><AreaTexto value={f.notas} onChange={(e) => set({ notas: e.target.value })} /></Campo>
          </Rejilla>
        </div>
      </PortalPanel>

      <PortalPanel title="Vista previa" description="Costo puesto en Lima por auto. La percepción va aparte, fuera del total.">
        {r ? <TablaResultado resultado={r} /> : <p className="px-5 py-4 text-sm text-ink-3">{calculo.error}</p>}
      </PortalPanel>

      {error ? <Notice tone="danger" label="No se pudo">{error}</Notice> : null}
      <div className="flex justify-end border-t border-line pt-6">
        <Button type="button" size="sm" onClick={() => void guardar()} disabled={busy}>{busy ? "Guardando…" : textoGuardar}</Button>
      </div>
    </div>
  );
}

function ClienteCampos({ valor, onChange, prefijo }: { valor: ClienteForm; onChange: (c: Partial<ClienteForm>) => void; prefijo: string }) {
  return (
    <Rejilla columnas={4}>
      <Campo label="Tipo">
        <Selector name={`${prefijo}-tipo`} value={valor.tipo} onChange={(e) => onChange({ tipo: e.target.value as ClienteForm["tipo"] })}>
          <option value="persona">Persona natural</option>
          <option value="empresa">Empresa</option>
        </Selector>
      </Campo>
      <Campo label={valor.tipo === "empresa" ? "Razón social" : "Nombre"} requerido>
        <Entrada name={`${prefijo}-nombre`} value={valor.nombre} onChange={(e) => onChange({ nombre: e.target.value })} />
      </Campo>
      <Campo label={valor.tipo === "empresa" ? "RUC" : "DNI o carné"}>
        <Entrada name={`${prefijo}-documento`} inputMode="numeric" value={valor.documento} onChange={(e) => onChange({ documento: e.target.value })} />
      </Campo>
      <Campo label="Correo">
        <Entrada name={`${prefijo}-email`} type="email" value={valor.email} onChange={(e) => onChange({ email: e.target.value })} />
      </Campo>
      <Campo label="Teléfono">
        <Entrada name={`${prefijo}-telefono`} value={valor.telefono} onChange={(e) => onChange({ telefono: e.target.value })} />
      </Campo>
    </Rejilla>
  );
}

export function TablaResultado({ resultado }: { resultado: ResultadoCotizacion }) {
  const autos = resultado.autos;
  const varios = autos.length > 1;
  const filas: [string, (a: ResultadoCotizacion["autos"][number]) => number, boolean?][] = [
    ["Precio", (a) => a.precio],
    ["Flete", (a) => a.flete],
    ["Seguro", (a) => a.seguro],
    ["CIF", (a) => a.cif, true],
    ["Ad valorem", (a) => a.adValorem],
    ["ISC", (a) => a.isc],
    ["IGV", (a) => a.igv],
    ["IPM", (a) => a.ipm],
    ["Tributos", (a) => a.tributos, true],
    ["Gastos de aduana", (a) => a.gastosAduana],
    ["Honorarios", (a) => a.honorarios],
    ["Total puesto en Lima", (a) => a.total, true],
    ["Pago 1 de 5", (a) => a.pagos[0]],
    ["Pago 2 de 5", (a) => a.pagos[1]],
    ["Pago 3 de 5", (a) => a.pagos[2]],
    ["Pago 4 de 5 (SUNAT)", (a) => a.pagos[3]],
    ["Pago 5 de 5", (a) => a.pagos[4]],
    ["Percepción 1.ª importación (aparte)", (a) => a.percepcionPrimera],
  ];
  return (
    <TableScroll>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <Th>Concepto</Th>
            {autos.map((a) => <Th key={a.indice} align="right">{a.nombreCorto}</Th>)}
            {varios ? <Th align="right">Total</Th> : null}
          </tr>
        </thead>
        <tbody>
          {filas.map(([label, f, fuerte]) => {
            const v = autos.map(f);
            const cls = fuerte ? "font-semibold text-ink" : "text-ink-2";
            return (
              <tr key={label} className="border-t border-line">
                <Td className={`py-2 ${cls}`}>{label}</Td>
                {v.map((x, i) => <Td key={i} align="right" className={`py-2 tabular-nums ${cls}`}>{usd(x)}</Td>)}
                {varios ? <Td align="right" className={`py-2 tabular-nums ${cls}`}>{usd(Math.round(v.reduce((s, x) => s + x, 0) * 100) / 100)}</Td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableScroll>
  );
}
