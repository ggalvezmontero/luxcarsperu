"use client";
/**
 * Carga la ficha con la sesión del equipo y la entrega al MISMO formulario del
 * alta (`VehiculoForm`) en modo edición. Sin sesión no hay nada que mostrar:
 * la ficha completa incluye el precio de compra, que es margen del negocio.
 */
import { useEffect, useState } from "react";
import Link from "next/link";

import { usePortalSession } from "@/components/portal/portalSession";
import { VehiculoForm } from "../../nuevo/VehiculoForm";
import { leerFichaVehiculo, type FichaEditable } from "../../consultas";

type Carga =
  | { fase: "cargando" }
  | { fase: "lista"; ficha: FichaEditable }
  | { fase: "error"; mensaje: string };

export function EditarVehiculo({ id, anioActual }: { id: string; anioActual: number }) {
  const { status: sesion, client } = usePortalSession();
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });

  useEffect(() => {
    if (sesion !== "autenticado" || !client) return;
    let cancelado = false;
    leerFichaVehiculo(client, id).then((resultado) => {
      if (cancelado) return;
      setCarga(
        resultado.ok
          ? { fase: "lista", ficha: resultado.ficha }
          : { fase: "error", mensaje: resultado.mensaje },
      );
    });
    return () => {
      cancelado = true;
    };
  }, [sesion, client, id]);

  if (sesion === "verificando" || (sesion === "autenticado" && carga.fase === "cargando")) {
    return <p className="mt-10 text-sm text-ink-3">Cargando la ficha…</p>;
  }

  if (sesion !== "autenticado") {
    return (
      <div className="mt-10 rounded-lux-lg border border-line-strong bg-surface p-8">
        <p className="text-sm leading-relaxed text-ink-2">
          Para editar un vehículo hace falta una sesión del equipo.
        </p>
        <Link
          href={`/portal/login?next=/portal/vehiculos/${id}/editar`}
          className="mt-5 inline-flex min-h-12 items-center rounded-full bg-silver px-7 text-xs uppercase tracking-[0.16em] text-void transition-colors hover:bg-silver-bright"
        >
          Iniciar sesión
        </Link>
      </div>
    );
  }

  if (carga.fase === "error") {
    return (
      <div className="mt-10 rounded-lux-lg border border-line-strong bg-surface p-8">
        <p className="text-sm leading-relaxed text-ink-2">{carga.mensaje}</p>
        <Link
          href="/portal/vehiculos"
          className="mt-5 inline-flex min-h-12 items-center rounded-full border border-line-strong px-7 text-xs uppercase tracking-[0.16em] text-ink transition-colors hover:border-silver"
        >
          Ver el stock
        </Link>
      </div>
    );
  }

  if (carga.fase !== "lista") {
    return <p className="mt-10 text-sm text-ink-3">Cargando la ficha…</p>;
  }

  const { ficha } = carga;
  return (
    <>
      <header className="mt-6 border-b border-line pb-8">
        <h1 className="text-3xl font-light tracking-wide text-ink sm:text-4xl">{ficha.titulo}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">
          Corrige lo que haga falta y guarda. Si el auto está publicado, la web se actualiza
          en unos segundos. Las fotos se gestionan{" "}
          <Link
            href={`/portal/vehiculos/${ficha.id}/fotos`}
            className="font-medium text-ink underline underline-offset-4"
          >
            aparte
          </Link>
          .
        </p>
      </header>

      {/* `key` por id: si se navega de una ficha a otra, el formulario se
          vuelve a montar con los valores nuevos en vez de conservar los viejos. */}
      <VehiculoForm key={ficha.id} anioActual={anioActual} edicion={ficha} />
    </>
  );
}
