"use client";

/**
 * Pantalla de consignaciones del portal.
 *
 * Lee con la sesión del equipo desde el NAVEGADOR (RLS evalúa `authenticated`),
 * nunca desde el servidor con `DATABASE_URL`. Acá hay teléfonos de dueños y
 * precios mínimos autorizados: ver el encabezado de `queries.ts`.
 *
 * FUNCIONA CON DATOS VACÍOS.
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
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConsignmentsTable } from "./ConsignmentsTable";
import {
  CONSIGNMENT_STATUSES,
  CONSIGNMENT_STATUS_LABEL,
  summarizeConsignments,
  type AmountsByCurrency,
  type ConsignmentStatus,
  type PortalConsignment,
} from "./model";
import {
  fetchConsignments,
  markSoldByOwner,
  updateConsignmentStatus,
  type ConsignmentMutationResult,
} from "./queries";

const SETUP_STEPS = [
  "Aplica las migraciones de db/migrations/ en el proyecto de Neon y activa ahí la Data API y Neon Auth.",
  "Carga NEXT_PUBLIC_NEON_URL y NEON_AUTH_COOKIE_SECRET en Vercel y en .env.local.",
  "Registra la primera consignación con el precio pedido y el piso autorizado por el dueño.",
];

const NO_SESSION_MESSAGE =
  "Sin sesión activa: el cambio no se guardó. Vuelve a iniciar sesión en el portal.";

/**
 * Un total por moneda, nunca la suma de soles con dólares: "US$ 120,000 ·
 * S/ 80,000". Las monedas en cero no se muestran; si todo es cero, un guion.
 */
function formatAmounts(amounts: AmountsByCurrency): string {
  const parts = (["USD", "PEN"] as const)
    .filter((currency) => amounts[currency] > 0)
    .map((currency) => formatCurrency(amounts[currency], "es-PE", currency));
  return parts.length ? parts.join(" · ") : "—";
}

