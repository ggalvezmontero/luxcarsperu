import type { Metadata } from "next";

import { GuiaFotografia } from "@/components/portal/GuiaFotografia";
import { SubidorFotos } from "@/components/portal/SubidorFotos";

/**
 * Carga de fotos de un vehículo del stock.
 *
 * LA PÁGINA NO LEE LA BASE DE DATOS. Es deliberado: el portal todavía no tiene
 * sesiones, así que si el servidor renderizara acá la ficha (incluido stock sin
 * publicar), esa información viajaría a cualquiera que abriera la URL. En su
 * lugar, el marco es estático y TODO lo que es dato del negocio lo pide el
 * cliente a `/api/portal/...`, que sí verifica la llave. Un solo punto de
 * control en vez de dos que se desincronizan.
 *
 * ORDEN DE LA PANTALLA, y no es casual: primero el subidor, después la guía. El
 * que ya sabe fotografiar no tiene que hacer scroll para trabajar; el que no,
 * se encuentra la guía completa apenas baja, sin buscar un enlace.
 */

export const metadata: Metadata = {
  title: "Fotos del vehículo",
  robots: { index: false, follow: false },
};

export default async function FotosVehiculoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-10">
      {/* Migas de pan sin enlace a propósito: el índice del portal lo está
          armando otro agente y un enlace a una ruta inexistente sería un 404
          para el equipo. Cuando exista `/portal`, convertir "Portal" en Link. */}
      <p className="text-xs uppercase tracking-[0.28em] text-ink-4">
        Portal
        <span aria-hidden="true" className="px-2">
          /
        </span>
        <span className="text-ink-3">Fotos del vehículo</span>
      </p>

      <SubidorFotos vehiculoId={id} />

      <GuiaFotografia />

      <footer className="border-t border-line pt-6 text-xs leading-relaxed text-ink-4">
        Las fotos se comprimen en tu teléfono antes de subir y se guardan en el
        bucket <code>vehiculos</code> de Supabase Storage. Solo fotos propias o
        del fabricante con derecho de uso.
      </footer>
    </div>
  );
}
