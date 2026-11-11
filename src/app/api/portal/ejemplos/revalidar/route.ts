/**
 * POST /api/portal/ejemplos/revalidar — pide regenerar las páginas públicas que
 * muestran los ejemplos de importación.
 *
 * El portal lo llama después de guardar un cambio en /portal/ejemplos. La
 * escritura ya ocurrió (desde el navegador, con RLS); esto solo le avisa a
 * Next que la home, /importar, las páginas de cada modelo y el sitemap quedaron
 * viejos. Se regeneran en la
 * siguiente visita: sin esto el cambio tardaría hasta la próxima regeneración
 * programada en verse.
 *
 * Solo para administradores: regenerar cuesta trabajo del servidor y no hay
 * razón para que lo dispare un visitante.
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { verificarSesionPortal } from "@/lib/portal/authServer";

/** Todo lo que pinta la lista de ejemplos. */
const RUTAS = ["/", "/importar", "/sitemap.xml"] as const;

export async function POST() {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) {
    return NextResponse.json({ ok: false, mensaje: sesion.mensaje }, { status: sesion.status });
  }

  try {
    for (const ruta of RUTAS) revalidatePath(ruta);
    // Todas las páginas de modelo a la vez: cambia el precio de una y también
    // la lista de "otros modelos" de las demás.
    revalidatePath("/importar/[modelo]", "page");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo pedir la actualización de la web." },
      { status: 500 },
    );
  }
}
