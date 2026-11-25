"use client";

/**
 * Documentos del expediente: generar desde una plantilla (con vista previa y
 * la lista de campos que faltan, los manuales editables), la lista por tipo y
 * versión con su estado, descargar PDF o DOCX, subir el firmado y mostrarlo u
 * ocultarlo al cliente.
 *
 * La vista previa se construye EN EL NAVEGADOR con el core (`construirDocumento`
 * + `renderHtml`): no genera archivos ni toca el servidor. Solo "Generar" llama
 * a la ruta, que renderiza el PDF y el DOCX y los sube al bucket privado.
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Badge, Notice, PortalPanel, TableScroll, Td, Th } from "@/components/portal/CrmUI";
import { Campo, Entrada, Rejilla, Selector } from "@/components/portal/expedientes/Formulario";
import { FICHA, type Campo as NombreCampo } from "@/core/expedientes/campos";
import { PLANTILLAS, construirDocumento, plantillaDe, renderHtml } from "@/core/expedientes/documentos";
import type { ContextoExpediente, Documento, TipoDocumento } from "@/core/expedientes/tipos";
import {
  cambiarVisibilidadDocumento,
  cargarCamposFijos,
  generarDocumento,
  subirDocumentoFirmado,
  urlDescargaDocumento,
} from "@/lib/expedientes/consultas";
import { ESTADO_DOCUMENTO_LABEL, ESTADO_DOCUMENTO_TONE, TIPO_DOCUMENTO_LABEL, fecha, fechaHora, hoyIso } from "@/lib/expedientes/formato";
import type { PortalClient } from "@/lib/portal/portalClient";

type Resultado = { ok: boolean; message: string };

export function PestanaDocumentos({
  client,
  ctx,
  onResultado,
}: {
  client: PortalClient;
  ctx: ContextoExpediente;
  onResultado: (r: Resultado) => void;
}) {
  return (
    <div className="space-y-6">
      <Generador ctx={ctx} onResultado={onResultado} />
      <ListaDocumentos client={client} ctx={ctx} onResultado={onResultado} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Generar                                                                    */
/* -------------------------------------------------------------------------- */

