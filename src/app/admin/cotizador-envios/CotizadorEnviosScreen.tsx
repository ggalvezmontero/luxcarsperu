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
 * guardar la CORRIGE (mismo número, misma fecha) en vez de crear otra, y la
 * pantalla avisa si hay cambios sin guardar. "Nueva cotización" cierra la
 * abierta y vuelve a crear.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/Button";
import { Badge, Notice, PortalPageHeader } from "@/components/portal/CrmUI";
import { cotizarEnvio } from "@/core/envios/calculoEnvio";
import { generarMensajeWhatsapp } from "@/core/envios/mensajeWhatsapp";
import { anioEnLima } from "@/core/envios/valorAduana";
import { formatCurrency } from "@/lib/utils";

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
import { generarPdfEnvio } from "./pdfEnvio";
import { ResultadoEnvio } from "./ResultadoEnvio";
import { aEntrada, desdeEntrada, faltantes, formularioInicial, type Formulario } from "./formulario";

const REGIMEN_CORTO = { "ley-retorno": "Ley del Retorno", "importacion-regular": "Importación regular" } as const;

export function CotizadorEnviosScreen() {
  const anioActual = useMemo(() => anioEnLima(), []);
  const [form, setForm] = useState<Formulario>(() => formularioInicial(anioActual));
  const [abierta, setAbierta] = useState<{ id: string; numero: string } | null>(null);
  /** La entrada tal como quedó guardada, para saber si hay cambios pendientes. */
  const [guardadaJson, setGuardadaJson] = useState<string | null>(null);

  const [historial, setHistorial] = useState<CotizacionEnvioResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [pdfDe, setPdfDe] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const entrada = useMemo(() => aEntrada(form), [form]);
  const resultado = useMemo(() => cotizarEnvio(entrada), [entrada]);
  const mensaje = useMemo(() => generarMensajeWhatsapp(entrada, resultado), [entrada, resultado]);
  const faltan = faltantes(form);
  const listo = entrada.vehiculo.valorFacturaUsd > 0;
  const entradaJson = useMemo(() => JSON.stringify(entrada), [entrada]);
  const sinGuardar = abierta !== null && guardadaJson !== entradaJson;

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
      setGuardadaJson(entradaJson);
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
    const formulario = desdeEntrada(r.datos.entrada);
    setForm(formulario);
    setGuardadaJson(JSON.stringify(aEntrada(formulario)));
    setAbierta({ id, numero: r.datos.numero });
    setAviso({ ok: true, texto: `${r.datos.numero} cargada en el formulario. Al guardar se corrige esa misma; "Nueva cotización" para empezar otra.` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function pdfDeGuardada(id: string) {
    setPdfDe(id);
    const r = await obtenerCotizacion(id);
    if (r.ok) {
      try {
        // El resultado guardado, no uno recalculado: es lo que se le dijo al cliente.
        await generarPdfEnvio(r.datos.entrada, r.datos.resultado, r.datos.numero);
      } catch {
        setAviso({ ok: false, texto: "No se pudo generar el PDF." });
      }
    } else {
      setAviso({ ok: false, texto: r.mensaje });
    }
    setPdfDe(null);
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
    setGuardadaJson(null);
    setAviso(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const total = resultado.elegido;
  const totalTexto = total.tributos || total.regimen === "ley-retorno" ? formatCurrency(total.totalUsd) : "No aplica";

  return (
    <div className="flex flex-col gap-8">
      <PortalPageHeader
        eyebrow={abierta ? `Editando ${abierta.numero}` : "Herramienta interna"}
        title="Cotizador de envíos"
        description="Para clientes que traen su propio vehículo desde Estados Unidos. Se calcula al escribir; guarda cuando quieras archivarla."
        actions={
          abierta ? (
            <div className="flex items-center gap-3">
              <Badge tone={sinGuardar ? "warn" : "ok"}>{sinGuardar ? "Cambios sin guardar" : "Guardada"}</Badge>
              <Button onClick={nueva} variant="ghost" size="sm">
                Nueva cotización
              </Button>
            </div>
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

          {/* Barra de acciones: se pega al borde inferior mientras se recorre el formulario. */}
          <div className="sticky bottom-0 z-10 -mx-1 rounded-lux border border-line bg-bg/90 p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-3">Total referencial</p>
                <p className="text-lg font-semibold tabular-nums text-ink">
                  {listo ? totalTexto : "—"}
                  <span className="ml-2 text-xs font-normal text-ink-4">{REGIMEN_CORTO[entrada.regimen]}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => guardar("borrador")} variant="secondary" size="sm" disabled={guardando}>
                  {guardando ? "Guardando…" : abierta ? "Actualizar borrador" : "Guardar borrador"}
                </Button>
                <Button onClick={() => guardar("enviada")} variant="primary" size="sm" disabled={guardando}>
                  {abierta ? "Actualizar como enviada" : "Guardar como enviada"}
                </Button>
              </div>
            </div>
            {faltan.length > 0 ? (
              <p className="mt-2 text-xs text-ink-4">Para guardar falta: {faltan.join(", ")}.</p>
            ) : sinGuardar ? (
              <p className="mt-2 text-xs text-warn">Hay cambios sin guardar en {abierta?.numero}.</p>
            ) : null}
          </div>
        </div>
        <ResultadoEnvio entrada={entrada} resultado={resultado} mensaje={mensaje} numero={abierta?.numero ?? null} listo={listo} />
      </div>

      <HistorialEnvios
        cotizaciones={historial}
        cargando={cargando}
        error={errorHistorial}
        abiertaId={abierta?.id ?? null}
        pdfDe={pdfDe}
        onAbrir={abrir}
        onPdf={pdfDeGuardada}
        onCambiarEstado={cambiar}
        onRecargar={cargarHistorial}
      />
    </div>
  );
}
