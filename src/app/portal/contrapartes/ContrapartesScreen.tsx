"use client";

/**
 * Contrapartes: lista filtrable por tipo, crear y editar (contacto, RUC o tax
 * ID, datos bancarios como campos sueltos) y la verificación de la cuenta
 * bancaria por teléfono (`verificar_banco_contraparte`: fecha y usuario).
 *
 * POR QUÉ LA VERIFICACIÓN. Un wire al vendedor o al forwarder sale de la
 * cuenta de fondos de clientes y no se recupera. Los datos bancarios que
 * llegan por correo se confirman por teléfono con la contraparte antes de
 * girar, y acá queda quién lo hizo y cuándo. Si los datos cambian, la base
 * borra la verificación anterior.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Badge, EmptyState, Notice, PortalPageHeader, PortalPanel, StatCard, StatGrid } from "@/components/portal/CrmUI";
import { AreaTexto, Campo, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { usePortalSession } from "@/components/portal/portalSession";
import type { Contraparte, DatosBancarios, TipoContraparte } from "@/core/expedientes/tipos";
import { TIPOS_CONTRAPARTE } from "@/core/expedientes/tipos";
import { actualizarContraparte, crearContraparteCompleta, listarContrapartesCompletas, verificarBancoContraparte, type DatosContraparteCompleta } from "@/lib/expedientes/consultas";
import { CONTRAPARTE_LABEL, fechaHora } from "@/lib/expedientes/formato";
import { bancoSinVerificar } from "@/lib/expedientes/mapeo";
import type { PortalClient } from "@/lib/portal/portalClient";

type Resultado = { ok: boolean; message: string };

export function ContrapartesScreen() {
  const { status: sessionStatus, client } = usePortalSession();
  const [lista, setLista] = useState<Contraparte[]>([]);
  const [tipo, setTipo] = useState<TipoContraparte | "todas">("todas");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [creando, setCreando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = await listarContrapartesCompletas(client);
    setLista(r.contrapartes);
    setError(r.error);
    setLoading(false);
  }, [client, canQuery]);

  useEffect(() => {
    if (sessionStatus === "verificando") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load, sessionStatus]);

  const notify = (r: Resultado) => {
    setFlash({ ok: r.ok, text: r.message });
    if (r.ok) void load();
  };

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return lista.filter((c) => (tipo === "todas" || c.tipo === tipo) && (!q || [c.nombre, c.pais ?? "", c.contacto ?? "", c.email ?? "", c.rucOTaxId ?? ""].join(" ").toLowerCase().includes(q)));
  }, [lista, tipo, busqueda]);

  const sinVerificar = lista.filter(bancoSinVerificar).length;

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Contrapartes"
        title="Vendedores, forwarders y terceros"
        description="Los documentos (Anexo A, LOA, instrucciones) toman de aquí nombre, dirección y contacto. Ninguna cuenta bancaria se usa para girar sin verificarla por teléfono."
        actions={<Button size="sm" onClick={() => setCreando((v) => !v)}>{creando ? "Cerrar" : "Nueva contraparte"}</Button>}
      />

      <StatGrid>
        <StatCard label="Contrapartes" value={lista.length} />
        <StatCard label="Vendedores" value={lista.filter((c) => c.tipo === "vendedor").length} />
        <StatCard label="Forwarders y agentes" value={lista.filter((c) => c.tipo === "forwarder" || c.tipo === "agente_aduana").length} />
        <StatCard label="Cuentas sin verificar" value={sinVerificar} tone={sinVerificar > 0 ? "warn" : "default"} hint="Con datos bancarios y sin verificación telefónica." />
      </StatGrid>

      {flash ? <Notice tone={flash.ok ? "info" : "danger"} label={flash.ok ? "Listo" : "No se pudo"}>{flash.text}</Notice> : null}
      {error ? <Notice tone="warn" label="No se pudo leer">{error}</Notice> : null}
      {sinVerificar > 0 ? (
        <Notice tone="warn" label="Cuentas sin verificar">
          {sinVerificar === 1 ? "Una contraparte tiene" : `${sinVerificar} contrapartes tienen`} datos bancarios que nadie confirmó por teléfono. No gires a esas cuentas hasta verificarlas.
        </Notice>
      ) : null}

      {creando && client ? (
        <PortalPanel title="Nueva contraparte">
          <FormularioContraparte
            busyLabel="Crear contraparte"
            onGuardar={async (datos) => {
              const r = await crearContraparteCompleta(client, datos);
              if (r.ok) setCreando(false);
              notify(r);
              return r.ok;
            }}
          />
        </PortalPanel>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Campo label="Buscar"><Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, país, contacto, correo, RUC" /></Campo>
        </div>
        <div className="sm:w-64">
          <Campo label="Tipo">
            <Selector value={tipo} onChange={(e) => setTipo(e.target.value as TipoContraparte | "todas")}>
              <option value="todas">Todas</option>
              {TIPOS_CONTRAPARTE.map((t) => <option key={t} value={t}>{CONTRAPARTE_LABEL[t]}</option>)}
            </Selector>
          </Campo>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-3">Cargando…</p>
      ) : !canQuery ? (
        <Notice tone="warn" label="Sin sesión">Hace falta una sesión de administrador.</Notice>
      ) : visibles.length === 0 ? (
        <EmptyState title="Sin contrapartes" description="Crea la primera con el botón de arriba. Los vendedores también se pueden crear desde la pestaña Vehículo y compra de un expediente." />
      ) : (
        <div className="space-y-3">
          {visibles.map((c) => (
            <TarjetaContraparte key={c.id} c={c} abierta={abierta === c.id} onAbrir={() => setAbierta(abierta === c.id ? null : c.id)} client={client!} onResultado={notify} />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaContraparte({ c, abierta, onAbrir, client, onResultado }: { c: Contraparte; abierta: boolean; onAbrir: () => void; client: PortalClient; onResultado: (r: Resultado) => void }) {
  const [busy, setBusy] = useState(false);
  const sinVerificar = bancoSinVerificar(c);
  const b = c.datosBancarios;
  return (
    <div className="rounded-lux border border-line bg-surface">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="silver">{CONTRAPARTE_LABEL[c.tipo]}</Badge>
            <p className="text-base font-medium text-ink">{c.nombre}</p>
            {c.pais ? <span className="text-xs text-ink-4">{c.pais}</span> : null}
            {b ? (
              sinVerificar ? <Badge tone="warn">Cuenta sin verificar</Badge> : <Badge tone="ok">Cuenta verificada</Badge>
            ) : <Badge tone="neutral">Sin datos bancarios</Badge>}
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {[c.contacto, c.email, c.telefono, c.rucOTaxId ? `RUC/Tax ID ${c.rucOTaxId}` : null].filter(Boolean).join(" · ") || "Sin datos de contacto"}
          </p>
          {b ? (
            <p className="mt-1 text-xs text-ink-3">
              {[b.banco, b.titular ? `titular ${b.titular}` : null, b.cuenta ? `cta. ${b.cuenta}` : null, b.swift ? `SWIFT ${b.swift}` : null, b.iban ? `IBAN ${b.iban}` : null, b.aba ? `ABA ${b.aba}` : null, b.moneda].filter(Boolean).join(" · ")}
              {c.bancoVerificadoEn ? <span className="text-ok"> · verificada por teléfono el {fechaHora(c.bancoVerificadoEn)}</span> : null}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {b ? (
            <Button
              size="sm"
              variant={sinVerificar ? "primary" : "ghost"}
              className={sinVerificar ? undefined : "border border-line"}
              disabled={busy}
              onClick={async () => {
                if (sinVerificar && !window.confirm(`¿Confirmaste por teléfono con ${c.nombre} que la cuenta ${b.cuenta ?? ""} es suya? Quedará registrado con tu usuario y la hora.`)) return;
                setBusy(true);
                onResultado(await verificarBancoContraparte(client, c.id, sinVerificar));
                setBusy(false);
              }}
            >
              {sinVerificar ? "Marcar cuenta verificada por teléfono" : "Quitar verificación"}
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={onAbrir}>{abierta ? "Cerrar" : "Editar"}</Button>
        </div>
      </div>
      {abierta ? (
        <div className="border-t border-line">
          <FormularioContraparte
            inicial={c}
            busyLabel="Guardar cambios"
            onGuardar={async (datos) => {
              const r = await actualizarContraparte(client, c.id, datos);
              onResultado(r);
              return r.ok;
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function FormularioContraparte({ inicial, busyLabel, onGuardar }: { inicial?: Contraparte; busyLabel: string; onGuardar: (datos: DatosContraparteCompleta) => Promise<boolean> }) {
  const b = inicial?.datosBancarios;
  const [f, setF] = useState({
    tipo: (inicial?.tipo ?? "vendedor") as TipoContraparte,
    nombre: inicial?.nombre ?? "",
    pais: inicial?.pais ?? "",
    direccion: inicial?.direccion ?? "",
    contacto: inicial?.contacto ?? "",
    email: inicial?.email ?? "",
    telefono: inicial?.telefono ?? "",
    ruc_o_tax_id: inicial?.rucOTaxId ?? "",
    notas: inicial?.notas ?? "",
    banco: b?.banco ?? "",
    titular: b?.titular ?? "",
    cuenta: b?.cuenta ?? "",
    swift: b?.swift ?? "",
    iban: b?.iban ?? "",
    aba: b?.aba ?? "",
    moneda: b?.moneda ?? "",
    direccionBanco: b?.direccionBanco ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const bancoCambia = inicial?.bancoVerificadoEn && (f.banco !== (b?.banco ?? "") || f.titular !== (b?.titular ?? "") || f.cuenta !== (b?.cuenta ?? "") || f.swift !== (b?.swift ?? "") || f.iban !== (b?.iban ?? "") || f.aba !== (b?.aba ?? "") || f.moneda !== (b?.moneda ?? "") || f.direccionBanco !== (b?.direccionBanco ?? ""));

  return (
    <form
      className="space-y-5 px-5 py-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const banco: DatosBancarios = {};
        for (const k of ["banco", "titular", "cuenta", "swift", "iban", "aba", "moneda", "direccionBanco"] as const) {
          if (f[k].trim()) banco[k] = f[k].trim();
        }
        await onGuardar({
          tipo: f.tipo,
          nombre: f.nombre,
          pais: f.pais,
          direccion: f.direccion,
          contacto: f.contacto,
          email: f.email.toLowerCase(),
          telefono: f.telefono,
          ruc_o_tax_id: f.ruc_o_tax_id,
          notas: f.notas,
          datos_bancarios: Object.keys(banco).length > 0 ? banco : null,
        });
        setBusy(false);
      }}
    >
      <Rejilla columnas={4}>
        <Campo label="Tipo" requerido>
          <Selector value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            {TIPOS_CONTRAPARTE.map((t) => <option key={t} value={t}>{CONTRAPARTE_LABEL[t]}</option>)}
          </Selector>
        </Campo>
        <Campo label="Nombre o razón social" requerido><Entrada value={f.nombre} onChange={(e) => set("nombre", e.target.value)} maxLength={200} /></Campo>
        <Campo label="País"><Entrada value={f.pais} onChange={(e) => set("pais", e.target.value)} maxLength={80} /></Campo>
        <Campo label="RUC o tax ID"><Entrada value={f.ruc_o_tax_id} onChange={(e) => set("ruc_o_tax_id", e.target.value)} maxLength={40} /></Campo>
        <Campo label="Dirección completa" className="sm:col-span-2"><Entrada value={f.direccion} onChange={(e) => set("direccion", e.target.value)} maxLength={300} /></Campo>
        <Campo label="Contacto"><Entrada value={f.contacto} onChange={(e) => set("contacto", e.target.value)} maxLength={160} /></Campo>
        <Campo label="Teléfono"><Entrada value={f.telefono} onChange={(e) => set("telefono", e.target.value)} maxLength={40} /></Campo>
        <Campo label="Correo"><Entrada type="email" value={f.email} onChange={(e) => set("email", e.target.value)} maxLength={160} /></Campo>
      </Rejilla>

      <div>
        <p className="text-[11px] uppercase tracking-[0.12em] text-ink-4">Datos bancarios</p>
        <p className="mt-1 text-xs text-ink-3">Como campos, no como texto pegado: así el Anexo D y las instrucciones los imprimen bien. Al cambiarlos, la verificación telefónica anterior se borra.</p>
        <div className="mt-3">
          <Rejilla columnas={4}>
            <Campo label="Banco"><Entrada value={f.banco} onChange={(e) => set("banco", e.target.value)} maxLength={120} /></Campo>
            <Campo label="Titular"><Entrada value={f.titular} onChange={(e) => set("titular", e.target.value)} maxLength={160} /></Campo>
            <Campo label="Número de cuenta"><Entrada value={f.cuenta} onChange={(e) => set("cuenta", e.target.value)} maxLength={60} /></Campo>
            <Campo label="Moneda"><Entrada value={f.moneda} onChange={(e) => set("moneda", e.target.value.toUpperCase())} maxLength={3} placeholder="USD" /></Campo>
            <Campo label="SWIFT / BIC"><Entrada value={f.swift} onChange={(e) => set("swift", e.target.value.toUpperCase())} maxLength={20} /></Campo>
            <Campo label="IBAN"><Entrada value={f.iban} onChange={(e) => set("iban", e.target.value.toUpperCase())} maxLength={40} /></Campo>
            <Campo label="ABA / routing / transit"><Entrada value={f.aba} onChange={(e) => set("aba", e.target.value)} maxLength={20} /></Campo>
            <Campo label="Dirección del banco"><Entrada value={f.direccionBanco} onChange={(e) => set("direccionBanco", e.target.value)} maxLength={200} /></Campo>
          </Rejilla>
        </div>
        {bancoCambia ? <p className="mt-2 text-xs text-warn">Cambiaste los datos bancarios: al guardar, la cuenta vuelve a quedar sin verificar.</p> : null}
      </div>

      <Campo label="Notas internas"><AreaTexto value={f.notas} onChange={(e) => set("notas", e.target.value)} rows={3} maxLength={4000} /></Campo>
      <Button type="submit" size="sm" disabled={busy || f.nombre.trim().length < 2}>{busy ? "Guardando…" : busyLabel}</Button>
    </form>
  );
}
