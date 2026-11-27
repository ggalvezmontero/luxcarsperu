import "server-only";

/**
 * Tareas que nacen al confirmar un pago (27 nov 2026): con cliente empresa, la
 * confirmación del pago que cubre una factura de honorarios (Pago 2 o Pago 5)
 * crea la tarea de autodetracción de esa factura, con vencimiento a cinco días
 * hábiles con los feriados de Perú. La regla vive en el core
 * (`tareasTrasConfirmar`); acá solo se inserta, sin repetir una que ya existe.
 * La usan la ruta de movimientos, la demo y las pruebas e2e.
 */

import { tareasTrasConfirmar } from "@/core/expedientes/honorarios";
import type { ContextoExpediente, Movimiento } from "@/core/expedientes/tipos";
import { getSql } from "@/lib/db/client";

export async function crearTareasTrasConfirmar(ctx: ContextoExpediente, movimiento: Movimiento): Promise<string[]> {
  const sql = getSql();
  if (!sql) return [];
  const nuevas = tareasTrasConfirmar(ctx, movimiento);
  for (const t of nuevas) {
    await sql`
      insert into public.expediente_tareas (expediente_id, etapa, clave, titulo, descripcion, responsable, estado, visible_cliente, orden, vence_el)
      values (${ctx.expediente.id}::uuid, ${ctx.expediente.etapa}::public.etapa_expediente, ${t.clave}, ${t.titulo}, ${t.descripcion}, 'luxcars', 'pendiente', false, 95, ${t.venceEl}::date)
      on conflict (expediente_id, clave) do nothing
    `;
  }
  return nuevas.map((t) => t.clave);
}
