"use client";

/**
 * Pantalla del cotizador de envíos.
 *
 * El cálculo corre acá, en el navegador, con el motor puro de
 * `src/core/envios/` y se actualiza con cada tecla. Guardar manda la ENTRADA
 * al servidor, que la recalcula y archiva su propio resultado: lo que se ve y
 * lo que se guarda salen de la misma función.
 *
 * Abrir una cotización del historial la deja "abierta": desde ese momento
 * guardar la CORRIGE (mismo número, misma fecha) en vez de crear otra.
 * "Nueva cotización" cierra la abierta y vuelve a crear.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { Notice, PortalPageHeader } from "@/components/portal/CrmUI";
import { cotizarEnvio } from "@/core/envios/calculoEnvio";
import { generarMensajeWhatsapp } from "@/core/envios/mensajeWhatsapp";
import { anioEnLima } from "@/core/envios/valorAduana";

import {
  actualizarCotizacion,
  cambiarEstado,
  guardarCotizacion,
  listarCotizaciones,
  obtenerCotizacion,
  type CotizacionEnvioResumen,
  type EstadoCotizacionEnvio,
} from "./api";
import { FormularioEnvio } from "./FormularioEnvio";
import { HistorialEnvios } from "./HistorialEnvios";
import { ResultadoEnvio } from "./ResultadoEnvio";
import { aEntrada, desdeEntrada, faltantes, formularioInicial, type Formulario } from "./formulario";

export function CotizadorEnviosScreen() {
  const anioActual = useMemo(() => anioEnLima(), []);
  const [form, setForm] = useState<Formulario>(() => formularioInicial(anioActual));
  const [abierta, setAbierta] = useState<{ id: string; numero: string } | null>(null);

  const [historial, setHistorial] = useState<CotizacionEnvioResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const entrada = useMemo(() => aEntrada(form), [form]);
  const resultado = useMemo(() => cotizarEnvio(entrada), [entrada]);
  const mensaje = useMemo(() => generarMensajeWhatsapp(entrada, resultado), [entrada, resultado]);
  const faltan = faltantes(form);

  const cargarHistorial = useCallback(async () => {
    setCargando(true);
    const r = await listarCotizaciones();
    if (r.ok) {
      setHistorial(r.datos);
      setErrorHistorial(null);
    } else {
      setErrorHistorial(r.mensaje);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    // Mismo patrón que las pantallas del portal: la carga sale del cuerpo del
    // efecto para no encadenar renders, y se cancela si la pantalla se desmonta.
    let cancelado = false;
    queueMicrotask(() => {
      if (!cancelado) void cargarHistorial();
    });
    return () => {
      cancelado = true;
    };
  }, [cargarHistorial]);

  async function guardar(estado: EstadoCotizacionEnvio) {
    if (faltan.length > 0) {
      setAviso({ ok: false, texto: `Para guardar falta: ${faltan.join(", ")}.` });
      return;
    }
    setGuardando(true);
    const r = abierta
      ? await actualizarCotizacion(abierta.id, entrada, estado)
      : await guardarCotizacion(entrada, estado);
    setGuardando(false);
    if (r.ok) {
      setAbierta({ id: r.datos.id, numero: r.datos.numero });
      setAviso({
        ok: true,
        texto: abierta
          ? `Cotización ${r.datos.numero} actualizada como ${estado}.`
          : `Cotización ${r.datos.numero} guardada como ${estado}.`,
      });
      void cargarHistorial();
    } else {
      setAviso({ ok: false, texto: r.mensaje });
    }
  }

  async function abrir(id: string) {
    const r = await obtenerCotizacion(id);
    if (!r.ok) {
      setAviso({ ok: false, texto: r.mensaje });
      return;
    }
    setForm(desdeEntrada(r.datos.entrada));
    setAbierta({ id, numero: r.datos.numero });
    setAviso({ ok: true, texto: `Cotización ${r.datos.numero} cargada en el formulario. Al guardar se actualiza esa misma; "Nueva cotización" para empezar otra.` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function cambiar(id: string, estado: EstadoCotizacionEnvio) {
    const previo = historial;
    setHistorial((h) => h.map((c) => (c.id === id ? { ...c, estado } : c)));
    const r = await cambiarEstado(id, estado);
    if (!r.ok) {
      setHistorial(previo);
      setAviso({ ok: false, texto: r.mensaje });
    }
  }

  function nueva() {
    setForm(formularioInicial(anioActual));
    setAbierta(null);
    setAviso(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <PortalPageHeader
        eyebrow={abierta ? `Editando ${abierta.numero}` : "Herramienta interna"}
        title="Cotizador de envíos"
        description="Para clientes que traen su propio vehículo desde Estados Unidos, por Ley del Retorno o importación regular. Se calcula al escribir; guarda cuando quieras archivarla."
        actions={
          abierta ? (
            <Button onClick={nueva} variant="ghost" size="sm">
              Nueva cotización
            </Button>
          ) : undefined
        }
      />

      {aviso ? (
        <Notice tone={aviso.ok ? "info" : "warn"} label={aviso.ok ? "Listo" : "Atención"}>
          {aviso.texto}
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col gap-5">
          <FormularioEnvio valor={form} onChange={setForm} anioActual={anioActual} recorridoKm={resultado.recorridoKm} />
          <div className="flex flex-wrap items-center gap-3 rounded-lux border border-line bg-surface p-4">
            <Button onClick={() => guardar("borrador")} variant="secondary" size="md" disabled={guardando}>
              {guardando ? "Guardando…" : abierta ? "Actualizar como borrador" : "Guardar borrador"}
            </Button>
            <Button onClick={() => guardar("enviada")} variant="primary" size="md" disabled={guardando}>
              {abierta ? "Actualizar como enviada" : "Guardar como enviada"}
            </Button>
            {faltan.length > 0 ? (
              <p className="text-xs text-ink-4">Para guardar falta: {faltan.join(", ")}.</p>
            ) : null}
          </div>
        </div>
        <ResultadoEnvio entrada={entrada} resultado={resultado} mensaje={mensaje} numero={abierta?.numero ?? null} />
      </div>

      <HistorialEnvios
        cotizaciones={historial}
        cargando={cargando}
        error={errorHistorial}
        onAbrir={abrir}
        onCambiarEstado={cambiar}
        onRecargar={cargarHistorial}
      />
    </div>
  );
}
