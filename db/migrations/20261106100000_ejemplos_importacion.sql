-- =============================================================================
--  Migración 0012 · ejemplos de importación a pedido, editables desde el portal
-- =============================================================================
--
--  Los autos de referencia de la home ("¿Cuánto cuesta traer el que quieres?")
--  y de /importar ("Ejemplos con precio real de referencia") vivían en
--  `src/data/trendingVehicles.json`: cambiar un precio o sumar un modelo exigía
--  tocar el repositorio y desplegar. Desde esta migración el dueño los edita en
--  /portal/ejemplos.
--
--  POR QUÉ UNA COLUMNA JSON Y NO VEINTE COLUMNAS
--  ---------------------------------------------------------------------------
--  Esos bloques posicionan en Google y no pueden cambiar de forma al mudarse a
--  la base. `datos` guarda el objeto EXACTO que usa la web (`TrendingVehicle`,
--  src/data/trendingVehicles.ts), así que lo que se pinta es idéntico venga del
--  archivo o de la tabla. Las reglas (foto propia y con licencia, crédito
--  obligatorio, simulación solo si el auto se consigue en EE.UU.) no se
--  repiten en SQL: viven en `src/lib/importExamples/validacion.ts` y se aplican
--  al guardar desde el portal y otra vez al leer para pintar la web.
--
--  EL ARCHIVO DEL REPOSITORIO SIGUE EXISTIENDO, como respaldo: si la base no
--  responde o no tiene al menos tres ejemplos válidos, la web pinta la lista
--  del archivo. Nunca una sección vacía.
--
--  RESTRICCIÓN LEGAL: igual que el resto del esquema, acá no entra inventario
--  de MarketCheck, Auto.dev, eBay, Autotrader, CarGurus, Cars.com, TrueCar,
--  AutoTempest ni Facebook Marketplace. Son modelos de referencia escritos a
--  mano por el equipo, no unidades de nadie.
-- =============================================================================

create table if not exists public.ejemplos_importacion (
  -- Parte de la URL pública (/?simular=<id>). No se cambia después de creado.
  id text primary key
    check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 80),

  -- Posición en la lista, de menor a mayor. La home muestra los tres primeros.
  orden integer not null default 0,

  -- Un ejemplo apagado no se muestra, pero se conserva para volver a usarlo.
  activo boolean not null default true,

  -- El TrendingVehicle completo, tal como lo usa la web.
  datos jsonb not null
    check (jsonb_typeof(datos) = 'object' and datos ->> 'id' = id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references neon_auth."user" (id) on delete set null
);

comment on table public.ejemplos_importacion is
  'Autos de referencia de "importación a pedido" (home y /importar). Los edita el equipo en /portal/ejemplos. Modelos escritos a mano, nunca inventario de terceros.';
comment on column public.ejemplos_importacion.datos is
  'TrendingVehicle completo (src/data/trendingVehicles.ts). Se valida con src/lib/importExamples/validacion.ts al guardar y al leer.';

create index if not exists ejemplos_importacion_orden_idx
  on public.ejemplos_importacion (orden, id);

drop trigger if exists ejemplos_importacion_set_updated_at on public.ejemplos_importacion;
create trigger ejemplos_importacion_set_updated_at
  before update on public.ejemplos_importacion
  for each row execute function public.tg_marcar_actualizado();

-- El id es una URL pública: una vez creado no se renombra.
create or replace function public.tg_ejemplo_id_fijo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id then
    raise exception 'El identificador de un ejemplo no se cambia: es parte de su enlace público.';
  end if;
  return new;
end;
$$;

drop trigger if exists ejemplos_importacion_id_fijo on public.ejemplos_importacion;
create trigger ejemplos_importacion_id_fijo
  before update on public.ejemplos_importacion
  for each row execute function public.tg_ejemplo_id_fijo();


