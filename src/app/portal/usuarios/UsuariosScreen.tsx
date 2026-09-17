"use client";

/**
 * /portal/usuarios — cuentas y roles.
 *
 * Cada persona crea su cuenta en luxcars.pe/cuenta (nace como cliente). Acá un
 * administrador la promueve a admin, la degrada o la desactiva. El trigger
 * `profiles_proteger` impide que un admin se quite su propio rol.
 */

import {
  Badge,
  EmptyState,
  Notice,
  PortalPageHeader,
  PortalPanel,
  StatCard,
  StatGrid,
  TableScroll,
  Td,
  Th,
} from "@/components/portal/CrmUI";
import { usePortalSession } from "@/components/portal/portalSession";
import { Button } from "@/components/Button";
import type { Profile } from "@/lib/auth/perfil";
import type { UserRole } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchUsers, setUserActive, setUserRole } from "./queries";

const ROLE_LABEL: Record<UserRole, string> = { admin: "Administrador", cliente: "Cliente" };

function fecha(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function UsuariosScreen() {
  const { status: sessionStatus, client, profile: me } = usePortalSession();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [role, setRole] = useState<UserRole | "">("");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState({ role: "" as UserRole | "", search: "" });

  const canQuery = sessionStatus === "autenticado" && Boolean(client);

  const load = useCallback(async () => {
    if (!client || !canQuery) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const r = await fetchUsers(client, { role: applied.role || null, search: applied.search || null });
    setUsers(r.users);
    setError(r.error);
    setLoading(false);
  }, [client, canQuery, applied]);

  useEffect(() => {
    if (sessionStatus === "verificando") return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load, sessionStatus]);

  const admins = useMemo(() => users.filter((u) => u.role === "admin" && u.active).length, [users]);
  const clientes = useMemo(() => users.filter((u) => u.role === "cliente").length, [users]);

  const act = async (fn: () => Promise<{ ok: boolean; message: string }>) => {
    const r = await fn();
    setFlash({ ok: r.ok, text: r.message });
    if (r.ok) void load();
  };

  return (
    <div className="space-y-8">
      <PortalPageHeader
        eyebrow="Usuarios"
        title="Cuentas y roles"
        description="Todo el que se registra en la web nace como cliente. Un administrador entra al portal y ve todo; un cliente solo ve sus propias solicitudes. El rol lo cambias acá."
      />

      <StatGrid>
        <StatCard label="Administradores activos" value={admins} tone="accent" />
        <StatCard label="Clientes" value={clientes} />
        <StatCard label="Cuentas" value={users.length} />
        <StatCard label="Desactivadas" value={users.filter((u) => !u.active).length} />
      </StatGrid>

      <Notice tone="info" label="Cómo dar de alta a alguien del equipo">
        Pídele que cree su cuenta en luxcars.pe/cuenta/login (Crear cuenta). Cuando aparezca en esta lista, cámbiale el rol a Administrador. Las contraseñas se restablecen desde Supabase → Authentication → Users.
      </Notice>

      {error ? (
        <Notice tone="warn" label="No se pudo leer">
          {error}
        </Notice>
      ) : null}
      {flash ? (
        <Notice tone={flash.ok ? "info" : "danger"} label={flash.ok ? "Listo" : "No se pudo"}>
          {flash.text}
        </Notice>
      ) : null}

      <PortalPanel
        title="Cuentas"
        toolbar={
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied({ role, search });
            }}
          >
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, correo o teléfono" className="field-lux min-h-10 w-56 py-1.5 text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole | "")} className="field-lux select-lux min-h-10 w-40 py-1.5 text-sm">
              <option value="">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="cliente">Clientes</option>
            </select>
            <Button size="sm" type="submit" variant="secondary">Filtrar</Button>
          </form>
        }
      >
        {loading ? (
          <p className="px-5 py-10 text-sm text-ink-3">Cargando…</p>
        ) : users.length === 0 ? (
          <EmptyState
            title="Sin cuentas que mostrar"
            description={canQuery ? "Ninguna cuenta coincide con el filtro." : "Sin sesión o sin base de datos no hay nada que listar."}
            steps={canQuery ? undefined : ["Aplica la migración 20260917100000_cuentas_y_roles.sql.", "Entra con una cuenta de administrador."]}
          />
        ) : (
          <TableScroll>
            <table className="w-full min-w-[820px] border-collapse">
              <thead className="border-b border-line">
                <tr>
                  <Th>Persona</Th>
                  <Th>Rol</Th>
                  <Th>Estado</Th>
                  <Th>Alta</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => {
                  const isMe = me?.id === u.id;
                  return (
                    <tr key={u.id} className={cn(!u.active && "opacity-60")}>
                      <Td>
                        <p className="font-medium text-ink">
                          {u.name || "Sin nombre"} {isMe ? <span className="text-xs text-ink-4">(tú)</span> : null}
                        </p>
                        {u.email ? <p className="text-xs text-ink-3">{u.email}</p> : null}
                        {u.phone ? <p className="text-xs text-ink-4">{u.phone}</p> : null}
                      </Td>
                      <Td>
                        <Badge tone={u.role === "admin" ? "silver" : "neutral"}>{ROLE_LABEL[u.role]}</Badge>
                      </Td>
                      <Td>
                        <Badge tone={u.active ? "ok" : "danger"}>{u.active ? "Activa" : "Desactivada"}</Badge>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-3">{fecha(u.createdAt)}</span>
                      </Td>
                      <Td>
                        {isMe ? (
                          <span className="text-xs text-ink-4">Tu propio rol lo cambia otro admin.</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {client ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => act(() => setUserRole(client, { id: u.id, role: u.role === "admin" ? "cliente" : "admin" }))}
                                >
                                  {u.role === "admin" ? "Quitar admin" : "Hacer admin"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="border border-line"
                                  onClick={() => act(() => setUserActive(client, { id: u.id, active: !u.active }))}
                                >
                                  {u.active ? "Desactivar" : "Activar"}
                                </Button>
                              </>
                            ) : null}
                          </div>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </PortalPanel>
    </div>
  );
}
