import type { Metadata } from "next";
import { VehiculosPanel } from "./VehiculosPanel";
import type { VehicleStatus } from "@/lib/db/types";

/**
 * Stock de vehículos del portal.
 *
 * La página es deliberadamente delgada: lee los filtros de la URL y nada más.
 * NO consulta la base de datos. El listado muestra precio de compra y notas
 * internas, y un componente de servidor tendría que leerlos con `service_role`
 * —que salta RLS—, de modo que el HTML con el margen del negocio viajaría a
 * cualquiera que abriera la URL, sin ejecutar JavaScript. La consulta vive en
 * `VehiculosPanel`, en el navegador, con la sesión del equipo. El razonamiento
 * completo está en el encabezado de `src/app/portal/layout.tsx`.
 *
 * Los filtros se leen acá y no en el cliente para que la URL sea la fuente de
 * verdad: un filtro se puede compartir por WhatsApp, recargar y deshacer con el
 * botón atrás.
 *
 * El `<main>` y el ancho los pone `PortalShell` desde el layout del portal.
 */

export const metadata: Metadata = {
  title: "Stock de vehículos",
  robots: { index: false, follow: false },
};

const ESTADOS_VALIDOS: readonly VehicleStatus[] = [
  "disponible",
  "reservado",
  "en_transito",
  "vendido",
];

function primerValor(valor: string | string[] | undefined): string {
  if (Array.isArray(valor)) return valor[0] ?? "";
  return valor ?? "";
}

export default async function VehiculosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // Se recorta la búsqueda: el filtro viaja a un `ilike` y no hay ninguna
  // consulta legítima de 500 caracteres.
  const busqueda = primerValor(params.q).slice(0, 80);

  const estadoParam = primerValor(params.estado);
  const estado = (ESTADOS_VALIDOS as readonly string[]).includes(estadoParam)
    ? (estadoParam as VehicleStatus)
    : "todos";

  const publicadoParam = primerValor(params.publicado);
  const publicado: "todos" | "si" | "no" =
    publicadoParam === "si" || publicadoParam === "no"
      ? publicadoParam
      : "todos";

  return (
    <VehiculosPanel
      busqueda={busqueda}
      estado={estado}
      publicado={publicado}
    />
  );
}
