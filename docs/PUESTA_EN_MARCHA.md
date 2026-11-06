# Puesta en marcha — LUX CARS IMPORT S.A.C.

Pasos exactos para dejar el sitio y el portal funcionando en producción.
Del código a "el equipo carga el primer auto".

**Quién hace esto:** el dueño. Son decisiones de cuenta, facturación y llaves —
ningún desarrollador puede hacerlas por él, y ningún agente debería.

**Tiempo estimado:** 45–60 minutos, la mayor parte esperando.

---

## Antes de empezar: qué pasa si no haces nada

El sitio **ya funciona sin base de datos**. No hay páginas rotas ni errores de
build: la capa de datos devuelve listas vacías y los formularios derivan al
cliente a WhatsApp. Eso significa que puedes desplegar hoy y terminar de
configurar Neon mañana.

Lo que **no** funciona sin esto: no se guarda ni un solo lead, el portal no
muestra números y no se puede cargar stock.

---

## Paso 0 — ⚠ Vercel Pro. Esto es primero por un motivo legal.

**El plan Hobby de Vercel prohíbe el uso comercial.** Está en sus términos: el
plan gratuito es para proyectos personales y no comerciales. LUX CARS IMPORT
S.A.C. es una empresa con RUC 20615410935 que vende vehículos desde este sitio —
eso es uso comercial sin ninguna ambigüedad.

Usar Hobby aquí expone el proyecto a **suspensión de la cuenta sin aviso**, y
una suspensión se lleva el sitio, el portal y los leads del día.

**No es una recomendación de rendimiento. Es cumplir los términos del proveedor
que aloja tu negocio.**

1. Entra a **vercel.com → tu cuenta → Settings → Billing** (o crea un Team).
2. Sube el plan a **Pro** (USD 20/mes por miembro al momento de escribir esto).
3. Asegúrate de que **el proyecto `luxcarsperu` quede dentro del Team de pago**,
   no en tu cuenta personal Hobby. Un proyecto en Hobby dentro de una cuenta que
   además tiene un Team Pro **sigue siendo Hobby**.

> **Cómo verificar que quedó bien:** abre el proyecto en Vercel. Arriba, junto al
> nombre, debe decir **Pro**, no *Hobby*. Si dice Hobby, el proyecto está en el
> scope equivocado: transfiérelo al Team.

De paso, Pro es lo que habilita **Deployment Protection**, que es como se cierra
el portal en el paso 6.

---

## Paso 1 — El proyecto en Neon

La base vive en **Neon**: organización `GIANFRANCO`, proyecto **`luxcarsperu`**
(`long-cell-98759372`), región AWS US East (N. Virginia) — la más cercana a
Perú con buena latencia, y la misma donde Vercel sirve por defecto.

**Estado al 2026-11-05: ya está creado**, con sus tres piezas activas en la rama
`main`:

| Pieza | Para qué |
|---|---|
| **Data API** | Las consultas del sitio y del portal, con RLS como candado |
| **Neon Auth** | El login del equipo |
| **Object Storage** | El bucket `vehiculos` con las fotos del stock, de lectura pública |

