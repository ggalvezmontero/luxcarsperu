/**
 * Opciones de los desplegables que describen un vehículo.
 *
 * Son listas de AYUDA, no de validación: cada desplegable que las usa
 * (`SelectConOtro`) termina en "Otro…" y deja escribir el valor. Lo que se
 * guarda es siempre texto, así que un valor que ya estaba en la base y no está
 * en la lista ("Blanco perlado", "Automática · 8") se sigue viendo y se sigue
 * pudiendo editar.
 *
 * Agregar una opción es una línea. Van en el orden en que más se usan.
 */

export const COLORES_EXTERIOR = [
  "Blanco",
  "Negro",
  "Gris",
  "Plata",
  "Azul",
  "Rojo",
  "Verde",
  "Marrón",
  "Beige",
  "Dorado",
  "Naranja",
  "Amarillo",
] as const;

export const COLORES_INTERIOR = ["Negro", "Gris", "Beige", "Marrón", "Rojo", "Blanco", "Azul"] as const;

export const CARROCERIAS = [
  "Sedán",
  "Coupé",
  "Convertible",
  "Hatchback",
  "SUV",
  "Pickup",
  "Van",
  "Station wagon",
] as const;

export const TRANSMISIONES = ["Automática", "Manual", "CVT", "Doble embrague (DCT)"] as const;

export const TRACCIONES = ["Delantera (FWD)", "Trasera (RWD)", "Integral (AWD)", "4x4 (4WD)"] as const;

/** Años para un desplegable, del más nuevo al más antiguo. */
export function aniosDesde(masNuevo: number, masAntiguo: number): number[] {
  return Array.from({ length: Math.max(0, masNuevo - masAntiguo + 1) }, (_, i) => masNuevo - i);
}
