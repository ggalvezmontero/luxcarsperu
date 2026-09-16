"use client";

/**
 * Barra de filtros del stock.
 *
 * Los filtros viven en la URL, no en el estado del componente. Eso permite
 * compartir "todos los reservados sin publicar" por WhatsApp con el equipo,
 * volver atrás con el botón del navegador y recargar sin perder el filtro. La
 * página es un Server Component que vuelve a consultar con esos parámetros.
 *
 * `useSearchParams` se evita a propósito (obligaría a envolver la página en un
 * Suspense): los valores actuales llegan por props desde el servidor, que ya
 * los leyó.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ESTADO_LABEL, ESTADO_OPCIONES } from "./etiquetas";
import type { VehicleStatus } from "@/lib/db/types";

type Props = {
  busqueda: string;
  estado: VehicleStatus | "todos";
  publicado: "todos" | "si" | "no";
  conteo: Record<VehicleStatus, number> & { total: number };
};

const RUTA = "/portal/vehiculos";

/** Tiempo que se espera tras la última tecla antes de consultar. */
const DEBOUNCE_MS = 300;

const control =
  "h-11 rounded-lux border border-line bg-surface-2 px-3 text-sm text-ink " +
  "transition-colors hover:border-line-strong focus:border-silver";

export function VehiculosFiltros({ busqueda, estado, publicado, conteo }: Props) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [texto, setTexto] = useState(busqueda);
  // Evita disparar una navegación en el primer render y en cada vuelta del
  // servidor: solo se navega cuando el usuario escribe de verdad.
  const ultimoAplicado = useRef(busqueda);

  function navegar(cambios: Record<string, string>) {
    const params = new URLSearchParams();
    const siguiente = {
      q: texto,
      estado,
      publicado,
      ...cambios,
    };
    if (siguiente.q.trim()) params.set("q", siguiente.q.trim());
    if (siguiente.estado !== "todos") params.set("estado", siguiente.estado);
    if (siguiente.publicado !== "todos")
      params.set("publicado", siguiente.publicado);

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${RUTA}?${query}` : RUTA, { scroll: false });
    });
  }

  useEffect(() => {
    if (texto === ultimoAplicado.current) return;
    const id = setTimeout(() => {
      ultimoAplicado.current = texto;
      navegar({ q: texto });
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
    // `navegar` se recrea en cada render; depender de él reiniciaría el timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const hayFiltro =
    texto.trim() !== "" || estado !== "todos" || publicado !== "todos";

  return (
    <div className="flex flex-col gap-4">
      {/* Atajos por estado, con el conteo real del stock completo. */}
      <div className="flex flex-wrap gap-2">
        <FiltroEstado
          activo={estado === "todos"}
          etiqueta="Todos"
          cantidad={conteo.total}
          onClick={() => navegar({ estado: "todos" })}
        />
        {ESTADO_OPCIONES.map((opcion) => (
          <FiltroEstado
            key={opcion}
            activo={estado === opcion}
            etiqueta={ESTADO_LABEL[opcion]}
            cantidad={conteo[opcion]}
            onClick={() => navegar({ estado: opcion })}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="busqueda-stock" className="sr-only">
            Buscar en el stock
          </label>
          <input
            id="busqueda-stock"
            type="search"
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Marca, modelo, VIN, placa o ubicación"
            className={`${control} w-full pr-24`}
            autoComplete="off"
          />
          {pendiente ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs uppercase tracking-[0.16em] text-ink-4">
              Buscando
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="filtro-publicado"
            className="text-xs uppercase tracking-[0.16em] text-ink-3"
          >
            Web
          </label>
          <select
            id="filtro-publicado"
            value={publicado}
            onChange={(event) => navegar({ publicado: event.target.value })}
            className={control}
          >
            <option value="todos">Publicados y borradores</option>
            <option value="si">Solo publicados</option>
            <option value="no">Solo borradores</option>
          </select>
        </div>

        {hayFiltro ? (
          <button
            type="button"
            onClick={() => {
              setTexto("");
              ultimoAplicado.current = "";
              startTransition(() => router.replace(RUTA, { scroll: false }));
            }}
            className="h-11 rounded-lux px-3 text-sm text-ink-3 transition-colors hover:text-ink"
          >
            Limpiar
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FiltroEstado({
  activo,
  etiqueta,
  cantidad,
  onClick,
}: {
  activo: boolean;
  etiqueta: string;
  cantidad: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs uppercase tracking-[0.14em] transition-colors",
        activo
          ? "border-silver bg-silver text-void"
          : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
      ].join(" ")}
    >
      {etiqueta}
      <span
        className={
          activo ? "text-void/70" : "text-ink-4 tabular-nums"
        }
      >
        {cantidad}
      </span>
    </button>
  );
}
