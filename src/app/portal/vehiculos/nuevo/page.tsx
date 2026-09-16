import type { Metadata } from "next";
import Link from "next/link";
import { VehiculoForm } from "./VehiculoForm";

/**
 * Alta de vehículo.
 *
 * Esta pantalla es la pieza central del negocio: es la vía LEGAL para llenar el
 * catálogo. El inventario de MarketCheck, Auto.dev, eBay, Autotrader, CarGurus,
 * Cars.com, TrueCar, AutoTempest y Facebook Marketplace no se puede guardar en
 * base de datos — sus contratos prohíben textualmente persistirlo y varios
 * obligan a borrar cualquier copia en seis horas. Así que el catálogo se carga
 * a mano, y lo que hace eso sostenible es el VIN: NHTSA vPIC completa la ficha
 * técnica sola y quedan unos cuatro minutos de trabajo por auto.
 *
 * LA PÁGINA NO LEE NI ESCRIBE EN LA BASE. Es un marco estático; todo el trabajo
 * con datos ocurre en el navegador, con la sesión del equipo, para no renderizar
 * información reservada en el servidor con `service_role` (ver el encabezado de
 * `src/app/portal/layout.tsx`).
 *
 * El `<main>` y el ancho los pone `PortalShell` desde el layout del portal:
 * aquí solo va el contenido.
 */

export const metadata: Metadata = {
  title: "Cargar vehículo",
  robots: { index: false, follow: false },
};

export default function NuevoVehiculoPage() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <nav className="text-xs uppercase tracking-[0.18em] text-ink-4">
        <Link
          href="/portal/vehiculos"
          className="transition-colors hover:text-ink-2"
        >
          Stock
        </Link>
        <span className="mx-2" aria-hidden>
          /
        </span>
        <span className="text-ink-3">Nuevo</span>
      </nav>

      <header className="mt-6 border-b border-line pb-8">
        <h1 className="text-3xl font-light tracking-wide text-ink sm:text-4xl">
          Cargar vehículo
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">
          Pega el VIN y deja que NHTSA complete la ficha técnica. Tú pones lo que
          ninguna API sabe: el kilometraje real, los precios, dónde está el auto
          y qué hay que contarle al cliente.
        </p>
      </header>

      {/*
        El año se calcula en el servidor y baja como prop para que el aviso de
        antigüedad no dependa del reloj del navegador del usuario, que puede
        estar mal puesto.
      */}
      <VehiculoForm anioActual={new Date().getFullYear()} />
    </div>
  );
}
