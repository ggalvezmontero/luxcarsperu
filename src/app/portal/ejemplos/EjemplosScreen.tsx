"use client";

/**
 * /portal/ejemplos — los "ejemplos de importación a pedido" de la web.
 *
 * Son los autos de referencia que salen en la home (los tres primeros
 * visibles) y en /importar (todos), cada uno con su enlace a la calculadora.
 * Antes vivían en un JSON del repositorio; ahora el dueño los edita, agrega,
 * ordena, oculta y borra desde acá sin desplegar.
 *
 * DOS COSAS QUE ESTA PANTALLA CUIDA A PROPÓSITO:
 *
 *   · Después de cada escritura se avisa a la web (`revalidarWeb`). Si ese
 *     aviso falla, lo guardado sigue guardado y se dice así: reportarlo como
 *     error haría que el dueño repita un cambio que ya está hecho.
 *
 *   · Con menos de `MIN_EXAMPLES` ejemplos válidos y visibles, la web vuelve a
 *     la lista de respaldo del repositorio. Para el dueño eso parecería que sus
 *     cambios se ignoran, así que no se deja ocultar ni borrar el que bajaría
 *     de ese mínimo, y se explica por qué.
 *
 * Lee y escribe desde el navegador con la sesión del administrador. Ver
 * `queries.ts`.
 */

import {
  Badge,
  EmptyState,
  Notice,
  PortalPageHeader,
  PortalPanel,
  StatCard,
  StatGrid,
  TableScroll,
  Td,
  Th,
  type NoticeTone,
} from "@/components/portal/CrmUI";
import { usePortalSession } from "@/components/portal/portalSession";
import { Button } from "@/components/Button";
import type { TrendingVehicle } from "@/data/trendingVehicles";
import { MIN_EXAMPLES } from "@/lib/importExamples/validacion";
import { quitarFotoEjemplo, rutaDeFotoEjemplo } from "@/lib/portal/ejemploFotos";
import { cn, formatCurrency } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EjemploForm } from "./EjemploForm";
import {
  PASO_ORDEN,
  cambiarVisibilidad,
  crearEjemplo,
  eliminarEjemplo,
  fetchEjemplos,
  fotoEnUso,
  guardarEjemplo,
  guardarOrden,
  revalidarWeb,
  type Ejemplo,
  type EjemploMutationResult,
} from "./queries";

/** Cuántos muestra la home. */
const EN_PORTADA = 3;

const SETUP_STEPS = [
  "Aplica la migración 20261106100000_ejemplos_importacion.sql con psql (ver db/README.md).",
  "Entra con una cuenta de administrador.",
];

const AVISO_WEB_PENDIENTE = "Guardado, pero la web no se pudo actualizar ahora; se actualizará sola más tarde.";

type Flash = { tone: NoticeTone; label: string; text: string };
type Formulario = { modo: "crear" } | { modo: "editar"; ejemplo: Ejemplo };

function nombreDe(e: Ejemplo): string {
  const crudo = typeof e.datos.name === "string" ? e.datos.name.trim() : "";
  return e.vehiculo?.name ?? (crudo || e.id);
}

function precio(e: Ejemplo): string {
  const min = e.vehiculo?.priceMinUsd ?? (typeof e.datos.priceMinUsd === "number" ? e.datos.priceMinUsd : null);
  const max = e.vehiculo?.priceMaxUsd ?? (typeof e.datos.priceMaxUsd === "number" ? e.datos.priceMaxUsd : null);
  if (min === null && max === null) return "—";
  if (min === null || max === null || min === max) return formatCurrency((min ?? max) as number, "en-US");
  return `${formatCurrency(min, "en-US")} – ${formatCurrency(max, "en-US")}`;
}

