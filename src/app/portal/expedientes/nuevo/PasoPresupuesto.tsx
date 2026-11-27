"use client";

/**
 * Paso 4: el presupuesto (Anexo B) calculado con el core, con flete base
 * (traslado al puerto incluido), gastos de aduana y, en usados, el costo de la
 * inspección editables; honorarios (gestión registral incluida) y los seis
 * hitos en cinco pagos; alerta de año modelo; etapa inicial.
 */

import { Notice, PortalPanel } from "@/components/portal/CrmUI";
import { Campo, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { TablaPresupuesto } from "@/components/portal/expedientes/TablaPresupuesto";
import { alertas } from "@/core/expedientes/alertas";
import type { Embarque, ImporterProfile } from "@/core/expedientes/tipos";
import { calcularPresupuesto, contextoPrevio, type EstadoAlta, type PresupuestoForm } from "./estado";

export function PasoPresupuesto({
  estado,
  actualizar,
  embarqueElegido,
}: {
  estado: EstadoAlta;
  actualizar: (cambios: Partial<EstadoAlta> | ((previo: EstadoAlta) => EstadoAlta)) => void;
  embarqueElegido: Embarque | null;
}) {
  const p = estado.presupuesto;
  const set = <K extends keyof PresupuestoForm>(k: K, valor: PresupuestoForm[K]) =>
    actualizar((previo) => ({ ...previo, presupuesto: { ...previo.presupuesto, [k]: valor } }));

  const { presupuesto, error } = calcularPresupuesto(estado);
  const avisos = alertas(contextoPrevio(estado, embarqueElegido)).filter((a) => a.clave === "anio_modelo");

  return (
    <div className="space-y-6">
      <PortalPanel title="Supuestos" description="Lo que el motor no sabe por sí solo. El flete base es el del contenedor completo con el traslado al puerto incluido (no hay línea de transporte interno); la proporción viene del paso anterior. La gestión registral va dentro de los honorarios.">
        <div className="px-5 py-4">
          <Rejilla columnas={4}>
            <Campo label="Flete base del contenedor (USD)">
              <Entrada value={p.flete_base} onChange={(e) => set("flete_base", e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" />
            </Campo>
            <Campo label="Gastos de aduana (USD)">
              <Entrada value={p.gastos_aduana} onChange={(e) => set("gastos_aduana", e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" />
            </Campo>
            {estado.vehiculo.condicion === "usado" ? (
              <Campo label="Inspección del usado (USD)" hint="Se cobra con el Pago 1. En nuevos no existe.">
                <Entrada value={p.costo_inspeccion} onChange={(e) => set("costo_inspeccion", e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" />
              </Campo>
            ) : null}
            <Campo label="Perfil del importador" hint="Decide la percepción del IGV.">
              <Selector value={p.perfil} onChange={(e) => set("perfil", e.target.value as ImporterProfile)}>
                <option value="primera-importacion">Primera importación · 10 %</option>
                <option value="recurrente">Recurrente</option>
              </Selector>
            </Campo>
            <Campo label="Percepción en el Pago 4">
              <label className="flex min-h-10 items-center gap-2 text-sm normal-case tracking-normal text-ink-2">
                <input type="checkbox" checked={p.percepcion_en_tributos} onChange={(e) => set("percepcion_en_tributos", e.target.checked)} className="h-4 w-4 accent-silver" />
                Se paga a SUNAT con los tributos (H5)
              </label>
            </Campo>
            <Campo label="Etapa inicial">
              <Selector value={p.etapa_inicial} onChange={(e) => set("etapa_inicial", e.target.value as PresupuestoForm["etapa_inicial"])}>
                <option value="prospecto">Prospecto (el cliente no lo ve todavía)</option>
                <option value="busqueda">Búsqueda del auto (visible para el cliente)</option>
              </Selector>
            </Campo>
          </Rejilla>
        </div>
      </PortalPanel>

      {avisos.map((a) => (
        <Notice key={a.clave} tone="danger" label={a.titulo}>{a.detalle}</Notice>
      ))}

      {error ? (
        <Notice tone="danger" label="No se puede calcular">{error}</Notice>
      ) : presupuesto ? (
        <TablaPresupuesto presupuesto={presupuesto} />
      ) : null}
    </div>
  );
}
