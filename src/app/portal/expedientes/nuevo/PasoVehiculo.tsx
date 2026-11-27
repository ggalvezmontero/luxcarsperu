"use client";

/**
 * Paso 2: el vehículo. El VIN se decodifica contra NHTSA vPIC por
 * `/api/vin/[vin]` (misma mecánica que el alta de stock): nunca pisa lo
 * escrito a mano y nunca bloquea. El origen APC se sugiere con el motor
 * (`resolveOrigin`) y queda editable: de él depende el ad valorem.
 */

import { useState } from "react";
import { Button } from "@/components/Button";
import { Notice, PortalPanel } from "@/components/portal/CrmUI";
import { Campo, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { resolveOrigin } from "@/core/pricing/originInference";
import { VEHICLE_CATEGORIES } from "@/core/pricing/vehicleCategories";
import { normalizeVin, validateVin, vinCheckDigitMatches, type VinDecoded, type VinLookupResponse } from "@/lib/vin";
import type { ClaseVehiculo } from "@/core/expedientes/tipos";
import type { VehicleCategoryId, VehicleCondition, VehicleOrigin } from "@/lib/db/types";
import { presupuestoInicial, type EstadoAlta, type VehiculoForm } from "./estado";

export function PasoVehiculo({
  estado,
  actualizar,
}: {
  estado: EstadoAlta;
  actualizar: (cambios: Partial<EstadoAlta> | ((previo: EstadoAlta) => EstadoAlta)) => void;
}) {
  const v = estado.vehiculo;
  const [vinEstado, setVinEstado] = useState<{ fase: "inactivo" | "consultando" | "ok" | "error"; mensaje?: string; avisos?: string[] }>({ fase: "inactivo" });

  const set = <K extends keyof VehiculoForm>(k: K, valor: VehiculoForm[K]) =>
    actualizar((previo) => {
      const vehiculo = { ...previo.vehiculo, [k]: valor };
      // Al cambiar la categoría, el flete base por defecto cambia con ella.
      const presupuesto = k === "categoria" ? { ...previo.presupuesto, flete_base: presupuestoInicial(valor as VehicleCategoryId).flete_base } : previo.presupuesto;
      return { ...previo, vehiculo, presupuesto };
    });

  async function decodificar() {
    const validacion = validateVin(v.vin);
    if (!validacion.valid) return setVinEstado({ fase: "error", mensaje: validacion.reason });
    setVinEstado({ fase: "consultando" });
    let respuesta: VinLookupResponse;
    try {
      const r = await fetch(`/api/vin/${validacion.vin}`, { headers: { accept: "application/json" } });
      respuesta = (await r.json()) as VinLookupResponse;
    } catch {
      return setVinEstado({ fase: "error", mensaje: "No se pudo consultar NHTSA. Escribe los datos a mano: el expediente se crea igual." });
    }
    if (!respuesta.ok) return setVinEstado({ fase: "error", mensaje: respuesta.error });
    aplicar(respuesta.data);
    setVinEstado({ fase: "ok", avisos: respuesta.notices });
  }

  function aplicar(d: VinDecoded) {
    actualizar((previo) => {
      const p = previo.vehiculo;
      const marca = p.marca || d.brand || "";
      const modelo = p.modelo || d.model || "";
      const categoria = d.suggestedCategory ?? p.categoria;
      const sugerido = marca && modelo ? resolveOrigin(marca, modelo, d.vin) : null;
      return {
        ...previo,
        vehiculo: {
          ...p,
          marca,
          modelo,
          version: p.version || d.trim || "",
          anio: p.anio || (d.year ? String(d.year) : ""),
          cilindrada_cc: p.cilindrada_cc || (d.engineCc ? String(d.engineCc) : ""),
          combustible: p.combustible || d.fuelType || "",
          transmision: p.transmision || d.transmission || "",
          pais_ensamblaje: p.pais_ensamblaje || d.assemblyCountry || "",
          categoria,
          origen: sugerido ? sugerido.origin : p.origen,
        },
        presupuesto: categoria !== p.categoria ? { ...previo.presupuesto, flete_base: presupuestoInicial(categoria).flete_base } : previo.presupuesto,
      };
    });
  }

  const sugerencia = v.marca && v.modelo ? resolveOrigin(v.marca, v.modelo, v.vin.length === 17 ? v.vin : undefined) : null;
  const digitoOk = v.vin.length === 17 ? vinCheckDigitMatches(v.vin) : true;

  return (
    <div className="space-y-6">
      <PortalPanel title="VIN" description="Pega el VIN y NHTSA completa la ficha. Si todavía no hay unidad elegida, déjalo vacío y describe lo que se busca.">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Entrada
              value={v.vin}
              onChange={(e) => set("vin", normalizeVin(e.target.value).slice(0, 17))}
              placeholder="17 caracteres"
              className="font-mono uppercase tracking-wider"
              aria-label="VIN"
              maxLength={17}
            />
            {!digitoOk ? <p className="mt-1 text-xs text-warn">El dígito verificador no cuadra: revisa si hay un error de tipeo (no bloquea).</p> : null}
            {vinEstado.fase === "error" ? <p className="mt-1 text-xs text-danger">{vinEstado.mensaje}</p> : null}
            {vinEstado.fase === "ok" ? (
              <p className="mt-1 text-xs text-ok">
                Ficha completada desde NHTSA.{vinEstado.avisos?.length ? ` ${vinEstado.avisos.join(" ")}` : ""}
              </p>
            ) : null}
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={() => void decodificar()} disabled={vinEstado.fase === "consultando" || v.vin.length !== 17}>
            {vinEstado.fase === "consultando" ? "Consultando…" : "Decodificar"}
          </Button>
        </div>
      </PortalPanel>

      <PortalPanel title="Ficha del vehículo">
        <div className="space-y-5 px-5 py-4">
          <Rejilla columnas={3}>
            <Campo label="Marca" requerido>
              <Entrada value={v.marca} onChange={(e) => set("marca", e.target.value)} maxLength={80} />
            </Campo>
            <Campo label="Modelo" requerido>
              <Entrada value={v.modelo} onChange={(e) => set("modelo", e.target.value)} maxLength={120} />
            </Campo>
            <Campo label="Versión">
              <Entrada value={v.version} onChange={(e) => set("version", e.target.value)} maxLength={120} />
            </Campo>
            <Campo label="Año modelo" requerido>
              <Entrada value={v.anio} onChange={(e) => set("anio", e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" />
            </Campo>
            <Campo label="Condición al importar">
              <Selector value={v.condicion} onChange={(e) => set("condicion", e.target.value as VehicleCondition)}>
                <option value="nuevo">Nuevo</option>
                <option value="usado">Usado</option>
              </Selector>
            </Campo>
            <Campo label="Categoría (decide el ISC)">
              <Selector value={v.categoria} onChange={(e) => set("categoria", e.target.value as VehicleCategoryId)}>
                {VEHICLE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Selector>
            </Campo>
            <Campo label="Clase (Anexo A y aduana)" requerido>
              <Selector value={v.clase} onChange={(e) => set("clase", e.target.value as ClaseVehiculo)}>
                <option value="M1">M1 · autos y SUV</option>
                <option value="N1">N1 · pickups y camionetas</option>
              </Selector>
            </Campo>
            <Campo label="Cilindrada (cc)">
              <Entrada value={v.cilindrada_cc} onChange={(e) => set("cilindrada_cc", e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
            </Campo>
            <Campo label="Combustible">
              <Entrada value={v.combustible} onChange={(e) => set("combustible", e.target.value)} maxLength={60} />
            </Campo>
            <Campo label="Transmisión">
              <Entrada value={v.transmision} onChange={(e) => set("transmision", e.target.value)} maxLength={60} />
            </Campo>
            <Campo label="Color">
              <Entrada value={v.color} onChange={(e) => set("color", e.target.value)} maxLength={60} />
            </Campo>
            <Campo label="Kilometraje">
              <Entrada value={v.km} onChange={(e) => set("km", e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
            </Campo>
            <Campo label="País de ensamblaje">
              <Entrada value={v.pais_ensamblaje} onChange={(e) => set("pais_ensamblaje", e.target.value)} maxLength={80} />
            </Campo>
            <Campo label="Documento de propiedad" hint="Title, MSO, registration…">
              <Entrada value={v.doc_propiedad} onChange={(e) => set("doc_propiedad", e.target.value)} maxLength={120} />
            </Campo>
            <Campo label="Origen para el ad valorem" className="sm:col-span-2">
              <Selector value={v.origen} onChange={(e) => set("origen", e.target.value as VehicleOrigin)}>
                <option value="otro">Otro origen · 6 %</option>
                <option value="originario-usa">Originario de EE.UU. (APC, con certificado) · 0 %</option>
              </Selector>
            </Campo>
          </Rejilla>
          {sugerencia ? (
            <Notice tone={sugerencia.origin === "originario-usa" ? "info" : "warn"} label={`Sugerencia del motor: ${sugerencia.origin === "originario-usa" ? "0 %" : "6 %"} · confianza ${sugerencia.confidence}`}>
              {sugerencia.reason}
              {v.condicion === "usado" ? " Un usado paga 6 % aunque sea originario de EE.UU." : ""}
            </Notice>
          ) : null}
        </div>
      </PortalPanel>
    </div>
  );
}
