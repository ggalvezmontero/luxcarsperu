"use client";

import { PhoneInput } from "@/components/PhoneInput";
import { SelectConOtro } from "@/components/SelectConOtro";
import { PortalPanel } from "@/components/portal/CrmUI";
import { CONFIG_ENVIOS } from "@/core/envios/configEnvios";
import { VEHICLE_CATEGORIES } from "@/core/pricing/vehicleCategories";
import { aniosDesde } from "@/lib/opcionesVehiculo";
import { cn, formatNumber } from "@/lib/utils";

import { ESTADOS_EEUU, PAISES_FABRICACION, PUERTOS_SALIDA, type Formulario } from "./formulario";

type Props = {
  valor: Formulario;
  onChange: (siguiente: Formulario) => void;
  anioActual: number;
  recorridoKm: number;
};

export function FormularioEnvio({ valor: f, onChange, anioActual, recorridoKm }: Props) {
  const set = <K extends keyof Formulario>(clave: K, v: Formulario[K]) => onChange({ ...f, [clave]: v });
  const anios = aniosDesde(anioActual + 1, anioActual - 8);
  const usado = f.condicion === "usado";
  const gasolinaNueva = !usado && f.combustible === "gasolina";

  return (
    <div className="flex flex-col gap-5">
      <PortalPanel title="Cliente">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="ce-nombre">
            <input id="ce-nombre" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} className="field-lux" maxLength={160} autoComplete="off" placeholder="Nombre y apellido" />
          </Field>
          <Field label="WhatsApp" htmlFor="ce-whatsapp" hint="Con el código del país donde vive.">
            <PhoneInput id="ce-whatsapp" value={f.whatsapp} onChange={(v) => set("whatsapp", v)} />
          </Field>
        </div>
      </PortalPanel>

      <PortalPanel title="Vehículo">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Marca" htmlFor="ce-marca">
            <input id="ce-marca" value={f.marca} onChange={(e) => set("marca", e.target.value)} className="field-lux" maxLength={80} placeholder="Subaru" />
          </Field>
          <Field label="Modelo" htmlFor="ce-modelo">
            <input id="ce-modelo" value={f.modelo} onChange={(e) => set("modelo", e.target.value)} className="field-lux" maxLength={120} placeholder="Outback Wilderness" />
          </Field>
          <Field label="Año modelo" htmlFor="ce-anio">
            <select id="ce-anio" value={f.anioModelo} onChange={(e) => set("anioModelo", e.target.value)} className="field-lux tabular-nums">
              {!anios.includes(Number(f.anioModelo)) ? <option value={f.anioModelo}>{f.anioModelo}</option> : null}
              {anios.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Segmento
            label="Condición"
            id="ce-condicion"
            valor={f.condicion}
            opciones={[{ v: "nuevo", l: "Nuevo" }, { v: "usado", l: "Usado" }]}
            onChange={(v) => set("condicion", v)}
          />
          <Field label="Recorrido" htmlFor="ce-recorrido" hint={f.unidadRecorrido === "millas" && recorridoKm > 0 ? `≈ ${formatNumber(recorridoKm)} km` : undefined}>
            <div className="flex gap-2">
              <input id="ce-recorrido" inputMode="decimal" value={f.recorrido} onChange={(e) => set("recorrido", e.target.value)} className="field-lux tabular-nums" placeholder="500" />
              <select aria-label="Unidad del recorrido" value={f.unidadRecorrido} onChange={(e) => set("unidadRecorrido", e.target.value as Formulario["unidadRecorrido"])} className="field-lux !w-28">
                <option value="millas">millas</option>
                <option value="km">km</option>
              </select>
            </div>
          </Field>
          <Field label="Combustible" htmlFor="ce-combustible">
            <select id="ce-combustible" value={f.combustible} onChange={(e) => set("combustible", e.target.value as Formulario["combustible"])} className="field-lux">
              {VEHICLE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="País de fabricación" htmlFor="ce-pais" hint="Solo un NUEVO fabricado en EE.UU. paga 0% de ad valorem; el resto, 6%.">
            <SelectConOtro id="ce-pais" value={f.paisFabricacion} onChange={(v) => set("paisFabricacion", v)} opciones={PAISES_FABRICACION} vacio="Elegir país…" placeholderOtro="País" />
          </Field>
          {gasolinaNueva ? (
            <Field label="Cilindrada (cc)" htmlFor="ce-cilindrada" hint="Define el ISC de un gasolina nuevo. Vacío = más de 1,500 cc (10%).">
              <input id="ce-cilindrada" inputMode="numeric" value={f.cilindrada} onChange={(e) => set("cilindrada", e.target.value)} className="field-lux tabular-nums" placeholder="2400" />
            </Field>
          ) : null}
          <Field label="Valor de factura (US$)" htmlFor="ce-factura" hint="Lo que pagó por el auto. Base del seguro.">
            <input id="ce-factura" inputMode="decimal" value={f.valorFactura} onChange={(e) => set("valorFactura", e.target.value)} className="field-lux tabular-nums" placeholder="55000" />
          </Field>
          {usado ? (
            <Field label="Valor de referencia como usado (US$)" htmlFor="ce-referencia" hint="Opcional. Si se deja vacío: factura menos 10% por año de uso, tope 50%.">
              <input id="ce-referencia" inputMode="decimal" value={f.valorReferencia} onChange={(e) => set("valorReferencia", e.target.value)} className="field-lux tabular-nums" placeholder="Opcional" />
            </Field>
          ) : null}
        </div>
      </PortalPanel>

      <PortalPanel title="Origen y régimen">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Ciudad" htmlFor="ce-ciudad">
            <input id="ce-ciudad" value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} className="field-lux" maxLength={80} placeholder="Vail" />
          </Field>
          <Field label="Estado" htmlFor="ce-estado">
            <SelectConOtro id="ce-estado" value={f.estado} onChange={(v) => set("estado", v)} opciones={ESTADOS_EEUU} vacio="Elegir estado…" placeholderOtro="Estado" />
          </Field>
          <Field label="Puerto de salida" htmlFor="ce-puerto">
            <SelectConOtro id="ce-puerto" value={f.puertoSalida} onChange={(v) => set("puertoSalida", v)} opciones={PUERTOS_SALIDA} placeholderOtro="Puerto" />
          </Field>
          <Segmento
            label="Régimen"
            id="ce-regimen"
            valor={f.regimen}
            opciones={[{ v: "ley-retorno", l: "Ley del Retorno" }, { v: "importacion-regular", l: "Importación regular" }]}
            onChange={(v) => set("regimen", v)}
          />
          {f.regimen === "ley-retorno" ? (
            <>
              <Field label="Años viviendo fuera del Perú" htmlFor="ce-anios-fuera" hint={`Mínimo ${CONFIG_ENVIOS.leyRetorno.aniosMinimosFuera} continuos.`}>
                <input id="ce-anios-fuera" inputMode="numeric" value={f.aniosFuera} onChange={(e) => set("aniosFuera", e.target.value)} className="field-lux tabular-nums" placeholder="4" />
              </Field>
              <Field label="Fecha estimada de retorno" htmlFor="ce-fecha-retorno">
                <input id="ce-fecha-retorno" type="date" value={f.fechaRetorno} onChange={(e) => set("fechaRetorno", e.target.value)} className="field-lux" />
              </Field>
            </>
          ) : null}
          <Field label="Fecha estimada de importación" htmlFor="ce-fecha-importacion" hint="Decide el año para la antigüedad y los años de uso. Vacía: la de retorno, o el año en curso.">
            <input id="ce-fecha-importacion" type="date" value={f.fechaImportacion} onChange={(e) => set("fechaImportacion", e.target.value)} className="field-lux" />
          </Field>
          <label className="flex items-center gap-3 self-end rounded-lux border border-line px-4 py-3 text-sm text-ink-2">
            <input type="checkbox" checked={f.prestamoVigente} onChange={(e) => set("prestamoVigente", e.target.checked)} className="h-4 w-4 accent-silver" />
            El vehículo tiene un préstamo vigente
          </label>
        </div>
      </PortalPanel>

      <PortalPanel title="Costos" description="Valores por defecto de la configuración; se pueden ajustar por cotización.">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Transporte interno en EE.UU. (US$)" htmlFor="ce-transporte" hint="Manual: del domicilio al puerto.">
            <input id="ce-transporte" inputMode="decimal" value={f.transporteInterno} onChange={(e) => set("transporteInterno", e.target.value)} className="field-lux tabular-nums" placeholder="1700" />
          </Field>
          <Field label="Flete marítimo Miami–Callao (US$)" htmlFor="ce-flete">
            <input id="ce-flete" inputMode="decimal" value={f.flete} onChange={(e) => set("flete", e.target.value)} className="field-lux tabular-nums" />
          </Field>
          <Field label="Gastos de aduana y puerto (US$)" htmlFor="ce-aduana">
            <input id="ce-aduana" inputMode="decimal" value={f.gastosAduana} onChange={(e) => set("gastosAduana", e.target.value)} className="field-lux tabular-nums" />
          </Field>
          <div>
            <span id="ce-servicio-label" className="block text-sm text-ink-2">Servicio Luxcars</span>
            <div className="mt-1.5 flex gap-2">
              <select aria-labelledby="ce-servicio-label" value={f.servicioTipo} onChange={(e) => set("servicioTipo", e.target.value as Formulario["servicioTipo"])} className="field-lux !w-40">
                <option value="fijo">Monto fijo</option>
                <option value="porcentaje">Porcentaje</option>
              </select>
              {f.servicioTipo === "fijo" ? (
                <input aria-label="Servicio, monto fijo en US$" inputMode="decimal" value={f.servicioMonto} onChange={(e) => set("servicioMonto", e.target.value)} className="field-lux tabular-nums" />
              ) : (
                <input aria-label="Servicio, porcentaje sobre el valor de factura" inputMode="decimal" value={f.servicioTasa} onChange={(e) => set("servicioTasa", e.target.value)} className="field-lux tabular-nums" />
              )}
            </div>
            <p className="mt-1.5 text-xs text-ink-4">
              {f.servicioTipo === "fijo" ? "En US$." : "Porcentaje sobre el valor de factura. Tasa inicial por confirmar."}
            </p>
          </div>
        </div>
      </PortalPanel>
    </div>
  );
}

function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm text-ink-2">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-ink-4">{hint}</p> : null}
    </div>
  );
}

function Segmento<T extends string>({ label, id, valor, opciones, onChange }: { label: string; id: string; valor: T; opciones: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <span id={`${id}-label`} className="block text-sm text-ink-2">{label}</span>
      <div role="group" aria-labelledby={`${id}-label`} className="mt-1.5 grid gap-2" style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
        {opciones.map((o) => (
          <button
            key={o.v}
            type="button"
            aria-pressed={valor === o.v}
            onClick={() => onChange(o.v)}
            className={cn(
              "field-lux flex items-center justify-center text-sm font-semibold transition-colors",
              valor === o.v ? "!border-silver !bg-surface-3 text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
