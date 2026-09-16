-- =============================================================================
--  Migración 0005 · tax_rates — tasas tributarias con vigencia
-- =============================================================================
--
--  PARA QUÉ EXISTE ESTA TABLA
--  ---------------------------------------------------------------------------
--  Hoy las tasas viven en `src/core/pricing/pricingConfig.ts`. Eso está bien
--  para calcular HOY, pero no permite responder la pregunta que sí llega:
--
--      "Ustedes me cotizaron esto en marzo. ¿Por qué ahora sale distinto?"
--
--  Las tasas cambian por norma (el caso más reciente: desde el ejercicio 2026
--  el 18% se descompone en IGV 15.5% + IPM 2.5% por la Ley 32387, cuando antes
--  era 16% + 2%). Esta tabla guarda cada tasa CON SU VIGENCIA Y SU NORMA, de
--  modo que una cotización vieja se puede reproducir y defender con el
--  articulado en la mano.
--
--  QUIÉN MANDA MIENTRAS TANTO
--  ---------------------------------------------------------------------------
--  El motor de precios de `src/core/pricing/` SIGUE SIENDO LA FUENTE DE VERDAD
--  del cálculo. Esta tabla es el registro normativo que lo respalda y el
--  insumo para migrarlo cuando se decida. Si algún día el motor lee de acá,
--  que lea: las filas de abajo reproducen EXACTAMENTE los valores del motor.
--  Mientras existan los dos, cualquier discrepancia entre esta tabla y
--  `pricingConfig.ts` es un bug que hay que resolver a favor de la NORMA.
--
--  CÓMO SE MODELA EL ALCANCE
--  ---------------------------------------------------------------------------
--  Una tasa aplica a una combinación de condición, categoría, origen, perfil
--  del importador y rango de cilindrada. NULL significa "cualquiera".
--  Así, el ISC escalonado de gasolina nueva son tres filas que se distinguen
--  solo por `cc_min` / `cc_max`.
--
--  El índice de exclusión impide que dos filas del MISMO alcance tengan
--  vigencias solapadas. Sin él, "¿qué IGV aplicaba el 3 de marzo?" podría
--  tener dos respuestas, y una cotización histórica dejaría de ser
--  reproducible: exactamente lo que esta tabla viene a evitar.
-- =============================================================================

