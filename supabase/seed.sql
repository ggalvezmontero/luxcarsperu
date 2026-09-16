-- =============================================================================
--  SEED OPCIONAL — datos de DEMOSTRACIÓN para desarrollo local
-- =============================================================================
--
--  Este archivo NO es necesario para que el sistema funcione. Sirve para tener
--  algo en pantalla mientras se construye el admin.
--
--  Lo corre automáticamente `supabase db reset` en local. NO lo apliques en
--  producción.
--
--  ---------------------------------------------------------------------------
--  TRES REGLAS QUE ESTE SEED RESPETA A PROPÓSITO
--  ---------------------------------------------------------------------------
--
--  1. NADA PUBLICADO. Todos los vehículos entran con `publicado = false`.
--     El catálogo anterior del proyecto tenía 9 vehículos con precios inflados
--     hasta 48% sobre el MSRP real (el Bronco Raptor figuraba entre USD 85,000
--     y 118,000 contra 79,995 reales) y 9 fotos de Unsplash que NO eran el auto
--     anunciado: el "Cybertruck" no era un Cybertruck y el "Bronco Raptor" era
--     un 4x4 genérico. Un seed que publique inventario inventado repite
--     exactamente ese error. Para probar la vista pública, reemplaza estas
--     filas por una unidad REAL y recién ahí pon `publicado = true`.
--
--  2. SIN FOTOS FALSAS. No se siembra ninguna fila en `vehicle_photos`. Es
--     preferible una ficha sin foto a una ficha con la foto de otro auto.
--
--  3. SIN COTIZACIONES FALSAS. No se siembra `quotes`. Una cotización creíble
--     exige la cascada tributaria real (CIF → ad valorem → ISC → IGV/IPM →
--     percepción). Escribir esos números a mano produciría un desglose que
--     parece verificado y no lo está. Genera cotizaciones de prueba con la
--     calculadora real: son las únicas que sirven para probar algo.
--
--  Las tasas tributarias NO están acá: son datos normativos reales y se cargan
--  en la migración 0005, no en el seed.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
--  Caché de decodificado de VIN (demo)
-- -----------------------------------------------------------------------------
--  `vin_pattern` empieza con "DEM" para que se note a simple vista que es un
--  patrón inventado y no un VIN real de una unidad existente.
-- -----------------------------------------------------------------------------
insert into public.vehicle_models (
  vin_pattern, marca, modelo, anio, version, tipo_vehiculo, carroceria,
  puertas, traccion, cilindrada_cc, cilindrada_l, cilindros,
  combustible_primario, nivel_electrificacion,
  pais_ensamblaje, ciudad_ensamblaje, empresa_ensamblaje,
  respuesta_cruda, codigo_error, texto_error, notas
)
select
  'DEM00000001', 'TOYOTA', 'Supra', 2026, 'MkV Final Edition',
  'PASSENGER CAR', 'Coupe', 2, 'RWD',
  2998, 3.0, 6,
  'Gasoline', null,
  'AUSTRIA', 'Graz', 'Magna Steyr',
  '{"_demo": true}'::jsonb, '0', null,
  'DEMO. El GR Supra MkV Final Edition 2026 se ensambla en Austria (Magna Steyr): NO es originario de EE.UU., así que paga 6% de ad valorem aunque se compre en Miami.'
where not exists (
  select 1 from public.vehicle_models where vin_pattern = 'DEM00000001'
);

-- -----------------------------------------------------------------------------
--  Stock (demo, SIN PUBLICAR)
-- -----------------------------------------------------------------------------
insert into public.vehicles (
  fuente, marca, modelo, version, anio, carroceria, categoria, cilindrada_cc,
  transmision, traccion, color_exterior, puertas, asientos,
  kilometraje_km, condicion, estado, ubicacion, publicado, notas_internas
)
select
  'carga_manual', 'Toyota', 'GR Supra', 'MkV Final Edition', 2026, 'Coupe',
  'gasolina', 2998,
  'Automática 8AT', 'RWD', 'Blanco', 2, 2,
  0, 'nuevo', 'disponible', 'Showroom San Isidro', false,
  'FILA DEMO — BORRAR. MSRP oficial de referencia USD 69,085; edición limitada a 1,300 unidades; ensamblada en Austria por Magna Steyr, así que NO califica al 0% del APC. Sin precio de venta a propósito: no hay unidad real detrás.'
