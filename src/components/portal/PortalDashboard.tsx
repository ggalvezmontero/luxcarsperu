"use client";

/**
 * Tablero del portal.
 *
 * Los indicadores se piden desde el navegador con la sesión del equipo, para
 * que RLS los evalúe como `authenticated`. NO se usa `service_role`: esa llave
 * salta todas las políticas y pintaría los leads para cualquiera que abra
 * /portal. Ver `src/lib/portal/supabaseBrowser.ts`.
 */

import { useCallback, useEffect, useState } from "react";
import { usePortalSession } from "@/components/portal/portalSession";
import {
  EMPTY_METRICS,
  currentMonthLabel,
  fetchPortalMetrics,
  type PortalMetrics,
} from "@/lib/portal/metrics";

/** Estado de configuración leído en el SERVIDOR (incluye la llave de servicio). */
export type DbStatus = {
  configured: boolean;
  writeConfigured: boolean;
  missing: string[];
};

type CardTone = "neutro" | "oro" | "atencion";

function MetricCard({
  label,
  value,
  caption,
  tone = "neutro",
  loading,
}: {
  label: string;
  value: number;
  caption: string;
  tone?: CardTone;
  loading: boolean;
}) {
  const valueColor =
    tone === "oro" ? "text-gold" : tone === "atencion" ? "text-warn" : "text-ink";
  const ring =
    tone === "atencion" ? "border-warn/30" : "border-line";

  return (
    <div
      className={`rounded-lux-lg border ${ring} bg-surface px-5 py-5 transition-colors hover:border-line-strong`}
    >
      <p className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
        {label}
      </p>
      <p
        className={`mt-3 text-4xl font-light tabular-nums ${valueColor}`}
        aria-busy={loading}
      >
        {loading ? (
          <span className="text-ink-4" aria-label="cargando">
            —
          </span>
        ) : (
          value
        )}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-3">{caption}</p>
    </div>
  );
}

function SetupNotice({ status }: { status: DbStatus }) {
  const faltaLectura = status.missing.filter((key) =>
    key.startsWith("NEXT_PUBLIC_"),
  );
  const faltaEscritura = status.missing.includes("SUPABASE_SERVICE_ROLE_KEY");

  return (
    <section
      role="alert"
      className="rounded-lux-lg border border-warn/40 bg-surface px-5 py-5 sm:px-6"
    >
      <p className="text-[0.62rem] uppercase tracking-[0.18em] text-warn">
        La base de datos no está configurada
      </p>
      <h2 className="mt-2 text-lg font-medium text-ink">
        El tablero muestra ceros porque todavía no hay de dónde leer.
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
        Nada está roto: el sitio público sigue funcionando y los formularios
        derivan al cliente a WhatsApp. Faltan variables de entorno del proyecto
        de Supabase (organización <code className="text-silver">zvwegcanushbpmjtohnp</code>).
      </p>

      <ol className="mt-5 space-y-4 text-sm text-ink-2">
        <li>
          <span className="font-medium text-ink">1. Aplicar el esquema.</span>{" "}
          Correr las migraciones de{" "}
          <code className="text-silver">supabase/migrations/</code> en el
          proyecto de Supabase. Crean tablas, RLS y el bucket de fotos.
        </li>
        <li>
          <span className="font-medium text-ink">
            2. Definir las variables
          </span>{" "}
          en Vercel → Project Settings → Environment Variables (y en{" "}
          <code className="text-silver">.env.local</code> para desarrollo). El
          detalle de cada una está en{" "}
          <code className="text-silver">.env.example</code>.
          {status.missing.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {status.missing.map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-warn">
                    •
                  </span>
                  <code className="text-xs text-silver">{key}</code>
                </li>
              ))}
            </ul>
          ) : null}
          {faltaLectura.length > 0 ? (
            <p className="mt-2 text-xs text-ink-3">
              Sin las públicas no hay lectura de inventario ni inicio de sesión
              en el portal.
            </p>
          ) : null}
          {faltaEscritura ? (
            <p className="mt-2 text-xs text-ink-3">
              Sin la llave de servicio no se guardan los leads: los formularios
              siguen derivando a WhatsApp. Es secreta y solo de servidor, jamás
              con prefijo <code className="text-silver">NEXT_PUBLIC_</code>.
            </p>
          ) : null}
        </li>
        <li>
          <span className="font-medium text-ink">3. Crear los usuarios</span> a
          mano en Supabase → Authentication → Users, uno por persona del equipo.
          Después, <span className="text-ink">desactivar el alta pública</span>{" "}
          en Authentication → Providers → Email → “Allow new users to sign up”.
          Si queda activa, cualquiera podría crearse una cuenta y RLS lo trataría
          como parte del equipo.
        </li>
        <li>
          <span className="font-medium text-ink">4. Volver a desplegar.</span>{" "}
          Las variables se leen en el build: un cambio en Vercel no toma efecto
          hasta el siguiente despliegue.
        </li>
      </ol>
    </section>
  );
}

/**
 * Recordatorio legal en la pantalla donde alguien podría tener la idea de
 * "traer el inventario automáticamente". Está en la UI a propósito: el
 * comentario en el código solo lo lee quien programa.
 */
