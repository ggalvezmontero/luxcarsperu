"use client";

/**
 * Clientes del mandato: lista con búsqueda, crear, editar (datos y KYC),
 * vincular la cuenta de /cuenta a mano y ver sus expedientes.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Badge, EmptyState, Notice, PortalPageHeader, PortalPanel, StatCard, StatGrid } from "@/components/portal/CrmUI";
import { ClienteForm } from "@/components/portal/expedientes/ClienteForm";
import { Entrada } from "@/components/portal/expedientes/Formulario";
import { EtapaBadge } from "@/components/portal/expedientes/Piezas";
import { usePortalSession } from "@/components/portal/portalSession";
import type { Cliente, EtapaExpediente } from "@/core/expedientes/tipos";
import { actualizarCliente, crearCliente, listarClientes, listarExpedientesDeCliente } from "@/lib/expedientes/consultas";
import { TIPO_CLIENTE_LABEL, fecha } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";
import { VinculoCuenta } from "../expedientes/[id]/PestanaCliente";

export function ClientesScreen() {
  const { status: sessionStatus, client } = usePortalSession();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setClientes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = await listarClientes(client, busqueda);
    setClientes(r.clientes);
    setError(r.error);
    setLoading(false);
  }, [client, canQuery, busqueda]);

  useEffect(() => {
    if (sessionStatus === "verificando") return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) void load();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [load, sessionStatus]);

  const notify = (r: { ok: boolean; message: string }) => {
    setFlash({ ok: r.ok, text: r.message });
    if (r.ok) void load();
  };

  const sinCuenta = clientes.filter((c) => !c.userId).length;
  const kycPendiente = clientes.filter((c) => !c.kycCompleto).length;

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Clientes"
        title="Clientes del mandato"
        description="Quien firma el contrato de importación. Con su cuenta vinculada sigue el expediente desde luxcars.pe/cuenta."
        actions={<Button size="sm" onClick={() => setCreando((v) => !v)}>{creando ? "Cerrar" : "Nuevo cliente"}</Button>}
      />

      <StatGrid>
        <StatCard label="Clientes" value={clientes.length} />
        <StatCard label="Sin cuenta vinculada" value={sinCuenta} tone={sinCuenta > 0 ? "warn" : "default"} hint="No pueden seguir su expediente." />
        <StatCard label="KYC pendiente" value={kycPendiente} tone={kycPendiente > 0 ? "warn" : "default"} />
        <StatCard label="Empresas" value={clientes.filter((c) => c.tipo === "empresa").length} />
      </StatGrid>

      {error ? <Notice tone="warn" label="No se pudo leer">{error}</Notice> : null}
      {flash ? <Notice tone={flash.ok ? "info" : "danger"} label={flash.ok ? "Listo" : "No se pudo"}>{flash.text}</Notice> : null}

      {creando && client ? (
        <PortalPanel title="Nuevo cliente">
          <div className="px-5 py-4">
            <ClienteForm
              cliente={null}
              onGuardar={async (datos) => {
                const r = await crearCliente(client, datos);
                if (r.ok) setCreando(false);
                notify(r);
                return r;
              }}
              onCancelar={() => setCreando(false)}
            />
          </div>
        </PortalPanel>
      ) : null}

      <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por razón social, RUC, DNI o correo" aria-label="Buscar cliente" />

      {loading ? (
        <p className="py-10 text-sm text-ink-3">Cargando…</p>
      ) : clientes.length === 0 ? (
        <div className="rounded-lux-lg border border-line bg-surface">
          <EmptyState title="Ningún cliente" description={busqueda ? "Ninguno coincide con la búsqueda." : "Crea el primero con el botón Nuevo cliente, o desde el asistente de expediente."} />
        </div>
      ) : (
        <ul className="space-y-3">
          {clientes.map((c) => (
            <li key={c.id} className="rounded-lux-lg border border-line bg-surface">
              <button type="button" onClick={() => setAbierto(abierto === c.id ? null : c.id)} className="flex w-full flex-col gap-2 px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{c.razonSocial}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-3">
                    {TIPO_CLIENTE_LABEL[c.tipo]} · {c.ruc ? `RUC ${c.ruc}` : c.dni ? `DNI ${c.dni}` : "sin documento"}
                    {c.email ? ` · ${c.email}` : ""}
                    {c.telefono ? ` · ${c.telefono}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Badge tone={c.kycCompleto ? "ok" : "warn"}>{c.kycCompleto ? "KYC completo" : "KYC pendiente"}</Badge>
                  <Badge tone={c.userId ? "ok" : "neutral"}>{c.userId ? "Cuenta vinculada" : "Sin cuenta"}</Badge>
                  <span className="text-xs text-ink-4">{fecha(c.createdAt)}</span>
                </div>
              </button>
              {abierto === c.id && client ? <DetalleCliente client={client} cliente={c} onResultado={notify} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetalleCliente({ client, cliente, onResultado }: { client: PortalClient; cliente: Cliente; onResultado: (r: { ok: boolean; message: string }) => void }) {
  const [expedientes, setExpedientes] = useState<{ id: string; codigo: string; etapa: EtapaExpediente; auto: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listarExpedientesDeCliente(client, cliente.id).then((r) => {
      if (!cancelled) setExpedientes(r);
    });
    return () => {
      cancelled = true;
    };
  }, [client, cliente.id]);

  return (
    <div className="grid gap-6 border-t border-line px-5 py-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <ClienteForm cliente={cliente} onGuardar={async (datos) => { const r = await actualizarCliente(client, cliente.id, datos); onResultado(r); return r; }} />
      </div>
      <div className="space-y-6">
        <VinculoCuenta client={client} clienteId={cliente.id} userId={cliente.userId} email={cliente.email} onResultado={onResultado} />
        <PortalPanel title="Expedientes">
          {expedientes === null ? (
            <p className="px-5 py-4 text-xs text-ink-4">Cargando…</p>
          ) : expedientes.length === 0 ? (
            <div className="px-5 py-4">
              <p className="text-xs text-ink-4">Sin expedientes.</p>
              <Button href="/portal/expedientes/nuevo" size="sm" variant="secondary" className="mt-3">Abrir uno</Button>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {expedientes.map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <Link href={`/portal/expedientes/${e.id}`} className="flex items-center justify-between gap-3 text-sm hover:text-silver">
                    <span>
                      <span className="font-mono text-xs text-silver">{e.codigo}</span>
                      <span className="block text-ink">{e.auto}</span>
                    </span>
                    <EtapaBadge etapa={e.etapa} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PortalPanel>
      </div>
    </div>
  );
}