-- -----------------------------------------------------------------------------
--  RLS — el público lee los activos; solo el equipo escribe
-- -----------------------------------------------------------------------------
--  Todo lo que hay en `datos` es público por diseño (es lo que se pinta en la
--  web), así que no hace falta acotar columnas como en `vehicles`.
-- -----------------------------------------------------------------------------
alter table public.ejemplos_importacion enable row level security;

revoke all on public.ejemplos_importacion from anonymous, authenticated;
grant select on public.ejemplos_importacion to anonymous;
grant select, insert, update, delete on public.ejemplos_importacion to authenticated;

drop policy if exists "ejemplos_importacion: lectura pública de activos" on public.ejemplos_importacion;
create policy "ejemplos_importacion: lectura pública de activos"
  on public.ejemplos_importacion for select
  to anonymous, authenticated
  using (activo);

drop policy if exists "ejemplos_importacion: el equipo lee todo" on public.ejemplos_importacion;
create policy "ejemplos_importacion: el equipo lee todo"
  on public.ejemplos_importacion for select
  to authenticated
  using (public.es_admin());

drop policy if exists "ejemplos_importacion: el equipo inserta" on public.ejemplos_importacion;
create policy "ejemplos_importacion: el equipo inserta"
  on public.ejemplos_importacion for insert
  to authenticated
  with check (public.es_admin());

drop policy if exists "ejemplos_importacion: el equipo actualiza" on public.ejemplos_importacion;
create policy "ejemplos_importacion: el equipo actualiza"
  on public.ejemplos_importacion for update
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "ejemplos_importacion: el equipo borra" on public.ejemplos_importacion;
create policy "ejemplos_importacion: el equipo borra"
  on public.ejemplos_importacion for delete
  to authenticated
  using (public.es_admin());


