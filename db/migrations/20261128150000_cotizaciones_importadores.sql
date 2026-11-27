-- =============================================================================
--  Cotizaciones: importadores pendientes hasta aceptar (28 nov 2026)
-- =============================================================================
--  El contacto (quien pide la cotización) y los importadores son cosas
--  distintas. La razón social y el RUC (o nombre y DNI) de cada importador
--  pueden faltar mientras la cotización es borrador o está enviada; al
--  aceptarla son obligatorios, porque cada importador se vuelve expediente.
--
--  `completar_importadores_cotizacion` fija el importador de cada auto en
--  `datos.autos[i].importador` sin tocar ninguna cifra, también en una
--  cotización enviada (así no hay que volverla a borrador ni reenviarla).
--  Idempotente.
-- =============================================================================

create or replace function public.completar_importadores_cotizacion(p_id uuid, p_importadores jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.cotizaciones%rowtype;
  v_n integer;
  v_i integer;
  imp jsonb;
  v_datos jsonb;
  v_doc text;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador completa los importadores.';
  end if;
  select * into q from public.cotizaciones where id = p_id for update;
  if not found then
    raise exception 'La cotización no existe.';
  end if;
  if q.estado not in ('borrador', 'enviada', 'vencida') then
    raise exception 'Los importadores se completan antes de aceptar la cotización.';
  end if;
  v_n := jsonb_array_length(q.datos->'autos');
  if p_importadores is null or jsonb_typeof(p_importadores) <> 'array' or jsonb_array_length(p_importadores) <> v_n then
    raise exception 'Indica el importador de cada auto (% autos).', v_n;
  end if;

  v_datos := q.datos;
  for v_i in 0 .. v_n - 1 loop
    imp := p_importadores->v_i;
    if imp is null or jsonb_typeof(imp) <> 'object' then
      continue;
    end if;
    if coalesce(imp->>'tipo', '') not in ('persona', 'empresa') then
      raise exception 'Auto %: indica si el importador es persona natural o empresa.', v_i + 1;
    end if;
    v_doc := nullif(regexp_replace(coalesce(imp->>'documento', ''), '\s', '', 'g'), '');
    if imp->>'tipo' = 'empresa' and v_doc is not null and v_doc !~ '^[0-9]{11}$' then
      raise exception 'Auto %: el RUC del importador tiene 11 dígitos.', v_i + 1;
    end if;
    v_datos := jsonb_set(v_datos, array['autos', v_i::text, 'importador'], jsonb_build_object(
      'tipo', imp->>'tipo',
      'nombre', left(trim(coalesce(imp->>'nombre', '')), 200),
      'documento', coalesce(v_doc, ''),
      'email', left(lower(trim(coalesce(imp->>'email', ''))), 200),
      'telefono', left(trim(coalesce(imp->>'telefono', '')), 40)
    ));
  end loop;

  update public.cotizaciones set datos = v_datos where id = p_id;
end;
$$;

comment on function public.completar_importadores_cotizacion(uuid, jsonb) is
  'Solo admin. Fija el importador de cada auto (tipo, razón social o nombre, RUC o DNI, correo, teléfono) sin tocar cifras; vale en borrador, enviada o vencida.';

revoke all on function public.completar_importadores_cotizacion(uuid, jsonb) from public;
grant execute on function public.completar_importadores_cotizacion(uuid, jsonb) to authenticated;
