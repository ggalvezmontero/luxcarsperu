"use client";

/**
 * Acciones rápidas sobre un vehículo del listado: publicar / despublicar,
 * cambiar estado y cambiar precio.
 *
 * NO ES UN FORMULARIO DE EDICIÓN COMPLETO, y a propósito: lo que faltaba era
 * poder mover un auto por su ciclo de vida (borrador → publicado → reservado →
 * vendido) y corregirle el precio. Cada botón es una mutación acotada de
 * `consultas.ts`.
 *
 * Publicar exige precio y URL (`vehicles_publicado_exige_precio` y
 * `vehicles_publicado_exige_slug`). Si a la ficha le falta alguno, se piden
 * ACÁ, en la misma fila, antes de mandar nada: es mejor que dejar que la base
 * rechace el cambio con un CHECK en inglés.
 *
 * La confirmación ("Estado actualizado.") vive en el estado local de este
 * componente. La fila se actualiza en el lugar (no se recarga el listado), así
 * que el mensaje no se pierde.
 */

import { useState } from "react";
import type { PortalClient } from "@/lib/portal/portalClient";
import type { Currency, VehicleStatus } from "@/lib/db/types";
import {
  cambiarEstadoVehiculo,
  cambiarPrecioVehiculo,
  despublicarVehiculo,
  publicarVehiculo,
  type AdminVehicle,
  type ResultadoCambio,
} from "./consultas";
import { ESTADO_LABEL, ESTADO_OPCIONES, MONEDA_OPCIONES } from "./etiquetas";
import { hoyEnLima } from "./fechas";
import { slugAutomatico } from "./nuevo/validacion";

type Modo = "nada" | "publicar" | "vendido" | "precio";

const BOTON =
  "rounded-full border border-line-strong px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink transition-colors hover:border-silver hover:bg-surface-2 disabled:opacity-45";
const BOTON_PRIMARIO =
  "rounded-full bg-silver px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-void transition-colors hover:bg-silver-bright disabled:opacity-45";
const BOTON_FANTASMA =
  "px-3 py-2 text-[11px] text-ink-3 underline-offset-4 hover:text-ink hover:underline";
const CAMPO =
  "w-full rounded-lux border border-line bg-surface-2 px-3 py-2 text-xs normal-case tracking-normal text-ink placeholder:text-ink-4";
const ROTULO = "block text-[11px] uppercase tracking-[0.14em] text-ink-4";

/**
 * Lee un precio escrito a mano. Como en el alta, "45,000" y "45 000" valen
 * 45000 (es como se pega desde un anuncio). `null` si no es un número.
 */