-- -----------------------------------------------------------------------------
--  SIEMBRA — los mismos nueve autos que estaban en el repositorio
-- -----------------------------------------------------------------------------
--  Generada desde src/data/trendingVehicles.json el 2026-11-06, en el mismo
--  orden. `on conflict do nothing`: volver a aplicar la migración no pisa lo
--  que el equipo haya editado después.
-- -----------------------------------------------------------------------------
insert into public.ejemplos_importacion (id, orden, datos) values
  ('toyota-gr-supra-final-edition', 10, $ejemplo${
  "id": "toyota-gr-supra-final-edition",
  "name": "Toyota GR Supra MkV Final Edition 2026",
  "detail": "Cierre de la generación MkV, producción limitada a 1,300 unidades a nivel mundial. Se agota por asignación, no por stock de patio.",
  "segment": "Coupé · gasolina",
  "priceMinUsd": 69085,
  "priceMaxUsd": 69085,
  "priceBasis": "msrp-oficial",
  "priceNote": "MSRP oficial de fábrica: USD 69,085. No incluye destination charge, market adjustment del dealer ni flete a Perú.",
  "assemblyCountry": "Austria",
  "assemblyPlant": "Magna Steyr, Graz",
  "adValorem": "no-califica",
  "adValoremNote": "No es originario de EE. UU. aunque se compre en Miami: lo fabrica Magna Steyr en Graz, Austria, sobre plataforma BMW. No accede al 0% del APC Perú-EE. UU.; paga 6% de ad valorem.",
  "availableInUsDealers": true,
  "importViability": "importable-con-advertencia",
  "warnings": [
    {
      "kind": "origen",
      "title": "Austriaco, no japonés ni estadounidense",
      "detail": "Es la confusión más cara de este modelo. El VIN arranca en WZ1 (Austria). Cotizar con 0% de ad valorem da un estimado falso: la calculadora aplica 6%."
    },
    {
      "kind": "disponibilidad",
      "title": "Edición limitada por asignación",
      "detail": "1,300 unidades mundiales. La disponibilidad real se confirma con el dealer antes de comprometer un precio al cliente."
    }
  ],
  "imageSrc": null,
  "imageAlt": "Toyota GR Supra MkV Final Edition 2026",
  "calculator": {
    "brand": "Toyota",
    "model": "GR Supra Final Edition",
    "priceUsd": 69085,
    "vehicleType": "gasolina",
    "preferredPlan": "fast"
  }
}$ejemplo$::jsonb),
  ('ford-bronco-raptor', 20, $ejemplo${
  "id": "ford-bronco-raptor",
  "name": "Ford Bronco Raptor 2026",
  "detail": "Todoterreno de alto desempeño 3.0L EcoBoost V6. El pedido más recurrente de la cartera de importación.",
  "segment": "SUV · gasolina",
  "priceMinUsd": 79995,
  "priceMaxUsd": 79995,
  "priceBasis": "msrp-oficial",
  "priceNote": "MSRP oficial de fábrica: USD 79,995. No incluye destination charge ni ajuste de mercado del dealer.",
  "assemblyCountry": "Estados Unidos",
  "assemblyPlant": "Michigan Assembly, Wayne",
  "adValorem": "candidato-0",
  "adValoremNote": "Wayne, Michigan es la única planta del mundo que produce el Bronco y el Bronco Raptor. Candidato sólido a 0% de ad valorem si la unidad es nueva y llega con certificado de origen.",
  "availableInUsDealers": true,
  "importViability": "importable",
  "warnings": [
    {
      "kind": "origen",
      "title": "Bronco Raptor no es Bronco Sport",
      "detail": "El Bronco Sport se ensambla en Hermosillo, México, y paga 6%. Confirmar el modelo exacto en el anuncio antes de cotizar 0%."
    }
  ],
  "imageSrc": "/images/vehiculos/ford-bronco-raptor.webp",
  "imageAlt": "Ford Bronco Raptor negro de cuatro puertas, generación U725, en tres cuartos frontal izquierdo en el patio de un concesionario. Se distinguen la parrilla con letras FORD y luces ámbar de marcación, los guardafangos ensanchados con tornillería expuesta y las llantas todoterreno de 37\" sobre rines negros. Imagen referencial del modelo, no de la unidad en venta.",
  "imageCredit": "HJUdall",
  "imageLicense": "CC0 1.0",
  "imageSourceUrl": "https://commons.wikimedia.org/wiki/File:24_Ford_Bronco_Raptor.jpg",
  "calculator": {
    "brand": "Ford",
    "model": "Bronco Raptor",
    "priceUsd": 79995,
    "vehicleType": "gasolina",
    "preferredPlan": "fast"
  }
}$ejemplo$::jsonb),
  ('toyota-tacoma-trd', 30, $ejemplo${
  "id": "toyota-tacoma-trd",
  "name": "Toyota Tacoma TRD 2026",
  "detail": "Pickup mediana en acabados TRD Sport, TRD Off-Road y TRD Pro. Alta demanda y reventa sólida en Lima.",
  "segment": "Pickup · gasolina / HEV",
  "priceMinUsd": 46000,
  "priceMaxUsd": 66000,
  "priceBasis": "referencial-miami",
  "priceNote": "Rango referencial de mercado entre TRD Sport y TRD Pro i-FORCE MAX. Sin MSRP verificado por acabado: confirmar la cifra exacta con el dealer antes de cerrar con el cliente.",
  "assemblyCountry": "México",
  "assemblyPlant": "Tijuana y Guanajuato",
  "adValorem": "no-califica",
  "adValoremNote": "La Tacoma se ensambla en México, no en EE. UU. Toda unidad comprada hoy en Miami es mexicana y paga 6% de ad valorem. La segunda línea de San Antonio recién mueve producción hacia 2030.",
  "availableInUsDealers": true,
  "importViability": "importable-con-advertencia",
  "warnings": [
    {
      "kind": "origen",
      "title": "Mexicana, no estadounidense",
      "detail": "Comprarla en Miami no la vuelve originaria de EE. UU. El VIN 3T confirma México. No prometer 0% de ad valorem."
    }
  ],
  "imageSrc": "/images/vehiculos/toyota-tacoma-trd.webp",
  "imageAlt": "Toyota Tacoma TRD Pro color Terra (naranja), cuarta generación N400 de doble cabina, en tres cuartos frontal izquierdo en el patio de un concesionario. Se distinguen la parrilla heritage con TOYOTA en letras de bloque, la toma de aire del capó con emblema TRD, los rines negros con tapa central roja y los resortes rojos de la suspensión. Imagen referencial del modelo, no de la unidad en venta.",
  "imageCredit": "HJUdall",
  "imageLicense": "CC0 1.0",
  "imageSourceUrl": "https://commons.wikimedia.org/wiki/File:24_Toyota_Tacoma_TRD_Pro_HV.jpg",
  "calculator": {
    "brand": "Toyota",
    "model": "Tacoma TRD Off-Road",
    "priceUsd": 56000,
    "vehicleType": "gasolina",
    "preferredPlan": "fast"
  }
}$ejemplo$::jsonb),
  ('ford-f250-super-duty', 40, $ejemplo${
  "id": "ford-f250-super-duty",
  "name": "Ford F-250 Super Duty 2026",
  "detail": "Pickup pesada de trabajo. Configuración de motor decisiva: la versión a gasolina 7.3L es la que se puede traer sin fricción.",
  "segment": "Pickup · gasolina",
  "priceMinUsd": 48000,
  "priceMaxUsd": 95000,
  "priceBasis": "referencial-miami",
  "priceNote": "Rango referencial amplio: va de XL cabina simple a Platinum/King Ranch full equipo. Sin MSRP verificado por configuración; pedir la ventana del vehículo al dealer.",
  "assemblyCountry": "Estados Unidos o Canadá",
  "assemblyPlant": "Kentucky Truck (Louisville) · desde Q3 2026 también Oakville, Ontario",
  "adValorem": "depende-vin",
  "adValoremNote": "Desde Q3 2026 Ford produce Super Duty también en Oakville, Canadá. Un F-250 MY2026-2027 puede ser canadiense y perder el 0%. Se cotiza 6% por defecto; con el VIN (1 = EE. UU., 2 = Canadá) y certificado de origen una unidad estadounidense puede bajar a 0%.",
  "availableInUsDealers": true,
  "importViability": "importable-con-advertencia",
  "warnings": [
    {
      "kind": "normativa",
      "title": "Diésel usado: importación prohibida",
      "detail": "El Power Stroke diésel usado NO entra a Perú en categoría de auto o camioneta. Solo procede la unidad a gasolina, o una diésel nueva de agencia. Verificar el motor antes de cualquier seña."
    },
    {
      "kind": "origen",
      "title": "Pedir el VIN antes de cotizar 0%",
      "detail": "Es el modelo donde más se equivoca el estimado: el primer carácter del VIN decide 0% o 6% sobre un CIF alto."
    }
  ],
  "imageSrc": "/images/vehiculos/ford-f250-super-duty.webp",
  "imageAlt": "Ford F-250 Super Duty XLT blanco de cabina doble, generación P708 (2023-2026), en tres cuartos frontal izquierdo dentro de una cabina de fotografía de concesionario con piso ajedrezado. Se distinguen la parrilla de dos barras, los faros LED con firma en doble C, los espejos de remolque y el decal FX4 en el platón. Imagen referencial del modelo, no de la unidad en venta.",
  "imageCredit": "HJUdall",
  "imageLicense": "CC0 1.0",
  "imageSourceUrl": "https://commons.wikimedia.org/wiki/File:24_Ford_F-250_Super_Duty_XLT.jpg",
  "calculator": {
    "brand": "Ford",
    "model": "F-250 Super Duty",
    "priceUsd": 71500,
    "vehicleType": "gasolina",
    "preferredPlan": "fast"
  }
}$ejemplo$::jsonb),
  ('ram-3500-limited', 50, $ejemplo${
  "id": "ram-3500-limited",
  "name": "RAM 3500 Limited 2026",
  "detail": "Heavy Duty tope de gama. Capacidad de arrastre y equipamiento de lujo en el mismo vehículo.",
  "segment": "Pickup · gasolina",
  "priceMinUsd": 72000,
  "priceMaxUsd": 105000,
  "priceBasis": "referencial-miami",
  "priceNote": "Rango referencial para el acabado Limited según cabina, tracción y paquete. Sin MSRP verificado: confirmar con el dealer.",
  "assemblyCountry": "México",
  "assemblyPlant": "Saltillo, Coahuila",
  "adValorem": "no-califica",
  "adValoremNote": "Toda la gama Heavy Duty de RAM (2500, 3500, 4500, 5500) se ensambla en Saltillo, México, desde 1995. No existe versión estadounidense: 6% siempre. Además supera 8,500 lb de GVWR y está exenta de etiqueta AALA, así que ni siquiera se puede verificar en la ventanilla del concesionario.",
  "availableInUsDealers": true,
  "importViability": "importable-con-advertencia",
  "warnings": [
    {
      "kind": "origen",
      "title": "La RAM 3500 es mexicana, siempre",
      "detail": "No hay unidad estadounidense que buscar. Cualquier promesa de 0% sobre este modelo es un error de cotización."
    },
    {
      "kind": "normativa",
      "title": "Diésel usado: importación prohibida",
      "detail": "La versión Cummins diésel usada no entra a Perú. Solo la 6.4L HEMI a gasolina, o una diésel nueva."
    }
  ],
  "imageSrc": "/images/vehiculos/ram-3500-limited.webp",
  "imageAlt": "RAM 3500 Limited Longhorn Crew Cab blanca, quinta generación DT, con caja larga y rueda trasera doble (dually), en tres cuartos frontal derecho sobre el piso de un salón del automóvil. Se distinguen la parrilla cromada con letras RAM, las cinco luces ámbar de gálibo sobre el parabrisas y la toma de aire elevada del capó. Imagen referencial del modelo, no de la unidad en venta.",
  "imageCredit": "Charles (Flickr), subida a Commons por usf1fan2",
  "imageLicense": "CC0 1.0",
  "imageSourceUrl": "https://commons.wikimedia.org/wiki/File:Ram_3500_Limited_Longhorn_Crew_Cab_4x4_Long_Box_(2026)_(55213412374).jpg",
  "calculator": {
    "brand": "RAM",
    "model": "3500 Limited",
    "priceUsd": 88500,
    "vehicleType": "gasolina",
    "preferredPlan": "fast"
  }
}$ejemplo$::jsonb),
  ('toyota-tundra-trd', 60, $ejemplo${
  "id": "toyota-tundra-trd",
  "name": "Toyota Tundra TRD 2026",
  "detail": "Pickup full-size con i-FORCE MAX híbrido en TRD Pro. Cabina amplia y la fiabilidad que pide el comprador peruano.",
  "segment": "Pickup · HEV",
  "priceMinUsd": 55000,
  "priceMaxUsd": 75000,
  "priceBasis": "referencial-miami",
  "priceNote": "Rango referencial entre TRD Off-Road y TRD Pro i-FORCE MAX. Sin MSRP verificado por acabado.",
  "assemblyCountry": "Estados Unidos",
  "assemblyPlant": "Toyota Motor Manufacturing Texas, San Antonio",
  "adValorem": "candidato-0",
  "adValoremNote": "La Tundra se ensambla exclusivamente en San Antonio, Texas, sin planta alternativa. Es de los pocos Toyota donde el 0% es sólido, sujeto a certificado de origen y a que la unidad sea nueva.",
  "availableInUsDealers": true,
  "importViability": "importable",
  "warnings": [
    {
      "kind": "precio",
      "title": "El híbrido full sí cambia el ISC",
      "detail": "El i-FORCE MAX es híbrido full (HEV) y nuevo no tributa ISC. Un mild-hybrid 48V no calificaría: confirmar la versión exacta."
    }
  ],
  "imageSrc": "/images/vehiculos/toyota-tundra-trd.webp",
  "imageAlt": "Toyota Tundra TRD Pro blanca, generación XK70 con cabina CrewMax de cuatro puertas, en tres cuartos frontal izquierdo en el patio de un concesionario. Se distinguen la parrilla heritage con TOYOTA en letras de bloque, la toma de aire TRD PRO del capó, el gancho de rescate rojo y los rines negros con tapa central roja. Imagen referencial del modelo, no de la unidad en venta.",
  "imageCredit": "HJUdall",
  "imageLicense": "CC0 1.0",
  "imageSourceUrl": "https://commons.wikimedia.org/wiki/File:24_Toyota_Tundra_TRD_Pro_HV.jpg",
  "calculator": {
    "brand": "Toyota",
    "model": "Tundra TRD Pro",
    "priceUsd": 65000,
    "vehicleType": "hev",
    "preferredPlan": "fast"
  }
}$ejemplo$::jsonb),
  ('chevrolet-corvette-z06', 70, $ejemplo${
  "id": "chevrolet-corvette-z06",
  "name": "Chevrolet Corvette Z06 Coupé 2026",
  "detail": "V8 LT6 atmosférico de 5.5L armado a mano. El deportivo americano de mayor consulta en la cartera.",
  "segment": "Coupé · gasolina",
  "priceMinUsd": 112000,
  "priceMaxUsd": 145000,
  "priceBasis": "referencial-miami",
  "priceNote": "Rango referencial: la base 1LZ parte cerca de USD 112,000 y el paquete Z07 con opciones sube fuerte. Sin MSRP verificado para MY2026; los dealers suelen aplicar ajuste de mercado sobre este modelo.",
  "assemblyCountry": "Estados Unidos",
  "assemblyPlant": "Bowling Green, Kentucky",
  "adValorem": "candidato-0",
  "adValoremNote": "Bowling Green es productor exclusivo mundial del Corvette desde 1981; el V8 LT6 del Z06 también se arma a mano ahí. Es el caso más limpio para sustentar 0% con certificado de origen.",
  "availableInUsDealers": true,
  "importViability": "importable",
  "warnings": [
    {
      "kind": "precio",
      "title": "Ajuste de mercado del dealer",
      "detail": "En este modelo el precio de lista rara vez es el precio de compra. El estimado se cierra recién con la cotización escrita del dealer."
    }
  ],
  "imageSrc": "/images/vehiculos/chevrolet-corvette-z06.webp",
  "imageAlt": "Chevrolet Corvette Z06 Coupé (C8) blanco en tres cuartos frontal izquierdo dentro del salón de un concesionario. Se distinguen la arquitectura de motor central con contrafuertes traseros, los guardafangos ensanchados, la gran toma de aire lateral negra, el emblema Z06 en el panel trasero y los rines negros con pinzas de freno rojas. Imagen referencial del modelo, no de la unidad en venta.",
  "imageCredit": "HJUdall",
  "imageLicense": "CC0 1.0",
  "imageSourceUrl": "https://commons.wikimedia.org/wiki/File:25_Chevrolet_Corvette_Z06.jpg",
  "calculator": {
    "brand": "Chevrolet",
    "model": "Corvette Z06",
    "priceUsd": 128500,
    "vehicleType": "gasolina",
    "preferredPlan": "fast"
  }
}$ejemplo$::jsonb),
  ('chevrolet-corvette-c8-stingray', 80, $ejemplo${
  "id": "chevrolet-corvette-c8-stingray",
  "name": "Chevrolet Corvette Stingray C8 2026",
  "detail": "Motor central V8 LT2 6.2L. La puerta de entrada al Corvette y la versión con mejor disponibilidad real.",
  "segment": "Coupé · gasolina",
  "priceMinUsd": 70000,
  "priceMaxUsd": 92000,
  "priceBasis": "referencial-miami",
  "priceNote": "Rango referencial entre 1LT base y 3LT con paquetes. Sin MSRP verificado para MY2026.",
  "assemblyCountry": "Estados Unidos",
  "assemblyPlant": "Bowling Green, Kentucky",
  "adValorem": "candidato-0",
  "adValoremNote": "Misma planta exclusiva que el Z06. Candidato sólido a 0% con certificado de origen si la unidad es nueva.",
  "availableInUsDealers": true,
  "importViability": "importable",
  "warnings": [],
  "imageSrc": "/images/vehiculos/chevrolet-corvette-c8-stingray.webp",
  "imageAlt": "Chevrolet Corvette Stingray (C8) rojo Torch Red en tres cuartos frontal izquierdo desde un ángulo elevado, rodando sobre asfalto. Se distinguen la carrocería estrecha del Stingray (no la ensanchada del Z06), el motor central con capó delantero corto, el alerón alto negro y los rines negros de cinco brazos. Imagen referencial del modelo, no de la unidad en venta.",
  "imageCredit": "OWS Photography",
  "imageLicense": "CC BY 4.0",
  "imageSourceUrl": "https://commons.wikimedia.org/wiki/File:Chevrolet_Corvette_Stingray_(C8)_Washington_DC_Metro_Area,_USA_(3).jpg",
  "calculator": {
    "brand": "Chevrolet",
    "model": "Corvette Stingray",
    "priceUsd": 81000,
    "vehicleType": "gasolina",
    "preferredPlan": "fast"
  }
}$ejemplo$::jsonb),
  ('tesla-cybertruck', 90, $ejemplo${
  "id": "tesla-cybertruck",
  "name": "Tesla Cybertruck 2026",
  "detail": "Pickup eléctrica de carrocería de acero inoxidable. Consulta frecuente, pero con una restricción de homologación que hay que decir de frente.",
  "segment": "Pickup · eléctrico",
  "priceMinUsd": 70000,
  "priceMaxUsd": 100000,
  "priceBasis": "referencial-miami",
  "priceNote": "Rango referencial entre Long Range y Cyberbeast. Sin MSRP verificado para MY2026: Tesla ajusta precios sin previo aviso.",
  "assemblyCountry": "Estados Unidos",
  "assemblyPlant": "Giga Texas, Austin",
  "adValorem": "candidato-0",
  "adValoremNote": "Se produce únicamente en Giga Texas, Austin. Supera 8,500 lb de GVWR y está exento de etiqueta AALA, así que no hay porcentaje oficial que mostrar: el sustento es el punto de ensamblaje final más el certificado de origen del APC.",
  "availableInUsDealers": true,
  "importViability": "importable-con-advertencia",
  "warnings": [
    {
      "kind": "homologacion",
      "title": "No homologado fuera de Norteamérica",
      "detail": "El Cybertruck no cuenta con homologación fuera de Norteamérica. Antes de cualquier seña hay que resolver por escrito la inscripción vehicular, el SOAT y la revisión técnica en Perú. No se compromete fecha de placa sin esa confirmación."
    },
    {
      "kind": "disponibilidad",
      "title": "Postventa y repuestos",
      "detail": "Sin red oficial Tesla en Perú, la garantía y los repuestos corren por cuenta del propietario. Debe quedar escrito en la propuesta."
    }
  ],
  "imageSrc": "/images/vehiculos/tesla-cybertruck.webp",
  "imageAlt": "Tesla Cybertruck en acero inoxidable sin pintar, vista frontal izquierda escorada hacia el perfil, estacionado sobre pavimento con setos y rosales de fondo. Se distinguen la carrocería en cuña de paneles planos, el parabrisas de una sola pieza, la franja LED delantera continua y los guardafangos y llantas negros. Imagen referencial del modelo, no de la unidad en venta.",
  "imageCredit": "Cutlass",
  "imageLicense": "CC0 1.0",
  "imageSourceUrl": "https://commons.wikimedia.org/wiki/File:2024_Tesla_Cybertruck,_front_left,_07-27-2024.jpg",
  "calculator": {
    "brand": "Tesla",
    "model": "Cybertruck",
    "priceUsd": 85000,
    "vehicleType": "ev",
    "preferredPlan": "fast"
  }
}$ejemplo$::jsonb)
on conflict (id) do nothing;