-- -----------------------------------------------------------------------------
--  Serialización del alcance de una tasa
-- -----------------------------------------------------------------------------
--  Existe por una razón técnica concreta: el índice de exclusión de más abajo
--  necesita comparar el alcance completo con `=`, y el alcance tiene columnas
--  que pueden ser NULL ("cualquiera"). En un índice, NULL nunca colisiona con
--  NULL, así que dos filas con el mismo alcance "cualquiera" se colarían sin
--  que la restricción se entere. Serializar a texto con '*' resuelve eso.
--
--  Va en una función porque el cast de enum a text NO es IMMUTABLE para
--  PostgreSQL (pasa por las funciones de E/S del tipo) y una expresión de
--  índice exige inmutabilidad. La función se declara IMMUTABLE a propósito:
--  para estos valores lo es.
--
--  CONSECUENCIA A TENER PRESENTE: si alguna vez se renombra una etiqueta de
--  los enums con ALTER TYPE ... RENAME VALUE, hay que REINDEXAR esta tabla,
--  porque el texto serializado quedaría desactualizado en el índice.
-- -----------------------------------------------------------------------------
create or replace function public.alcance_tasa(
  tributo public.tributo,
  condicion public.condicion_vehiculo,
  categoria public.categoria_vehiculo,
  origen public.origen_vehiculo,
  perfil_importador public.perfil_importador,
  cc_min integer,
  cc_max integer
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select tributo::text
    || '|' || coalesce(condicion::text, '*')
    || '|' || coalesce(categoria::text, '*')
    || '|' || coalesce(origen::text, '*')
    || '|' || coalesce(perfil_importador::text, '*')
    || '|' || coalesce(cc_min::text, '*')
    || '|' || coalesce(cc_max::text, '*');
$$;

comment on function public.alcance_tasa(
  public.tributo, public.condicion_vehiculo, public.categoria_vehiculo,
  public.origen_vehiculo, public.perfil_importador, integer, integer
) is
  'Serializa el alcance de una tasa ("*" = cualquiera) para poder compararlo en el índice de exclusión. Renombrar una etiqueta de enum obliga a REINDEX.';


create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),

  tributo public.tributo not null,

  -- Tasa en tanto por uno: 0.155 = 15.5%. NULL solo cuando `prohibido`.
  tasa numeric(8, 6)
    check (tasa is null or (tasa >= 0 and tasa <= 1)),

  -- No toda combinación tiene tasa: el usado a diésel no paga X%, está
  -- PROHIBIDO de importar. Modelarlo como 0% sería mentir; como 40%, también.
  -- Es el mismo `null` que devuelve resolveIscRate() en el motor.
  prohibido boolean not null default false,

  -- --- Alcance (NULL = cualquiera) ------------------------------------------
  condicion public.condicion_vehiculo,
  categoria public.categoria_vehiculo,
  origen public.origen_vehiculo,
  perfil_importador public.perfil_importador,
  cc_min integer check (cc_min is null or cc_min >= 0),
  cc_max integer check (cc_max is null or cc_max >= 0),

  -- --- Vigencia -------------------------------------------------------------
  vigente_desde date not null,
  vigente_hasta date,   -- NULL = vigente hoy

  -- --- Sustento normativo (obligatorio: sin norma, la tasa es un rumor) ------
  base_legal text not null,
  referencia_norma text,
  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tax_rates_tasa_o_prohibido
    check (
      (prohibido and tasa is null) or
      (not prohibido and tasa is not null)
    ),

  constraint tax_rates_vigencia_coherente
    check (vigente_hasta is null or vigente_hasta > vigente_desde),

  constraint tax_rates_cc_coherente
    check (cc_min is null or cc_max is null or cc_max >= cc_min),

  -- Dos tasas del mismo alcance no pueden solaparse en el tiempo.
  constraint tax_rates_sin_solapamiento exclude using gist (
    public.alcance_tasa(
      tributo, condicion, categoria, origen, perfil_importador, cc_min, cc_max
    ) with =,
    daterange(vigente_desde, vigente_hasta, '[)') with &&
  )
);

comment on table public.tax_rates is
  'Tasas tributarias de importación con vigencia y sustento normativo. Permite reproducir una cotización histórica. El cálculo vigente lo hace src/core/pricing/.';
comment on column public.tax_rates.tasa is
  'Tanto por uno: 0.155 = 15.5%. NULL únicamente cuando prohibido = true.';
comment on column public.tax_rates.prohibido is
  'TRUE cuando la combinación no se puede importar (hoy: usado a diésel). Equivale al null de resolveIscRate().';
comment on column public.tax_rates.base_legal is
  'Norma que sustenta la tasa. Obligatorio: sin norma no se puede defender una cotización.';
comment on constraint tax_rates_sin_solapamiento on public.tax_rates is
  'Garantiza una sola tasa por alcance y fecha: si no, una cotización histórica tendría dos respuestas posibles.';

create index if not exists tax_rates_tributo_vigencia_idx
  on public.tax_rates (tributo, vigente_desde desc);

create index if not exists tax_rates_vigentes_idx
  on public.tax_rates (tributo)
  where vigente_hasta is null;

drop trigger if exists tax_rates_set_updated_at on public.tax_rates;
create trigger tax_rates_set_updated_at
  before update on public.tax_rates
  for each row execute function public.tg_marcar_actualizado();


