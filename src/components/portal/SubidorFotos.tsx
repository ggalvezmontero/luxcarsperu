"use client";

/**
 * Subidor de fotos del stock. Pensado para usarse CON UNA MANO, parado al lado
 * del auto, con el celular y señal regular.
 *
 * DECISIONES QUE VIENEN DE ESE ESCENARIO Y NO DE UN MOCKUP:
 *
 *  · Arrastrar y soltar existe para el escritorio, pero el camino principal en
 *    móvil son dos botones grandes: "Elegir fotos" (galería) y "Tomar foto"
 *    (abre la cámara trasera directo, con `capture="environment"`).
 *  · Se comprime en el propio teléfono ANTES de subir. Ocho fotos de iPhone son
 *    ~60 MB por 4G; comprimidas son ~5 MB. Es la diferencia entre cargar un auto
 *    en dos minutos o en veinte.
 *  · Se sube de a UNA y en fila. Con señal irregular, ocho subidas en paralelo
 *    se pelean el ancho de banda y fallan juntas; en fila, si una falla, las
 *    otras siete ya están guardadas y se reintenta solo esa.
 *  · Reordenar tiene flechas además de arrastrar. Arrastrar con el pulgar, al
 *    sol, en una pantalla táctil no funciona; una flecha sí. Y las flechas son
 *    además el único camino accesible por teclado.
 *  · Sube directo del navegador a Supabase Storage con la sesión del equipo
 *    (ver `src/lib/portal/vehiclePhotos.ts`): RLS es el candado, no hace falta
 *    `service_role`, y de paso se esquiva el límite de ~4.5 MB que tiene el
 *    cuerpo de una función serverless en Vercel.
 *  · Sin Supabase configurado la pantalla NO se bloquea: comprime, muestra,
 *    deja ordenar y permite descargar las fotos ya optimizadas, avisando en
 *    claro que nada se está guardando.
 *
 * SOBRE `<img>` EN LUGAR DE `next/image`: las fotos viven en Supabase Storage
 * (dominio no declarado en `next.config.ts`) y, en modo local, son `blob:` de
 * esta sesión. `next/image` fallaría en ambos casos. Además este es el panel
 * interno: no hay SEO ni Core Web Vitals que optimizar acá.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/Button";
import { usePortalSession } from "@/components/portal/portalSession";
import { cn } from "@/lib/utils";
import {
  BYTES_MAXIMOS_SUBIDA,
  comprimirFoto,
  esArchivoDeFotoValido,
  formatearBytes,
} from "@/lib/portal/imageCompression";
import { MINIMO_FOTOS, TOMAS_MINIMAS } from "@/lib/portal/photoGuide";
import {
  borrarFoto,
  guardarAlt,
  guardarOrden,
  listarFotos,
  marcarPortada,
  obtenerFichaVehiculo,
  subirFoto,
  type FichaVehiculo,
  type FotoVehiculo,
} from "@/lib/portal/vehiclePhotos";

/* ========================================================================== */
/* Tipos de pantalla                                                          */
/* ========================================================================== */

/**
 * Foto en pantalla. Unifica la guardada en Supabase con la que solo existe en
 * esta pestaña (modo sin base de datos), para que la galería tenga UN camino de
 * renderizado en vez de dos que se desincronizan.
 */
type FotoUI = {
  id: string;
  url: string | null;
  alt: string;
  esPortada: boolean;
  bytes: number | null;
  /** `true` si vive solo en memoria: no está guardada en ningún lado. */
  local: boolean;
  /** Datos de la foto persistida, para borrarla del bucket. */
  origen?: FotoVehiculo;
  nombreDescarga?: string;
};

type EstadoItem = "comprimiendo" | "subiendo" | "error";

/** Foto en tránsito: ya elegida, todavía no guardada. */
type ItemCola = {
  key: string;
  nombre: string;
  previewUrl: string;
  estado: EstadoItem;
  mensaje?: string;
};

