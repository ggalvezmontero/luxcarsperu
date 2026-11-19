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

/**
 * Formulario del cotizador. Cuatro bloques en el orden en que se conversa con
 * el cliente: quién es, qué auto, de dónde y con qué régimen, y qué cuesta.
 * Los campos marcados con * son los que hacen falta para GUARDAR; para ver
 * el estimado basta el valor de factura.
 */
export function FormularioEnvio({ valor: f, onChange, anioActual, recorridoKm }: Props) {
  const set = <K extends keyof Formulario>(clave: K, v: Formulario[K]) => onChange({ ...f, [clave]: v });
  const anios = aniosDesde(anioActual + 1, anioActual - 8);
  const usado = f.condicion === "usado";
  const gasolinaNueva = !usado && f.combustible === "gasolina";

  return (
    <div className="flex flex-col gap-5">
      <PortalPanel title="Cliente">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="ce-nombre" requerido>
            <input id="ce-nombre" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} className="field-lux" maxLength={160} autoComplete="off" placeholder="Nombre y apellido" />
          </Field>
          <Field label="WhatsApp" htmlFor="ce-whatsapp" hint="Con el código del país donde vive.">
            <PhoneInput id="ce-whatsapp" value={f.whatsapp} onChange={(v) => set("whatsapp", v)} />
          </Field>
        </div>
      </PortalPanel>

      <PortalPanel title="Vehículo">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Marca" htmlFor="ce-marca" requerido>
            <input id="ce-marca" value={f.marca} onChange={(e) => set("marca", e.target.value)} className="field-lux" maxLength={80} placeholder="Subaru" />
          </Field>
          <Field label="Modelo" htmlFor="ce-modelo" requerido>
            <input id="ce-modelo" value={f.modelo} onChange={(e) => set("modelo", e.target.value)} className="field-lux" maxLength={120} placeholder="Outback Wilderness" />
          </Field>
          <Field label="Año modelo" htmlFor="ce-anio" requerido>
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
          <Field label="Valor de factura" htmlFor="ce-factura" requerido hint="Lo que pagó por el auto. Base del seguro y del valor para aduanas.">
            <Dinero id="ce-factura" value={f.valorFactura} onChange={(v) => set("valorFactura", v)} placeholder="55,000" />
          </Field>
          {usado ? (
            <Field label="Valor de referencia como usado" htmlFor="ce-referencia" hint="Opcional. Vacío: factura menos 10% por año de uso, tope 50%.">
              <Dinero id="ce-referencia" value={f.valorReferencia} onChange={(v) => set("valorReferencia", v)} placeholder="Opcional" />
            </Field>
          ) : null}
          <Field label="Recorrido" htmlFor="ce-recorrido" hint={f.unidadRecorrido === "millas" && recorridoKm > 0 ? `≈ ${formatNumber(recorridoKm)} km` : usado ? `Tope para usados: ${formatNumber(CONFIG_ENVIOS.usados.recorridoMaximoKm)} km.` : undefined}>
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <input id="ce-recorrido" inputMode="decimal" value={f.recorrido} onChange={(e) => set("recorrido", e.target.value)} className="field-lux tabular-nums" placeholder="500" />
              <select aria-label="Unidad del recorrido" value={f.unidadRecorrido} onChange={(e) => set("unidadRecorrido", e.target.value as Formulario["unidadRecorrido"])} className="field-lux">
                <option value="millas">millas</option>
                <option value="km">km</option>
              </select>
            </div>
          </Field>
          <Field label="Combustible" htmlFor="ce-combustible" hint={usado && f.combustible === "diesel" ? "Un diésel usado no puede importarse." : undefined}>
            <select id="ce-combustible" value={f.combustible} onChange={(e) => set("combustible", e.target.value as Formulario["combustible"])} className="field-lux">
              {VEHICLE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="País de fabricación" htmlFor="ce-pais" hint="Solo un nuevo hecho en EE.UU. paga 0% de ad valorem; el resto, 6%.">
            <SelectConOtro id="ce-pais" value={f.paisFabricacion} onChange={(v) => set("paisFabricacion", v)} opciones={PAISES_FABRICACION} vacio="Elegir país…" placeholderOtro="País" />
          </Field>
          {gasolinaNueva ? (
            <Field label="Cilindrada (cc)" htmlFor="ce-cilindrada" hint="Define el ISC de un gasolina nuevo. Vacío = más de 1,500 cc (10%).">
              <input id="ce-cilindrada" inputMode="numeric" value={f.cilindrada} onChange={(e) => set("cilindrada", e.target.value)} className="field-lux tabular-nums" placeholder="2400" />
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
          <Field label="Fecha estimada de importación" htmlFor="ce-fecha-importacion" hint="Fija el año para la antigüedad y los años de uso. Vacía: la de retorno o el año en curso.">
            <input id="ce-fecha-importacion" type="date" value={f.fechaImportacion} onChange={(e) => set("fechaImportacion", e.target.value)} className="field-lux" />
          </Field>
          <Segmento
            label="Régimen"
            id="ce-regimen"
            className="sm:col-span-2"
            valor={f.regimen}
            opciones={[{ v: "ley-retorno", l: "Ley del Retorno" }, { v: "importacion-regular", l: "Importación regular" }]}
            onChange={(v) => set("regimen", v)}
          />
          {f.regimen === "ley-retorno" ? (
            <>
              <Field label="Años viviendo fuera del Perú" htmlFor="ce-anios-fuera" requerido hint={`Mínimo ${CONFIG_ENVIOS.leyRetorno.aniosMinimosFuera} continuos.`}>
                <input id="ce-anios-fuera" inputMode="numeric" value={f.aniosFuera} onChange={(e) => set("aniosFuera", e.target.value)} className="field-lux tabular-nums" placeholder="4" />
              </Field>
              <Field label="Fecha estimada de retorno" htmlFor="ce-fecha-retorno" hint="El beneficio vence el 31/12/2029.">
                <input id="ce-fecha-retorno" type="date" value={f.fechaRetorno} onChange={(e) => set("fechaRetorno", e.target.value)} className="field-lux" />
              </Field>
            </>
          ) : null}
          <label className="flex cursor-pointer items-start gap-3 rounded-lux border border-line px-4 py-3 text-sm text-ink-2 transition-colors hover:border-line-strong sm:col-span-2">
            <input type="checkbox" checked={f.prestamoVigente} onChange={(e) => set("prestamoVigente", e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-silver" />
            <span>
              <span className="block text-ink">El vehículo tiene un préstamo vigente</span>
              <span className="block text-xs text-ink-4">Para exportarlo hay que cancelarlo o tener la autorización escrita del financista.</span>
            </span>
          </label>
        </div>
      </PortalPanel>

      <PortalPanel title="Costos" description="Vienen de la configuración; se pueden ajustar por cotización.">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Transporte interno en EE.UU." htmlFor="ce-transporte" hint="Del domicilio al puerto. Se cotiza aparte.">
            <Dinero id="ce-transporte" value={f.transporteInterno} onChange={(v) => set("transporteInterno", v)} placeholder="1,700" />
          </Field>
          <Field label="Flete marítimo hasta el Callao" htmlFor="ce-flete">
            <Dinero id="ce-flete" value={f.flete} onChange={(v) => set("flete", v)} />
          </Field>
          <Field label="Gastos de aduana y puerto" htmlFor="ce-aduana">
            <Dinero id="ce-aduana" value={f.gastosAduana} onChange={(v) => set("gastosAduana", v)} />
          </Field>
          <Field
            label="Servicio Luxcars"
            htmlFor="ce-servicio-valor"
            hint={f.servicioTipo === "fijo" ? "Monto fijo por la gestión completa." : "Porcentaje sobre el valor de factura. Tasa inicial por confirmar."}
          >
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Tipo de servicio" value={f.servicioTipo} onChange={(e) => set("servicioTipo", e.target.value as Formulario["servicioTipo"])} className="field-lux">
                <option value="fijo">Monto fijo</option>
                <option value="porcentaje">Porcentaje</option>
              </select>
              {f.servicioTipo === "fijo" ? (
                <Dinero id="ce-servicio-valor" value={f.servicioMonto} onChange={(v) => set("servicioMonto", v)} />
              ) : (
                <div className="relative">
                  <input id="ce-servicio-valor" inputMode="decimal" value={f.servicioTasa} onChange={(e) => set("servicioTasa", e.target.value)} className="field-lux !pr-9 tabular-nums" />
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-ink-4">%</span>
                </div>
              )}
            </div>
          </Field>
        </div>
      </PortalPanel>

      <p className="px-1 text-xs text-ink-4">* Necesario para guardar. El estimado se calcula con lo que haya.</p>
    </div>
  );
}

function Field({ label, htmlFor, hint, requerido, className, children }: { label: string; htmlFor: string; hint?: string; requerido?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-sm text-ink-2">
        {label}
        {requerido ? <span aria-hidden className="ml-1 text-silver">*</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1.5 text-xs text-ink-4">{hint}</p> : null}
    </div>
  );
}

/** Importe en US$ con el prefijo dentro del campo: la etiqueta queda corta y la moneda, a la vista. */
function Dinero({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-ink-4">US$</span>
      <input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} className="field-lux !pl-14 tabular-nums" placeholder={placeholder} aria-describedby={undefined} />
    </div>
  );
}

function Segmento<T extends string>({ label, id, valor, opciones, onChange, className }: { label: string; id: string; valor: T; opciones: { v: T; l: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={className}>
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
