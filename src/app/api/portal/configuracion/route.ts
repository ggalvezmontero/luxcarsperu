/**
 * /api/portal/configuracion — respaldo de los parámetros de la empresa.
 *
 *   GET  → { respaldo }: lo que vale para cada campo de `CAMPOS_EMPRESA` cuando
 *          la tabla `configuracion_documentos` no tiene la fila: la variable
 *          `LUXCARS_DOCUMENTOS_JSON` y los valores por defecto públicos (ciudad
 *          de la sede, 15 días de espera). La pantalla /portal/configuracion los
 *          muestra como "valor de respaldo" para que el equipo los confirme o
 *          los pise. No expone nada más del entorno.
 *   POST → olvida la caché de 60 s de `camposFijosLuxcars()` en esta instancia;
 *          la pantalla lo llama tras guardar para que la siguiente emisión lea
 *          la tabla al instante.
 *
 * Las filas de la tabla NO pasan por acá: la pantalla las lee y escribe por la
 * Data API con la sesión del administrador (RLS `(select es_admin())`). La
 * ruta solo comprueba sesión y rol admin (`verificarSesionPortal`).
 */

import { NextResponse } from "next/server";

import { CAMPOS_EMPRESA, type CamposExtra } from "@/core/expedientes/campos";
import { camposFijosLuxcars, olvidarCamposFijos, respaldoDesdeEntorno } from "@/lib/expedientes/servidor/datosFijos";
import { verificarSesionPortal } from "@/lib/portal/authServer";

export async function GET() {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return NextResponse.json({ ok: false, mensaje: sesion.mensaje }, { status: sesion.status });
  // Lo público por defecto (ciudad, días) más la variable de entorno; la tabla no entra: eso lo lee la pantalla.
  olvidarCamposFijos();
  const sinTabla = await camposFijosLuxcars();
  const entorno = respaldoDesdeEntorno();
  const respaldo: CamposExtra = {};
  for (const k of CAMPOS_EMPRESA) {
    const v = entorno[k] ?? (k === "CIUDAD_FIRMA" || k === "DIAS_ESPERA_MAX" ? sinTabla[k] : undefined);
    if (v) respaldo[k] = v;
  }
  return NextResponse.json({ ok: true, respaldo });
}

export async function POST() {
  const sesion = await verificarSesionPortal();
  if (!sesion.ok) return NextResponse.json({ ok: false, mensaje: sesion.mensaje }, { status: sesion.status });
  olvidarCamposFijos();
  return NextResponse.json({ ok: true });
}
