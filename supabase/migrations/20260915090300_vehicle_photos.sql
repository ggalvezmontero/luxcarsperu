-- =============================================================================
--  Migración 0004 · vehicle_photos + bucket de Storage
-- =============================================================================
--
--  El dueño tiene autos en stock pero sin buenas fotos. El cuello de botella
--  real es subirlas rápido desde el celular, parado al lado del auto. Por eso:
--
--    · `orden` decide la galería, y se puede reordenar arrastrando sin pelear
--      con restricciones de unicidad (el índice es simple, no único).
--    · `es_principal` tiene índice ÚNICO PARCIAL: exactamente una portada por
--      vehículo, garantizado por la base. Nada de dos portadas por un doble
--      clic.
--    · `alt` es obligatorio en las publicadas: sin alt no hay accesibilidad ni
--      SEO, y una ficha de auto vive de Google.
--
--  MISMA RESTRICCIÓN LEGAL QUE `vehicles`: acá solo entran fotos PROPIAS
--  (tomadas por el equipo) o del fabricante con derecho de uso. Jamás fotos
--  traídas de MarketCheck, Autotrader, CarGurus, Cars.com, eBay, TrueCar,
--  AutoTempest ni Facebook Marketplace: persistir su contenido está prohibido
--  por contrato, y además una foto ajena de un auto que no es el tuyo es
--  publicidad engañosa.
-- =============================================================================

create table if not exists public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),

  vehicle_id uuid not null
    references public.vehicles (id) on delete cascade,

  -- Ruta dentro del bucket 'vehiculos' de Supabase Storage.
  -- Convención: {vehicle_id}/{uuid}.{ext}
  storage_path text not null unique,

  -- URL pública resuelta. Se materializa para no reconstruirla en cada render.
  url_publica text,

  alt text not null default '',
  orden integer not null default 0
    check (orden >= 0),
  es_principal boolean not null default false,

  ancho_px integer check (ancho_px is null or ancho_px > 0),
  alto_px integer check (alto_px is null or alto_px > 0),
  bytes bigint check (bytes is null or bytes >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  subida_por uuid references auth.users (id) on delete set null
);

comment on table public.vehicle_photos is
  'Fotos del stock propio. Solo fotos propias o del fabricante con derecho de uso: nunca imágenes traídas de marketplaces de terceros.';
comment on column public.vehicle_photos.es_principal is
  'Portada de la ficha. Un índice único parcial garantiza una sola por vehículo.';
comment on column public.vehicle_photos.alt is
  'Texto alternativo. Obligatorio para fotos de vehículos publicados (ver trigger).';

-- Exactamente una portada por vehículo.
create unique index if not exists vehicle_photos_una_principal_idx
  on public.vehicle_photos (vehicle_id)
  where es_principal;

-- La galería siempre se pide así: por vehículo, ordenada.
create index if not exists vehicle_photos_vehicle_orden_idx
  on public.vehicle_photos (vehicle_id, orden);

drop trigger if exists vehicle_photos_set_updated_at on public.vehicle_photos;
create trigger vehicle_photos_set_updated_at
  before update on public.vehicle_photos
  for each row execute function public.tg_marcar_actualizado();


-- Dos comodidades para quien sube fotos desde el celular, parado al lado del
-- auto, que es como se van a cargar de verdad:
--
--   1. La primera foto del vehículo se vuelve portada sola. Ninguna ficha
--      queda sin imagen principal por olvido.
--   2. Si no se indica `orden`, la foto se va al final de la galería. Sin
--      esto, subir cinco fotos seguidas las dejaría todas en orden 0 y la
--      galería saldría en un orden arbitrario distinto en cada consulta.
create or replace function public.tg_acomodar_foto()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  hay_fotos boolean;
begin
  select exists (
    select 1 from public.vehicle_photos where vehicle_id = new.vehicle_id
  ) into hay_fotos;

  if not hay_fotos then
    new.es_principal := true;
  elsif new.orden = 0 then
    select coalesce(max(orden), 0) + 1
    into new.orden
    from public.vehicle_photos
    where vehicle_id = new.vehicle_id;
  end if;

  return new;
end;
$$;

comment on function public.tg_acomodar_foto() is
  'La primera foto es portada; las siguientes se encolan al final si no se indica orden.';

