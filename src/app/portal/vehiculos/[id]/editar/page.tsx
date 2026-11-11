import type { Metadata } from "next";
import Link from "next/link";

import { EditarVehiculo } from "./EditarVehiculo";

/**
 * Edición de la ficha de un vehículo ya cargado.
 *
 * Igual que el alta y las fotos, LA PÁGINA NO LEE NI ESCRIBE EN LA BASE: es un
 * marco estático y la ficha la pide el navegador con la sesión del equipo
 * (RLS). Así una URL con el id de un auto sin publicar no revela nada a quien
 * no tenga sesión de administrador.
 */

export const metadata: Metadata = {
  title: "Editar vehículo",
  robots: { index: false, follow: false },
};

export default async function EditarVehiculoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <nav className="text-xs uppercase tracking-[0.18em] text-ink-4">
        <Link href="/portal/vehiculos" className="transition-colors hover:text-ink-2">
          Stock
        </Link>
        <span className="mx-2" aria-hidden>
          /
        </span>
        <span className="text-ink-3">Editar</span>
      </nav>

      <EditarVehiculo id={id} anioActual={new Date().getFullYear()} />
    </div>
  );
}
