-- =============================================================================
--  Migración 0009 · consignación pública — la web distingue propio de consignado
-- =============================================================================
--
--  Hasta acá la vista `vehiculos_publicos` no exponía `vehicles.fuente`, así
--  que el sitio no podía saber si una unidad publicada es stock propio o el
--  auto de un cliente en consignación, y todo salía bajo el título "Stock
--  propio". Eso es un problema de honestidad comercial: un consignado no es
--  de LuxCars y el comprador tiene derecho a saberlo antes de la visita.
--
--  La decisión de negocio (2026-09-17) es publicar también los consignados,
--  etiquetados como tales. Para eso hacen falta dos cosas:
--
--    1. Que `anon` pueda leer la columna `fuente`. El GRANT por columna de la
--       migración 0003 no la incluía, y como la vista es `security_invoker`,
--       sin este GRANT la consulta pública falla.
--    2. Que la vista la devuelva. `create or replace view` solo admite AÑADIR
--       columnas al final, por eso `fuente` va última y no junto a `estado`.
--
--  `fuente` es procedencia del DATO, no del auto (ver 0003). Sigue siendo la
--  lista blanca de siempre: acá no se agrega ningún valor, solo se lee.
-- =============================================================================

grant select (fuente) on public.vehicles to anon;

create or replace view public.vehiculos_publicos
with (security_invoker = true) as
select
  v.id,
  v.slug,
  v.marca,
  v.modelo,
  v.version,
  v.anio,
  v.carroceria,
  v.categoria,
  v.cilindrada_cc,
  v.transmision,
  v.traccion,
  v.color_exterior,
  v.puertas,
  v.asientos,
  v.kilometraje_km,
  v.condicion,
  v.precio_venta,
  v.moneda_venta,
  v.precio_negociable,
  v.estado,
  v.ubicacion,
  v.titular,
  v.descripcion,
  v.destacados,
  v.publicado_en,
  p.url_publica as foto_portada_url,
  p.alt         as foto_portada_alt,
  v.fuente
from public.vehicles v
left join public.vehicle_photos p
  on p.vehicle_id = v.id
 and p.es_principal
where v.publicado;

comment on view public.vehiculos_publicos is
  'Stock publicado para el sitio público, con portada resuelta y fuente (propio vs. consignación). security_invoker: respeta el RLS de quien consulta.';

grant select on public.vehiculos_publicos to anon, authenticated;
