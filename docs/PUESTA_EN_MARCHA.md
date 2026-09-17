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
cliente a WhatsApp. Eso significa que puedes desplegar hoy y configurar
Supabase mañana.

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

## Paso 1 — Crear el proyecto en Supabase

1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) con la cuenta
   de la organización **`zvwegcanushbpmjtohnp`**.
2. **New project**:
   - **Name**: `luxcars-produccion`
   - **Database password**: genérala con el botón y **guárdala en el gestor de
     contraseñas**. Supabase no vuelve a mostrarla y sin ella no se puede
     conectar por CLI.
   - **Region**: `East US (North Virginia)` — es la más cercana a Perú con buena
     latencia, y la misma región donde Vercel sirve por defecto.
   - **Plan**: el gratuito alcanza para empezar. Súbelo a Pro cuando el stock
     real y las fotos crezcan (el límite de Storage del gratuito es 1 GB, que son
     más o menos 3.000 fotos ya comprimidas por el portal).
3. Espera a que termine de aprovisionar (~2 minutos).

---

## Paso 2 — Aplicar las migraciones

Las 10 migraciones están en `supabase/migrations/`. **Nadie las ha ejecutado
todavía** contra tu proyecto: fueron probadas contra un PostgreSQL 17 local
descartable con los roles de Supabase recreados, y ahí quedaron limpias (7
tablas, 1 vista, 30 políticas RLS, 45 índices, 22 tasas cargadas).

```bash
# 1. Instalar la CLI (una sola vez)
npm install -g supabase

# 2. Iniciar sesión — abre el navegador
supabase login

# 3. Enlazar con tu proyecto
#    El <ref> es el "Project ref" de Settings → General (algo como abcdefghijklm)
cd /ruta/al/proyecto/luxcarsperu
supabase link --project-ref <ref>

# 4. Aplicar el esquema
supabase db push
```

**Qué debe pasar:** lista las 7 migraciones y termina sin errores.

**Verificación (no te saltes esto):** en el dashboard, **Table Editor** debe
mostrar `vehicle_models`, `vehicles`, `vehicle_photos`, `leads`, `quotes`,
`consignments` y `tax_rates`. En **Storage** debe existir el bucket
**`vehiculos`**.

> **No cargues el seed.** `supabase/seed.sql` es solo para desarrollo local.
> Siembra dos filas marcadas `FILA DEMO`, sin publicar y sin fotos. Si por
> cualquier motivo lo corriste contra producción, **borra esas dos filas antes
> de publicar cualquier auto**.

---

## Paso 3 — Registro público ABIERTO, portal cerrado por rol

Desde la migración `20260917100000_cuentas_y_roles.sql` los clientes crean
cuenta en **luxcars.pe/cuenta** para pedir búsquedas y ofrecer su auto. Por eso
el alta pública **debe quedar activa**:

1. Supabase → **Authentication → Sign In / Providers → Email**.
2. **"Allow new users to sign up"** activado.
3. Decide si exiges confirmar el correo (**"Confirm email"**). Recomendado:
   activado. El formulario ya lo contempla: si no llega sesión al registrarse,
   le dice al cliente que revise su bandeja.

**Por qué esto ya no abre el negocio:** toda cuenta nueva nace con rol
`cliente`. Todas las políticas del portal exigen `public.es_admin()`, así que
un cliente con sesión recibe cero filas de leads, vehículos sin publicar,
consignaciones y márgenes, exactamente igual que un anónimo. Lo que ve es lo
suyo: sus solicitudes.

> **Cómo verificar:** regístrate en una ventana de incógnito y abre
> `/portal`. Debe decir "Esta cuenta no es del equipo".

---

## Paso 4 — El primer administrador y los siguientes

- **Si ya había usuarios** en Authentication → Users al aplicar la migración,
  todos pasaron a `admin` automáticamente (eran el equipo).
- **Si el proyecto está vacío**, regístrate en `/cuenta/login` con tu correo y
  luego, en Supabase → **SQL Editor**, ejecuta:

  ```sql
  update public.profiles set rol = 'admin' where email = 'tu@correo.pe';
  ```

  Desde el editor SQL no hay sesión, así que el trigger de protección no
  interfiere. Este paso solo hace falta una vez.
- **Los siguientes admins** no se crean en Supabase: cada persona del equipo se
  registra en `/cuenta/login` y tú le cambias el rol desde
  **/portal/usuarios → Hacer admin**. Ahí mismo se quita el rol o se desactiva
  una cuenta cuando alguien deja el equipo.

**Da el rol admin solo a quien lo necesite.** Todo admin ve todo: leads,
márgenes y precio mínimo de cada consignación. Un admin de más es un juego
completo de llaves de más. Las contraseñas se restablecen desde
Authentication → Users.

---

## Paso 5 — Variables de entorno en Vercel

Ve a **Vercel → proyecto → Settings → Environment Variables**. Los valores están
en Supabase → **Project Settings → API Keys** (y la URL en **Data API**).

| Variable | Valor | Entornos | ¿Secreta? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`https://xxx.supabase.co`) | Production, Preview, Development | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave `anon` / publishable | Production, Preview, Development | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave `service_role` | **Solo Production** | **SÍ** |

### Sobre `SUPABASE_SERVICE_ROLE_KEY`, que es la peligrosa

- **Salta todas las políticas RLS.** Quien la tenga puede leer y escribir la base
  entera.
- **JAMÁS le pongas el prefijo `NEXT_PUBLIC_`.** Ese prefijo la mete en el bundle
  del navegador y deja tu base abierta a cualquiera que abra las herramientas de
  desarrollo. No hay forma de deshacerlo salvo rotar la llave.
- **Jamás en el repositorio**, ni siquiera en una rama.
- Sin ella los formularios siguen funcionando, pero **ningún lead se guarda**:
  todo se va por WhatsApp. Es la variable que hay que priorizar si quieres dejar
  de perder el rastro de las consultas.

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

**Cuesta cero y es lo que hay que hacer hoy.** La solución definitiva —instalar
`@supabase/ssr` y un `middleware.ts` que valide la sesión en el servidor— agrega
una dependencia al proyecto y es decisión tuya; está explicada en
[`ARQUITECTURA.md`](./ARQUITECTURA.md#5-el-portal--portal).

> **Ojo:** Password Protection cubre **todo** el sitio, incluido el público. Si
> solo quieres cerrar `/portal`, usa Vercel Authentication o deja el portal en un
> proyecto aparte.

---

## Paso 7 — Verificar que todo quedó bien

Con el sitio desplegado, en este orden:

1. **`/portal/login`** — entra con uno de los usuarios que creaste. Si entra, el
   paso 4 y las variables están bien.
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

11. **¿Se instala `@supabase/ssr`?** Habilita proteger el portal en el servidor.
    Mientras tanto, el paso 6 es la red de seguridad.
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
