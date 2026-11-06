"use client";

/**
 * Sesión del CLIENTE en el sitio público (/cuenta/*).
 *
 * Mismo modelo que el portal (`portalSession.tsx`): quien decide si hay sesión
 * es Neon Auth; acá solo se escucha (`onAuthStateChange` para otras pestañas,
 * `alCambiarSesion` para esta) y se lee el perfil
 * (`public.profiles`) para saber nombre y rol. No se persiste nada a mano.
 *
 * Comparte el cliente de navegador con el portal a propósito: una sola sesión
 * por navegador. Un admin que entra por /cuenta ve su cuenta como cualquier
 * cliente y además tiene acceso al portal; un cliente que intenta /portal es
 * rechazado por su rol.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

export type CuentaSessionStatus =
  | "verificando"
  | "autenticado"
  | "anonimo"
  | "sin-configurar";

export type CuentaSessionValue = {
  status: CuentaSessionStatus;
  email: string | null;
  userId: string | null;
  /** `null` mientras se carga o si no hay sesión. */
  profile: Profile | null;
  client: PortalClient | null;
  signOut: () => Promise<void>;
  /** Vuelve a leer el perfil (tras editarlo). */
  refreshProfile: () => Promise<void>;
};

const CuentaSessionContext = createContext<CuentaSessionValue | null>(null);

export function CuentaSessionProvider({ children }: { children: React.ReactNode }) {
  const configured = isPortalAuthConfigured();
  const client = useMemo(() => getPortalClient(), []);

  const [status, setStatus] = useState<CuentaSessionStatus>(
    configured ? "verificando" : "sin-configurar",
  );
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!client) return;
    const result = await fetchOwnProfileResult(client);
    // Si la lectura falló se conserva el perfil que ya se tenía.
    if (result.status === "ok") setProfile(result.profile);
    else if (result.status === "sin-perfil") setProfile(null);
  }, [client]);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;

    if (!client) {
      queueMicrotask(() => {
        if (!cancelled) setStatus("sin-configurar");
      });
      return () => {
        cancelled = true;
      };
    }

    const apply = async (session: PortalAuthSession) => {
      if (cancelled) return;
      setEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
      if (session?.user) {
        const result = await fetchOwnProfileResult(client);
        if (cancelled) return;
        // Una lectura fallida conserva el perfil que ya se tenía, pero solo si
        // es de este mismo usuario.
        const uid = session.user.id ?? null;
        if (result.status === "ok") setProfile(result.profile);
        else if (result.status === "sin-perfil") setProfile(null);
        else setProfile((previo) => (previo && previo.id === uid ? previo : null));
        setStatus("autenticado");
      } else {
        setProfile(null);
        setStatus("anonimo");
      }
    };

    const releer = () =>
      client.auth
        .getSession()
        .then(({ data }: { data: { session: PortalAuthSession } }) => apply(data.session))
        .catch(() => {
          if (!cancelled) setStatus("anonimo");
        });

    void releer();
    const dejarDeOir = alCambiarSesion(releer);

    const { data: listener } = client.auth.onAuthStateChange(
      (_event: string, session: PortalAuthSession) => {
        void apply(session);
      },
    );

    return () => {
      cancelled = true;
      dejarDeOir();
      listener.subscription.unsubscribe();
    };
  }, [configured, client]);

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
      setStatus("anonimo");
      setEmail(null);
      setUserId(null);
      setProfile(null);
    }
  }, [client]);

  const value = useMemo<CuentaSessionValue>(
    () => ({ status, email, userId, profile, client, signOut, refreshProfile }),
    [status, email, userId, profile, client, signOut, refreshProfile],
  );

  return (
    <CuentaSessionContext.Provider value={value}>{children}</CuentaSessionContext.Provider>
  );
}

export function useCuentaSession(): CuentaSessionValue {
  const value = useContext(CuentaSessionContext);
  if (!value) {
    throw new Error(
      "useCuentaSession() debe usarse dentro de <CuentaSessionProvider>, que monta src/app/cuenta/layout.tsx.",
    );
  }
  return value;
}
