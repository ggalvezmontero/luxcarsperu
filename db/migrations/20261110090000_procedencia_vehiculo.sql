-- =============================================================================
--  Migración 0013 · vehicles.procedencia — ¿importado o ya en el Perú?
-- =============================================================================
--
--  El formulario del portal mostraba "Antes de importarlo, ojo con esto" para
--  cualquier usado con más de 2 años o más de 32,000 km, también para un auto
--  comprado en Lima para reventa, al que esas reglas no le aplican. No había
--  forma de saberlo: `fuente` dice cómo llegó el DATO al sistema (carga manual,
--  feed, consignación), no de dónde viene el AUTO.
--
--  Esta columna guarda eso último:
--    'importado'  → lo trae (o lo trajo) LuxCars; rigen antigüedad máxima,
--                   tope de kilometraje y prohibición de diésel usado.
--    'local'      → ya estaba en el Perú (compra local, consignación); se
--                   inventaría tal cual está y el portal no avisa nada.
--
--  NO se confunde con `public.origen_vehiculo` ('originario-usa' / 'otro'),
--  que es la regla de origen del APC Perú–EE.UU. para el arancel.
--
--  Las filas existentes quedan como 'importado': hasta hoy todo el stock
--  propio vino de EE.UU., y es el valor que conserva el comportamiento previo.
--  Igual que antes, no hay CHECK de antigüedad ni kilometraje: las reglas de
--  importación viven en `checkAdmissibility()` y solo se consultan al importar.
-- =============================================================================

do $$ begin
  -- Espejo exacto de VehicleProcedencia (src/lib/db/types.ts)
  create type public.procedencia_vehiculo as enum ('importado', 'local');
exception when duplicate_object then null; end $$;

alter table public.vehicles
  add column if not exists procedencia public.procedencia_vehiculo
    not null default 'importado';

comment on column public.vehicles.procedencia is
  'De dónde viene el AUTO: importado por LuxCars o ya en el Perú. Distinto de fuente (procedencia del dato).';

-- `authenticated` ya tiene privilegios a nivel de tabla (migración 0003), así
-- que el equipo puede escribirla sin más. `anonymous` solo lee columnas
-- explícitas y esta no se expone: es información de operación, no de ficha.
