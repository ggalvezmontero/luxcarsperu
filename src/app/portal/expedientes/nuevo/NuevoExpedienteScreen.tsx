"use client";

/**
 * Asistente de alta de expediente: cliente → vehículo → compra y embarque →
 * presupuesto. Crea con la función `crear_expediente` en una transacción.
 *
 * Opción "desde solicitud de compra": precarga marca, modelo y cliente de un
 * pedido de búsqueda de /cuenta y lo enlaza (`origen_solicitud_id`); al crear,
 * la solicitud pasa a "propuesta enviada".
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Notice, PortalPageHeader } from "@/components/portal/CrmUI";
import { usePortalSession } from "@/components/portal/portalSession";
import type { Embarque } from "@/core/expedientes/tipos";
import { crearExpediente, listarEmbarques } from "@/lib/expedientes/consultas";
import { cn } from "@/lib/utils";
import { PasoCliente } from "./PasoCliente";
import { PasoCompra } from "./PasoCompra";
import { PasoPresupuesto } from "./PasoPresupuesto";
import { PasoVehiculo } from "./PasoVehiculo";
import {
  ESTADO_INICIAL,
  calcularPresupuesto,
  construirDatos,
  validarCompra,
  validarVehiculo,
  type EstadoAlta,
  type Paso,
} from "./estado";

const PASOS: { n: Paso; label: string }[] = [
  { n: 1, label: "Cliente" },
  { n: 2, label: "Vehículo" },
  { n: 3, label: "Compra y embarque" },
  { n: 4, label: "Presupuesto" },
];

export function NuevoExpedienteScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const solicitudParam = params?.get("solicitud") ?? null;
  const { status: sessionStatus, client } = usePortalSession();
  const [estado, setEstado] = useState<EstadoAlta>(ESTADO_INICIAL);
  const [embarques, setEmbarques] = useState<Embarque[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  useEffect(() => {
    if (!client || !canQuery) return;
    let cancelled = false;
    void listarEmbarques(client).then((r) => {
      if (!cancelled) setEmbarques(r.embarques);
    });
    return () => {
      cancelled = true;
    };
  }, [client, canQuery]);

  const actualizar = useCallback((cambios: Partial<EstadoAlta> | ((previo: EstadoAlta) => EstadoAlta)) => {
    setEstado((previo) => (typeof cambios === "function" ? cambios(previo) : { ...previo, ...cambios }));
  }, []);

  const embarqueElegido = useMemo(
    () => (estado.compra.embarqueModo === "existente" ? embarques.find((e) => e.id === estado.compra.embarque_id) ?? null : null),
    [embarques, estado.compra.embarqueModo, estado.compra.embarque_id],
  );

  const irA = (paso: Paso) => {
    setError(null);
    actualizar({ paso });
  };

  const siguiente = () => {
    setError(null);
    if (estado.paso === 1 && !estado.cliente) return setError("Elige o crea el cliente antes de seguir.");
    if (estado.paso === 2) {
      const e = validarVehiculo(estado.vehiculo);
      if (e) return setError(e);
    }
    if (estado.paso === 3) {
      const e = validarCompra(estado.compra);
      if (e) return setError(e);
    }
    if (estado.paso < 4) actualizar({ paso: (estado.paso + 1) as Paso });
  };

  const crear = async () => {
    if (!client || !estado.cliente) return;
    const { presupuesto, error: errorCalculo } = calcularPresupuesto(estado);
    if (!presupuesto) return setError(errorCalculo ?? "No se pudo calcular el presupuesto.");
    setBusy(true);
    const r = await crearExpediente(client, construirDatos(estado, presupuesto, embarqueElegido));
    setBusy(false);
    if (!r.ok || !r.id) return setError(r.message);
    router.push(`/portal/expedientes/${r.id}`);
  };

  return (
    <div className="mt-6 space-y-8">
      <PortalPageHeader
        eyebrow="Nuevo expediente"
        title="Abrir una importación a pedido"
        description="Cuatro pasos: quién compra, qué auto, cómo se compra y viaja, y cuánto cuesta. Todo se puede corregir después desde el expediente."
      />

      <ol className="flex flex-wrap gap-2" aria-label="Pasos">
        {PASOS.map((p) => {
          const hecho = estado.paso > p.n;
          const activo = estado.paso === p.n;
          return (
            <li key={p.n}>
              <button
                type="button"
                onClick={() => (hecho ? irA(p.n) : undefined)}
                disabled={!hecho && !activo}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                  activo ? "border-line-strong bg-surface-2 text-ink" : hecho ? "border-line text-ink-2 hover:text-ink" : "border-line text-ink-4",
                )}
              >
                <span className="font-mono text-silver">{String(p.n).padStart(2, "0")}</span>
                {p.label}
              </button>
            </li>
          );
        })}
      </ol>

      {!canQuery && sessionStatus !== "verificando" ? (
        <Notice tone="warn" label="Sin sesión">Hace falta una sesión de administrador para abrir expedientes.</Notice>
      ) : null}

      {estado.paso === 1 && client ? (
        <PasoCliente client={client} estado={estado} actualizar={actualizar} solicitudParam={solicitudParam} />
      ) : null}
      {estado.paso === 2 ? <PasoVehiculo estado={estado} actualizar={actualizar} /> : null}
      {estado.paso === 3 ? <PasoCompra estado={estado} actualizar={actualizar} embarques={embarques} /> : null}
      {estado.paso === 4 ? <PasoPresupuesto estado={estado} actualizar={actualizar} embarqueElegido={embarqueElegido} /> : null}

      {error ? (
        <p role="alert" className="text-sm text-danger">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        <Button type="button" variant="ghost" size="sm" disabled={estado.paso === 1} onClick={() => irA((estado.paso - 1) as Paso)}>
          Atrás
        </Button>
        {estado.paso < 4 ? (
          <Button type="button" size="sm" onClick={siguiente}>Siguiente</Button>
        ) : (
          <Button type="button" size="sm" onClick={() => void crear()} disabled={busy || !canQuery}>
            {busy ? "Creando…" : "Crear expediente"}
          </Button>
        )}
      </div>
    </div>
  );
}
