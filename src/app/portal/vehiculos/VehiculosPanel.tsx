"use client";

/**
 * Listado del stock para el equipo de LuxCars.
 *
 * El portal es SOLO PARA ADMINISTRACIÓN: el dueño y su equipo. El cliente no
 * tiene cuenta — cotiza, llena formularios y sigue por WhatsApp. Acá se ve lo
 * que el sitio público jamás muestra: borradores sin publicar, autos vendidos y
 * el precio de compra.
 *
 * POR QUÉ ES UN COMPONENTE DE CLIENTE Y NO SE RENDERIZA EN EL SERVIDOR: porque
 * muestra el margen del negocio. Un componente de servidor tendría que leer con
 * `service_role`, que salta RLS, y Next mandaría ese HTML —precio de compra
 * incluido— a cualquiera que abriera la URL con `curl`, sin ejecutar una línea
 * de JavaScript. Consultando desde el navegador con la sesión del equipo, el
 * candado es RLS en Postgres: sin sesión no hay filas. El detalle está en el
 * encabezado de `src/app/portal/layout.tsx`.
 *
 * Los filtros viven en la URL (los lee el Server Component y bajan por props),
 * así que un filtro se puede compartir, recargar y deshacer con el botón atrás.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePortalSession } from "@/components/portal/portalSession";
import { VehiculosFiltros } from "./VehiculosFiltros";
import {
  CONTEO_VACIO,
  listarVehiculos,
  type AdminVehicle,
  type ConteoEstados,
} from "./consultas";
import {
  CATEGORIA_LABEL,
  CONDICION_LABEL,
  ESTADO_LABEL,
  FUENTE_LABEL,
  formatearFecha,
  formatearKilometraje,
  formatearPrecio,
} from "./etiquetas";
import type { VehicleStatus } from "@/lib/db/types";

type Props = {
  busqueda: string;
  estado: VehicleStatus | "todos";
  publicado: "todos" | "si" | "no";
};

type Datos = {
  vehiculos: AdminVehicle[];
  conteo: ConteoEstados;
  cargado: boolean;
  error: string | null;
};

const DATOS_VACIOS: Datos = {
  vehiculos: [],
  conteo: CONTEO_VACIO,
  cargado: false,
  error: null,
};

export function VehiculosPanel({ busqueda, estado, publicado }: Props) {
  const { status: sesion, client } = usePortalSession();
  const [datos, setDatos] = useState<Datos>(DATOS_VACIOS);

  const puedeConsultar = sesion === "autenticado" && client !== null;

  // Todo `setState` ocurre DESPUÉS del await, nunca en el cuerpo síncrono del
  // efecto (regla react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!puedeConsultar || !client) return;
    let cancelado = false;

    void (async () => {
      const resultado = await listarVehiculos(client, {
        search: busqueda || undefined,
        status: estado === "todos" ? undefined : estado,
        published:
          publicado === "todos" ? undefined : publicado === "si" ? true : false,
      });
      if (cancelado) return;
      setDatos({
        vehiculos: resultado.vehiculos,
        conteo: resultado.conteo,
        cargado: true,
        error: resultado.estado === "ok" ? null : resultado.mensaje ?? null,
      });
    })();

    return () => {
      cancelado = true;
    };
  }, [client, puedeConsultar, busqueda, estado, publicado]);

  const hayFiltro =
    busqueda.trim() !== "" || estado !== "todos" || publicado !== "todos";
  const cargando = puedeConsultar && !datos.cargado;
  const publicadosVisibles = datos.vehiculos.filter((v) => v.published).length;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-light tracking-wide text-ink sm:text-4xl">
            Stock de vehículos
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-2">
            {datos.cargado
              ? `${datos.conteo.total} ${
                  datos.conteo.total === 1
                    ? "unidad cargada"
                    : "unidades cargadas"
                } · ${publicadosVisibles} ${
                  publicadosVisibles === 1 ? "visible" : "visibles"
                } en la web dentro de este filtro.`
              : "Cada ficha se carga a mano en unos cuatro minutos, con el VIN haciendo el trabajo pesado."}
          </p>
        </div>

        {/* El único botón en oro de la pantalla: es la acción que mueve el
            negocio. Todo lo demás va en plata. */}
        <Link
          href="/portal/vehiculos/nuevo"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-gold px-7 text-sm font-medium uppercase tracking-[0.16em] text-void transition-colors hover:bg-gold-bright"
        >
          Cargar vehículo
        </Link>
      </header>

      {sesion === "sin-configurar" ? <AvisoSinConfigurar /> : null}
      {sesion === "anonimo" ? <AvisoSinSesion /> : null}
      {datos.error ? (
        <div className="mt-8 rounded-lux border border-danger/40 bg-surface-2 p-5">
          <p className="text-sm font-medium text-danger">
            Error al leer el stock
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            {datos.error}
          </p>
        </div>
      ) : null}

      <section className="mt-8">
        <VehiculosFiltros
          busqueda={busqueda}
          estado={estado}
          publicado={publicado}
          conteo={datos.conteo}
        />
      </section>

      <section className="mt-8">
        {cargando ? (
          <Esqueleto />
        ) : datos.vehiculos.length === 0 ? (
          <EstadoVacio hayFiltro={hayFiltro} puedeConsultar={puedeConsultar} />
        ) : (
          <>
            <CabeceraTabla />
            <ul className="mt-2 flex flex-col gap-2">
              {datos.vehiculos.map((vehiculo) => (
                <li key={vehiculo.id}>
                  <FilaVehiculo vehiculo={vehiculo} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <NotaProcedencia />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const GRID =
  "grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-[minmax(0,1fr)_120px_120px_140px_120px] md:items-center";

function CabeceraTabla() {
  return (
    <div
      className={`${GRID} hidden px-4 pb-2 text-[0.7rem] uppercase tracking-[0.16em] text-ink-4 md:grid`}
      aria-hidden
    >
      <span>Vehículo</span>
      <span>Estado</span>
      <span>Kilometraje</span>
      <span>Precio de venta</span>
      <span>Web</span>
    </div>
  );
}

function FilaVehiculo({ vehiculo }: { vehiculo: AdminVehicle }) {
  return (
    <article
      className={`${GRID} rounded-lux border border-line bg-surface p-4 transition-colors hover:border-line-strong`}
    >
      <div className="min-w-0">
        <h2 className="truncate text-base font-medium text-ink">
          {vehiculo.title || `${vehiculo.brand} ${vehiculo.model}`}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
          <span>{CATEGORIA_LABEL[vehiculo.category]}</span>
          <span aria-hidden>·</span>
          <span>{CONDICION_LABEL[vehiculo.condition]}</span>
          <span aria-hidden>·</span>
          <span>{FUENTE_LABEL[vehiculo.source]}</span>
          {vehiculo.location ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{vehiculo.location}</span>
            </>
          ) : null}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-4">
          <span className="font-mono tracking-wider">
            {vehiculo.vin ?? "Sin VIN"}
          </span>
          {vehiculo.plate ? (
            <>
              <span aria-hidden>·</span>
              <span>Placa {vehiculo.plate}</span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span>Ingreso {formatearFecha(vehiculo.intakeDate)}</span>
        </p>
        <p className="mt-3">
          <Link
            href={`/portal/vehiculos/${vehiculo.id}/fotos`}
            className="text-xs uppercase tracking-[0.14em] text-silver underline-offset-4 transition-colors hover:text-silver-bright hover:underline"
          >
            Fotos
          </Link>
        </p>
      </div>

      <Dato etiqueta="Estado">
        <EstadoPildora estado={vehiculo.status} />
      </Dato>

      <Dato etiqueta="Kilometraje">
        <span className="text-sm text-ink-2 tabular-nums">
          {formatearKilometraje(vehiculo.mileageKm)}
        </span>
      </Dato>

      <Dato etiqueta="Precio de venta">
        <span className="text-sm font-medium text-ink tabular-nums">
          {formatearPrecio(vehiculo.price, vehiculo.currency)}
        </span>
        {vehiculo.purchasePrice !== null ? (
          <span className="block text-xs text-ink-4 tabular-nums">
            Compra{" "}
            {formatearPrecio(vehiculo.purchasePrice, vehiculo.purchaseCurrency)}
          </span>
        ) : null}
      </Dato>

      <Dato etiqueta="Web">
        {vehiculo.published ? (
          <span className="inline-flex items-center gap-2 text-sm text-ink-2">
            <span className="size-1.5 rounded-full bg-ok" aria-hidden />
            Publicado
          </span>
        ) : (
          <span className="text-sm text-ink-4">Borrador</span>
        )}
      </Dato>
    </article>
  );
}

/** En móvil cada dato lleva su rótulo; en escritorio lo da la cabecera. */
function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 md:block">
      <span className="text-[0.7rem] uppercase tracking-[0.16em] text-ink-4 md:hidden">
        {etiqueta}
      </span>
      <div className="text-right md:text-left">{children}</div>
    </div>
  );
}

function EstadoPildora({ estado }: { estado: VehicleStatus }) {
  const estilos: Record<VehicleStatus, string> = {
    disponible: "border-silver/40 text-silver",
    reservado: "border-warn/40 text-warn",
    en_transito: "border-info/40 text-info",
    vendido: "border-line text-ink-4",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs tracking-wide ${estilos[estado]}`}
    >
      {ESTADO_LABEL[estado]}
    </span>
  );
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-2" aria-busy>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-lux border border-line bg-surface"
        />
      ))}
      <p className="sr-only">Cargando el stock…</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function AvisoSinConfigurar() {
  return (
    <div className="mt-8 rounded-lux border border-warn/40 bg-surface-2 p-5">
      <p className="text-sm font-medium text-warn">
        Sin base de datos conectada
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        El portal funciona, pero no hay stock que mostrar ni dónde guardarlo.
        Faltan las variables de Supabase: se configuran en Vercel → Project
        Settings → Environment Variables (o en{" "}
        <code className="font-mono">.env.local</code>) y están documentadas en{" "}
        <code className="font-mono">.env.example</code>.
      </p>
    </div>
  );
}

function AvisoSinSesion() {
  return (
    <div className="mt-8 rounded-lux border border-line-strong bg-surface-2 p-5">
      <p className="text-sm font-medium text-ink">Inicia sesión para ver el stock</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        El inventario incluye precios de compra y notas internas, así que se lee
        con la sesión del equipo.{" "}
        <Link
          href="/portal/login"
          className="text-silver underline underline-offset-4"
        >
          Entrar al portal
        </Link>
        .
      </p>
    </div>
  );
}

function EstadoVacio({
  hayFiltro,
  puedeConsultar,
}: {
  hayFiltro: boolean;
  puedeConsultar: boolean;
}) {
  if (!puedeConsultar) {
    return (
      <div className="rounded-lux border border-dashed border-line p-10 text-center">
        <p className="text-sm text-ink-2">
          No hay stock que mostrar todavía.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-3">
          El formulario de alta funciona igual: puedes recorrerlo y decodificar
          un VIN contra NHTSA para ver exactamente qué se guardaría.
        </p>
        <Link
          href="/portal/vehiculos/nuevo"
          className="mt-6 inline-flex min-h-11 items-center rounded-full border border-line-strong px-6 text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:border-silver"
        >
          Abrir el formulario
        </Link>
      </div>
    );
  }

  if (hayFiltro) {
    return (
      <div className="rounded-lux border border-dashed border-line p-10 text-center">
        <p className="text-sm text-ink-2">
          Ningún vehículo coincide con este filtro.
        </p>
        <Link
          href="/portal/vehiculos"
          className="mt-4 inline-block text-sm text-silver underline-offset-4 hover:underline"
        >
          Ver todo el stock
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lux border border-dashed border-line p-10 text-center">
      <p className="text-sm text-ink">Todavía no hay ningún vehículo cargado.</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-3">
        Pega el VIN, deja que NHTSA complete la ficha técnica y agrega
        kilometraje, precio y ubicación. Son unos cuatro minutos por auto.
      </p>
      <Link
        href="/portal/vehiculos/nuevo"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-silver px-6 text-xs uppercase tracking-[0.16em] text-void transition-colors hover:bg-silver-bright"
      >
        Cargar el primero
      </Link>
    </div>
  );
}

/**
 * Nota de procedencia, visible en el portal a propósito.
 *
 * La restricción no puede vivir solo en un comentario del código: quien opere
 * el portal tiene que saber por qué carga los autos a mano, o en seis meses
 * alguien va a "resolver" el trabajo manual con un scraper.
 */
function NotaProcedencia() {
  return (
    <details className="mt-12 rounded-lux border border-line bg-surface p-5">
      <summary className="cursor-pointer text-sm text-ink-2 marker:text-ink-4">
        De dónde sale este stock (y por qué no se importa solo)
      </summary>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-3">
        <p>
          Cada ficha nace de una de tres vías:{" "}
          <strong className="text-ink-2">carga manual</strong> en este portal, con
          autocompletado por VIN contra{" "}
          <strong className="text-ink-2">NHTSA vPIC</strong> (API del gobierno de
          EE.UU., gratuita y sin llave), o un{" "}
          <strong className="text-ink-2">feed XML de un dealer partner</strong> con
          licencia firmada.
        </p>
        <p>
          Está prohibido guardar en esta base inventario de MarketCheck, Auto.dev,
          eBay, Autotrader, CarGurus, Cars.com, TrueCar, AutoTempest o Facebook
          Marketplace. Sus contratos prohíben textualmente{" "}
          <span className="italic">cache, store, index or otherwise persist</span>,
          prohíben crear bases derivadas y varios obligan a borrar cualquier copia
          en seis horas. Un solo registro guardado es incumplimiento de contrato,
          con revocación de la llave de API.
        </p>
        <p>
          Por eso el alta es manual y por eso la columna{" "}
          <code className="font-mono text-ink-2">fuente</code> es una lista blanca
          en la propia base de datos. Los cuatro minutos por auto no son una
          carencia del sistema: son el precio de operar dentro de la ley.
        </p>
      </div>
    </details>
  );
}
