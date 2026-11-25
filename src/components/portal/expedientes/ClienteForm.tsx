"use client";

/**
 * Formulario de cliente del mandato: lo usan el asistente de alta de
 * expediente (crear) y /portal/clientes (crear y editar). Guarda por la Data
 * API con la sesión del equipo; el correo en minúsculas lo garantiza la base.
 */

import { useState } from "react";
import { Button } from "@/components/Button";
import type { Cliente, TipoCliente } from "@/core/expedientes/tipos";
import { TIPOS_CLIENTE } from "@/core/expedientes/tipos";
import type { DatosCliente } from "@/lib/expedientes/consultas";
import { TIPO_CLIENTE_LABEL } from "@/lib/expedientes/formato";
import { AreaTexto, Campo, Entrada, Rejilla, Selector } from "./Formulario";

type Valores = {
  tipo: TipoCliente;
  razon_social: string;
  ruc: string;
  dni: string;
  domicilio: string;
  partida: string;
  representante: string;
  representante_dni: string;
  representante_cargo: string;
  email: string;
  telefono: string;
  actividad: string;
  banco_origen: string;
  beneficiario_final: string;
  origen_fondos: string;
  es_pep: boolean;
  kyc_ficha_ruc_en: string;
  kyc_vigencia_en: string;
  kyc_listas_en: string;
  kyc_listas_resultado: string;
  notas_internas: string;
};

function desde(c: Cliente | null, prellenado: Partial<Valores> = {}): Valores {
  return {
    tipo: c?.tipo ?? "empresa",
    razon_social: c?.razonSocial ?? "",
    ruc: c?.ruc ?? "",
    dni: c?.dni ?? "",
    domicilio: c?.domicilio ?? "",
    partida: c?.partida ?? "",
    representante: c?.representante ?? "",
    representante_dni: c?.representanteDni ?? "",
    representante_cargo: c?.representanteCargo ?? "",
    email: c?.email ?? "",
    telefono: c?.telefono ?? "",
    actividad: c?.actividad ?? "",
    banco_origen: c?.bancoOrigen ?? "",
    beneficiario_final: c?.beneficiarioFinal ?? "",
    origen_fondos: c?.origenFondos ?? "",
    es_pep: c?.esPep ?? false,
    kyc_ficha_ruc_en: c?.kycFichaRucEn ?? "",
    kyc_vigencia_en: c?.kycVigenciaEn ?? "",
    kyc_listas_en: c?.kycListasEn ?? "",
    kyc_listas_resultado: c?.kycListasResultado ?? "",
    notas_internas: c?.notasInternas ?? "",
    ...prellenado,
  };
}

export function aDatosCliente(v: Valores): DatosCliente {
  return {
    tipo: v.tipo,
    razon_social: v.razon_social.trim(),
    ruc: v.ruc.replace(/\D/g, "") || null,
    dni: v.dni.trim() || null,
    domicilio: v.domicilio,
    partida: v.partida,
    representante: v.representante,
    representante_dni: v.representante_dni,
    representante_cargo: v.representante_cargo,
    email: v.email.trim().toLowerCase(),
    telefono: v.telefono,
    actividad: v.actividad,
    banco_origen: v.banco_origen,
    beneficiario_final: v.beneficiario_final,
    origen_fondos: v.origen_fondos,
    es_pep: v.es_pep,
    kyc_ficha_ruc_en: v.kyc_ficha_ruc_en || null,
    kyc_vigencia_en: v.kyc_vigencia_en || null,
    kyc_listas_en: v.kyc_listas_en || null,
    kyc_listas_resultado: v.kyc_listas_resultado,
    notas_internas: v.notas_internas,
  };
}

export function validarCliente(v: Valores): string | null {
  if (v.razon_social.trim().length < 2) return "Escribe la razón social o el nombre completo.";
  const ruc = v.ruc.replace(/\D/g, "");
  if (v.tipo === "empresa" && ruc.length !== 11) return "Una empresa necesita RUC de once dígitos.";
  if (ruc && ruc.length !== 11) return "El RUC tiene once dígitos.";
  if (!ruc && !v.dni.trim()) return "El cliente necesita RUC o DNI.";
  if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) return "El correo no parece válido.";
  return null;
}