-- -----------------------------------------------------------------------------
--  Consulta de tasas a una fecha dada
-- -----------------------------------------------------------------------------
--  Acceso a datos puro: devuelve las filas vigentes en `fecha`. NO resuelve
--  cuál aplica a un vehículo concreto, porque esa desambiguación (el escalonado
--  por cilindrada, el doble candado de origen, la exclusión de usados del APC)
--  ya está implementada y verificada en el motor de precios. Reimplementarla
--  en SQL crearía una segunda fuente de verdad que terminaría discrepando.
-- -----------------------------------------------------------------------------
create or replace function public.tasas_vigentes(fecha date default current_date)
returns setof public.tax_rates
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from public.tax_rates t
  where t.vigente_desde <= fecha
    and (t.vigente_hasta is null or t.vigente_hasta > fecha)
  order by t.tributo, t.condicion nulls first, t.categoria nulls first;
$$;

comment on function public.tasas_vigentes(date) is
  'Tasas vigentes en la fecha indicada. Solo lectura: la desambiguación por vehículo vive en src/core/pricing/.';


-- -----------------------------------------------------------------------------
--  RLS — tabla de consulta interna
-- -----------------------------------------------------------------------------
alter table public.tax_rates enable row level security;

revoke all on public.tax_rates from anon, authenticated;
grant select, insert, update, delete on public.tax_rates to authenticated;

drop policy if exists "tax_rates: el equipo lee" on public.tax_rates;
create policy "tax_rates: el equipo lee"
  on public.tax_rates for select
  to authenticated
  using (true);

drop policy if exists "tax_rates: el equipo inserta" on public.tax_rates;
create policy "tax_rates: el equipo inserta"
  on public.tax_rates for insert
  to authenticated
  with check (true);

drop policy if exists "tax_rates: el equipo actualiza" on public.tax_rates;
create policy "tax_rates: el equipo actualiza"
  on public.tax_rates for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "tax_rates: el equipo borra" on public.tax_rates;
create policy "tax_rates: el equipo borra"
  on public.tax_rates for delete
  to authenticated
  using (true);


-- =============================================================================
--  CARGA NORMATIVA INICIAL
-- =============================================================================
--  Esto NO es seed de demostración: son las tasas reales que usa el negocio y
--  reproducen exactamente los valores verificados de pricingConfig.ts y
--  vehicleCategories.ts. Por eso van en la migración y no en seed.sql.
-- =============================================================================

-- --- AD VALOREM --------------------------------------------------------------
insert into public.tax_rates
  (tributo, tasa, condicion, origen, vigente_desde, base_legal, referencia_norma, notas)
values
  ('ad_valorem', 0.000000, 'nuevo', 'originario-usa', date '2009-02-01',
   'Acuerdo de Promoción Comercial Perú–Estados Unidos (APC), regla de origen del capítulo 87.',
   'APC Perú–EE.UU. · TPI 802',
   'Exige certificado de origen del exportador y VCR ≥ 35% por costo neto. Comprar el auto en Miami NO otorga origen. La fecha marca la entrada en vigor del APC; para cotizaciones retroactivas anteriores a 2016 verificar el cronograma de desgravación del capítulo 87 antes de usar esta fila.'),

  ('ad_valorem', 0.060000, 'nuevo', 'otro', date '2017-01-01',
   'Arancel de Aduanas: derecho ad valorem de 6% para la partida 87.03 sin preferencia aplicable.',
   'D.S. 342-2016-EF',
   'Aplica a todo vehículo nuevo no originario de EE.UU.: un Toyota japonés, un Kia coreano o un auto ensamblado en México comprados en Florida pagan 6%.')
on conflict do nothing;

insert into public.tax_rates
  (tributo, tasa, condicion, vigente_desde, base_legal, referencia_norma, notas)
values
  ('ad_valorem', 0.060000, 'usado', date '2009-02-01',
   'La preferencia arancelaria del APC EXCLUYE a los vehículos usados de la partida 87.03.',
   'APC Perú–EE.UU. · Arancel de Aduanas',
   'Un usado paga 6% AUNQUE sea originario de EE.UU. y tenga certificado de origen. Por eso el origen no se evalúa en esta fila.')
on conflict do nothing;

-- --- ISC · VEHÍCULO NUEVO ----------------------------------------------------
-- Gasolina nueva: escalonado por cilindrada.
insert into public.tax_rates
  (tributo, tasa, condicion, categoria, cc_min, cc_max, vigente_desde, base_legal, referencia_norma, notas)
