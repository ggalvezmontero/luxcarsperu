import type { VehicleCondition, VehicleOrigin } from "../pricing/pricingConfig";
import type { VehicleCategoryId } from "../pricing/vehicleCategories";
import type { ServicioEnvio } from "./configEnvios";

/** Régimen con el que entra el vehículo. */
export type RegimenEnvio = "ley-retorno" | "importacion-regular";

export type UnidadRecorrido = "millas" | "km";

/**
 * Todo lo que el administrador escribe en el formulario. Es lo que se guarda
 * como `entrada` en la base: con esto se reproduce la cotización completa.
 * Las fechas van como texto ISO `YYYY-MM-DD`; los montos, en USD.
 */
export type EntradaCotizacionEnvio = {
  cliente: {
    nombre: string;
    whatsapp: string;
  };
  vehiculo: {
    marca: string;
    modelo: string;
    anioModelo: number;
    condicion: VehicleCondition;
    recorrido: number;
    unidadRecorrido: UnidadRecorrido;
    combustible: VehicleCategoryId;
    paisFabricacion: string;
    valorFacturaUsd: number;
    /** Valor de referencia como usado. Si viene, manda sobre la depreciación. */
    valorReferenciaUsadoUsd: number | null;
    /** Solo cambia el ISC de un gasolina NUEVO. */
    cilindradaCc: number | null;
  };
  origen: {
    ciudad: string;
    estado: string;
    puertoSalida: string;
  };
  regimen: RegimenEnvio;
  /** Solo Ley del Retorno. */
  retorno: {
    aniosFuera: number;
    fechaRetorno: string | null;
  } | null;
  prestamoVigente: boolean;
  fechaImportacion: string | null;
  costos: {
    transporteInternoUsd: number;
    fleteUsd: number;
    gastosAduanaUsd: number;
    servicio: ServicioEnvio;
  };
};

export type NivelAlerta = "info" | "warn" | "danger";

export type AlertaEnvio = {
  clave: string;
  nivel: NivelAlerta;
  titulo: string;
  detalle: string;
  /** Si se menciona en el mensaje al cliente. Lo interno (p. ej. margen) no va. */
  paraCliente: boolean;
};

export type TributosEnvio = {
  adValorem: number;
  isc: number;
  igv: number;
  ipm: number;
  /** Suma de los cuatro. Es lo que se paga de verdad. */
  total: number;
  /** Adelanto del IGV, aparte del total: se recupera como crédito fiscal. */
  percepcion: number;
  tasas: {
    adValorem: number;
    isc: number;
    igv: number;
    ipm: number;
    percepcion: number;
  };
};

export type DesgloseRegimen = {
  regimen: RegimenEnvio;
  transporteInternoUsd: number;
  fleteUsd: number;
  seguroUsd: number;
  /** Valor en aduana + flete + seguro. Base de los tributos en la importación regular. */
  cifUsd: number;
  /** `null` cuando el vehículo no puede nacionalizarse por esa vía (diésel usado). */
  tributos: TributosEnvio | null;
  gastosAduanaUsd: number;
  servicioUsd: number;
  /** Costo total referencial, SIN la percepción. */
  totalUsd: number;
  /** Efectivo a desembolsar: total más percepción. En el Retorno es igual al total. */
  efectivoUsd: number;
  /**
   * Ley del Retorno: si el beneficio aplica con los datos dados. En la
   * importación regular siempre `true` (no hay beneficio que perder).
   */
  beneficioAplica: boolean;
};

export type ValorAduanaEstimado = {
  valorUsd: number;
  metodo: "factura" | "referencia" | "depreciacion";
  aniosUso: number;
  /** Fracción descontada (0.1 por año, tope 0.5). */
  depreciacion: number;
  /** Cuánto queda por debajo del tope del Retorno. Negativo si lo supera. */
  margenTopeUsd: number;
};

export type ResultadoCotizacionEnvio = {
  /** Origen a efectos del ad valorem, deducido del país de fabricación. */
  origen: VehicleOrigin;
  recorridoKm: number;
  /** Año en que se importa (fecha de importación, si no la de retorno, si no el año en curso). */
  anioImportacion: number;
  valorAduana: ValorAduanaEstimado;
  /** Último día en que el vehículo puede ingresar como usado (ISO). `null` si es nuevo. */
  fechaLimiteIngreso: string | null;
  retorno: DesgloseRegimen;
  regular: DesgloseRegimen;
  /** El desglose del régimen elegido en la entrada. */
  elegido: DesgloseRegimen;
  alertas: AlertaEnvio[];
  nota: string;
  motorVersion: string;
};