export function ConsignmentsScreen() {
  const { status: sessionStatus, client } = usePortalSession();

  const [consignments, setConsignments] = useState<PortalConsignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [applied, setApplied] = useState<{
    status: ConsignmentStatus | "";
    search: string;
  }>({ status: "", search: "" });
  const [draft, setDraft] = useState(applied);

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setConsignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await fetchConsignments(client, {
      status: applied.status || null,
      search: applied.search || null,
    });
    setConsignments(result.consignments);
    setError(result.error);
    setLoading(false);
  }, [client, canQuery, applied]);

  useEffect(() => {
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

  const handleMarkSoldByOwner = useCallback(
    async (input: {
      id: string;
      notes?: string | null;
    }): Promise<ConsignmentMutationResult> => {
      if (!client) return { ok: false, message: NO_SESSION_MESSAGE };
      const result = await markSoldByOwner(client, input);
      if (result.ok) void load();
      return result;
    },
    [client, load],
  );

  const handleChangeStatus = useCallback(
    async (input: {
      id: string;
      status: ConsignmentStatus;
    }): Promise<ConsignmentMutationResult> => {
      if (!client) return { ok: false, message: NO_SESSION_MESSAGE };
      const result = await updateConsignmentStatus(client, input);
      if (result.ok) void load();
      return result;
    },
    [client, load],
  );

  const summary = useMemo(
    () => summarizeConsignments(consignments),
    [consignments],
  );

  const hasFilters = Boolean(applied.status || applied.search);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied(draft);
  }

  function clearFilters() {
    const empty = { status: "" as const, search: "" };
    setDraft(empty);
    setApplied(empty);
  }

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Portal · Administración"
        title="Consignaciones"
        description="Autos de clientes que LuxCars vende sin comprarlos. No hay contrato de exclusividad: el dueño sigue usando su auto y, si lo vende por su cuenta, no paga comisión."
        actions={
          <Link
            href="/portal/leads"
            className="inline-flex items-center rounded-full border border-line-strong px-5 py-3 text-xs font-medium uppercase tracking-[0.16em] text-ink transition-colors hover:border-silver hover:bg-surface-2"
          >
            Leads
          </Link>
        }
      />

      <StatGrid>
        <StatCard
          label="En cartera"
          value={summary.open.length}
          hint={
            summary.averageDaysOpen
              ? `${summary.averageDaysOpen} días promedio publicados`
              : "Sin consignaciones abiertas"
          }
        />
        <StatCard
          label="Valor publicado"
          value={formatAmounts(summary.activePortfolioValue)}
          hint="Precios pedidos abiertos, por moneda"
        />
        {/* Oro: el único dato destacado de la pantalla. */}
        <StatCard
          label="Comisión proyectada"
          value={formatAmounts(summary.pipelineCommission)}
          hint="Si se cierran a precio pedido, por moneda"
          tone="accent"
        />
        <StatCard
          label="Vendidos por el dueño"
          value={summary.countsByStatus.vendida_por_dueno}
          hint="Cerrados sin comisión"
        />
      </StatGrid>

      <Notice tone="info" label="Sin contrato de exclusividad">
        Es la promesa de esta línea de negocio, y el sistema la respeta: ninguna
        consignación puede registrarse como exclusiva (la base lo impide por
        diseño) y la acción <strong>“Vendido por el dueño”</strong> cierra el
        caso en cero, sin comisión ni penalidad. Si un auto se vende solo, eso
        no es una fuga: es lo que se le prometió al cliente.
      </Notice>

      {sessionStatus === "sin-configurar" ? (
        <Notice tone="warn" label="Sin base de datos conectada">
          La pantalla funciona, pero no hay nada que listar todavía. Las
          consignaciones se registran a mano desde el portal en cuanto se conecte
          la base de Neon.
        </Notice>
      ) : null}

      {error ? (
        <Notice tone="danger" label="Error de lectura">
          {error}
        </Notice>
      ) : null}

      <PortalPanel
        title="Autos en consignación"
        description="Más recientes primero. El precio mínimo va oculto: es información reservada de la negociación."
        toolbar={
          <form
            onSubmit={applyFilters}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <label className="sr-only" htmlFor="q">
              Buscar consignación
            </label>
            <input
              id="q"
              value={draft.search}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, search: event.target.value }))
              }
              placeholder="Dueño, teléfono, marca, placa…"
              className="w-full rounded-lux border border-line bg-surface-2 px-3 py-2 text-xs text-ink placeholder:text-ink-4 sm:w-56"
            />

            <label className="sr-only" htmlFor="estado">
              Estado
            </label>
            <select
              id="estado"
              value={draft.status}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  status: event.target.value as ConsignmentStatus | "",
                }))
              }
              className="rounded-lux border border-line bg-surface-2 px-3 py-2 text-xs text-ink"
            >
              <option value="">Todos los estados</option>
              {CONSIGNMENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {CONSIGNMENT_STATUS_LABEL[value]}
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
        {/* El "Cargando…" solo reemplaza la tabla cuando todavía no hay nada que
            mostrar. Una recarga después de un cambio deja la tabla MONTADA: si
            se desmontara, se perdería la confirmación local ("Estado
            actualizado.") antes de que el equipo alcance a leerla. */}
        {loading && consignments.length === 0 ? (
          <p className="px-5 py-16 text-center text-sm text-ink-3" role="status">
            Cargando consignaciones…
          </p>
        ) : consignments.length ? (
          <div
            aria-busy={loading}
            className={loading ? "opacity-70 transition-opacity" : "transition-opacity"}
          >
            <ConsignmentsTable
              consignments={consignments}
              canWrite={canQuery}
              onMarkSoldByOwner={handleMarkSoldByOwner}
              onChangeStatus={handleChangeStatus}
            />
          </div>
        ) : (
          <EmptyState
            title={
              hasFilters
                ? "Ninguna consignación coincide con el filtro"
                : "Todavía no hay autos en consignación"
            }
            description={
              hasFilters
                ? "Prueba con otro estado o limpia los filtros para ver la cartera completa."
                : "Cada consignación se registra a mano: dueño, vehículo, precio pedido, piso autorizado y comisión pactada. El auto sigue siendo del cliente y solo se publica en el stock si él lo autoriza."
            }
            steps={
              hasFilters || sessionStatus !== "sin-configurar"
                ? undefined
                : SETUP_STEPS
            }
          />
        )}
      </PortalPanel>

      <Notice tone="warn" label="Precio mínimo · dato reservado">
        El piso autorizado por el dueño no se comparte con el comprador, no se
        imprime en la ficha pública y no sale del portal. Si se filtra, se acabó
        la negociación.
      </Notice>
    </div>
  );
}