values
  ('isc', 0.050000, 'nuevo', 'gasolina', 0, 1400, date '2019-06-16',
   'Nuevo Apéndice IV del TUO de la Ley del IGV e ISC: tramo hasta 1,400 cc.',
   'D.S. 055-99-EF · texto vigente según D.S. 181-2019-EF', null),

  ('isc', 0.075000, 'nuevo', 'gasolina', 1401, 1500, date '2019-06-16',
   'Nuevo Apéndice IV del TUO de la Ley del IGV e ISC: tramo de 1,401 a 1,500 cc.',
   'D.S. 055-99-EF · texto vigente según D.S. 181-2019-EF', null),

  ('isc', 0.100000, 'nuevo', 'gasolina', 1501, null, date '2019-06-16',
   'Nuevo Apéndice IV del TUO de la Ley del IGV e ISC: tramo superior a 1,500 cc.',
   'D.S. 055-99-EF · texto vigente según D.S. 181-2019-EF',
   'Tramo por defecto del catálogo de LuxCars: la enorme mayoría supera los 1,500 cc.')
on conflict do nothing;

-- Electrificados nuevos: no gravados. Diésel nuevo: 20%.
insert into public.tax_rates
  (tributo, tasa, condicion, categoria, vigente_desde, base_legal, referencia_norma, notas)
values
  ('isc', 0.000000, 'nuevo', 'hev', date '2019-06-16',
   'No gravado: las subpartidas 8703.40 / 8703.50 no figuran en el Apéndice IV.',
   'D.S. 055-99-EF · Nuevo Apéndice IV',
   'OJO: un mild-hybrid de 48V NO califica como HEV; tributa como gasolina.'),

  ('isc', 0.000000, 'nuevo', 'ev', date '2019-06-16',
   'No gravado: las subpartidas de vehículos eléctricos no figuran en el Apéndice IV.',
   'D.S. 055-99-EF · Nuevo Apéndice IV', null),

  ('isc', 0.000000, 'nuevo', 'phev', date '2019-06-16',
   'No gravado: las subpartidas de híbridos enchufables no figuran en el Apéndice IV.',
   'D.S. 055-99-EF · Nuevo Apéndice IV', null),

  ('isc', 0.200000, 'nuevo', 'diesel', date '2019-06-16',
   'Apéndice IV: 20% para vehículos nuevos con motor de encendido por compresión.',
   'D.S. 055-99-EF · texto vigente según D.S. 181-2019-EF', null)
on conflict do nothing;

-- --- ISC · VEHÍCULO USADO ----------------------------------------------------
-- TODO usado de la partida 87.03 paga 40%, sin importar la propulsión.
-- El 10% que circula por internet viene de bloques rotulados "TEXTO ANTERIOR"
-- en el PDF oficial: redacción DEROGADA en 2019.
insert into public.tax_rates
  (tributo, tasa, condicion, categoria, vigente_desde, base_legal, referencia_norma, notas)
values
  ('isc', 0.400000, 'usado', 'gasolina', date '2019-06-16',
   'Literal A del Nuevo Apéndice IV: "8703.40.10.00 / 8703.80.90.90 — Sólo: vehículos automóviles USADOS".',
   'D.S. 055-99-EF · D.S. 181-2019-EF (vigente 16.6.2019)',
   'El 10% que circula para usados corresponde a redacción derogada en 2019.'),

  ('isc', 0.400000, 'usado', 'hev', date '2019-06-16',
   'Literal A del Nuevo Apéndice IV: todo usado de la partida 87.03 paga 40%.',
   'D.S. 055-99-EF · D.S. 181-2019-EF',
   'El beneficio de 0% aplica solo al híbrido NUEVO. Usado no tiene beneficio.'),

  ('isc', 0.400000, 'usado', 'ev', date '2019-06-16',
   'Literal A del Nuevo Apéndice IV: todo usado de la partida 87.03 paga 40%.',
   'D.S. 055-99-EF · D.S. 181-2019-EF',
   'El beneficio de 0% aplica solo al eléctrico NUEVO.'),

  ('isc', 0.400000, 'usado', 'phev', date '2019-06-16',
   'Literal A del Nuevo Apéndice IV: todo usado de la partida 87.03 paga 40%.',
   'D.S. 055-99-EF · D.S. 181-2019-EF',
   'El beneficio de 0% aplica solo al enchufable NUEVO.')
