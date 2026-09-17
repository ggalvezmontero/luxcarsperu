"use client";

/**
 * Pantalla de leads del portal.
 *
 * Lee con la sesión del equipo desde el NAVEGADOR (RLS evalúa `authenticated`),
 * nunca desde el servidor con `service_role`: esa llave salta las políticas y
 * el HTML saldría con los datos personales dentro antes de cualquier guard.
 * Ver `queries.ts` y `src/lib/portal/supabaseBrowser.ts`.
 *
 * FUNCIONA CON DATOS VACÍOS: sin Supabase configurado muestra el estado vacío
 * con los pasos de configuración; sin leads, explica de dónde van a salir.
 */

import {
  EmptyState,
  Notice,
  PortalPageHeader,
  PortalPanel,
  StatCard,
  StatGrid,
} from "@/components/portal/CrmUI";
import { usePortalSession } from "@/components/portal/portalSession";
import { LEAD_ORIGINS, type LeadOrigin, type LeadStatus } from "@/lib/db/types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LeadsTable } from "./LeadsTable";
import {
  LEAD_ORIGIN_LABEL,
  LEAD_STAGES,
  countLeadsByStatus,
  emptyLeadCounts,
  type PortalLead,
} from "./model";
import {
  fetchLeads,
  markWhatsappOpened,
  updateLeadStatus,
  type LeadMutationResult,
} from "./queries";

const SETUP_STEPS = [
  "Crea el proyecto en Supabase (organización zvwegcanushbpmjtohnp) y aplica las migraciones de supabase/migrations/.",
  "Carga NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel y en .env.local.",
  "Crea tu cuenta en luxcars.pe/cuenta/login y pide a un administrador que te asigne el rol admin desde /portal/usuarios.",
];

