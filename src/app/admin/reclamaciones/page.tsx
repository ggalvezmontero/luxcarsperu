/**
 * /admin/reclamaciones — hojas del Libro de Reclamaciones y su respuesta.
 *
 * El acceso lo decide el layout de /admin (404 a quien no sea admin). La
 * lista se lee en el servidor con `DATABASE_URL`; responder pasa por
 * `/api/admin/reclamaciones/[id]`, que vuelve a comprobar la sesión.
 */

import type { Metadata } from "next";

import { Badge, EmptyState, Notice, PortalPageHeader, PortalPanel } from "@/components/portal/CrmUI";
import { listarReclamaciones } from "@/lib/db/reclamaciones";

import { ResponderReclamacion } from "./ResponderReclamacion";

export const metadata: Metadata = { title: "Libro de Reclamaciones" };

const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }).format(new Date(iso));

/** Días hábiles (lunes a viernes) transcurridos desde una fecha. Sin feriados: es una guía. */
function diasHabilesDesde(iso: string): number {
  const d = new Date(iso);
  const hoy = new Date();
  let n = 0;
  for (let t = new Date(d); t < hoy; t.setDate(t.getDate() + 1)) {
    const dia = t.getDay();
    if (dia !== 0 && dia !== 6) n++;
  }
  return Math.max(0, n - 1);
}

export default async function ReclamacionesPage() {
  const hojas = await listarReclamaciones();
  const pendientes = hojas?.filter((h) => h.estado === "recibida").length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <PortalPageHeader
        eyebrow="Libro de Reclamaciones"
        title="Reclamos y quejas"
        description={`Cada hoja debe responderse en quince días hábiles. ${pendientes === 0 ? "No hay hojas pendientes." : `${pendientes} pendiente${pendientes === 1 ? "" : "s"}.`}`}
      />

      {hojas === null ? (
        <Notice tone="warn" label="Sin base de datos">
          No se pudo leer la tabla `reclamaciones`. Falta aplicar la migración 20261118120000 o la conexión no responde.
        </Notice>
      ) : hojas.length === 0 ? (
        <PortalPanel>
          <EmptyState title="Todavía no hay hojas registradas" description="Cuando un cliente registre un reclamo o una queja en luxcars.pe/libro-de-reclamaciones aparecerá acá, con su número y plazo." />
        </PortalPanel>
      ) : (
        <div className="flex flex-col gap-5">
          {hojas.map((h) => {
            const dias = diasHabilesDesde(h.createdAt);
            const vencida = h.estado === "recibida" && dias >= 12;
            return (
              <PortalPanel
                key={h.id}
                title={`${h.numero} · ${h.tipo === "reclamo" ? "Reclamo" : "Queja"}`}
                description={`${fecha(h.createdAt)} · ${h.consumidorNombre} · ${h.consumidorDocumento}`}
                toolbar={
                  h.estado === "respondida" ? (
                    <Badge tone="ok">Respondida {h.respondidaEn ? fecha(h.respondidaEn) : ""}</Badge>
                  ) : (
                    <Badge tone={vencida ? "danger" : "warn"}>{dias} de 15 días hábiles</Badge>
                  )
                }
              >
                <dl className="grid gap-x-6 gap-y-3 px-5 py-5 text-sm sm:grid-cols-2">
                  <Dato k="Contacto" v={[h.consumidorTelefono, h.consumidorEmail].filter(Boolean).join(" · ") || "—"} />
                  <Dato k="Domicilio" v={h.consumidorDomicilio} />
                  {h.apoderadoNombre ? <Dato k="Padre, madre o apoderado" v={h.apoderadoNombre} /> : null}
                  <Dato k={h.bienTipo === "producto" ? "Producto" : "Servicio"} v={h.bienDescripcion + (h.montoReclamadoUsd ? ` · USD ${h.montoReclamadoUsd.toLocaleString("en-US")}` : "")} />
                  <div className="sm:col-span-2">
                    <Dato k="Detalle" v={h.detalle} />
                  </div>
                  <div className="sm:col-span-2">
                    <Dato k="Pedido" v={h.pedido} />
                  </div>
                </dl>
                <div className="border-t border-line px-5 py-5">
                  {h.estado === "respondida" && h.respuesta ? (
                    <Dato k="Respuesta de Luxcars" v={h.respuesta} />
                  ) : (
                    <ResponderReclamacion id={h.id} numero={h.numero} />
                  )}
                </div>
              </PortalPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-4">{k}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-ink-2">{v}</dd>
    </div>
  );
}
