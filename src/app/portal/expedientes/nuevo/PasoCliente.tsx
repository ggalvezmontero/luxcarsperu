"use client";

/**
 * Paso 1: el cliente del mandato. Buscar uno existente, crear uno nuevo o
 * partir de una solicitud de compra de /cuenta (precarga auto y cliente).
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Badge, PortalPanel } from "@/components/portal/CrmUI";
import { ClienteForm } from "@/components/portal/expedientes/ClienteForm";
import { Entrada, Selector } from "@/components/portal/expedientes/Formulario";
import { fetchPurchaseRequests, type AdminPurchaseRequest } from "@/app/portal/solicitudes/queries";
import type { Cliente } from "@/core/expedientes/tipos";
import { cargarCliente, crearCliente, listarClientes } from "@/lib/expedientes/consultas";
import { TIPO_CLIENTE_LABEL } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";
import type { EstadoAlta } from "./estado";

export function PasoCliente({
  client,
  estado,
  actualizar,
  solicitudParam,
}: {
  client: PortalClient;
  estado: EstadoAlta;
  actualizar: (cambios: Partial<EstadoAlta> | ((previo: EstadoAlta) => EstadoAlta)) => void;
  solicitudParam: string | null;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(false);
  const [modo, setModo] = useState<"buscar" | "crear">("buscar");
  const [solicitudes, setSolicitudes] = useState<AdminPurchaseRequest[]>([]);
  const [prellenado, setPrellenado] = useState<{ razon_social: string; email: string; telefono: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCargando(true);
    const t = setTimeout(() => {
      void listarClientes(client, busqueda).then((r) => {
        if (cancelled) return;
        setClientes(r.clientes);
        setCargando(false);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [client, busqueda]);

  useEffect(() => {
    let cancelled = false;
    void fetchPurchaseRequests(client).then((r) => {
      if (!cancelled) setSolicitudes(r.requests.filter((s) => s.status === "nueva" || s.status === "en_busqueda" || s.status === "propuesta_enviada"));
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  // `?solicitud=<id>` precarga apenas la lista llega.
  useEffect(() => {
    if (!solicitudParam || estado.origenSolicitudId) return;
    const s = solicitudes.find((x) => x.id === solicitudParam);
    if (s) void aplicarSolicitud(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudParam, solicitudes]);

  async function aplicarSolicitud(s: AdminPurchaseRequest) {
    actualizar((previo) => ({
      ...previo,
      origenSolicitudId: s.id,
      vehiculo: {
        ...previo.vehiculo,
        marca: s.brand,
        modelo: s.model,
        anio: previo.vehiculo.anio || String(s.yearMax ?? s.yearMin ?? ""),
        condicion: s.condition === "usado" ? "usado" : "nuevo",
      },
    }));
    const email = s.requester.email?.toLowerCase() ?? "";
    if (email) {
      const r = await listarClientes(client, email);
      const existente = r.clientes.find((c) => c.email === email);
      if (existente) {
        actualizar({ cliente: existente });
        setAviso(`Solicitud enlazada. El cliente ${existente.razonSocial} ya estaba registrado.`);
        return;
      }
    }
    setPrellenado({ razon_social: s.requester.name, email, telefono: s.requester.phone ?? "" });
    setModo("crear");
    setAviso("Solicitud enlazada. El cliente no existía: completa su ficha para crearlo.");
  }

  return (
    <div className="space-y-6">
      {solicitudes.length > 0 ? (
        <PortalPanel title="Desde una solicitud de compra" description="Precarga marca, modelo y cliente de un pedido de búsqueda de luxcars.pe/cuenta y lo deja enlazado.">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <Selector
              value={estado.origenSolicitudId ?? ""}
              onChange={(e) => {
                const s = solicitudes.find((x) => x.id === e.target.value);
                if (s) void aplicarSolicitud(s);
                else actualizar({ origenSolicitudId: null });
              }}
            >
              <option value="">Sin solicitud (expediente en blanco)</option>
              {solicitudes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.brand} {s.model} · {s.requester.name}
                </option>
              ))}
            </Selector>
          </div>
          {aviso ? <p className="px-5 pb-4 text-xs text-ink-3">{aviso}</p> : null}
        </PortalPanel>
      ) : null}

      {estado.cliente ? (
        <PortalPanel title="Cliente del mandato">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-ink">{estado.cliente.razonSocial}</p>
              <p className="mt-0.5 text-xs text-ink-3">
                {TIPO_CLIENTE_LABEL[estado.cliente.tipo]} · {estado.cliente.ruc ? `RUC ${estado.cliente.ruc}` : `DNI ${estado.cliente.dni}`}
                {estado.cliente.email ? ` · ${estado.cliente.email}` : ""}
              </p>
              <div className="mt-2 flex gap-2">
                <Badge tone={estado.cliente.kycCompleto ? "ok" : "warn"}>{estado.cliente.kycCompleto ? "KYC completo" : "KYC pendiente"}</Badge>
                <Badge tone={estado.cliente.userId ? "ok" : "neutral"}>{estado.cliente.userId ? "Cuenta vinculada" : "Sin cuenta"}</Badge>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => actualizar({ cliente: null })}>Cambiar</Button>
          </div>
        </PortalPanel>
      ) : (
        <PortalPanel
          title="¿Quién compra?"
          toolbar={
            <div className="inline-flex rounded-full border border-line bg-surface p-1 text-xs">
              {(["buscar", "crear"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setModo(m)} className={`rounded-full px-3 py-1.5 ${modo === m ? "bg-ink text-void" : "text-ink-3"}`}>
                  {m === "buscar" ? "Buscar" : "Crear nuevo"}
                </button>
              ))}
            </div>
          }
        >
          {modo === "buscar" ? (
            <div className="space-y-3 px-5 py-4">
              <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Razón social, RUC, DNI o correo" aria-label="Buscar cliente" />
              {cargando ? (
                <p className="text-xs text-ink-4">Buscando…</p>
              ) : clientes.length === 0 ? (
                <p className="text-xs text-ink-4">Ningún cliente registrado{busqueda ? " con ese texto" : ""}. Créalo en la pestaña «Crear nuevo».</p>
              ) : (
                <ul className="divide-y divide-line">
                  {clientes.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{c.razonSocial}</p>
                        <p className="truncate text-xs text-ink-3">
                          {c.ruc ? `RUC ${c.ruc}` : c.dni ? `DNI ${c.dni}` : ""}
                          {c.email ? ` · ${c.email}` : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const completo = await cargarCliente(client, c.id);
                          actualizar({ cliente: completo ?? c });
                        }}
                      >
                        Elegir
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="px-5 py-4">
              <ClienteForm
                key={prellenado?.email ?? "nuevo"}
                cliente={null}
                compacto
                prellenado={prellenado ?? undefined}
                textoGuardar="Crear y usar este cliente"
                onGuardar={async (datos) => {
                  const r = await crearCliente(client, datos);
                  if (r.ok && r.id) {
                    const creado = await cargarCliente(client, r.id);
                    if (creado) actualizar({ cliente: creado });
                  }
                  return r;
                }}
              />
            </div>
          )}
        </PortalPanel>
      )}
    </div>
  );
}