export function LeadsScreen() {
  const { status: sessionStatus, client } = usePortalSession();

  const [leads, setLeads] = useState<PortalLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros aplicados (los que ya se consultaron) y el borrador del formulario.
  const [applied, setApplied] = useState<{
    status: LeadStatus | "";
    origin: LeadOrigin | "";
    search: string;
  }>({ status: "", origin: "", search: "" });
  const [draft, setDraft] = useState(applied);

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setLeads([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await fetchLeads(client, {
      status: applied.status || null,
      origin: applied.origin || null,
      search: applied.search || null,
    });
    setLeads(result.leads);
    setError(result.error);
    setLoading(false);
  }, [client, canQuery, applied]);

  useEffect(() => {
    // `sin-configurar` y `anonimo` no consultan: no hay a quién preguntarle.
    if (sessionStatus === "verificando") return;

    // En un microtask, no en el cuerpo del efecto: `load()` empieza con un
    // `setLoading(true)` síncrono y eso dispara renders en cascada
    // (react-hooks/set-state-in-effect). Mismo patrón que `portalSession.tsx`.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });

    return () => {
      cancelled = true;
    };
  }, [load, sessionStatus]);

  const handleUpdateStatus = useCallback(
    async (input: {
      id: string;
      status: LeadStatus;
      lostReason?: string | null;
    }): Promise<LeadMutationResult> => {
      if (!client) {
        return {
          ok: false,
          message: "Sin base de datos configurada: el cambio no se guardó.",
        };
      }
      const result = await updateLeadStatus(client, input);
      if (result.ok) {
        // Actualización local inmediata; la recarga confirma contra la base.
        setLeads((current) =>
          current.map((lead) =>
            lead.id === input.id
              ? {
                  ...lead,
                  status: input.status,
                  lostReason:
                    input.status === "perdido"
                      ? (input.lostReason ?? "").trim() || lead.lostReason
                      : null,
                }
              : lead,
          ),
        );
        void load();
      }
      return result;
    },
    [client, load],
  );

  const handleWhatsappOpen = useCallback(
    (lead: PortalLead) => {
      if (!client) return;
      setLeads((current) =>
        current.map((item) =>
          item.id === lead.id ? { ...item, whatsappSent: true } : item,
        ),
      );
      void markWhatsappOpened(client, lead.id);
    },
    [client],
  );

  const counts = useMemo(
    () => (leads.length ? countLeadsByStatus(leads) : emptyLeadCounts()),
    [leads],
  );

  const openCount = LEAD_STAGES.filter(
    (stage) => stage.group === "abierto",
  ).reduce((total, stage) => total + counts[stage.id], 0);

  const stale = leads.filter(
    (lead) => lead.status === "nuevo" && lead.ageDays >= 2,
  ).length;

  const hasFilters = Boolean(applied.status || applied.origin || applied.search);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied(draft);
  }

  function clearFilters() {
    const empty = { status: "" as const, origin: "" as const, search: "" };
    setDraft(empty);
    setApplied(empty);
  }

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Portal · Administración"
        title="Leads"
        description="Todas las consultas que entran por la calculadora, el stock, el formulario de contacto y consignación. El cliente no tiene cuenta: desde acá se le escribe por WhatsApp con el mensaje ya armado."
        actions={
          <Link
            href="/portal/consignaciones"
            className="inline-flex items-center rounded-full border border-line-strong px-5 py-3 text-xs font-medium uppercase tracking-[0.16em] text-ink transition-colors hover:border-silver hover:bg-surface-2"
          >
            Consignaciones
          </Link>
        }
      />

      <StatGrid>
        {/* Oro: el único dato destacado de la pantalla. Es lo que hay que hacer hoy. */}
        <StatCard
          label="Nuevos sin contactar"
          value={counts.nuevo}
          hint={stale ? `${stale} con 2 días o más de espera` : "Al día"}
          tone="accent"
        />
        <StatCard label="En el embudo" value={openCount} hint="Etapas abiertas" />
        <StatCard label="Cerrados / ganados" value={counts.ganado} tone="ok" />
        <StatCard label="Perdidos" value={counts.perdido} tone="danger" />
      </StatGrid>

      {sessionStatus === "sin-configurar" ? (
        <Notice tone="warn" label="Sin base de datos conectada">
          La pantalla funciona, pero no hay nada que listar todavía. Mientras
          tanto, los formularios del sitio siguen derivando a cada cliente al
          WhatsApp de LuxCars: ningún lead se pierde.
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="danger" label="Error de lectura">
          {error}
        </Notice>
      ) : null}

      <PortalPanel
        title="Embudo"
        description="Del más reciente al más antiguo. Máximo 200 registros por vista."
        toolbar={
          <form
            onSubmit={applyFilters}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <label className="sr-only" htmlFor="q">
              Buscar lead
            </label>
            <input
              id="q"
              value={draft.search}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, search: event.target.value }))
              }
              placeholder="Nombre, teléfono, correo, marca…"
              className="w-full rounded-lux border border-line bg-surface-2 px-3 py-2 text-xs text-ink placeholder:text-ink-4 sm:w-56"
            />

            <label className="sr-only" htmlFor="estado">
              Etapa
            </label>
            <select
              id="estado"
              value={draft.status}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  status: event.target.value as LeadStatus | "",
                }))
              }
              className="rounded-lux border border-line bg-surface-2 px-3 py-2 text-xs text-ink"
            >
              <option value="">Todas las etapas</option>
              {LEAD_STAGES.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="origen">
              Origen
            </label>
            <select
              id="origen"
              value={draft.origin}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  origin: event.target.value as LeadOrigin | "",
                }))
              }
              className="rounded-lux border border-line bg-surface-2 px-3 py-2 text-xs text-ink"
            >
              <option value="">Todos los orígenes</option>
              {LEAD_ORIGINS.map((value) => (
                <option key={value} value={value}>
                  {LEAD_ORIGIN_LABEL[value]}
                </option>
              ))}
            </select>

            <button
              type="submit"
              className="rounded-full border border-line-strong px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-ink transition-colors hover:border-silver hover:bg-surface-2"
            >
              Filtrar
            </button>

            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="px-2 text-[11px] text-silver underline underline-offset-4"
              >
                Limpiar
              </button>
            ) : null}
          </form>
        }
      >
        {loading ? (
          <p className="px-5 py-16 text-center text-sm text-ink-3" role="status">
            Cargando leads…
          </p>
        ) : leads.length ? (
          <LeadsTable
            leads={leads}
            canWrite={canQuery}
            onUpdateStatus={handleUpdateStatus}
            onWhatsappOpen={handleWhatsappOpen}
          />
        ) : (
          <EmptyState
            title={
              hasFilters
                ? "Ningún lead coincide con el filtro"
                : "Todavía no hay leads registrados"
            }
            description={
              hasFilters
                ? "Prueba con otra etapa u origen, o limpia los filtros para ver el embudo completo."
                : "Los leads aparecen acá en cuanto alguien envía la calculadora o un formulario del sitio."
            }
            steps={
              hasFilters || sessionStatus !== "sin-configurar"
                ? undefined
                : SETUP_STEPS
            }
          />
        )}
      </PortalPanel>

      <Notice tone="info" label="Datos personales · Ley 29733">
        Esta tabla contiene nombre, teléfono y correo de personas reales. No se
        exporta a herramientas externas ni se comparte fuera del equipo, y el
        sitio no registra IP ni huella de navegador de quien consulta.
      </Notice>
    </div>
  );
}
