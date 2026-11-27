/**
 * Traduce un auto de una cotización aceptada a lo que recibe
 * `crear_expediente(p_datos)`. Reutiliza el armado del asistente de alta
 * (`construirDatos` de /portal/expedientes/nuevo): mismas tareas de la etapa,
 * mismos hitos con sus fechas, mismas columnas. Lo único distinto es el
 * presupuesto, que lleva las cifras de la cotización (ver
 * `src/core/cotizaciones/presupuesto.ts`).
 *
 * El embarque y la etapa los fija `aceptar_cotizacion` en SQL: todos nacen en
 * búsqueda y, con varios autos, en un mismo embarque consolidado.
 */

import {
  COMPRA_INICIAL,
  ESTADO_INICIAL,
  VEHICULO_INICIAL,
  construirDatos,
  presupuestoInicial,
  type EstadoAlta,
} from "@/app/portal/expedientes/nuevo/estado";
import { presupuestoDesdeCotizacion, type AutoCotizacion, type DatosCotizacion, type ResultadoAuto } from "@/core/cotizaciones";
import type { Cliente } from "@/core/expedientes/tipos";
import type { ImporterProfile } from "@/core/pricing/pricingConfig";
import type { DatosCrearExpediente } from "@/lib/expedientes/consultas";

export type OpcionesAceptar = {
  perfil: ImporterProfile;
  percepcionEnTributos: boolean;
};

export function datosExpedienteDesdeCotizacion(input: {
  codigo: string;
  datos: DatosCotizacion;
  auto: AutoCotizacion;
  resultado: ResultadoAuto;
  cliente: Cliente;
  opciones: OpcionesAceptar;
}): DatosCrearExpediente {
  const { auto, resultado: r, cliente, datos, codigo, opciones } = input;
  const presupuesto = presupuestoDesdeCotizacion(auto, r, {
    codigo,
    fleteContenedor: datos.costos.flete,
    perfil: opciones.perfil,
    percepcionEnTributos: opciones.percepcionEnTributos,
  });
  const estado: EstadoAlta = {
    ...ESTADO_INICIAL,
    paso: 4,
    cliente,
    origenSolicitudId: null,
    vehiculo: {
      ...VEHICULO_INICIAL,
      marca: auto.marca.trim(),
      modelo: auto.modelo.trim(),
      version: (auto.version ?? "").trim(),
      anio: String(auto.anio),
      color: auto.color.trim(),
      cilindrada_cc: auto.cilindradaCc ? String(auto.cilindradaCc) : "",
      condicion: auto.condicion,
      categoria: auto.propulsion,
      clase: auto.clase ?? "M1",
      origen: auto.origen,
      pais_ensamblaje: auto.origen === "originario-usa" ? "Estados Unidos" : "",
    },
    compra: {
      ...COMPRA_INICIAL,
      moneda: "USD",
      precio: String(r.precio),
      tc_ref: "1",
      proporcion: String(presupuesto.proporcionFlete),
      modalidad: datos.autos.length > 1 ? "consolidado" : "exclusivo",
      embarqueModo: "ninguno",
      semanas_estimadas: (datos.plazo ?? "").trim(),
      notas_internas: `Desde la cotización ${codigo}, auto ${r.indice} de ${datos.autos.length}.`,
    },
    presupuesto: {
      ...presupuestoInicial(auto.propulsion),
      flete_base: String(datos.costos.flete),
      gastos_aduana: String(r.gastosAduana),
      perfil: opciones.perfil,
      percepcion_en_tributos: opciones.percepcionEnTributos,
      etapa_inicial: "busqueda",
    },
  };
  return { ...construirDatos(estado, presupuesto, null), etapa: "busqueda", embarque_id: null, embarque_nuevo: null };
}