Si algún día hay que rehacerlo desde cero: [console.neon.tech](https://console.neon.tech)
→ **New project**, activar **Data API** (con Neon Auth como proveedor) y crear
el bucket `vehiculos` con acceso `public_read` en **Object storage**.

El plan gratuito alcanza para empezar. Revísalo cuando el stock real y las fotos
crezcan.

---

## Paso 2 — Aplicar las migraciones

Las 7 migraciones están en `db/migrations/`. **Estado al 2026-11-05: ya están
aplicadas** en `luxcarsperu` (7 tablas, 1 vista, las políticas RLS y 22 tasas
cargadas).

Para aplicarlas en una base nueva hace falta `psql` y la cadena de conexión
(Neon → **Connect**):

```bash
cd /ruta/al/proyecto/luxcarsperu
for f in db/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$f"
done
```

**Orden obligatorio:** primero activar la Data API y Neon Auth (paso 1). Las
migraciones otorgan permisos a los roles `anonymous` y `authenticated` y
referencian `neon_auth."user"`; todo eso lo crea Neon al activarlas.

**Verificación (no te saltes esto):** en la consola, **Tables** debe mostrar
`vehicle_models`, `vehicles`, `vehicle_photos`, `leads`, `quotes`,
`consignments` y `tax_rates`.

> **No cargues el seed.** `db/seed.sql` es solo para desarrollo local.
> Siembra dos filas marcadas `FILA DEMO`, sin publicar y sin fotos. Si por
> cualquier motivo lo corriste contra producción, **borra esas dos filas antes
> de publicar cualquier auto**.

---

## Paso 3 — ⚠ El alta pública debe quedar desactivada. El paso más importante de todos.

**Si el registro se abre, cualquier persona de internet puede crearse una cuenta
y entrar a ver tus leads, tus márgenes y el precio mínimo de cada consignación.**

Las políticas de la base dan acceso de equipo a **cualquier usuario
autenticado**, que es lo que se pidió. Si el registro queda abierto, registrarse
**es** entrar al equipo.

**Estado al 2026-11-05: ya está desactivada** (`disable_sign_up`). Para
comprobarlo o cambiarlo: consola de Neon → **Auth** → configuración de
**Sign-in with Email** → el registro de usuarios nuevos debe estar apagado.

> **Cómo verificar:** el sitio lo confirma solo. Un registro contra
> `/api/auth/sign-up/email` debe responder
> *"Email and password sign up is not enabled"*.

---

## Paso 4 — Crear los usuarios del equipo

No hay registro en el portal y no lo habrá.

1. Consola de Neon → **Auth → Users → crear usuario**. Solo pide el **correo**
   (y un nombre). Uno por persona del equipo.
2. Esa persona abre **`/portal/recuperar`**, escribe su correo y recibe un
   enlace (vence en 15 minutos) para **definir su propia contraseña**. Nadie le
   dicta una clave a nadie.
3. La misma pantalla sirve el día que alguien la olvida.

El correo sale del remitente compartido de Neon (`auth@mail.myneon.app`). Sirve
para empezar; para producción conviene configurar un remitente propio en
**Auth → Email provider**, o el enlace puede caer en spam.

**Crea solo las cuentas que hacen falta.** Hoy todo usuario autenticado ve
todo: no hay diferencia entre un vendedor y el dueño. Una cuenta de más es un
juego completo de llaves de más.

---

## Paso 5 — Variables de entorno en Vercel

Ve a **Vercel → proyecto `luxcarspe` → Settings → Environment Variables**. Los
valores salen de Neon → **Connect**.

| Variable | Valor | ¿Secreta? |
|---|---|---|
| `NEXT_PUBLIC_NEON_URL` | Dirección https de la base, sin credenciales (`https://ep-xxx….neon.tech/neondb`) | No |
| `DATABASE_URL` | Cadena de conexión de Postgres (la "pooled") | **SÍ** |
| `NEON_AUTH_COOKIE_SECRET` | Texto aleatorio de 32+ caracteres (`openssl rand -base64 32`) | **SÍ** |
| `NEXT_PUBLIC_NEON_STORAGE_URL` | Pestaña **Storage** → `AWS_ENDPOINT_URL_S3` | No |
| `NEON_STORAGE_ACCESS_KEY_ID` | Pestaña **Storage** → `AWS_ACCESS_KEY_ID` | **SÍ** |
| `NEON_STORAGE_SECRET_ACCESS_KEY` | Pestaña **Storage** → `AWS_SECRET_ACCESS_KEY` | **SÍ** |

Las de Storage llevan nombre propio porque Vercel reserva los `AWS_*` para su
entorno y no deja definirlos.

### Sobre `DATABASE_URL`, que es la peligrosa

- **Salta todas las políticas RLS.** Quien la tenga puede leer y escribir la base
  entera.
- **JAMÁS le pongas el prefijo `NEXT_PUBLIC_`.** Ese prefijo la mete en el bundle
  del navegador y deja tu base abierta a cualquiera que abra las herramientas de
  desarrollo. No hay forma de deshacerlo salvo cambiar la contraseña del rol.
- **Jamás en el repositorio**, ni siquiera en una rama.
- Sin ella los formularios siguen funcionando, pero **ningún lead se guarda**:
  todo se va por WhatsApp. Es la variable que hay que priorizar si quieres dejar
  de perder el rastro de las consultas.

### Dominios de confianza de Neon Auth

Neon Auth solo acepta el login desde los dominios que conoce. Ya están
`https://www.luxcars.pe` y `https://luxcars.pe`. Si el sitio se sirve desde otro
dominio (por ejemplo, una URL de preview de Vercel), agrégalo en Neon → **Auth**
→ dominios de confianza, o el login de ese dominio va a fallar.

> **Después de guardar las variables hay que volver a desplegar.** Vercel las lee
> en el build, así que un deploy anterior no las ve. **Deployments → … →
> Redeploy.**

Para desarrollo local, copia `.env.example` como `.env.local` y complétalo.
`.env.local` está ignorado por git.

---

## Paso 6 — Cerrar el portal con Deployment Protection

El portal tiene login, pero el guard corre **en el navegador**. Los datos están
protegidos por RLS (sin sesión, Postgres devuelve cero filas), pero **la URL
`/portal` responde 200 a cualquiera**. Esto lo cierra en el borde, antes de que
Next conteste.

1. Vercel → proyecto → **Settings → Deployment Protection**.
2. Activa **Vercel Authentication** (o **Password Protection** si el equipo no
   tiene cuentas de Vercel).
3. Guarda y vuelve a desplegar.

**Cuesta cero y es lo que hay que hacer hoy.** La solución definitiva —un
`proxy.ts` que valide la sesión de Neon Auth en el servidor antes de responder
cualquier `/portal/*`— es decisión tuya; está explicada en
[`ARQUITECTURA.md`](./ARQUITECTURA.md#5-el-portal--portal).

> **Ojo:** Password Protection cubre **todo** el sitio, incluido el público. Si
> solo quieres cerrar `/portal`, usa Vercel Authentication o deja el portal en un
> proyecto aparte.

---

## Paso 7 — Verificar que todo quedó bien

Con el sitio desplegado, en este orden:

1. **`/portal/recuperar`** y luego **`/portal/login`** — define tu contraseña
   con el enlace del correo y entra. Si entra, el paso 4 y las variables están
   bien.
2. **`/portal`** — el aviso de "falta configurar" debe haber desaparecido y los
   indicadores mostrar ceros reales (no hay datos todavía).
3. **`/portal/vehiculos/nuevo`** — carga un auto de verdad con su VIN. El
   autocompletado debe traer marca, modelo y año. **Cronométralo.** Si los cuatro
   minutos son ocho, hay que saber dónde se van.
4. **`/portal/vehiculos/{id}/fotos`** — sube fotos **desde el celular**, que es
   como se va a usar. Especialmente con un iPhone: los HEIC reales no se
   probaron nunca.
5. **`/portal/leads`** — debe cargar vacío, sin errores.
6. **Incógnito, sin sesión** — `/portal` no debe dejarte pasar.

---

## Lo que necesitas decidir o conseguir tú

Nada de esto lo puede resolver el código.

### Bloquea que el sitio se vea terminado

1. **FOTOS REALES DEL STOCK.** Es la carencia más cara: hay autos y no hay fotos.
   Por unidad: 3/4 delantero y trasero a la altura del faro, ambos laterales,
   interior con el odómetro legible, y **detalle de los golpes y rayones** — el
   defecto fotografiado genera más confianza que el auto impecable. Luz de día
   nublado, fondo liso, horizontal, mínimo 2000 px. La guía completa ya está
   dentro del portal, en la pantalla de fotos.
2. **LOS 7 PRECIOS REFERENCIALES.** Tacoma TRD, F-250, RAM 3500, Tundra TRD,
   Corvette Z06, Corvette C8 y Cybertruck están con rango prudente porque no
   había MSRP verificado por acabado. Los más urgentes son el **Z06** (el ajuste
   de mercado del dealer es enorme) y el **Cybertruck** (Tesla cambia precios sin
   aviso). Hace falta el MSRP real por versión o una cotización escrita del
   dealer.

### Números que el cliente va a preguntar y hoy no existen

3. **El % de comisión de consignación** que pactas de verdad. Es el dato que más
   te van a preguntar y el único porcentaje que no está escrito.
4. **Si la tasación se cobra aparte** o va incluida en la comisión.
5. **Si el precio de venta se publica en USD o en soles** (la base soporta ambas).
6. **Si hay monto mínimo** para consignación y gestión documentaria. El piso de
   USD 30.000 aplica **solo a importación**; hoy el sitio dice "escríbenos y te
   decimos".
7. **Precios de lista de Changan y Geely en Perú.** Están como referencia
   prudente. El argumento completo —"te sale más caro traerlo"— depende de que
   esa cifra sea correcta: confírmala con el importador oficial.

### Afirmaciones publicadas que hay que confirmar o bajar de tono

8. **"Informe de 150 puntos"** y **"técnicos certificados"** en la inspección de
   Miami, y **"el informe llega antes de transferir el dinero al vendedor"**.
   Vienen del copy anterior. Si alguna no se cumple **siempre**, hay que
   corregirla ahora, no cuando un cliente la reclame. Un comprador de USD 80.000
   contrasta ese tipo de cifra.
9. **"Trabajamos directamente con las marcas más deseadas del mundo"** sobre 20
   logos de fabricantes, y **"fuentes verificadas"** sobre 10 logos de portales.
   Si esos acuerdos no están firmados, conviene ajustar el texto
   ("marcas que importamos", "portales que revisamos").
10. **Homologación del Cybertruck.** Alguien tiene que averiguar si inscripción
    vehicular, SOAT y revisión técnica son viables en Perú hoy. Si no lo son, el
    vehículo debería **salir** del catálogo, no quedarse con una advertencia.

### Decisiones técnicas que agregan dependencias

11. **¿Se agrega un `proxy.ts` con Neon Auth?** Habilita proteger el portal en
    el servidor. Mientras tanto, el paso 6 es la red de seguridad.
12. **Cookies.** El banner existe pero **no gobierna nada**: hoy ni "aceptar" ni
    "rechazar" activan o bloquean ningún script. El día que agregues analítica,
    tiene que leer la clave `luxcars-cookie-consent` **antes** de cargarse, o el
    banner es decorativo y, en la práctica, engañoso.

---

## Recordatorios que valen dinero

- **⛔ No conectes APIs de inventario de terceros.** MarketCheck, Auto.dev, eBay,
  Autotrader, CarGurus, Cars.com, TrueCar, AutoTempest y Facebook Marketplace
  **prohíben por contrato** guardar su inventario. Buscar ahí es legal; guardar
  lo que devuelven, no. El detalle completo, y por qué la base lo impide por sí
  sola, está en [`ARQUITECTURA.md`](./ARQUITECTURA.md#0-la-restricción-legal-léela-antes-de-tocar-el-inventario).
- **El bucket de fotos es de lectura pública.** No subas ahí tarjetas de
  propiedad, DNIs ni documentos de clientes. Eso necesita un bucket privado
  aparte con URLs firmadas.
- **Datos personales bajo Ley 29733.** El portal tiene nombres, teléfonos y
  correos de clientes, y documentos de los dueños en consignación. No se exportan
  a herramientas externas y no se comparten capturas de pantalla por WhatsApp.
- **Al cerrar una venta, registra siempre la fecha.** El indicador "vendidas del
  mes" no cuenta las unidades sin fecha de venta — sin ella no se puede atribuir
  a un mes, y el número va a salir bajo sin que nadie sepa por qué.
- **Al reemplazar una foto, cámbiale el nombre de archivo.** No la sobrescribas:
  el caché de imágenes de Vercel dura 30 días y seguiría sirviendo la vieja.
- **`REFERENCE_YEAR = 2026`** en `src/lib/config.ts`. Es una línea al año, y de
  ella depende el "solo modelos 2024 en adelante" que se muestra al cliente.
  Ponlo en el checklist de enero.
