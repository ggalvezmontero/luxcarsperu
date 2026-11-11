/**
 * POST /api/portal/vehiculos/revalidar — pide regenerar las páginas públicas
 * que muestran el stock después de un cambio en un vehículo.
 *
 * El portal lo llama tras guardar la ficha, publicar, despublicar, cambiar el
 * estado o el precio. La escritura ya ocurrió (desde el navegador, con RLS);
 * esto solo le avisa a Next que la portada, /comprar, la ficha del auto y el
 * sitemap quedaron viejos. Sin esto, un auto recién publicado tardaba hasta
 * cinco minutos en aparecer en el listado (y la portada, hasta que venciera su
 * caché): pasó el 2026-11-11 con el primer auto en consignación.
 *
 * Cuerpo JSON opcional: `{ id, slug }` del vehículo. Se validan por forma
 * (UUID y slug de letras, números y guiones) porque van a una ruta.
 *
 * Solo para administradores: regenerar cuesta trabajo del servidor y no hay
 * razón para que lo dispare un visitante.
 */

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { verificarSesionPortal } from "@/lib/portal/authServer";

/** Todo lo que lista el stock. */
const RUTAS = ["/", "/comprar", "/sitemap.xml"] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9-]{1,120}$/;

export async function POST(request: Request) {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) {
    return NextResponse.json({ ok: false, mensaje: sesion.mensaje }, { status: sesion.status });
  }

  let cuerpo: { id?: unknown; slug?: unknown } = {};
  try {
    cuerpo = (await request.json()) as typeof cuerpo;
  } catch {
    // Sin cuerpo: se regeneran solo los listados.
  }
  const id = typeof cuerpo.id === "string" && UUID_RE.test(cuerpo.id) ? cuerpo.id : null;
  const slug = typeof cuerpo.slug === "string" && SLUG_RE.test(cuerpo.slug) ? cuerpo.slug : null;

  try {
    for (const ruta of RUTAS) revalidatePath(ruta);
    // La ficha se sirve por slug o por id (`/comprar/<slug o id>`): las dos.
    if (slug) revalidatePath(`/comprar/${slug}`);
    if (id) revalidatePath(`/comprar/${id}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, mensaje: "No se pudo pedir la actualización de la web." },
      { status: 500 },
    );
  }
}