export function EjemplosScreen() {
  const { status: sessionStatus, client } = usePortalSession();
  const [ejemplos, setEjemplos] = useState<Ejemplo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  /** Hay una escritura en curso: las acciones de las filas esperan. */
  const [ocupado, setOcupado] = useState(false);
  const [formulario, setFormulario] = useState<Formulario | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState<string | null>(null);

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setEjemplos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = await fetchEjemplos(client);
    setEjemplos(r.ejemplos);
    setError(r.error);
    setLoading(false);
  }, [client, canQuery]);

  useEffect(() => {
    if (sessionStatus === "verificando") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load, sessionStatus]);

  // La web descarta las filas que no pasan `validarEjemplo`: solo cuentan las
  // válidas y visibles, igual para el mínimo que para la portada.
  const visibles = useMemo(() => ejemplos.filter((e) => e.activo && e.vehiculo), [ejemplos]);
  const portada = useMemo(() => new Set(visibles.slice(0, EN_PORTADA).map((e) => e.id)), [visibles]);
  const ocultos = useMemo(() => ejemplos.filter((e) => !e.activo).length, [ejemplos]);
  const conProblemas = useMemo(() => ejemplos.filter((e) => !e.vehiculo).length, [ejemplos]);
  const usaRespaldo = canQuery && !loading && !error && visibles.length < MIN_EXAMPLES;

  /**
   * Cierre común de toda escritura: si salió bien, avisa a la web; siempre
   * recarga la lista (sin desmontarla, para que el aviso no se pierda).
   */
  const despuesDeEscribir = useCallback(
    async (r: EjemploMutationResult) => {
      if (!r.ok) {
        setFlash({ tone: "danger", label: "No se pudo", text: r.message });
      } else {
        const web = await revalidarWeb();
        setFlash(
          web.ok
            ? { tone: "info", label: "Listo", text: `${r.message} La web se actualiza en unos segundos.` }
            : { tone: "warn", label: "Guardado", text: `${r.message} ${AVISO_WEB_PENDIENTE}` },
        );
      }
      await load();
    },
    [load],
  );

  /** Mensaje si ocultar o borrar `e` dejaría la web por debajo del mínimo. */
  function bloqueoPorMinimo(e: Ejemplo, accion: "ocultar" | "eliminar"): string | null {
    if (!e.activo || !e.vehiculo) return null; // no cuenta para el mínimo
    const quedarian = visibles.length - 1;
    if (quedarian >= MIN_EXAMPLES) return null;
    return `No se puede ${accion} "${nombreDe(e)}": quedarían ${quedarian} ejemplo${quedarian === 1 ? "" : "s"} visible${quedarian === 1 ? "" : "s"} y la web necesita al menos ${MIN_EXAMPLES}. Con menos, la web vuelve a mostrar la lista de respaldo y parecería que tus cambios no se guardaron. Muestra o agrega otro ejemplo primero.`;
  }

  async function alternarVisibilidad(e: Ejemplo) {
    if (!client) return;
    if (e.activo) {
      const bloqueo = bloqueoPorMinimo(e, "ocultar");
      if (bloqueo) {
        setFlash({ tone: "warn", label: "No se ocultó", text: bloqueo });
        return;
      }
    }
    setOcupado(true);
    const r = await cambiarVisibilidad(client, { id: e.id, activo: !e.activo, nombre: nombreDe(e) });
    await despuesDeEscribir(r);
    setOcupado(false);
  }

  async function mover(indice: number, delta: -1 | 1) {
    if (!client) return;
    const destino = indice + delta;
    if (destino < 0 || destino >= ejemplos.length) return;
    const ordenActual = Object.fromEntries(ejemplos.map((e) => [e.id, e.orden]));
    const nueva = [...ejemplos];
    [nueva[indice], nueva[destino]] = [nueva[destino], nueva[indice]];
    // Se ve movido enseguida; la recarga confirma contra la base.
    setEjemplos(nueva.map((e, i) => ({ ...e, orden: (i + 1) * PASO_ORDEN })));
    setOcupado(true);
    const r = await guardarOrden(client, { ids: nueva.map((e) => e.id), ordenActual });
    await despuesDeEscribir(r);
    setOcupado(false);
  }

  function pedirBorrado(e: Ejemplo) {
    const bloqueo = bloqueoPorMinimo(e, "eliminar");
    if (bloqueo) {
      setFlash({ tone: "warn", label: "No se eliminó", text: bloqueo });
      return;
    }
    setConfirmarBorrado(e.id);
  }

  async function borrar(e: Ejemplo) {
    if (!client) return;
    setOcupado(true);
    const r = await eliminarEjemplo(client, { id: e.id, nombre: nombreDe(e) });
    setConfirmarBorrado(null);
    if (r.ok) {
      // La foto subida desde el portal se queda sin dueño: se borra si ningún
      // otro ejemplo la usa. Las rutas `/images/…` del repositorio no se tocan.
      const src = typeof e.datos.imageSrc === "string" ? e.datos.imageSrc : null;
      const ruta = rutaDeFotoEjemplo(src);
      if (src && ruta && !(await fotoEnUso(client, src))) await quitarFotoEjemplo(ruta);
    }
    await despuesDeEscribir(r);
    setOcupado(false);
  }

  async function guardarFormulario(vehiculo: TrendingVehicle): Promise<EjemploMutationResult> {
    if (!client || !formulario) {
      return { ok: false, message: "No hay sesión del portal: el cambio no se guardó." };
    }
    if (formulario.modo === "crear") {
      const ultimo = ejemplos.reduce((max, e) => Math.max(max, e.orden), 0);
      return crearEjemplo(client, { vehiculo, orden: ultimo + PASO_ORDEN });
    }
    return guardarEjemplo(client, { id: formulario.ejemplo.id, vehiculo });
  }

  function abrirFormulario(f: Formulario) {
    setConfirmarBorrado(null);
    setFlash(null);
    setFormulario(f);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  const accionesBloqueadas = ocupado || formulario !== null || !client;

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Ejemplos de importación"
        title="Autos de referencia de la web"
        description="Los modelos con precio de referencia que salen en la home (los tres primeros visibles) y en /importar (todos), cada uno con su enlace a la calculadora. Los cambios se publican sin desplegar."
        actions={
          <Button
            size="sm"
            disabled={!canQuery || formulario !== null}
            onClick={() => abrirFormulario({ modo: "crear" })}
          >
            Nuevo ejemplo
          </Button>
        }
      />

      <StatGrid>
        <StatCard label="Visibles en la web" value={visibles.length} tone="accent" hint={`Mínimo ${MIN_EXAMPLES} para que se use esta lista.`} />
        <StatCard label="En la portada" value={Math.min(EN_PORTADA, visibles.length)} hint="Los tres primeros visibles." />
        <StatCard label="Ocultos" value={ocultos} />
        <StatCard label="Con datos incompletos" value={conProblemas} tone={conProblemas > 0 ? "warn" : "default"} hint="La web no los muestra." />
      </StatGrid>

      {usaRespaldo ? (
        <Notice tone="warn" label="La web está usando la lista de respaldo">
          Hay {visibles.length} ejemplo{visibles.length === 1 ? "" : "s"} válido{visibles.length === 1 ? "" : "s"} y visible
          {visibles.length === 1 ? "" : "s"}; con menos de {MIN_EXAMPLES}, la home y /importar muestran la lista guardada
          en el repositorio y no esta. Muestra o agrega ejemplos hasta llegar a {MIN_EXAMPLES}.
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="warn" label="No se pudo leer">
          {error}
        </Notice>
      ) : null}
      {flash ? (
        <Notice tone={flash.tone} label={flash.label}>
          {flash.text}
        </Notice>
      ) : null}

      {formulario && client ? (
        <EjemploForm
          key={formulario.modo === "crear" ? "nuevo" : formulario.ejemplo.id}
          client={client}
          inicial={formulario.modo === "crear" ? null : formulario.ejemplo}
          idsExistentes={ejemplos.map((e) => e.id)}
          guardar={guardarFormulario}
          onGuardado={(r) => {
            setFormulario(null);
            void despuesDeEscribir(r);
          }}
          onCancelar={() => setFormulario(null)}
        />
      ) : null}

      <PortalPanel
        title="Ejemplos"
        description="En el orden en que se muestran. Ocultar no borra: el ejemplo se conserva para volver a mostrarlo."
      >
        {/* Igual que en leads: el "Cargando…" solo reemplaza la tabla cuando
            todavía no hay nada que mostrar. La recarga que sigue a un cambio
            deja la tabla MONTADA y el aviso de arriba a la vista. */}
        {loading && ejemplos.length === 0 ? (
          <p className="px-5 py-10 text-sm text-ink-3" role="status">
            Cargando…
          </p>
        ) : ejemplos.length === 0 ? (
          <EmptyState
            title="Todavía no hay ejemplos"
            description={
              canQuery
                ? "Mientras no haya al menos tres, la web muestra la lista de respaldo del repositorio. Crea el primero con «Nuevo ejemplo»."
                : "Sin sesión o sin base de datos no hay nada que listar."
            }
            steps={canQuery ? undefined : SETUP_STEPS}
          />
        ) : (
          <div aria-busy={loading || ocupado} className={cn("transition-opacity", (loading || ocupado) && "opacity-70")}>
            <TableScroll>
              <table className="w-full min-w-[1000px] border-collapse">
                <thead className="border-b border-line">
                  <tr>
                    <Th>#</Th>
                    <Th>Foto</Th>
                    <Th>Ejemplo</Th>
                    <Th align="right">Precio EE.UU.</Th>
                    <Th>En la web</Th>
                    <Th>Acciones</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ejemplos.map((e, i) => {
                    const src = typeof e.datos.imageSrc === "string" && e.datos.imageSrc.trim() ? e.datos.imageSrc : null;
                    const segmento = typeof e.datos.segment === "string" ? e.datos.segment : "";
                    return (
                      <tr key={e.id} className={cn("align-top", !e.activo && "opacity-60")}>
                        <Td>
                          <span className="font-mono text-xs text-silver">{String(i + 1).padStart(2, "0")}</span>
                        </Td>
                        <Td>
                          <div className="flex h-12 w-16 items-center justify-center overflow-hidden rounded-sm border border-line bg-surface-2">
                            {src ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={src} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[10px] uppercase tracking-[0.12em] text-ink-4">Sin foto</span>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <p className="font-medium text-ink">{nombreDe(e)}</p>
                          {segmento ? <p className="mt-1 text-xs text-ink-3">{segmento}</p> : null}
                          <p className="mt-1 font-mono text-[11px] text-ink-4">{e.id}</p>
                        </Td>
                        <Td align="right">
                          <span className="font-semibold tabular-nums text-ink">{precio(e)}</span>
                        </Td>
                        <Td>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge tone={e.activo ? "ok" : "neutral"}>{e.activo ? "Visible" : "Oculto"}</Badge>
                            {portada.has(e.id) ? <Badge tone="silver">En la portada</Badge> : null}
                            {e.vehiculo && e.vehiculo.calculator === null ? <Badge tone="info">Sin simulación</Badge> : null}
                            {!e.vehiculo ? <Badge tone="danger">No se muestra</Badge> : null}
                          </div>
                          {e.problema ? (
                            <p className="mt-2 max-w-xs text-xs text-danger">Datos incompletos: {e.problema} Edítalo para corregirlo.</p>
                          ) : null}
                        </Td>
                        <Td>
                          {confirmarBorrado === e.id ? (
                            <div className="flex w-64 flex-col gap-2">
                              <p className="text-xs leading-relaxed text-ink-2">
                                ¿Eliminar «{nombreDe(e)}» para siempre? Su enlace a la calculadora deja de funcionar. Si
                                solo quieres sacarlo de la web, usa Ocultar.
                              </p>
                              <div className="flex gap-2">
                                <Button size="sm" disabled={ocupado} onClick={() => void borrar(e)}>
                                  {ocupado ? "…" : "Sí, eliminar"}
                                </Button>
                                <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setConfirmarBorrado(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex max-w-xs flex-wrap gap-2">
                              <Button size="sm" variant="secondary" disabled={accionesBloqueadas} onClick={() => abrirFormulario({ modo: "editar", ejemplo: e })}>
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="border border-line"
                                disabled={accionesBloqueadas || i === 0}
                                aria-label={`Subir ${nombreDe(e)}`}
                                onClick={() => void mover(i, -1)}
                              >
                                Subir
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="border border-line"
                                disabled={accionesBloqueadas || i === ejemplos.length - 1}
                                aria-label={`Bajar ${nombreDe(e)}`}
                                onClick={() => void mover(i, 1)}
                              >
                                Bajar
                              </Button>
                              <Button size="sm" variant="ghost" className="border border-line" disabled={accionesBloqueadas} onClick={() => void alternarVisibilidad(e)}>
                                {e.activo ? "Ocultar" : "Mostrar"}
                              </Button>
                              <Button size="sm" variant="ghost" className="border border-line text-danger" disabled={accionesBloqueadas} onClick={() => pedirBorrado(e)}>
                                Eliminar
                              </Button>
                            </div>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableScroll>
          </div>
        )}
      </PortalPanel>

      <Notice tone="info" label="Reglas de los ejemplos">
        Son modelos de referencia escritos a mano por el equipo, nunca inventario copiado de MarketCheck, eBay, Autotrader,
        CarGurus, Cars.com, TrueCar, AutoTempest ni Facebook Marketplace. La simulación solo se ofrece para autos que se
        consiguen en dealers de EE.UU., y las fotos tienen que ser propias o con licencia.
      </Notice>
    </div>
  );
}