on conflict do nothing;

-- Diésel usado: no es una tasa, es una PROHIBICIÓN de importación.
insert into public.tax_rates
  (tributo, tasa, prohibido, condicion, categoria, vigente_desde, base_legal, referencia_norma, notas)
values
  ('isc', null, true, 'usado', 'diesel', date '2020-03-01',
   'Prohibición de importar vehículos usados con motor diésel en automóviles, SUV y camionetas.',
   'D. Leg. 843 · texto del D.S. 005-2020-MTC',
   'No se puede cotizar: el vehículo no puede ingresar al país. Equivale al null que devuelve resolveIscRate().')
on conflict do nothing;

-- --- IGV / IPM ---------------------------------------------------------------
-- El total sigue siendo 18%; lo que cambió en 2026 es la COMPOSICIÓN.
-- Estas cuatro filas son la demostración de por qué existe esta tabla.
insert into public.tax_rates
  (tributo, tasa, vigente_desde, vigente_hasta, base_legal, referencia_norma, notas)
values
  ('igv', 0.160000, date '2011-03-01', date '2026-01-01',
   'Tasa del IGV de 16% vigente hasta el ejercicio 2025.',
   'TUO de la Ley del IGV e ISC (D.S. 055-99-EF) · Ley 29666',
   'Compone el 18% junto con el IPM de 2%.'),

  ('ipm', 0.020000, date '2011-03-01', date '2026-01-01',
   'Impuesto de Promoción Municipal de 2% vigente hasta el ejercicio 2025.',
   'D. Leg. 776 · Ley de Tributación Municipal',
   'Compone el 18% junto con el IGV de 16%.')
on conflict do nothing;

insert into public.tax_rates
  (tributo, tasa, vigente_desde, base_legal, referencia_norma, notas)
values
  ('igv', 0.155000, date '2026-01-01',
   'Desde el ejercicio 2026 la composición legal del 18% es IGV 15.5% + IPM 2.5%.',
   'Ley 32387',
   'El total no cambia; el desglose sí. La proforma Heysen 202602537 ya usa estas tasas.'),

  ('ipm', 0.025000, date '2026-01-01',
   'Desde el ejercicio 2026 el IPM es 2.5%.',
   'Ley 32387',
   'El total no cambia; el desglose sí.')
on conflict do nothing;

-- --- PERCEPCIÓN DEL IGV ------------------------------------------------------
-- NO es un costo: es un adelanto recuperable como crédito fiscal. Pero sí es
-- caja que el cliente tiene que poner, por eso se cotiza aparte (cashRequired).
insert into public.tax_rates
  (tributo, tasa, condicion, perfil_importador, vigente_desde, base_legal, referencia_norma, notas)
values
  ('percepcion', 0.100000, null, 'primera-importacion', date '2003-11-01',
   'Percepción de 10% para quien importa por primera vez, no tiene RUC o no está afecto al IGV.',
   'Ley 28053 · R.S. 203-2003/SUNAT',
   'Aplica cualquiera sea la condición del vehículo: por eso `condicion` va en NULL.'),

  ('percepcion', 0.050000, 'usado', 'recurrente', date '2003-11-01',
   'Percepción de 5% cuando la mercancía importada es usada.',
   'Ley 28053 · R.S. 203-2003/SUNAT', null),

  ('percepcion', 0.035000, 'nuevo', 'recurrente', date '2003-11-01',
   'Percepción de 3.5% para el importador recurrente con mercancía nueva.',
   'Ley 28053 · R.S. 203-2003/SUNAT',
   'Verificada contra la proforma Heysen 202602537: S/ 5,813.89 sobre base S/ 166,111.14.')
on conflict do nothing;
