-- Expedientes · documentos del cliente sin rayas ni notas internas (2026-11-28)
--
-- El Anexo C deja de imprimir casillas y líneas para llenar a mano: lo que el
-- cliente declara se pide en el portal en la etapa de contrato y el anexo sale
-- lleno. Si falta un dato, el documento no se emite (regla "sin rayas").
--
--  1. `clientes.es_pep` admite NULL = "todavía no lo declaró" (antes era
--     `not null default false`, y un cliente nuevo quedaba como "No" sin que
--     nadie lo preguntara). Los valores existentes se conservan.
--  2. Columnas nuevas de `clientes`:
--       · `pep_cargo`: el cargo público que hace PEP al representante.
--       · `beneficiarios`: arreglo JSON de beneficiarios finales
--         `{ nombre, documento, porcentaje, pep }` (hasta 10). NULL = no
--         declarados. `beneficiario_final` (texto) queda solo para datos viejos.
--       · `origen_fondos_tipo`: utilidades | prestamo | aporte_capital |
--         venta_activo | otro. El detalle sigue en `origen_fondos`.
--       · `kyc_uif_en` y `kyc_responsable`: la verificación interna de
--         LUXCARS (registro de operaciones de la UIF y quién la hizo). Viven en
--         la pestaña Cliente del expediente y NUNCA van en un documento del
--         cliente (antes estaban impresas en el Anexo C con rayas).
--  3. Las confirmaciones pendientes del dueño (porcentaje de detracción con el
--     contador, poder para SUNARP con el notario) ya no van como notas
--     "[CONFIRMAR…]" en los documentos: son filas `PENDIENTE_*` de
--     `configuracion_documentos` (valor = fecha en que se marcaron hechas),
--     que se marcan desde /portal/configuracion. No cambia el esquema; solo el
--     comentario de la tabla.
--
-- Idempotente: se puede volver a aplicar.
-- Después de aplicar: `neon data-api refresh-schema`.

alter table public.clientes alter column es_pep drop not null;
alter table public.clientes alter column es_pep drop default;

alter table public.clientes
  add column if not exists pep_cargo text check (pep_cargo is null or length(pep_cargo) <= 160),
  add column if not exists beneficiarios jsonb check (
    beneficiarios is null or (jsonb_typeof(beneficiarios) = 'array' and jsonb_array_length(beneficiarios) <= 10)
  ),
  add column if not exists origen_fondos_tipo text check (
    origen_fondos_tipo is null or origen_fondos_tipo in ('utilidades', 'prestamo', 'aporte_capital', 'venta_activo', 'otro')
  ),
  add column if not exists kyc_uif_en date,
  add column if not exists kyc_responsable text check (kyc_responsable is null or length(kyc_responsable) <= 120);

comment on column public.clientes.es_pep is
  '¿El representante es o fue en los últimos cinco años persona expuesta políticamente (o pariente o asociado cercano)? NULL = todavía no lo declaró. Sale en el Anexo C como "No" o "Sí: cargo".';
comment on column public.clientes.pep_cargo is
  'Cargo público que hace PEP al representante (obligatorio si es_pep). Anexo C.';
comment on column public.clientes.beneficiarios is
  'Beneficiarios finales (10 % o más del capital, o control): arreglo JSON de { nombre, documento, porcentaje, pep }. NULL = no declarados. La tabla del Anexo C sale de aquí; beneficiario_final (texto) queda solo para datos anteriores al 28 nov 2026.';
comment on column public.clientes.origen_fondos_tipo is
  'Origen de los fondos declarado en el Anexo C: utilidades, prestamo, aporte_capital, venta_activo u otro. El detalle va en origen_fondos.';
comment on column public.clientes.kyc_uif_en is
  'Uso interno: fecha en que se completó el Registro de Operaciones de la UIF para este cliente. Nunca va en un documento del cliente.';
comment on column public.clientes.kyc_responsable is
  'Uso interno: quién hizo la debida diligencia del cliente. Nunca va en un documento del cliente.';

comment on table public.configuracion_documentos is
  'Parámetros de la empresa que van en los documentos del expediente (RUC, domicilio, partida, representante y DNI, cuentas Fondos de Clientes y Detracciones, porcentaje de detracción, ciudad de firma, días de espera en consolidado): una fila por campo del paquete (clave = nombre del campo en src/core/expedientes/campos.ts). Además, filas PENDIENTE_* con la fecha en que el dueño marcó hecha cada confirmación previa al primer uso (PENDIENTES_EMPRESA). Se llena desde /portal/configuracion; la variable LUXCARS_DOCUMENTOS_JSON queda solo como respaldo. Solo admin.';
