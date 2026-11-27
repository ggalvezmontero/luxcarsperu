/**
 * Tipos de las cotizaciones de importación a pedido. Lo que escribe el equipo
 * (`DatosCotizacion`, se guarda en `cotizaciones.datos`) y lo que calcula el
 * core (`ResultadoCotizacion`, se guarda en `cotizaciones.resultado`).
 */

import type { ImporterProfile, VehicleCondition, VehicleOrigin } from "../pricing/pricingConfig";
import type { VehicleCategoryId } from "../pricing/vehicleCategories";

export type TipoClienteCotizacion = "persona" | "empresa";

export type EstadoCotizacion = "borrador" | "enviada" | "aceptada" | "rechazada" | "vencida";

export const ESTADOS_COTIZACION: readonly EstadoCotizacion[] = ["borrador", "enviada", "aceptada", "rechazada", "vencida"];

/** Días de vigencia desde que se envía. */
export const VIGENCIA_DIAS = 15;

export type ClienteCotizacion = {
  tipo: TipoClienteCotizacion;
  /** Nombre completo o razón social. */
  nombre: string;
  /** RUC (empresa, 11 dígitos) o DNI / carné (persona). */
  documento: string;
  email: string;
  telefono: string;
  /** Ficha de cliente existente, si se eligió una. */
  clienteId?: string | null;
};

export type AutoCotizacion = {
  marca: string;
  modelo: string;
  /** Versión o acabado, opcional ("TRD Pro" puede ir en el modelo). */
  version?: string;
  anio: number;
  color: string;
  condicion: VehicleCondition;
  /** Propulsión: categoría del motor de precios. */
  propulsion: VehicleCategoryId;
  /** Solo gasolina nueva: el ISC depende de la cilindrada (sin dato se asume más de 1,500 cc). */
  cilindradaCc?: number | null;
  /** Originario de EE.UU. con certificado de origen (TLC, ad valorem 0 % en nuevos) u otro. */
  origen: VehicleOrigin;
  /** M1 autos y SUV · N1 pickups. Va al Anexo A del expediente. */
  clase?: "M1" | "N1";
  /** Precio del vehículo en USD. */
  precio: number;
  /** Importador del auto. `null` = el cliente de la cotización. */
  importador: ClienteCotizacion | null;
};

/** Cómo se reparten los costos del contenedor entre los autos. */
export type Reparto =
  | { modo: "iguales" }
  /** Porcentajes por auto, en el orden de los autos; suman 100. */
  | { modo: "porcentaje"; porcentajes: number[] };

/** Costos totales del contenedor, en USD. */
export type CostosCotizacion = {
  flete: number;
  seguro: number;
  gastosAduana: number;
  /** Honorarios de Luxcars, IGV incluido. */
  honorarios: number;
};

export type DatosCotizacion = {
  autos: AutoCotizacion[];
  costos: CostosCotizacion;
  reparto: Reparto;
  /** Perfil del importador para la percepción del expediente (la cotización muestra 10 % y 3.5 %). */
  perfil?: ImporterProfile;
  /** Plazo estimado que sale en las condiciones. */
  plazo?: string;
};

export type ResultadoAuto = {
  indice: number;
  nombre: string;
  nombreCorto: string;
  precio: number;
  flete: number;
  seguro: number;
  cif: number;
  tasaAdValorem: number;
  tasaIsc: number;
  adValorem: number;
  isc: number;
  igv: number;
  ipm: number;
  /** Suma de las líneas redondeadas: ad valorem, ISC, IGV e IPM. */
  tributos: number;
  gastosAduana: number;
  honorarios: number;
  /** Costo puesto en Lima antes de honorarios: CIF + tributos + aduana. */
  costoAntesDeHonorarios: number;
  total: number;
  /** Base de la percepción (CIF + tributos). */
  percepcionBase: number;
  /** Percepción si es la primera importación (10 %). */
  percepcionPrimera: number;
  /** Percepción de un importador recurrente (3.5 % en nuevos, 5 % en usados). */
  percepcionRecurrente: number;
  tasaPercepcionPrimera: number;
  tasaPercepcionRecurrente: number;
  /** Proporción de los costos del contenedor que lleva este auto (0–1). */
  proporcion: number;
  /** Cinco pagos: precio · flete + seguro + ½ honorarios · aduana · tributos · ½ honorarios. */
  pagos: [number, number, number, number, number];
};

export type ResultadoCotizacion = {
  autos: ResultadoAuto[];
  total: number;
  /** Honorarios que propone la regla de `src/core/pricing` (BrokerModule), suma de todos los autos. */
  honorariosPropuestos: number;
  /** Seguro que propone InsuranceModule, suma de todos los autos. */
  seguroPropuesto: number;
};