where not exists (
  select 1 from public.vehicles
  where marca = 'Toyota' and modelo = 'GR Supra' and notas_internas like 'FILA DEMO%'
);

insert into public.vehicles (
  fuente, marca, modelo, anio, carroceria, categoria, cilindrada_cc,
  transmision, traccion, color_exterior, puertas, asientos,
  kilometraje_km, condicion, estado, ubicacion, publicado, notas_internas
)
select
  'importacion_directa', 'Ford', 'Bronco Raptor', 2026, 'SUV',
  'gasolina', 2996,
  'Automática 10AT', '4WD', 'Gris', 4, 5,
  0, 'nuevo', 'en_transito', 'En tránsito Miami–Callao', false,
  'FILA DEMO — BORRAR. MSRP oficial de referencia USD 79,995. El catálogo anterior lo listaba entre USD 85,000 y 118,000: hasta 48% por encima del precio real de fábrica. No repetir esa cifra en ningún material.'
where not exists (
  select 1 from public.vehicles
  where marca = 'Ford' and modelo = 'Bronco Raptor' and notas_internas like 'FILA DEMO%'
);

-- -----------------------------------------------------------------------------
--  Lead (demo)
-- -----------------------------------------------------------------------------
insert into public.leads (
  origen, estado, nombre, telefono, email,
  interes_marca, interes_modelo, interes_anio, presupuesto_usd,
  mensaje, pagina_origen, notas_internas
)
select
  'calculadora', 'nuevo', 'Cliente de Prueba', '+51 999 999 999',
  'demo@example.com', 'Toyota', 'Tacoma TRD', 2026, 55000,
  'Quiero saber cuánto me costaría traer una Tacoma TRD del 2026 puesta en Lima.',
  '/importar',
  'FILA DEMO — BORRAR.'
where not exists (
  select 1 from public.leads where email = 'demo@example.com'
);

-- -----------------------------------------------------------------------------
--  Consignación (demo)
-- -----------------------------------------------------------------------------
--  Muestra el caso que define la línea: sin exclusividad, con precio mínimo
--  reservado y con la posibilidad de que el dueño lo venda por su cuenta.
-- -----------------------------------------------------------------------------
insert into public.consignments (
  propietario_nombre, propietario_tipo_documento, propietario_documento,
  propietario_telefono, propietario_email,
  marca, modelo, anio, version, kilometraje_km, color,
  precio_pedido, precio_minimo, moneda, tasacion_luxcars,
  tipo_comision, comision_porcentaje,
  fecha_inicio, estado, notas_internas
)
select
  'Propietario de Prueba', 'DNI', '00000000',
  '+51 988 888 888', 'consignacion.demo@example.com',
  'Toyota', 'Tundra TRD', 2024, 'TRD Pro', 18500, 'Negro',
  62000, 57000, 'USD', 59500,
  'porcentaje', 0.0400,
  current_date, 'activa',
  'FILA DEMO — BORRAR. Sin exclusividad: el dueño sigue usando el auto y puede venderlo por su cuenta sin penalidad.'
where not exists (
  select 1 from public.consignments where propietario_email = 'consignacion.demo@example.com'
);

commit;

-- -----------------------------------------------------------------------------
--  Verificación rápida
-- -----------------------------------------------------------------------------
--  Debe devolver 0 en `publicados`. Si devuelve otra cosa, alguien publicó una
--  fila de demostración y el sitio está mostrando inventario que no existe.
-- -----------------------------------------------------------------------------
select
  (select count(*) from public.vehicles)                      as vehiculos,
  (select count(*) from public.vehicles where publicado)      as publicados,
  (select count(*) from public.vehicle_photos)                as fotos,
  (select count(*) from public.leads)                         as leads,
  (select count(*) from public.consignments)                  as consignaciones,
  (select count(*) from public.quotes)                        as cotizaciones,
  (select count(*) from public.tax_rates)                     as tasas;