function LegalNotice() {
  return (
    <section className="rounded-lux-lg border border-line bg-surface-2 px-5 py-5 sm:px-6">
      <p className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
        Cómo entra el inventario
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-2">
        El stock se carga <span className="text-ink">a mano</span>, con
        autocompletado por VIN contra{" "}
        <span className="text-silver">NHTSA vPIC</span> (API del gobierno de
        EE.UU., gratuita y sin llave). Son unos cuatro minutos por unidad.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2">
        <span className="text-ink">Está prohibido</span> guardar en esta base de
        datos inventario de MarketCheck, Auto.dev, eBay, Autotrader, CarGurus,
        Cars.com, TrueCar, AutoTempest o Facebook Marketplace. Sus contratos
        prohíben textualmente almacenar, cachear o indexar sus datos y obligan a
        borrarlos a las seis horas. Un solo registro guardado es incumplimiento
        de contrato y revocación de la llave. No es una limitación técnica que
        se pueda optimizar más adelante.
      </p>
      <p className="mt-3 text-xs text-ink-3">
        La vía legal para escalar son feeds XML de dealers partner con licencia
        firmada. Detalle en <code className="text-silver">supabase/README.md</code>{" "}
        y <code className="text-silver">src/lib/db/types.ts</code>.
      </p>
    </section>
  );
}

type Snapshot = {
  metrics: PortalMetrics;
  issues: string[];
  /** `true` una vez que las consultas respondieron al menos una vez. */
  loaded: boolean;
};

const EMPTY_SNAPSHOT: Snapshot = {
  metrics: EMPTY_METRICS,
  issues: [],
  loaded: false,
};

export function PortalDashboard({ dbStatus }: { dbStatus: DbStatus }) {
  const { status: sessionStatus, client } = usePortalSession();
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [refreshing, setRefreshing] = useState(false);

  const sinDatos = sessionStatus === "sin-configurar" || !dbStatus.configured;
  const puedeConsultar =
    !sinDatos && sessionStatus === "autenticado" && client !== null;

  // Carga inicial. Todo `setState` ocurre DESPUÉS del `await`, nunca en el
  // cuerpo síncrono del efecto (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!puedeConsultar || !client) return;
    let cancelled = false;

    void (async () => {
      const result = await fetchPortalMetrics(client);
      if (cancelled) return;
      setSnapshot({
        metrics: result.metrics,
        issues: result.issues,
        loaded: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [client, puedeConsultar]);

  // Recarga manual. Acá sí se puede actualizar estado de forma síncrona:
  // es un manejador de evento, no un efecto.
  const refresh = useCallback(async () => {
    if (!client) return;
    setRefreshing(true);
    const result = await fetchPortalMetrics(client);
    setSnapshot({
      metrics: result.metrics,
      issues: result.issues,
      loaded: true,
    });
    setRefreshing(false);
  }, [client]);

  const { metrics, issues } = snapshot;
  // Estado derivado, no almacenado: hay menos formas de que quede incoherente.
  const loading = puedeConsultar && (!snapshot.loaded || refreshing);

  const mes = currentMonthLabel();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light tracking-wide text-ink">Tablero</h1>
          <p className="mt-1 text-sm text-ink-3">
            Estado del negocio · {mes}
          </p>
        </div>
        {puedeConsultar ? (
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lux border border-line px-4 py-2 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        ) : null}
      </header>

      {sinDatos ? <SetupNotice status={dbStatus} /> : null}

      {issues.length > 0 ? (
        <section
          role="status"
          className="rounded-lux border border-line bg-surface px-5 py-4"
        >
          <p className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
            Algunos indicadores no se pudieron leer
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ink-2">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Indicadores">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            label="Unidades en stock"
            value={metrics.stockDisponible}
            caption="Disponibles para venta inmediata."
            loading={loading}
          />
          <MetricCard
            label="Reservadas"
            value={metrics.reservados}
            caption="Con seña o compromiso de compra."
            loading={loading}
          />
          <MetricCard
            label={`Vendidas en ${mes}`}
            value={metrics.vendidosDelMes}
            caption="Cuenta las que tienen fecha de venta registrada."
            tone="oro"
            loading={loading}
          />
          <MetricCard
            label="Leads sin atender"
            value={metrics.leadsSinAtender}
            caption="Consultas en estado nuevo. Nadie las tocó todavía."
            tone={metrics.leadsSinAtender > 0 ? "atencion" : "neutro"}
            loading={loading}
          />
          <MetricCard
            label="Consignaciones activas"
            value={metrics.consignacionesActivas}
            caption="Autos de terceros en venta, sin exclusividad."
            loading={loading}
          />
          <MetricCard
            label="En tránsito"
            value={metrics.enTransito}
            caption="Importaciones en camino a Callao."
            loading={loading}
          />
        </div>

        {metrics.sinPublicar > 0 ? (
          <p className="mt-4 text-xs text-ink-3">
            {metrics.sinPublicar}{" "}
            {metrics.sinPublicar === 1
              ? "unidad disponible no está publicada"
              : "unidades disponibles no están publicadas"}
            : no aparecen en la web hasta marcarlas como publicadas y cargarles
            fotos.
          </p>
        ) : null}
      </section>

      <LegalNotice />
    </div>
  );
}
