"use client";

import { useRouter } from "next/navigation";
import { Notice, PortalPageHeader } from "@/components/portal/CrmUI";
import { usePortalSession } from "@/components/portal/portalSession";
import { guardarCotizacion } from "@/lib/cotizaciones/consultas";
import { CotizacionEditor } from "../CotizacionEditor";

export function NuevaCotizacionScreen() {
  const router = useRouter();
  const { status, client } = usePortalSession();
  return (
    <div className="mt-6 space-y-8">
      <PortalPageHeader
        eyebrow="Nueva cotización"
        title="Cotizar una importación a pedido"
        description="Cliente, autos y costos del contenedor. Se guarda en borrador con el siguiente número; después generas el PDF y la marcas como enviada."
      />
      {status !== "verificando" && !client ? <Notice tone="warn" label="Sin sesión">Hace falta una sesión de administrador.</Notice> : null}
      {client ? (
        <CotizacionEditor
          inicial={null}
          textoGuardar="Crear cotización"
          onGuardar={async (e) => {
            const r = await guardarCotizacion(client, null, e);
            if (r.ok && r.id) router.push(`/portal/cotizaciones/${r.id}`);
            return r;
          }}
        />
      ) : null}
    </div>
  );
}