export function ClienteForm({
  cliente,
  prellenado,
  compacto = false,
  textoGuardar = "Guardar cliente",
  onGuardar,
  onCancelar,
}: {
  cliente: Cliente | null;
  prellenado?: Partial<Valores>;
  /** Solo los campos del mandato; el KYC y las notas se editan en /portal/clientes. */
  compacto?: boolean;
  textoGuardar?: string;
  onGuardar: (datos: DatosCliente) => Promise<{ ok: boolean; message: string }>;
  onCancelar?: () => void;
}) {
  const [v, setV] = useState<Valores>(() => desde(cliente, prellenado));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Valores>(k: K, valor: Valores[K]) => setV((p) => ({ ...p, [k]: valor }));

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const invalido = validarCliente(v);
        if (invalido) return setError(invalido);
        setError(null);
        setBusy(true);
        const r = await onGuardar(aDatosCliente(v));
        setBusy(false);
        if (!r.ok) setError(r.message);
      }}
    >
      <Rejilla columnas={3}>
        <Campo label="Tipo">
          <Selector value={v.tipo} onChange={(e) => set("tipo", e.target.value as TipoCliente)}>
            {TIPOS_CLIENTE.map((t) => (
              <option key={t} value={t}>{TIPO_CLIENTE_LABEL[t]}</option>
            ))}
          </Selector>
        </Campo>
        <Campo label={v.tipo === "empresa" ? "Razón social" : "Nombre completo"} requerido className="sm:col-span-2">
          <Entrada value={v.razon_social} onChange={(e) => set("razon_social", e.target.value)} required maxLength={200} />
        </Campo>
        <Campo label="RUC" requerido={v.tipo === "empresa"}>
          <Entrada value={v.ruc} onChange={(e) => set("ruc", e.target.value.replace(/\D/g, "").slice(0, 11))} inputMode="numeric" placeholder="20…" />
        </Campo>
        <Campo label="DNI" requerido={v.tipo === "persona"}>
          <Entrada value={v.dni} onChange={(e) => set("dni", e.target.value)} maxLength={20} />
        </Campo>
        <Campo label="Correo" hint="Si se registra en luxcars.pe/cuenta con este correo, su cuenta se vincula sola.">
          <Entrada type="email" value={v.email} onChange={(e) => set("email", e.target.value)} maxLength={160} />
        </Campo>
        <Campo label="Teléfono / WhatsApp">
          <Entrada value={v.telefono} onChange={(e) => set("telefono", e.target.value)} maxLength={40} />
        </Campo>
        <Campo label="Domicilio" className="sm:col-span-2">
          <Entrada value={v.domicilio} onChange={(e) => set("domicilio", e.target.value)} maxLength={300} />
        </Campo>
        {v.tipo === "empresa" ? (
          <>
            <Campo label="Partida registral">
              <Entrada value={v.partida} onChange={(e) => set("partida", e.target.value)} maxLength={60} />
            </Campo>
            <Campo label="Representante legal">
              <Entrada value={v.representante} onChange={(e) => set("representante", e.target.value)} maxLength={160} />
            </Campo>
            <Campo label="DNI del representante">
              <Entrada value={v.representante_dni} onChange={(e) => set("representante_dni", e.target.value)} maxLength={20} />
            </Campo>
            <Campo label="Cargo">
              <Entrada value={v.representante_cargo} onChange={(e) => set("representante_cargo", e.target.value)} maxLength={80} />
            </Campo>
            <Campo label="Actividad" className="sm:col-span-2">
              <Entrada value={v.actividad} onChange={(e) => set("actividad", e.target.value)} maxLength={200} />
            </Campo>
          </>
        ) : null}
      </Rejilla>

      {!compacto ? (
        <>
          <h3 className="pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-silver">Debida diligencia (KYC)</h3>
          <Rejilla columnas={3}>
            <Campo label="Ficha RUC revisada el">
              <Entrada type="date" value={v.kyc_ficha_ruc_en} onChange={(e) => set("kyc_ficha_ruc_en", e.target.value)} />
            </Campo>
            <Campo label="Vigencia de poder revisada el">
              <Entrada type="date" value={v.kyc_vigencia_en} onChange={(e) => set("kyc_vigencia_en", e.target.value)} />
            </Campo>
            <Campo label="Listas (PEP, OFAC, ONU) el">
              <Entrada type="date" value={v.kyc_listas_en} onChange={(e) => set("kyc_listas_en", e.target.value)} />
            </Campo>
            <Campo label="Resultado de listas" className="sm:col-span-2">
              <Entrada value={v.kyc_listas_resultado} onChange={(e) => set("kyc_listas_resultado", e.target.value)} maxLength={300} placeholder="Sin coincidencias" />
            </Campo>
            <Campo label="Persona expuesta políticamente">
              <label className="flex min-h-10 items-center gap-2 text-sm normal-case tracking-normal text-ink-2">
                <input type="checkbox" checked={v.es_pep} onChange={(e) => set("es_pep", e.target.checked)} className="h-4 w-4 accent-silver" />
                Es PEP o vinculado
              </label>
            </Campo>
            <Campo label="Banco de origen de los fondos">
              <Entrada value={v.banco_origen} onChange={(e) => set("banco_origen", e.target.value)} maxLength={120} />
            </Campo>
            <Campo label="Beneficiario final">
              <Entrada value={v.beneficiario_final} onChange={(e) => set("beneficiario_final", e.target.value)} maxLength={200} />
            </Campo>
            <Campo label="Origen de los fondos">
              <Entrada value={v.origen_fondos} onChange={(e) => set("origen_fondos", e.target.value)} maxLength={500} />
            </Campo>
          </Rejilla>
          <Campo label="Notas internas" hint="Solo las ve el equipo.">
            <AreaTexto value={v.notas_internas} onChange={(e) => set("notas_internas", e.target.value)} maxLength={4000} rows={3} />
          </Campo>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-danger">{error}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Guardando…" : textoGuardar}</Button>
        {onCancelar ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancelar}>Cancelar</Button>
        ) : null}
      </div>
    </form>
  );
}
