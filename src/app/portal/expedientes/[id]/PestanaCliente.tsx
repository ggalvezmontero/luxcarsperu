"use client";

/**
 * Cliente del mandato: datos, KYC con fechas y vínculo con la cuenta de
 * /cuenta (automático por correo verificado, o a mano buscando el perfil).
 */

import { useState } from "react";
import { Button } from "@/components/Button";
import { Badge, PortalPanel } from "@/components/portal/CrmUI";
import { ClienteForm } from "@/components/portal/expedientes/ClienteForm";
import { Dato, Entrada } from "@/components/portal/expedientes/Formulario";
import type { Profile } from "@/lib/auth/perfil";
import { participacion, textoOrigenFondos, textoPep } from "@/core/expedientes/campos";
import type { ContextoExpediente } from "@/core/expedientes/tipos";
import { actualizarCliente, buscarPerfiles, vincularCuenta } from "@/lib/expedientes/consultas";
import { TIPO_CLIENTE_LABEL, fecha } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";

export function PestanaCliente({
  client,
  ctx,
  onResultado,
}: {
  client: PortalClient;
  ctx: ContextoExpediente;
  onResultado: (r: { ok: boolean; message: string }) => void;
}) {
  const c = ctx.cliente;
  const [editando, setEditando] = useState(false);

  if (!c) return <PortalPanel title="Cliente"><p className="px-5 py-6 text-sm text-ink-3">El expediente no tiene cliente.</p></PortalPanel>;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <PortalPanel
          title={c.razonSocial}
          description={`${TIPO_CLIENTE_LABEL[c.tipo]} · ${c.ruc ? `RUC ${c.ruc}` : c.dni ? `DNI ${c.dni}` : "sin documento"}`}
          toolbar={<Button size="sm" variant="secondary" onClick={() => setEditando((v) => !v)}>{editando ? "Cerrar" : "Editar"}</Button>}
        >
          {editando ? (
            <div className="px-5 py-4">
              <ClienteForm
                cliente={c}
                onGuardar={async (datos) => {
                  const r = await actualizarCliente(client, c.id, datos);
                  if (r.ok) setEditando(false);
                  onResultado(r);
                  return r;
                }}
                onCancelar={() => setEditando(false)}
              />
            </div>
          ) : (
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
              <Dato label="Correo">{c.email ?? "—"}</Dato>
              <Dato label="Teléfono">{c.telefono ?? "—"}</Dato>
              <Dato label="Domicilio">{c.domicilio ?? "—"}</Dato>
              {c.tipo === "empresa" ? (
                <>
                  <Dato label="Representante">{c.representante ? `${c.representante}${c.representanteDni ? ` · DNI ${c.representanteDni}` : ""}` : "—"}</Dato>
                  <Dato label="Cargo">{c.representanteCargo ?? "—"}</Dato>
                  <Dato label="Partida">{c.partida ?? "—"}</Dato>
                  <Dato label="Actividad">{c.actividad ?? "—"}</Dato>
                </>
              ) : null}
              <Dato label="Banco y cuenta de origen">{c.bancoOrigen ?? "Sin declarar"}</Dato>
              <Dato label="Origen de fondos">{textoOrigenFondos(c) || "Sin declarar"}</Dato>
              <Dato label="¿Representante PEP?">{textoPep(c) || (c.esPep ? "Sí, falta el cargo" : "Sin declarar")}</Dato>
              <div className="sm:col-span-2 lg:col-span-3">
                <Dato label="Beneficiarios finales">
                  {c.beneficiarios?.length
                    ? c.beneficiarios.map((b) => `${b.nombre} (${b.documento}, ${participacion(b.porcentaje)}${b.pep ? ", PEP" : ""})`).join(" · ")
                    : "Sin declarar"}
                </Dato>
              </div>
              {c.notasInternas ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <Dato label="Notas internas">{c.notasInternas}</Dato>
                </div>
              ) : null}
            </div>
          )}
        </PortalPanel>
      </div>

      <div className="space-y-6">
        <PortalPanel title="KYC (uso interno)" description="Verificación de LUXCARS con fecha. Es compuerta para pasar a compra y nunca va en un documento del cliente.">
          <div className="space-y-3 px-5 py-4">
            <Badge tone={c.kycCompleto ? "ok" : "warn"}>{c.kycCompleto ? "Completo" : "Pendiente"}</Badge>
            <Dato label="Ficha RUC: activo y habido">{fecha(c.kycFichaRucEn) || "Sin revisar"}</Dato>
            <Dato label="Vigencia de poder">{fecha(c.kycVigenciaEn) || "Sin revisar"}</Dato>
            <Dato label="Listas de sanciones">{c.kycListasEn ? `${fecha(c.kycListasEn)}${c.kycListasResultado ? ` · ${c.kycListasResultado}` : ""}` : "Sin revisar"}</Dato>
            <Dato label="Registro de operaciones UIF">{fecha(c.kycUifEn) || "Pendiente"}</Dato>
            <Dato label="Responsable">{c.kycResponsable || "Sin asignar"}</Dato>
          </div>
        </PortalPanel>

        <VinculoCuenta client={client} clienteId={c.id} userId={c.userId} email={c.email} onResultado={onResultado} />
      </div>
    </div>
  );
}

export function VinculoCuenta({
  client,
  clienteId,
  userId,
  email,
  onResultado,
}: {
  client: PortalClient;
  clienteId: string;
  userId: string | null;
  email: string | null;
  onResultado: (r: { ok: boolean; message: string }) => void;
}) {
  const [texto, setTexto] = useState(email ?? "");
  const [perfiles, setPerfiles] = useState<Profile[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  return (
    <PortalPanel title="Cuenta en luxcars.pe" description="Con la cuenta vinculada el cliente sigue el expediente desde /cuenta.">
      <div className="space-y-3 px-5 py-4">
        {userId ? (
          <>
            <Badge tone="ok">Vinculada</Badge>
            <p className="text-xs text-ink-3">Se vinculó por correo verificado o a mano. Desvincular corta el acceso del cliente a este expediente.</p>
            <Button size="sm" variant="ghost" className="border border-line" onClick={async () => onResultado(await vincularCuenta(client, { clienteId, userId: null }))}>
              Desvincular
            </Button>
          </>
        ) : (
          <>
            <Badge tone="neutral">Sin cuenta</Badge>
            <p className="text-xs text-ink-3">
              Si el cliente se registra en luxcars.pe/cuenta con el correo <span className="text-ink-2">{email ?? "de su ficha"}</span>, se vincula solo. Si usó otro correo, búscalo acá.
            </p>
            <div className="flex gap-2">
              <Entrada value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Correo o nombre de la cuenta" aria-label="Buscar cuenta" />
              <Button
                size="sm"
                variant="secondary"
                disabled={buscando || texto.trim().length < 3}
                onClick={async () => {
                  setBuscando(true);
                  setPerfiles(await buscarPerfiles(client, texto));
                  setBuscando(false);
                }}
              >
                {buscando ? "…" : "Buscar"}
              </Button>
            </div>
            {perfiles ? (
              perfiles.length === 0 ? (
                <p className="text-xs text-ink-4">Ninguna cuenta coincide.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {perfiles.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">{p.name || p.email}</p>
                        <p className="truncate text-xs text-ink-4">{p.email}{p.role === "admin" ? " · admin" : ""}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={async () => onResultado(await vincularCuenta(client, { clienteId, userId: p.id }))}>Vincular</Button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </>
        )}
      </div>
    </PortalPanel>
  );
}