function leerPrecio(texto: string): number | null {
  const limpio = texto.replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

export function AccionesVehiculo({
  vehiculo,
  client,
  puedeEscribir,
  onActualizado,
}: {
  vehiculo: AdminVehicle;
  client: PortalClient | null;
  /** `false` sin sesión: se ven los datos, pero no se puede cambiar nada. */
  puedeEscribir: boolean;
  onActualizado: (vehiculo: AdminVehicle) => void;
}) {
  const [modo, setModo] = useState<Modo>("nada");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  // Datos que se piden en línea.
  const [precioTexto, setPrecioTexto] = useState("");
  const [moneda, setMoneda] = useState<Currency>(vehiculo.currency);
  const [slugTexto, setSlugTexto] = useState("");
  const [fechaVenta, setFechaVenta] = useState("");
  /** Campos que la base (o la validación) pidió además de los que ya faltaban. */
  const [pedir, setPedir] = useState<{ precio: boolean; slug: boolean }>({
    precio: false,
    slug: false,
  });

  const bloqueado = !puedeEscribir || !client || ocupado;
  const idBase = `veh-${vehiculo.id}`;

  async function ejecutar(
    accion: (cliente: PortalClient) => Promise<ResultadoCambio>,
    alFallar?: (resultado: Extract<ResultadoCambio, { ok: false }>) => void,
  ) {
    if (!client) {
      setAviso({
        ok: false,
        texto: "Sin sesión del equipo: el cambio no se guardó. Vuelve a iniciar sesión.",
      });
      return;
    }
    setOcupado(true);
    setAviso(null);
    const resultado = await accion(client);
    setOcupado(false);
    if (resultado.ok) {
      onActualizado(resultado.vehiculo);
      setModo("nada");
      setPedir({ precio: false, slug: false });
      setAviso({ ok: true, texto: resultado.mensaje });
      return;
    }
    setAviso({ ok: false, texto: resultado.mensaje });
    alFallar?.(resultado);
  }

  /* --- Publicar -------------------------------------------------------- */

  function abrirPublicar(extra: { precio?: boolean; slug?: boolean } = {}) {
    setPrecioTexto(vehiculo.price !== null ? String(vehiculo.price) : "");
    setMoneda(vehiculo.currency);
    setSlugTexto(
      vehiculo.slug ??
        slugAutomatico(
          vehiculo.title || [vehiculo.year, vehiculo.brand, vehiculo.model].join(" "),
          vehiculo.vin,
        ) ??
        "",
    );
    setPedir({ precio: Boolean(extra.precio), slug: Boolean(extra.slug) });
    setModo("publicar");
  }

  function alPulsarPublicar() {
    setAviso(null);
    // Si ya tiene precio y URL se publica directo; si falta algo, se pide.
    if (vehiculo.price !== null && vehiculo.slug !== null) {
      void ejecutar(
        (cliente) => publicarVehiculo(cliente, vehiculo),
        (fallo) => {
          if (fallo.campo === "precio" || fallo.campo === "slug") {
            abrirPublicar({ [fallo.campo]: true });
          }
        },
      );
      return;
    }
    abrirPublicar();
  }

  const pidePrecio = vehiculo.price === null || pedir.precio;
  const pideSlug = vehiculo.slug === null || pedir.slug;

  function confirmarPublicar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos: { precio?: number; moneda?: Currency; slug?: string } = {};
    if (pidePrecio) {
      const precio = leerPrecio(precioTexto);
      if (precio === null || precio <= 0) {
        setAviso({ ok: false, texto: "Escribe el precio de venta: un número mayor que cero." });
        return;
      }
      datos.precio = precio;
      datos.moneda = moneda;
    }
    if (pideSlug) {
      if (!slugTexto.trim()) {
        setAviso({ ok: false, texto: "Escribe la URL (slug) con la que se va a publicar." });
        return;
      }
      datos.slug = slugTexto;
    }
    void ejecutar(
      (cliente) => publicarVehiculo(cliente, vehiculo, datos),
      (fallo) => {
        if (fallo.campo === "precio" || fallo.campo === "slug") {
          setPedir((previo) => ({ ...previo, [fallo.campo as "precio" | "slug"]: true }));
        }
      },
    );
  }

  /* --- Estado ---------------------------------------------------------- */

  function alCambiarEstado(estado: VehicleStatus) {
    if (estado === vehiculo.status) return;
    setAviso(null);
    if (estado === "vendido") {
      // `vehicles_vendido_exige_fecha`: se pide la fecha, con hoy (Lima) por
      // defecto, antes de guardar.
      setFechaVenta(hoyEnLima());
      setModo("vendido");
      return;
    }
    void ejecutar((cliente) => cambiarEstadoVehiculo(cliente, vehiculo.id, estado));
  }

  function confirmarVendido(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaVenta)) {
      setAviso({ ok: false, texto: "Elige la fecha de venta." });
      return;
    }
    void ejecutar((cliente) =>
      cambiarEstadoVehiculo(cliente, vehiculo.id, "vendido", { vendidoEn: fechaVenta }),
    );
  }

  /* --- Precio ---------------------------------------------------------- */

  function abrirPrecio() {
    setAviso(null);
    setPrecioTexto(vehiculo.price !== null ? String(vehiculo.price) : "");
    setMoneda(vehiculo.currency);
    setModo("precio");
  }

  function confirmarPrecio(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const precio = leerPrecio(precioTexto);
    if (precio === null || precio <= 0) {
      setAviso({ ok: false, texto: "Escribe el precio de venta: un número mayor que cero." });
      return;
    }
    void ejecutar((cliente) => cambiarPrecioVehiculo(cliente, vehiculo.id, precio, moneda));
  }

  function cancelar() {
    setModo("nada");
    setPedir({ precio: false, slug: false });
    setAviso(null);
  }

  /* --- Render ---------------------------------------------------------- */

  const campoPrecio = (
    <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
      <label className={ROTULO} htmlFor={`${idBase}-precio`}>
        Precio de venta
        <input
          id={`${idBase}-precio`}
          value={precioTexto}
          onChange={(evento) => setPrecioTexto(evento.target.value)}
          inputMode="decimal"
          placeholder="45000"
          className={`${CAMPO} mt-1 tabular-nums`}
        />
      </label>
      <label className={ROTULO} htmlFor={`${idBase}-moneda`}>
        Moneda
        <select
          id={`${idBase}-moneda`}
          value={moneda}
          onChange={(evento) => setMoneda(evento.target.value as Currency)}
          className={`${CAMPO} mt-1`}
        >
          {MONEDA_OPCIONES.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <div className="border-t border-line pt-3 md:col-span-5">
      <div className="flex flex-wrap items-center gap-2">
        {vehiculo.published ? (
          <button
            type="button"
            className={BOTON}
            disabled={bloqueado}
            onClick={() => {
              setModo("nada");
              void ejecutar((cliente) => despublicarVehiculo(cliente, vehiculo.id));
            }}
          >
            Despublicar
          </button>
        ) : (
          <button
            type="button"
            className={BOTON_PRIMARIO}
            disabled={bloqueado}
            onClick={alPulsarPublicar}
          >
            Publicar en la web
          </button>
        )}

        <label className="sr-only" htmlFor={`${idBase}-estado`}>
          Estado de {vehiculo.title}
        </label>
        <select
          id={`${idBase}-estado`}
          value={modo === "vendido" ? "vendido" : vehiculo.status}
          disabled={bloqueado}
          onChange={(evento) => alCambiarEstado(evento.target.value as VehicleStatus)}
          className="rounded-lux border border-line bg-surface-2 px-3 py-2 text-xs text-ink disabled:opacity-50"
        >
          {ESTADO_OPCIONES.map((estado) => (
            <option key={estado} value={estado}>
              {ESTADO_LABEL[estado]}
            </option>
          ))}
        </select>

        <button type="button" className={BOTON} disabled={bloqueado} onClick={abrirPrecio}>
          Cambiar precio
        </button>

        {ocupado ? (
          <span className="text-[11px] text-ink-3" role="status">
            Guardando…
          </span>
        ) : null}
      </div>

      {modo === "publicar" ? (
        <form
          onSubmit={confirmarPublicar}
          className="mt-3 max-w-md space-y-3 rounded-lux border border-line-strong bg-surface-2 p-3"
        >
          <p className="text-xs font-semibold text-ink">Para publicar falta</p>
          <p className="text-[11px] leading-relaxed text-ink-3">
            Un auto publicado necesita precio (nadie debería tener que escribir
            por WhatsApp solo para saber cuánto cuesta) y una URL propia.
          </p>
          {pidePrecio ? campoPrecio : null}
          {pideSlug ? (
            <label className={ROTULO} htmlFor={`${idBase}-slug`}>
              URL (slug)
              <input
                id={`${idBase}-slug`}
                value={slugTexto}
                onChange={(evento) => setSlugTexto(evento.target.value)}
                placeholder="2026-toyota-gr-supra-4f2a1b"
                className={`${CAMPO} mt-1 font-mono`}
              />
              <span className="mt-1 block normal-case tracking-normal text-ink-4">
                Quedará en luxcars.pe/comprar/… Solo minúsculas, números y guiones.
              </span>
            </label>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className={BOTON_PRIMARIO} disabled={bloqueado}>
              {ocupado ? "Publicando…" : "Publicar"}
            </button>
            <button type="button" className={BOTON_FANTASMA} onClick={cancelar}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {modo === "vendido" ? (
        <form
          onSubmit={confirmarVendido}
          className="mt-3 max-w-md space-y-3 rounded-lux border border-line-strong bg-surface-2 p-3"
        >
          <p className="text-xs font-semibold text-ink">Marcar como vendido</p>
          <label className={ROTULO} htmlFor={`${idBase}-vendido`}>
            Fecha de venta
            <input
              id={`${idBase}-vendido`}
              type="date"
              value={fechaVenta}
              onChange={(evento) => setFechaVenta(evento.target.value)}
              className={`${CAMPO} mt-1`}
            />
          </label>
          {vehiculo.published ? (
            <p className="text-[11px] leading-relaxed text-ink-3">
              Sigue publicado: un vendido a la vista sirve de prueba social. Si
              prefieres ocultarlo, usa “Despublicar”.
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className={BOTON_PRIMARIO} disabled={bloqueado}>
              {ocupado ? "Guardando…" : "Confirmar venta"}
            </button>
            <button type="button" className={BOTON_FANTASMA} onClick={cancelar}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {modo === "precio" ? (
        <form
          onSubmit={confirmarPrecio}
          className="mt-3 max-w-md space-y-3 rounded-lux border border-line-strong bg-surface-2 p-3"
        >
          <p className="text-xs font-semibold text-ink">Cambiar precio de venta</p>
          {campoPrecio}
          {vehiculo.published ? (
            <p className="text-[11px] leading-relaxed text-ink-3">
              Está publicado: el precio nuevo se ve en la web al guardar.
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className={BOTON_PRIMARIO} disabled={bloqueado}>
              {ocupado ? "Guardando…" : "Guardar precio"}
            </button>
            <button type="button" className={BOTON_FANTASMA} onClick={cancelar}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {aviso ? (
        <p
          className={`mt-2 text-[11px] ${aviso.ok ? "text-ok" : "text-danger"}`}
          role={aviso.ok ? "status" : "alert"}
        >
          {aviso.texto}
        </p>
      ) : null}
    </div>
  );
}