drop trigger if exists vehicle_photos_primera_es_principal on public.vehicle_photos;
drop trigger if exists vehicle_photos_acomodar on public.vehicle_photos;
create trigger vehicle_photos_acomodar
  before insert on public.vehicle_photos
  for each row execute function public.tg_acomodar_foto();


-- -----------------------------------------------------------------------------
--  RLS
-- -----------------------------------------------------------------------------
--  Lectura pública SOLO de fotos cuyo vehículo está publicado. El EXISTS se
--  evalúa bajo el RLS de `vehicles` para el mismo rol, así que anon no puede
--  usarlo para deducir la existencia de stock no publicado.
-- -----------------------------------------------------------------------------
alter table public.vehicle_photos enable row level security;

revoke all on public.vehicle_photos from anon, authenticated;

grant select (
  id, vehicle_id, storage_path, url_publica, alt, orden, es_principal,
  ancho_px, alto_px, created_at
) on public.vehicle_photos to anon;

grant select, insert, update, delete on public.vehicle_photos to authenticated;

drop policy if exists "vehicle_photos: lectura pública si el auto está publicado"
  on public.vehicle_photos;
create policy "vehicle_photos: lectura pública si el auto está publicado"
  on public.vehicle_photos for select
  to anon
  using (
    exists (
      select 1
      from public.vehicles v
      where v.id = vehicle_photos.vehicle_id
        and v.publicado
    )
  );

drop policy if exists "vehicle_photos: el equipo lee" on public.vehicle_photos;
create policy "vehicle_photos: el equipo lee"
  on public.vehicle_photos for select
  to authenticated
  using (true);

drop policy if exists "vehicle_photos: el equipo inserta" on public.vehicle_photos;
create policy "vehicle_photos: el equipo inserta"
  on public.vehicle_photos for insert
  to authenticated
  with check (true);

drop policy if exists "vehicle_photos: el equipo actualiza" on public.vehicle_photos;
create policy "vehicle_photos: el equipo actualiza"
  on public.vehicle_photos for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "vehicle_photos: el equipo borra" on public.vehicle_photos;
create policy "vehicle_photos: el equipo borra"
  on public.vehicle_photos for delete
  to authenticated
  using (true);


-- -----------------------------------------------------------------------------
--  VISTA PÚBLICA DE STOCK
-- -----------------------------------------------------------------------------
--  `select *` sobre `vehicles` falla para anon a propósito (los GRANT son por
--  columna). Esta vista es el camino cómodo para el front público: expone solo
--  lo publicable y ya trae la portada resuelta.
--
--  `security_invoker = true` es deliberado: la vista NO elude el RLS, lo aplica
--  con los permisos de quien consulta. Una vista SECURITY DEFINER acá sería un
--  agujero: expondría stock sin publicar a cualquiera.
-- -----------------------------------------------------------------------------
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
  p.alt         as foto_portada_alt
from public.vehicles v
left join public.vehicle_photos p
  on p.vehicle_id = v.id
 and p.es_principal
where v.publicado;

comment on view public.vehiculos_publicos is
  'Stock publicado para el sitio público, con portada resuelta. security_invoker: respeta el RLS de quien consulta.';

grant select on public.vehiculos_publicos to anon, authenticated;


-- -----------------------------------------------------------------------------
--  BUCKET DE STORAGE
-- -----------------------------------------------------------------------------
--  Público en lectura (las fotos del stock se muestran en el sitio) y escritura
--  solo para el equipo autenticado. Tope de 15 MB: una foto de celular moderno
--  entra de sobra y evita que una subida accidental de un video tumbe la cuota.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehiculos',
  'vehiculos',
  true,
  15728640,  -- 15 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vehiculos: lectura pública" on storage.objects;
create policy "vehiculos: lectura pública"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'vehiculos');

drop policy if exists "vehiculos: el equipo sube" on storage.objects;
create policy "vehiculos: el equipo sube"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vehiculos');

drop policy if exists "vehiculos: el equipo actualiza" on storage.objects;
create policy "vehiculos: el equipo actualiza"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'vehiculos')
  with check (bucket_id = 'vehiculos');

drop policy if exists "vehiculos: el equipo borra" on storage.objects;
create policy "vehiculos: el equipo borra"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'vehiculos');