const etiqueta =
  "text-[11px] font-medium uppercase tracking-[0.28em] text-ink-3";

function aUI(foto: FotoVehiculo): FotoUI {
  return {
    id: foto.id,
    url: foto.url,
    alt: foto.alt,
    esPortada: foto.esPortada,
    bytes: foto.bytes,
    local: false,
    origen: foto,
  };
}

/* ========================================================================== */
/* Componente                                                                 */
/* ========================================================================== */

export function SubidorFotos({ vehiculoId }: { vehiculoId: string }) {
  const { status, client } = usePortalSession();

  const [ficha, setFicha] = useState<FichaVehiculo | null>(null);
  const [fotos, setFotos] = useState<FotoUI[]>([]);
  const [cola, setCola] = useState<ItemCola[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [arrastradoIndice, setArrastradoIndice] = useState<number | null>(null);

  const inputGaleria = useRef<HTMLInputElement>(null);
  const inputCamara = useRef<HTMLInputElement>(null);
  /** Los `blob:` creados hay que revocarlos o la pestaña se come la memoria. */
  const urlsCreadas = useRef<string[]>([]);

  /* REORDENAR CON TECLADO: dos problemas que se ven solo probándolo.
     1) Al mover una foto a la primera o la última posición, la flecha que
        acabas de pulsar se vuelve `disabled`. El navegador quita el foco de un
        elemento deshabilitado y lo manda a `<body>`: la siguiente tabulación
        reinicia desde arriba y se pierde el sitio en una galería de 12 fotos.
     2) El movimiento no se anuncia. En pantalla la tarjeta salta de lugar; con
        lector de pantalla no pasa absolutamente nada.
     `focoPendiente` recuerda a qué botón hay que volver y `anuncio` alimenta la
     región viva que dice en qué posición quedó la foto. */
  const focoPendiente = useRef<{ fotoId: string; direccion: "atras" | "adelante" } | null>(
    null,
  );
  const [anuncio, setAnuncio] = useState("");

  /**
   * Modo local = hay pantalla pero no hay dónde guardar (falta configurar
   * Supabase). Se comprime y se ordena igual, y se avisa. Es mejor que un
   * formulario muerto: el equipo puede fotografiar hoy y subir cuando el dueño
   * termine de configurar.
   */
  const modoLocal = status === "sin-configurar" || !client;

  /**
   * "Cargando" se DERIVA, no se guarda en estado.
   *
   * Tenerlo como estado obligaba a un `setCargando(false)` en el cuerpo del
   * efecto para el caso sin configuración, que es exactamente lo que prohíbe
   * `react-hooks/set-state-in-effect` (renders en cascada). Derivarlo da el
   * mismo resultado sin un `useState` extra: hay carga en curso mientras se
   * verifica la sesión, o mientras hay sesión pero todavía no llegó la ficha ni
   * un error que explique por qué no llegará.
   */
  const cargando =
    status === "verificando" || (!modoLocal && ficha === null && error === null);

  /* ---------------------------------------------------------------------- */
  /* Carga inicial                                                          */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    // Mientras el armazón verifica la sesión no se consulta nada: sin sesión,
    // RLS devolvería cero filas y se vería un "no existe" que no es cierto.
    if (status === "verificando" || modoLocal) return;

    let cancelado = false;

    // Todo `setState` de acá vive DESPUÉS de un `await`, nunca en el cuerpo
    // síncrono del efecto: es la forma permitida de sincronizar con una fuente
    // externa sin provocar renders en cascada.
    (async () => {
      const fichaResultado = await obtenerFichaVehiculo(client, vehiculoId);
      if (cancelado) return;

      if (!fichaResultado.ok) {
        setError(fichaResultado.mensaje);
        return;
      }

      const galeria = await listarFotos(client, fichaResultado.data.id);
      if (cancelado) return;

      if (!galeria.ok) {
        setError(galeria.mensaje);
        // La ficha se fija igual: el encabezado puede mostrar el auto aunque la
        // galería haya fallado, y así el error no deja la pantalla en blanco.
        setFicha(fichaResultado.data);
        return;
      }

      setError(null);
      setFicha(fichaResultado.data);
      setFotos(galeria.data.map(aUI));
    })();

    return () => {
      cancelado = true;
    };
  }, [client, modoLocal, status, vehiculoId]);

  useEffect(() => {
    const urls = urlsCreadas.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  /** Relee la galería desde la base: la verdad del orden y la portada es suya. */
  const refrescarGaleria = useCallback(async () => {
    if (!ficha || modoLocal) return;
    const galeria = await listarFotos(client, ficha.id);
    if (!galeria.ok) {
      setError(galeria.mensaje);
      return;
    }
    setFotos((previas) => [
      ...galeria.data.map(aUI),
      ...previas.filter((foto) => foto.local),
    ]);
  }, [client, ficha, modoLocal]);

  /* ---------------------------------------------------------------------- */
  /* Alta de archivos                                                        */
  /* ---------------------------------------------------------------------- */

  const procesarArchivos = useCallback(
    async (archivos: File[]) => {
      const validos = archivos.filter(esArchivoDeFotoValido);
      const descartados = archivos.length - validos.length;
      if (descartados > 0) {
        setAviso(
          `Se ignoraron ${descartados} archivo(s) que no son fotos. Se aceptan JPG, PNG, WebP, AVIF y HEIC.`,
        );
      }
      if (validos.length === 0) return;

      // En fila, no en paralelo: ver la nota de cabecera.
      for (const archivo of validos) {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const preview = URL.createObjectURL(archivo);
        urlsCreadas.current.push(preview);

        setCola((previa) => [
          ...previa,
          {
            key,
            nombre: archivo.name,
            previewUrl: preview,
            estado: "comprimiendo",
          },
        ]);

        const comprimida = await comprimirFoto(archivo);

        if (comprimida.bytes > BYTES_MAXIMOS_SUBIDA) {
          setCola((previa) =>
            previa.map((item) =>
              item.key === key
                ? {
                    ...item,
                    estado: "error",
                    mensaje: `Pesa ${formatearBytes(comprimida.bytes)} y el máximo es 15 MB.`,
                  }
                : item,
            ),
          );
          continue;
        }

        if (modoLocal || !ficha) {
          // Sin almacenamiento: la foto vive en esta pestaña. Se puede ordenar,
          // marcar portada y descargar comprimida, pero no se guarda.
          setFotos((previas) => [
            ...previas,
            {
              id: `local-${key}`,
              url: preview,
              alt: "",
              esPortada: previas.length === 0,
              bytes: comprimida.bytes,
              local: true,
              nombreDescarga: `${archivo.name.replace(/\.[^.]+$/, "")}.${comprimida.extension}`,
            },
          ]);
          setCola((previa) => previa.filter((item) => item.key !== key));
          continue;
        }

        setCola((previa) =>
          previa.map((item) =>
            item.key === key ? { ...item, estado: "subiendo" } : item,
          ),
        );

        const subida = await subirFoto(client, {
          vehicleId: ficha.id,
          blob: comprimida.blob,
          contentType: comprimida.contentType,
          extension: comprimida.extension,
          // Un alt provisional es mejor que ninguno: la base exige alt en las
          // fotos publicadas, y el equipo puede afinarlo después en la tarjeta.
          alt: ficha.titulo,
          anchoPx: comprimida.anchoPx,
          altoPx: comprimida.altoPx,
        });

        if (!subida.ok) {
          setCola((previa) =>
            previa.map((item) =>
              item.key === key
                ? { ...item, estado: "error", mensaje: subida.mensaje }
                : item,
            ),
          );
          continue;
        }

        setFotos((previas) => [
          ...previas.filter((foto) => !foto.local),
          aUI(subida.data),
          ...previas.filter((foto) => foto.local),
        ]);
        setCola((previa) => previa.filter((item) => item.key !== key));
      }
    },
    [client, ficha, modoLocal],
  );

  const alSoltar = (evento: React.DragEvent<HTMLDivElement>) => {
    evento.preventDefault();
    setArrastrando(false);
    const archivos = Array.from(evento.dataTransfer?.files ?? []);
    if (archivos.length > 0) void procesarArchivos(archivos);
  };

  /* ---------------------------------------------------------------------- */
  /* Acciones sobre la galería                                              */
  /* ---------------------------------------------------------------------- */

  /** Reordena en pantalla primero y confirma contra la base después. */
  const mover = useCallback(
    (desde: number, hasta: number) => {
      if (hasta < 0 || hasta >= fotos.length || desde === hasta) return;

      const reordenadas = [...fotos];
      const [sacada] = reordenadas.splice(desde, 1);
      reordenadas.splice(hasta, 0, sacada);
      setFotos(reordenadas);

      focoPendiente.current = {
        fotoId: sacada.id,
        direccion: hasta < desde ? "atras" : "adelante",
      };
      setAnuncio(
        `Foto movida a la posición ${hasta + 1} de ${reordenadas.length}.` +
          (hasta === 0 ? " Ahora es la portada." : ""),
      );

      if (modoLocal || !ficha) return;

      const guardables = reordenadas.filter((foto) => !foto.local);
      if (guardables.length === 0) return;

      void (async () => {
        const resultado = await guardarOrden(
          client,
          ficha.id,
          guardables.map((foto) => foto.id),
        );
        if (!resultado.ok) {
          setError(resultado.mensaje);
          // El orden que vale es el de la base: si no se guardó, se vuelve a
          // leer en vez de dejar en pantalla un orden que no existe.
          void refrescarGaleria();
        }
      })();
    },
    [client, ficha, fotos, modoLocal, refrescarGaleria],
  );

  const hacerPortada = useCallback(
    (foto: FotoUI) => {
      setFotos((previas) =>
        previas.map((item) => ({ ...item, esPortada: item.id === foto.id })),
      );

      if (foto.local || modoLocal || !ficha) return;

      void (async () => {
        const resultado = await marcarPortada(client, ficha.id, foto.id);
        if (!resultado.ok) {
          setError(resultado.mensaje);
          void refrescarGaleria();
        }
      })();
    },
    [client, ficha, modoLocal, refrescarGaleria],
  );

  const escribirAlt = useCallback(
    (foto: FotoUI, alt: string) => {
      if (alt === foto.alt) return;
      setFotos((previas) =>
        previas.map((item) => (item.id === foto.id ? { ...item, alt } : item)),
      );

      if (foto.local || modoLocal || !ficha) return;

      void (async () => {
        const resultado = await guardarAlt(client, ficha.id, foto.id, alt);
        if (!resultado.ok) setError(resultado.mensaje);
      })();
    },
    [client, ficha, modoLocal],
  );

  const quitar = useCallback(
    (foto: FotoUI) => {
      // Borrar es lo único irreversible de esta pantalla: se pregunta siempre.
      if (!window.confirm("¿Quitar esta foto de la ficha?")) return;

      if (foto.local || modoLocal || !ficha || !foto.origen) {
        setFotos((previas) => previas.filter((item) => item.id !== foto.id));
        return;
      }

      void (async () => {
        const resultado = await borrarFoto(client, ficha.id, foto.origen!);
        if (!resultado.ok) {
          setError(resultado.mensaje);
          return;
        }
        if (resultado.data.aviso) setAviso(resultado.data.aviso);
        await refrescarGaleria();
      })();
    },
    [client, ficha, modoLocal, refrescarGaleria],
  );

  /* ---------------------------------------------------------------------- */
  /* Derivados                                                              */
  /* ---------------------------------------------------------------------- */

  const total = fotos.length;
  const faltantes = Math.max(0, MINIMO_FOTOS - total);
  /* Devuelve el foco a la flecha equivalente de la foto que se acaba de mover.
     Si esa flecha quedó deshabilitada (la foto llegó al principio o al final),
     salta a la flecha contraria, que siempre está activa: lo que no puede pasar
     es que el foco se pierda. */
  useEffect(() => {
    const pendiente = focoPendiente.current;
    if (!pendiente) return;
    focoPendiente.current = null;

    const busca = (direccion: "atras" | "adelante") =>
      document.querySelector<HTMLButtonElement>(
        `[data-mover="${direccion}"][data-foto="${CSS.escape(pendiente.fotoId)}"]`,
      );

    const preferida = busca(pendiente.direccion);
    const alternativa =
      pendiente.direccion === "atras" ? busca("adelante") : busca("atras");

    const destino =
      preferida && !preferida.disabled ? preferida : alternativa ?? preferida;
    destino?.focus();
  }, [fotos]);

  const sinAlt = useMemo(
    () => fotos.filter((foto) => !foto.alt.trim()).length,
    [fotos],
  );
  const pesoTotal = useMemo(
    () => fotos.reduce((suma, foto) => suma + (foto.bytes ?? 0), 0),
    [fotos],
  );

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <section className="space-y-6">
      {/* ── Encabezado y avance ─────────────────────────────────────────── */}
      <header className="rounded-lux-lg border border-line bg-surface px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={etiqueta}>Fotos del vehículo</p>
            <h1 className="mt-2 truncate text-2xl font-medium tracking-tight text-ink sm:text-3xl">
              {ficha?.titulo ?? (cargando ? "Cargando…" : "Vehículo")}
            </h1>
            {ficha ? (
              <p className="mt-2 text-sm text-ink-3">
                {ficha.publicado
                  ? "Publicado: cada cambio se ve en el sitio al instante."
                  : "Sin publicar: estas fotos todavía no son visibles para el público."}
              </p>
            ) : null}
          </div>

          <div className="text-right">
            <p className="font-mono text-3xl text-ink">
              {total}
              <span className="text-ink-4">/{MINIMO_FOTOS}</span>
            </p>
            <p className="mt-1 text-xs text-ink-3">
              {faltantes > 0
                ? `Faltan ${faltantes} de las tomas mínimas`
                : "Tomas mínimas completas"}
            </p>
          </div>
        </div>

        <div
          className="mt-5 h-1 w-full overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={MINIMO_FOTOS}
          aria-valuenow={Math.min(total, MINIMO_FOTOS)}
          aria-label="Avance de las tomas mínimas"
        >
          <div
            className="h-full bg-silver transition-[width] duration-300"
            style={{ width: `${Math.min(100, (total / MINIMO_FOTOS) * 100)}%` }}
          />
        </div>

        {/* Recordatorio de qué tomas faltan, en el orden de la guía. */}
        <ul className="mt-4 flex flex-wrap gap-2">
          {TOMAS_MINIMAS.map((toma, indice) => (
            <li
              key={toma.id}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] tracking-wide",
                indice < total
                  ? "border-line-strong text-ink-2"
                  : "border-line text-ink-4",
              )}
            >
              {toma.nombre}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-4">
          Es la lista de referencia, no una asignación automática: sube las fotos
          en ese orden y la galería queda ordenada sola.
        </p>
      </header>

      {/* ── Avisos ──────────────────────────────────────────────────────── */}
      {modoLocal ? (
        <div className="rounded-lux border border-warn/40 bg-surface-2 px-5 py-4">
          <p className="text-sm font-medium text-warn">
            Modo sin almacenamiento: estas fotos NO se están guardando.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Supabase no está configurado, así que no hay dónde guardar. Puedes
            fotografiar, comprimir, ordenar y descargar las fotos ya optimizadas,
            pero se pierden al cerrar la pestaña. Define las variables de{" "}
            <code className="text-ink-3">.env.example</code> en Vercel y vuelve a
            entrar para guardarlas de verdad.
          </p>
        </div>
      ) : null}

      {/* `role="alert"`: un fallo al subir (sin señal, archivo rechazado) tiene
          que anunciarse solo. Antes solo cambiaba de color en pantalla. */}
      {error ? (
        <div
          role="alert"
          className="rounded-lux border border-danger/40 bg-surface-2 px-5 py-4"
        >
          <p className="text-sm leading-relaxed text-danger">{error}</p>
        </div>
      ) : null}

      {aviso ? (
        <div
          role="status"
          className="flex items-start justify-between gap-4 rounded-lux border border-line bg-surface-2 px-5 py-4"
        >
          <p className="text-sm leading-relaxed text-ink-2">{aviso}</p>
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="text-sm text-ink-3 hover:text-ink"
            aria-label="Cerrar aviso"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : null}

      {/* ── Zona de carga ───────────────────────────────────────────────── */}
      <div
        onDragOver={(evento) => {
          evento.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
        className={cn(
          "rounded-lux-lg border border-dashed px-5 py-8 text-center transition-colors sm:px-7 sm:py-10",
          arrastrando
            ? "border-silver bg-surface-2"
            : "border-line-strong bg-surface",
        )}
      >
        <p className="text-base text-ink">
          Arrastra las fotos aquí o elígelas desde el celular
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-3">
          Se reducen y comprimen en tu propio teléfono antes de subir: suben
          rápido con señal mala y se ven igual de bien.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {/* El único oro de la pantalla: la acción que carga las fotos. */}
          <Button
            type="button"
            variant="accent"
            size="lg"
            onClick={() => inputGaleria.current?.click()}
          >
            Elegir fotos
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => inputCamara.current?.click()}
          >
            Tomar foto ahora
          </Button>
        </div>

        <input
          ref={inputGaleria}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(evento) => {
            const archivos = Array.from(evento.target.files ?? []);
            // Se limpia el input o elegir el MISMO archivo dos veces seguidas
            // no dispara `change` y la foto no se sube.
            evento.target.value = "";
            if (archivos.length > 0) void procesarArchivos(archivos);
          }}
        />
        {/* `capture="environment"` abre la cámara trasera directo, sin pasar por
            la galería: es el camino de menos toques parado al lado del auto. */}
        <input
          ref={inputCamara}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(evento) => {
            const archivos = Array.from(evento.target.files ?? []);
            evento.target.value = "";
            if (archivos.length > 0) void procesarArchivos(archivos);
          }}
        />
      </div>

      {/* ── Cola de subida ──────────────────────────────────────────────── */}
      {cola.length > 0 ? (
        <ul className="space-y-2" aria-live="polite">
          {cola.map((item) => (
            <li
              key={item.key}
              className="flex items-center gap-4 rounded-lux border border-line bg-surface px-4 py-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt=""
                className="h-12 w-16 shrink-0 rounded-sm object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{item.nombre}</p>
                <p
                  className={cn(
                    "text-xs",
                    item.estado === "error" ? "text-danger" : "text-ink-3",
                  )}
                >
                  {item.estado === "comprimiendo"
                    ? "Comprimiendo…"
                    : item.estado === "subiendo"
                      ? "Subiendo…"
                      : item.mensaje}
                </p>
              </div>
              {item.estado === "error" ? (
                <button
                  type="button"
                  onClick={() =>
                    setCola((previa) =>
                      previa.filter((otro) => otro.key !== item.key),
                    )
                  }
                  className="text-sm text-ink-3 hover:text-ink"
                >
                  Descartar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* ── Galería ─────────────────────────────────────────────────────── */}
      {total > 0 ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={etiqueta}>Galería · arrastra o usa las flechas</p>
            <p className="text-xs text-ink-4">
              {formatearBytes(pesoTotal)} en total
              {sinAlt > 0 ? ` · ${sinAlt} sin descripción` : ""}
            </p>
          </div>

          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fotos.map((foto, indice) => (
              <li
                key={foto.id}
                draggable
                onDragStart={() => setArrastradoIndice(indice)}
                onDragOver={(evento) => evento.preventDefault()}
                onDrop={(evento) => {
                  evento.preventDefault();
                  if (arrastradoIndice !== null) mover(arrastradoIndice, indice);
                  setArrastradoIndice(null);
                }}
                onDragEnd={() => setArrastradoIndice(null)}
                className={cn(
                  "overflow-hidden rounded-lux border bg-surface",
                  foto.esPortada ? "border-line-strong" : "border-line",
                )}
              >
                <div className="relative aspect-[4/3] bg-surface-3">
                  {foto.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={foto.url}
                      alt={foto.alt || "Foto del vehículo"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-ink-4">
                      Sin vista previa
                    </div>
                  )}

                  <span className="absolute left-3 top-3 rounded-full bg-void/70 px-2 py-1 font-mono text-[11px] text-ink-2">
                    {String(indice + 1).padStart(2, "0")}
                  </span>

                  {foto.esPortada ? (
                    <span className="absolute right-3 top-3 rounded-full bg-silver px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-void">
                      Portada
                    </span>
                  ) : null}

                  {foto.local ? (
                    <span className="absolute bottom-3 left-3 rounded-full bg-void/70 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-warn">
                      Sin guardar
                    </span>
                  ) : null}
                </div>

                <div className="space-y-3 p-4">
                  <label className="block">
                    <span className="sr-only">
                      Descripción de la foto {indice + 1}
                    </span>
                    <input
                      type="text"
                      defaultValue={foto.alt}
                      onBlur={(evento) =>
                        escribirAlt(foto, evento.target.value.trim())
                      }
                      placeholder="Describe la toma (ej. 3/4 delantero)"
                      className="min-h-11 w-full rounded-sm border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-4"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => mover(indice, indice - 1)}
                      disabled={indice === 0}
                      data-mover="atras"
                      data-foto={foto.id}
                      aria-label={`Mover la foto ${indice + 1} hacia atrás`}
                      className="min-h-11 min-w-11 rounded-sm border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-35"
                    >
                      <span aria-hidden="true">←</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(indice, indice + 1)}
                      disabled={indice === total - 1}
                      data-mover="adelante"
                      data-foto={foto.id}
                      aria-label={`Mover la foto ${indice + 1} hacia adelante`}
                      className="min-h-11 min-w-11 rounded-sm border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-35"
                    >
                      <span aria-hidden="true">→</span>
                    </button>

                    {!foto.esPortada ? (
                      <button
                        type="button"
                        onClick={() => hacerPortada(foto)}
                        className="min-h-11 rounded-sm border border-line px-3 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                      >
                        Hacer portada
                      </button>
                    ) : null}

                    {foto.local && foto.url ? (
                      <a
                        href={foto.url}
                        download={foto.nombreDescarga}
                        className="min-h-11 rounded-sm border border-line px-3 text-xs leading-[2.75rem] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                      >
                        Descargar
                      </a>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => quitar(foto)}
                      className="ml-auto min-h-11 rounded-sm px-3 text-xs text-ink-3 transition-colors hover:text-danger"
                    >
                      Borrar
                    </button>
                  </div>

                  {foto.bytes ? (
                    <p className="text-[11px] text-ink-4">
                      {formatearBytes(foto.bytes)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {sinAlt > 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-ink-3">
              {sinAlt} foto(s) sin descripción. El texto alternativo es lo que
              lee Google y lo que escucha alguien con lector de pantalla: una
              ficha sin descripciones posiciona peor.
            </p>
          ) : null}
        </div>
      ) : !cargando ? (
        <p className="text-sm text-ink-3">
          Todavía no hay fotos. Empieza por la 3/4 delantera: es la portada.
        </p>
      ) : null}

      {/* Región viva del reordenamiento. Vacía en pantalla y siempre montada:
          si se montara junto con el mensaje, varios lectores de pantalla no
          anunciarían el primer cambio. */}
      <p role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </section>
  );
}
