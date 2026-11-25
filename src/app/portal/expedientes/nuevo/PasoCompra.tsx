"use client";

/**
 * Paso 3: compra y embarque. Moneda, precio y tope, tipo de cambio de
 * referencia, modalidad, embarque existente o nuevo, proporción del flete y
 * las fechas estimadas de las que dependen hitos y alertas.
 */

import { PortalPanel } from "@/components/portal/CrmUI";
import { AreaTexto, Campo, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import type { Embarque, ModalidadEmbarque, TipoContenedor } from "@/core/expedientes/tipos";
import { MODALIDADES_EMBARQUE, TIPOS_CONTENEDOR } from "@/core/expedientes/tipos";
import { CONTENEDOR_LABEL, MODALIDAD_LABEL, fecha, usd } from "@/lib/expedientes/formato";
import { precioUsd, type CompraForm, type EstadoAlta } from "./estado";

const MONEDAS = ["USD", "CAD", "EUR", "GBP", "JPY", "MXN"];

export function PasoCompra({
  estado,
  actualizar,
  embarques,
}: {
  estado: EstadoAlta;
  actualizar: (cambios: Partial<EstadoAlta> | ((previo: EstadoAlta) => EstadoAlta)) => void;
  embarques: Embarque[];
}) {
  const c = estado.compra;
  const set = <K extends keyof CompraForm>(k: K, valor: CompraForm[K]) =>
    actualizar((previo) => {
      const compra = { ...previo.compra, [k]: valor };
      if (k === "modalidad") {
        compra.proporcion = valor === "consolidado" ? (previo.compra.proporcion === "1" ? "0.5" : previo.compra.proporcion) : "1";
      }
      return { ...previo, compra };
    });

  const abiertos = embarques.filter((e) => !e.fechaArriboReal);

  return (
    <div className="space-y-6">
      <PortalPanel title="Compra" description="El precio tope y el tipo de cambio de referencia son reservados: el cliente no los ve.">
        <div className="px-5 py-4">
          <Rejilla columnas={3}>
            <Campo label="Moneda de compra">
              <Selector value={c.moneda} onChange={(e) => set("moneda", e.target.value)}>
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Selector>
            </Campo>
            <Campo label={`Precio (${c.moneda})`} requerido hint="El acordado o el estimado de la búsqueda.">
              <Entrada value={c.precio} onChange={(e) => set("precio", e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" />
            </Campo>
            <Campo label={`Precio tope (${c.moneda})`} hint="Reservado. Hasta dónde puede llegar la negociación.">
              <Entrada value={c.precio_tope} onChange={(e) => set("precio_tope", e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" />
            </Campo>
            {c.moneda !== "USD" ? (
              <Campo label={`Tipo de cambio ${c.moneda} → USD`} requerido hint={`Precio en USD: ${usd(precioUsd(c))}`}>
                <Entrada value={c.tc_ref} onChange={(e) => set("tc_ref", e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" />
              </Campo>
            ) : null}
            <Campo label="Fecha límite de compra">
              <Entrada type="date" value={c.fecha_limite_compra} onChange={(e) => set("fecha_limite_compra", e.target.value)} />
            </Campo>
            <Campo label="País de origen">
              <Entrada value={c.pais_origen} onChange={(e) => set("pais_origen", e.target.value)} maxLength={80} />
            </Campo>
            <Campo label="Puerto de salida">
              <Entrada value={c.puerto_origen} onChange={(e) => set("puerto_origen", e.target.value)} maxLength={120} />
            </Campo>
          </Rejilla>
        </div>
      </PortalPanel>

      <PortalPanel title="Embarque" description="Un embarque agrupa uno o varios expedientes y reparte el flete. Se puede asignar después.">
        <div className="space-y-4 px-5 py-4">
          <Rejilla columnas={3}>
            <Campo label="Modalidad">
              <Selector value={c.modalidad} onChange={(e) => set("modalidad", e.target.value as ModalidadEmbarque)}>
                {MODALIDADES_EMBARQUE.map((m) => (
                  <option key={m} value={m}>{MODALIDAD_LABEL[m]}</option>
                ))}
              </Selector>
            </Campo>
            <Campo label="Proporción del flete" hint="1 = contenedor exclusivo · 0.5 = consolidado a dos.">
              <Entrada value={c.proporcion} onChange={(e) => set("proporcion", e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" />
            </Campo>
            <Campo label="Embarque">
              <Selector value={c.embarqueModo} onChange={(e) => set("embarqueModo", e.target.value as CompraForm["embarqueModo"])}>
                <option value="ninguno">Asignar después</option>
                <option value="existente">Uno existente</option>
                <option value="nuevo">Crear uno nuevo</option>
              </Selector>
            </Campo>
          </Rejilla>

          {c.embarqueModo === "existente" ? (
            <Campo label="Elegir embarque">
              <Selector value={c.embarque_id} onChange={(e) => set("embarque_id", e.target.value)}>
                <option value="">—</option>
                {abiertos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo} · {MODALIDAD_LABEL[e.modalidad]}
                    {e.fechaZarpeEst ? ` · zarpe ${fecha(e.fechaZarpeEst)}` : ""}
                  </option>
                ))}
              </Selector>
            </Campo>
          ) : null}

          {c.embarqueModo === "nuevo" ? (
            <Rejilla columnas={4}>
              <Campo label="Contenedor">
                <Selector value={c.embarque_contenedor} onChange={(e) => set("embarque_contenedor", e.target.value as TipoContenedor)}>
                  {TIPOS_CONTENEDOR.map((t) => (
                    <option key={t} value={t}>{CONTENEDOR_LABEL[t]}</option>
                  ))}
                </Selector>
              </Campo>
              <Campo label="Puerto de origen">
                <Entrada value={c.embarque_puerto_origen} onChange={(e) => set("embarque_puerto_origen", e.target.value)} maxLength={120} />
              </Campo>
              <Campo label="Release estimado">
                <Entrada type="date" value={c.embarque_fecha_release_est} onChange={(e) => set("embarque_fecha_release_est", e.target.value)} />
              </Campo>
              <Campo label="Zarpe estimado">
                <Entrada type="date" value={c.embarque_fecha_zarpe_est} onChange={(e) => set("embarque_fecha_zarpe_est", e.target.value)} />
              </Campo>
              <Campo label="Arribo estimado al Callao">
                <Entrada type="date" value={c.embarque_fecha_arribo_est} onChange={(e) => set("embarque_fecha_arribo_est", e.target.value)} />
              </Campo>
            </Rejilla>
          ) : null}
        </div>
      </PortalPanel>

      <PortalPanel title="Fechas del expediente" description="De acá salen las fechas límite de los hitos y la alerta de año modelo (se evalúa al año del arribo estimado).">
        <div className="space-y-4 px-5 py-4">
          <Rejilla columnas={4}>
            <Campo label="Fecha límite H2">
              <Entrada type="date" value={c.fecha_limite_h2} onChange={(e) => set("fecha_limite_h2", e.target.value)} />
            </Campo>
            <Campo label="Embarque estimado">
              <Entrada type="date" value={c.fecha_est_embarque} onChange={(e) => set("fecha_est_embarque", e.target.value)} />
            </Campo>
            <Campo label="Arribo estimado">
              <Entrada type="date" value={c.fecha_est_arribo} onChange={(e) => set("fecha_est_arribo", e.target.value)} />
            </Campo>
            <Campo label="Entrega estimada">
              <Entrada type="date" value={c.fecha_est_entrega} onChange={(e) => set("fecha_est_entrega", e.target.value)} />
            </Campo>
            <Campo label="Semanas estimadas" hint="Texto para el contrato, p. ej. «10 a 14 semanas».">
              <Entrada value={c.semanas_estimadas} onChange={(e) => set("semanas_estimadas", e.target.value)} maxLength={40} />
            </Campo>
          </Rejilla>
          <Campo label="Notas internas" hint="Solo las ve el equipo.">
            <AreaTexto value={c.notas_internas} onChange={(e) => set("notas_internas", e.target.value)} rows={3} maxLength={8000} />
          </Campo>
        </div>
      </PortalPanel>
    </div>
  );
}
