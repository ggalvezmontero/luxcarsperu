"use client";

/**
 * /portal/configuracion — datos de la empresa que van en los documentos del
 * expediente (RUC, domicilio, partida, representante, DNI, cuentas, porcentaje
 * de detracción, ciudad de firma, días de espera en consolidado).
 *
 * Se fijan UNA vez acá y desde entonces ningún documento sale con una raya:
 * lo que falte bloquea la emisión del documento que lo use y la pestaña
 * Documentos manda a esta pantalla. Los valores viven en la tabla
 * `configuracion_documentos` (RLS solo admin); la variable de entorno
 * `LUXCARS_DOCUMENTOS_JSON` queda como respaldo y se muestra como tal.
 *
 * Arriba, las confirmaciones que el dueño marca como hechas antes del primer
 * uso (`PENDIENTES_EMPRESA`): ya no van como notas en los documentos.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Notice, PortalPageHeader, PortalPanel } from "@/components/portal/CrmUI";
import { Campo as CampoForm, Entrada, Rejilla } from "@/components/portal/expedientes/Formulario";
import { usePortalSession } from "@/components/portal/portalSession";
import { CAMPOS_EMPRESA, FICHA, PENDIENTES_EMPRESA, type Campo, type CamposExtra, type ClavePendiente } from "@/core/expedientes/campos";
import { fecha } from "@/lib/expedientes/formato";
import { guardarConfiguracion, leerConfiguracion, leerPendientes, leerRespaldo, marcarPendiente } from "./consultas";

type Grupo = { titulo: string; descripcion: string; campos: Campo[] };

const ETIQUETA: Record<string, string> = {
  LUXCARS_RUC: "RUC",
  LUXCARS_DOMICILIO: "Domicilio fiscal",
  LUXCARS_PARTIDA: "Partida registral",
  LUXCARS_REPRESENTANTE: "Representante legal",
  LUXCARS_REP_DNI: "DNI del representante",
  CTA_FONDOS_BANCO: "Fondos de Clientes · banco",
  CTA_FONDOS_NUMERO: "Fondos de Clientes · número de cuenta",
  CTA_FONDOS_CCI: "Fondos de Clientes · CCI",
  CTA_DETRACCION_NUMERO: "Detracciones · cuenta en el Banco de la Nación",
  PORCENTAJE_DETRACCION: "Porcentaje de detracción",
  CIUDAD_FIRMA: "Ciudad de firma",
  DIAS_ESPERA_MAX: "Días máximos de espera en consolidado",
};

function etiqueta(k: Campo): string {
  return ETIQUETA[k] ?? k.replace(/_/g, " ").toLowerCase();
}

const GRUPOS: Grupo[] = [
  {
    titulo: "Empresa",
    descripcion: "Identifican a Lux Cars Import S.A.C. en el contrato, los anexos, la LOA y las cartas.",
    campos: CAMPOS_EMPRESA.filter((k) => FICHA[k].grupo === "luxcars"),
  },
  {
    titulo: "Cuentas",
    descripcion: "Fondos de Clientes recibe todos los pagos del cliente (Pagos 1, 2, 3 y 5); el Pago 4 lo paga el cliente directo a SUNAT. Detracciones es la cuenta del Banco de la Nación donde LUXCARS deposita la detracción de cada factura de honorarios.",
    campos: CAMPOS_EMPRESA.filter((k) => FICHA[k].grupo === "cuentas"),
  },
  {
    titulo: "Documentos",
    descripcion: "Parámetros que van en el texto de los documentos. El porcentaje de detracción de un expediente, si está puesto, manda sobre este; los días de espera se pueden cambiar al generar cada contrato.",
    campos: CAMPOS_EMPRESA.filter((k) => FICHA[k].grupo !== "luxcars" && FICHA[k].grupo !== "cuentas"),
  },
];

export function ConfiguracionScreen() {
  const { status: sessionStatus, client, profile } = usePortalSession();
  const [guardados, setGuardados] = useState<CamposExtra>({});
  const [respaldo, setRespaldo] = useState<CamposExtra>({});
  const [valores, setValores] = useState<CamposExtra>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [hechos, setHechos] = useState<Partial<Record<ClavePendiente, string>>>({});
  const [marcando, setMarcando] = useState<ClavePendiente | null>(null);

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [tabla, resp, pend] = await Promise.all([leerConfiguracion(client), leerRespaldo(), leerPendientes(client)]);
    setHechos(pend.hechos);
    const g: CamposExtra = {};
    for (const f of tabla.filas) g[f.clave] = f.valor;
    setGuardados(g);
    setRespaldo(resp);
    setValores(g);
    setError(tabla.error);
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

  // Un campo está resuelto si tiene valor guardado, valor escrito sin guardar aún, o respaldo.
  const efectivo = useCallback((k: Campo) => (valores[k] ?? "").trim() || respaldo[k] || "", [valores, respaldo]);
  const faltan = useMemo(() => CAMPOS_EMPRESA.filter((k) => !((guardados[k] ?? "").trim() || respaldo[k])), [guardados, respaldo]);
  const cambios = useMemo(() => CAMPOS_EMPRESA.filter((k) => (valores[k] ?? "") !== (guardados[k] ?? "")), [valores, guardados]);

  const guardar = async () => {
    if (!client) return;
    setBusy(true);
    const aGuardar: CamposExtra = {};
    for (const k of cambios) aGuardar[k] = valores[k] ?? "";
    const r = await guardarConfiguracion(client, aGuardar, profile?.id ?? null);
    setBusy(false);
    setFlash({ ok: r.ok, text: r.message });
    if (r.ok) void load();
  };

  const marcar = async (clave: ClavePendiente, hecho: boolean) => {
    if (!client) return;
    setMarcando(clave);
    const r = await marcarPendiente(client, clave, hecho, profile?.id ?? null);
    setMarcando(null);
    setFlash({ ok: r.ok, text: r.message });
    if (r.ok) void load();
  };
  const pendientes = PENDIENTES_EMPRESA.filter((p) => !hechos[p.clave]);

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Configuración"
        title="Datos de la empresa para los documentos"
        description="Se fijan una vez acá y salen en el contrato, los anexos, la LOA, las cartas, las constancias y la rendición. Ningún documento se emite con un dato en blanco: lo que falte aquí bloquea la emisión y la pestaña Documentos te trae a esta pantalla."
      />

      {loading ? (
        <p className="text-sm text-ink-3">Leyendo la configuración…</p>
      ) : faltan.length > 0 ? (
        <Notice tone="warn" label={`Faltan ${faltan.length} ${faltan.length === 1 ? "dato" : "datos"}`}>
          Los documentos que los usan no se podrán emitir hasta completarlos: {faltan.map(etiqueta).join(", ")}.
        </Notice>
      ) : (
        <Notice tone="info" label="Configuración completa">
          Los {CAMPOS_EMPRESA.length} datos de la empresa están definidos. Los que vienen del respaldo (variable de entorno) se pueden pisar escribiéndolos acá.
        </Notice>
      )}

      {error ? (
        <Notice tone="warn" label="No se pudo leer">
          {error}
        </Notice>
      ) : null}
      {flash ? (
        <Notice tone={flash.ok ? "info" : "danger"} label={flash.ok ? "Guardado" : "No se pudo"}>
          {flash.text}
        </Notice>
      ) : null}

      <PortalPanel
        title={`Confirmaciones antes del primer uso${pendientes.length ? ` (${pendientes.length} pendientes)` : ""}`}
        description="Lo que el dueño confirma una vez con el contador o el notario. Ningún documento las imprime: se marcan aquí cuando están hechas."
      >
        <ul className="divide-y divide-line">
          {PENDIENTES_EMPRESA.map((p) => {
            const hecho = hechos[p.clave];
            return (
              <li key={p.clave} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 max-w-2xl">
                  <p className={`text-sm ${hecho ? "text-ink-3" : "text-ink"}`}>{p.titulo}</p>
                  <p className="mt-0.5 text-xs text-ink-4">{hecho ? `Hecho el ${fecha(hecho)}.` : p.detalle}</p>
                </div>
                <Button
                  size="sm"
                  variant={hecho ? "ghost" : "secondary"}
                  className={hecho ? "border border-line" : ""}
                  disabled={loading || !canQuery || marcando !== null}
                  onClick={() => void marcar(p.clave, !hecho)}
                >
                  {marcando === p.clave ? "…" : hecho ? "Volver a pendiente" : "Marcar como hecho"}
                </Button>
              </li>
            );
          })}
        </ul>
      </PortalPanel>

      {GRUPOS.map((g) => (
        <PortalPanel key={g.titulo} title={g.titulo} description={g.descripcion}>
          <div className="px-5 py-4">
            <Rejilla columnas={g.campos.length > 6 ? 3 : 2}>
              {g.campos.map((k) => {
                const guardado = (guardados[k] ?? "").trim();
                const deRespaldo = !guardado && Boolean(respaldo[k]);
                const vacio = !efectivo(k);
                return (
                  <CampoForm
                    key={k}
                    label={etiqueta(k)}
                    requerido={vacio}
                    hint={`${FICHA[k].descripcion}.${deRespaldo ? ` Valor de respaldo (variable de entorno): ${respaldo[k]}. Escríbelo para fijarlo en el portal.` : ""}`}
                  >
                    <Entrada
                      value={valores[k] ?? ""}
                      placeholder={deRespaldo ? respaldo[k] : `ej. ${FICHA[k].ejemplo}`}
                      maxLength={500}
                      disabled={loading || !canQuery}
                      className={vacio ? "border-warn" : undefined}
                      onChange={(e) => setValores((p) => ({ ...p, [k]: e.target.value }))}
                    />
                  </CampoForm>
                );
              })}
            </Rejilla>
          </div>
        </PortalPanel>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={busy || loading || !canQuery || cambios.length === 0} onClick={() => void guardar()}>
          {busy ? "Guardando…" : cambios.length > 0 ? `Guardar (${cambios.length})` : "Guardar"}
        </Button>
        {cambios.length > 0 ? (
          <Button size="sm" variant="ghost" className="border border-line" disabled={busy} onClick={() => setValores(guardados)}>
            Descartar cambios
          </Button>
        ) : null}
        <p className="text-xs text-ink-4">Cada dato se guarda por separado con la fecha y el usuario que lo cambió. Vaciar un campo lo borra del portal y vuelve al respaldo, si lo hay.</p>
      </div>
    </div>
  );
}