function Generador({ ctx, onResultado }: { ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const [tipo, setTipo] = useState<TipoDocumento>("contrato");
  const [fijos, setFijos] = useState<Record<string, string> | null>(null);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState(false);
  const [mostrarPrevia, setMostrarPrevia] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generado, setGenerado] = useState<{ pdf: string | null; docx: string | null; version: number } | null>(null);

  useEffect(() => {
    let cancelado = false;
    void cargarCamposFijos(ctx.expediente.id).then((f) => {
      if (!cancelado) setFijos(f);
    });
    return () => {
      cancelado = true;
    };
  }, [ctx.expediente.id]);

  const plantilla = plantillaDe(tipo);
  const doc = useMemo(() => {
    if (!plantilla) return null;
    return construirDocumento(plantilla, ctx, { ...(fijos ?? {}), ...extra });
  }, [plantilla, ctx, fijos, extra]);

  const html = useMemo(() => (doc && mostrarPrevia ? renderHtml(doc.estructura) : ""), [doc, mostrarPrevia]);
  const vigente = ctx.documentos.find((d) => d.tipo === tipo && d.estado !== "reemplazado" && d.estado !== "anulado");

  const generar = async () => {
    if (!doc || doc.faltantes.length > 0) return;
    setBusy(true);
    const r = await generarDocumento({ expedienteId: ctx.expediente.id, tipo, extra, visibleCliente: visible });
    setBusy(false);
    if (r.ok) {
      setGenerado({ pdf: r.urls.pdf, docx: r.urls.docx, version: r.version });
    }
    onResultado(r);
  };

  const campoEditable = (k: NombreCampo, obligatorio: boolean) => (
    <Campo key={k} label={k.replace(/_/g, " ").toLowerCase()} hint={FICHA[k].descripcion} requerido={obligatorio}>
      <Entrada
        value={extra[k] ?? ""}
        placeholder={`ej. ${FICHA[k].ejemplo}`}
        maxLength={500}
        onChange={(e) => setExtra((p) => ({ ...p, [k]: e.target.value }))}
      />
    </Campo>
  );

  return (
    <PortalPanel
      title="Generar documento"
      description="Se construye con los datos del expediente, el cliente, el embarque, las contrapartes y el presupuesto. Regenerar crea una versión nueva y marca la anterior como reemplazada."
      toolbar={
        <Selector value={tipo} onChange={(e) => { setTipo(e.target.value as TipoDocumento); setGenerado(null); }} aria-label="Tipo de documento">
          {PLANTILLAS.map((p) => (
            <option key={p.tipo} value={p.tipo}>{p.nombre}</option>
          ))}
        </Selector>
      }
    >
      <div className="space-y-4 px-5 py-4">
        {vigente ? (
          <p className="text-xs text-ink-4">
            Ya existe la versión {vigente.version} ({ESTADO_DOCUMENTO_LABEL[vigente.estado].toLowerCase()}, {fechaHora(vigente.emitidoEn ?? vigente.createdAt)}). Generar de nuevo crea la versión {vigente.version + 1}.
          </p>
        ) : null}

        {fijos === null ? <p className="text-xs text-ink-4">Leyendo los datos fijos de Luxcars…</p> : null}

        {doc && doc.faltantes.length > 0 ? (
          <Notice tone="warn" label={`Faltan ${doc.faltantes.length} datos para emitir`}>
            Complétalos en el expediente (cliente, vehículo, compra, contrapartes) o escríbelos aquí para este documento.
            <div className="mt-3">
              <Rejilla columnas={3}>{doc.faltantes.map((k) => campoEditable(k, true))}</Rejilla>
            </div>
          </Notice>
        ) : null}

        {doc && doc.manualesVacios.length > 0 ? (
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-ink-4">Opcionales: si se dejan vacíos salen como línea para llenar a mano</p>
            <div className="mt-2">
              <Rejilla columnas={3}>{doc.manualesVacios.map((k) => campoEditable(k, false))}</Rejilla>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="secondary" onClick={() => setMostrarPrevia((m) => !m)} disabled={!doc}>
            {mostrarPrevia ? "Ocultar vista previa" : "Vista previa"}
          </Button>
          <label className="flex items-center gap-2 text-xs text-ink-2">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4 accent-silver" />
            Visible para el cliente al emitir
          </label>
          <Button size="sm" disabled={busy || !doc || doc.faltantes.length > 0 || fijos === null} onClick={() => void generar()}>
            {busy ? "Generando…" : vigente ? `Generar versión ${vigente.version + 1}` : "Generar PDF y DOCX"}
          </Button>
        </div>

        {generado ? (
          <Notice tone="info" label={`Versión ${generado.version} emitida`}>
            Los enlaces duran cinco minutos; después, descárgalos desde la lista.
            <span className="ml-2 inline-flex gap-3">
              {generado.pdf ? <a className="underline text-silver-bright" href={generado.pdf} target="_blank" rel="noopener noreferrer">Abrir PDF</a> : null}
              {generado.docx ? <a className="underline text-silver-bright" href={generado.docx} target="_blank" rel="noopener noreferrer">Bajar DOCX</a> : null}
            </span>
          </Notice>
        ) : null}

        {mostrarPrevia && html ? (
          <div className="max-h-[70vh] overflow-auto rounded-lux border border-line">
            <div className="papel-doc" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        ) : null}
      </div>
    </PortalPanel>
  );
}

/* -------------------------------------------------------------------------- */
/* Lista                                                                      */
/* -------------------------------------------------------------------------- */

function ListaDocumentos({ client, ctx, onResultado }: { client: PortalClient; ctx: ContextoExpediente; onResultado: (r: Resultado) => void }) {
  const documentos = ctx.documentos;
  if (documentos.length === 0) {
    return (
      <PortalPanel title="Documentos del expediente">
        <p className="px-5 py-6 text-sm text-ink-3">Todavía no hay documentos. Genera el contrato, los anexos y la LOA arriba.</p>
      </PortalPanel>
    );
  }
  return (
    <PortalPanel title="Documentos del expediente" description="Todas las versiones. El cliente solo ve los marcados visibles y los baja por una URL firmada que vence a los cinco minutos.">
      <TableScroll>
        <table className="w-full min-w-[880px] border-collapse">
          <thead className="border-b border-line">
            <tr>
              <Th>Documento</Th>
              <Th>Versión</Th>
              <Th>Estado</Th>
              <Th>Emitido</Th>
              <Th>Cliente</Th>
              <Th align="right">Archivos</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {documentos.map((d) => (
              <FilaDocumento key={d.id} d={d} client={client} expedienteId={ctx.expediente.id} onResultado={onResultado} />
            ))}
          </tbody>
        </table>
      </TableScroll>
    </PortalPanel>
  );
}

function FilaDocumento({ d, client, expedienteId, onResultado }: { d: Documento; client: PortalClient; expedienteId: string; onResultado: (r: Resultado) => void }) {
  const [subiendo, setSubiendo] = useState(false);
  const [firmadoEn, setFirmadoEn] = useState(hoyIso());
  const [subirAbierto, setSubirAbierto] = useState(false);
  const vigente = d.estado === "emitido" || d.estado === "firmado";
  const seFirma = plantillaDe(d.tipo)?.seFirma ?? true;

  return (
    <tr className={d.estado === "reemplazado" ? "opacity-60" : ""}>
      <Td>
        <p className="text-ink">{TIPO_DOCUMENTO_LABEL[d.tipo]}</p>
        <p className="mt-0.5 text-xs text-ink-4">{d.titulo}{d.plantillaVersion ? ` · ${d.plantillaVersion}` : ""}</p>
      </Td>
      <Td>v{d.version}</Td>
      <Td>
        <Badge tone={ESTADO_DOCUMENTO_TONE[d.estado]}>{ESTADO_DOCUMENTO_LABEL[d.estado]}</Badge>
        {d.firmadoEn ? <p className="mt-1 text-xs text-ink-4">Firmado el {fecha(d.firmadoEn)}</p> : null}
      </Td>
      <Td>{fechaHora(d.emitidoEn ?? d.createdAt)}</Td>
      <Td>
        <label className="flex items-center gap-2 text-xs text-ink-2">
          <input
            type="checkbox"
            checked={d.visibleCliente}
            disabled={!vigente}
            className="h-4 w-4 accent-silver"
            onChange={async (e) => onResultado(await cambiarVisibilidadDocumento(client, { documentoId: d.id, visibleCliente: e.target.checked }))}
          />
          {d.visibleCliente ? "Visible" : "Oculto"}
        </label>
      </Td>
      <Td align="right">
        <div className="flex flex-wrap justify-end gap-2">
          {d.tienePdf ? <Button size="sm" variant="ghost" className="border border-line" href={urlDescargaDocumento(d.id, "pdf")}>PDF</Button> : null}
          {d.tieneDocx ? <Button size="sm" variant="ghost" className="border border-line" href={urlDescargaDocumento(d.id, "docx")}>DOCX</Button> : null}
          {d.tieneFirmado ? <Button size="sm" variant="secondary" href={urlDescargaDocumento(d.id, "firmado")}>Firmado</Button> : null}
          {vigente && seFirma ? (
            <Button size="sm" variant="ghost" className="border border-line" onClick={() => setSubirAbierto((a) => !a)}>
              {d.tieneFirmado ? "Reemplazar firmado" : "Subir firmado"}
            </Button>
          ) : null}
        </div>
        {subirAbierto ? (
          <div className="mt-3 flex flex-wrap items-end justify-end gap-3 text-left">
            <Campo label="Fecha de firma">
              <Entrada type="date" value={firmadoEn} onChange={(e) => setFirmadoEn(e.target.value)} />
            </Campo>
            <Campo label="PDF firmado (hasta 15 MB)">
              <input
                type="file"
                accept="application/pdf"
                disabled={subiendo}
                className="block text-xs text-ink-2 file:mr-3 file:rounded-full file:border file:border-line file:bg-surface-2 file:px-3 file:py-1.5 file:text-xs file:text-ink"
                onChange={async (e) => {
                  const archivo = e.target.files?.[0];
                  if (!archivo) return;
                  setSubiendo(true);
                  const r = await subirDocumentoFirmado({ expedienteId, documentoId: d.id, archivo, firmadoEn: firmadoEn || null });
                  setSubiendo(false);
                  if (r.ok) setSubirAbierto(false);
                  onResultado(r);
                }}
              />
            </Campo>
            {subiendo ? <span className="text-xs text-ink-4">Subiendo…</span> : null}
          </div>
        ) : null}
      </Td>
    </tr>
  );
}
