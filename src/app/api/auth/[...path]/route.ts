/**
 * /api/auth/* — puente entre el navegador y Neon Auth.
 *
 * El portal no llama a Neon Auth directo: llama acá, y esta ruta reenvía la
 * petición (iniciar sesión, leer la sesión, pedir el token de la Data API,
 * cerrar sesión, recuperar contraseña). El motivo es la cookie: así queda en el
 * dominio de LuxCars y no en uno de terceros, que Safari y los modos privados
 * bloquean. El detalle está en `src/lib/portal/portalClient.ts`.
 *
 * No hay lógica propia: todo lo resuelve `@neon/neon-js`. Lo único que agrega
 * este archivo es no lanzar si falta configuración — responde 503 diciendo qué
 * variable falta, para que el build y el resto del sitio sigan en pie.
 */

import { NextResponse } from "next/server";

import {
  getPortalAuth,
  getPortalAuthServerMissingEnv,
} from "@/lib/portal/authServer";

type Contexto = { params: Promise<{ path: string[] }> };
type Metodo = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

function reenviar(metodo: Metodo) {
  return async (request: Request, contexto: Contexto): Promise<Response> => {
    const auth = getPortalAuth();
    if (!auth) {
      return NextResponse.json(
        {
          code: "portal_sin_configurar",
          message: `portal_sin_configurar: falta ${getPortalAuthServerMissingEnv().join(" y ")}.`,
        },
        { status: 503 },
      );
    }
    return auth.handler()[metodo](request, contexto);
  };
}

export const GET = reenviar("GET");
export const POST = reenviar("POST");
export const PUT = reenviar("PUT");
export const DELETE = reenviar("DELETE");
export const PATCH = reenviar("PATCH");
