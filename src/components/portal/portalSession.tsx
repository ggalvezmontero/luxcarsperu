"use client";

/**
 * Estado de sesión del portal, compartido entre el armazón y las pantallas.
 *
 * Quien decide si hay sesión es Neon Auth, no este archivo: acá solo se
 * escucha (`onAuthStateChange` para otras pestañas, `alCambiarSesion` para
 * esta) y se guarda el resultado. No se persiste nada a
 * mano, no se guarda ninguna contraseña y no se emite ningún token propio.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { fetchOwnProfileResult, type Profile } from "@/lib/auth/perfil";
import {
  alCambiarSesion,
  avisarCambioDeSesion,
  getPortalClient,
  isPortalAuthConfigured,
  type PortalAuthSession,
  type PortalClient,
} from "@/lib/portal/portalClient";

/**
 * - `verificando`: todavía se está leyendo la sesión guardada (primer render).
 * - `autenticado`: hay sesión válida de Neon Auth.
 * - `anonimo`: no hay sesión; corresponde mandar a /portal/login.
 * - `sin-permiso`: hay sesión pero el perfil NO es administrador (un cliente
 *   del sitio). El portal no se muestra; RLS ya le devolvería cero filas,
 *   esto solo evita una pantalla vacía y confusa.
 * - `error-perfil`: hay sesión pero NO se pudo leer el perfil (token vencido,
 *   base dormida, red). No se sabe si es admin: no se cierra la sesión ni se
 *   dice "no es del equipo"; se ofrece reintentar con `reintentar()`.
 * - `sin-configurar`: no hay variables de Neon. No tiene sentido pedir
 *   login porque no hay a quién preguntarle: se muestra el portal en modo
 *   demostración, con todo en cero y el aviso de qué falta.
 *
 * `autenticado` significa, desde la migración 0010, "sesión válida Y rol
 * admin activo". Ninguna pantalla del portal tiene que volver a comprobarlo.
 */
export type PortalSessionStatus =
  | "verificando"
  | "autenticado"
  | "anonimo"
  | "sin-permiso"
  | "error-perfil"
  | "sin-configurar";

export type PortalSessionValue = {
  status: PortalSessionStatus;
  /** Correo del usuario con sesión, para mostrarlo en la barra lateral. */
  email: string | null;
  /** Perfil (`public.profiles`) del usuario con sesión. `null` sin sesión. */
  profile: Profile | null;
  /** Cliente con sesión. `null` si no hay configuración. */
  client: PortalClient | null;
  /** Cierra la sesión en Neon Auth y devuelve al login. */
  signOut: () => Promise<void>;
  /** Vuelve a leer sesión y perfil (para salir de `error-perfil`). */
  reintentar: () => Promise<void>;
};

const PortalSessionContext = createContext<PortalSessionValue | null>(null);

export function PortalSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isPortalAuthConfigured();

  // El cliente se resuelve en render, no en un efecto: `getPortalClient()`
  // está memoizado a nivel de módulo y devuelve `null` en el servidor, así que
  // esto es estable y no dispara un render extra. Guardarlo en estado obligaría
  // a un `setState` síncrono dentro del efecto (renders en cascada).
  const client = useMemo(() => getPortalClient(), []);

  // El estado inicial ya es el correcto para el caso "sin configurar": el
  // efecto no necesita corregirlo.
  const [status, setStatus] = useState<PortalSessionStatus>(
    configured ? "verificando" : "sin-configurar",
  );
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // La relectura vive dentro del efecto (cierra sobre `cancelled` y `client`);
  // el botón de reintentar la alcanza por acá.
  const releerRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!configured) return;

    let cancelled = false;

    if (!client) {
      // Configuración presente pero el cliente no se pudo construir. En un
      // microtask, no en el cuerpo del efecto: un `setState` síncrono acá
      // provoca renders en cascada (react-hooks/set-state-in-effect).
      queueMicrotask(() => {
        if (!cancelled) setStatus("sin-configurar");
      });
      return () => {
        cancelled = true;
      };
    }

    // Con sesión, el estado final depende del ROL del perfil, no solo de que
    // exista la sesión. Sin perfil (o inactivo, o cliente) no hay portal.
    const resolve = async (session: PortalAuthSession) => {
      if (cancelled) return;
      setEmail(session?.user?.email ?? null);
      if (!session) {
        setProfile(null);
        setStatus("anonimo");
        return;
      }
      const result = await fetchOwnProfileResult(client);
      if (cancelled) return;
      if (result.status === "error") {
        // La lectura falló: no se sabe si es admin. Nunca se trata como
        // "sin permiso" (eso le dice a un admin que no es del equipo).
        setProfile(null);
        setStatus("error-perfil");
        return;
      }
      const own = result.status === "ok" ? result.profile : null;
      setProfile(own);
      setStatus(own?.role === "admin" && own.active ? "autenticado" : "sin-permiso");
    };

    const releer = () =>
      client.auth
        .getSession()
        .then(({ data }: { data: { session: PortalAuthSession } }) =>
          resolve(data.session),
        )
        .catch(() => {
          // Neon Auth inalcanzable: se trata como "sin sesión", no como error
          // fatal. El usuario verá el login y el mensaje al intentar entrar.
          if (!cancelled) setStatus("anonimo");
        });

    releerRef.current = releer;
    void releer();
    const dejarDeOir = alCambiarSesion(releer);

    const { data: listener } = client.auth.onAuthStateChange(
      (_event: string, session: PortalAuthSession) => {
        void resolve(session);
      },
    );

    return () => {
      cancelled = true;
      releerRef.current = null;
      dejarDeOir();
      listener.subscription.unsubscribe();
    };
  }, [configured, client]);

  const reintentar = useCallback(async () => {
    const releer = releerRef.current;
    if (!releer) return;
    setStatus("verificando");
    await releer();
  }, []);

  const signOut = useCallback(async () => {
    if (!client) return;
    try {
      // El SDK no siempre lanza: `signOut()` también puede devolver
      // `{ error }` (ver el adaptador de @neon/auth). Se trata igual que una
      // excepción.
      const resultado = (await client.auth.signOut()) as
        | { error?: unknown }
        | undefined;
      if (resultado?.error) throw resultado.error;
      await avisarCambioDeSesion();
    } catch {
      // Si la red falla no hay nada que releer: se fuerza el estado.
      setStatus("anonimo");
      setEmail(null);
      setProfile(null);
    }
  }, [client]);

  const value = useMemo<PortalSessionValue>(
    () => ({ status, email, profile, client, signOut, reintentar }),
    [status, email, profile, client, signOut, reintentar],
  );

  return (
    <PortalSessionContext.Provider value={value}>
      {children}
    </PortalSessionContext.Provider>
  );
}

export function usePortalSession(): PortalSessionValue {
  const value = useContext(PortalSessionContext);
  if (!value) {
    throw new Error(
      "usePortalSession() debe usarse dentro de <PortalSessionProvider>, que monta src/app/portal/layout.tsx.",
    );
  }
  return value;
}
