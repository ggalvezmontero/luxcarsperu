"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/Button";

/** Caja de respuesta de una hoja. Al guardar, la página se vuelve a leer del servidor. */
export function ResponderReclamacion({ id, numero }: { id: string; numero: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<{ ocupado: boolean; error: string | null }>({ ocupado: false, error: null });

  async function guardar() {
    setEstado({ ocupado: true, error: null });
    try {
      const r = await fetch(`/api/admin/reclamaciones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respuesta: texto }),
      });
      const json = (await r.json().catch(() => null)) as { ok?: boolean; mensaje?: string } | null;
      if (!r.ok || !json?.ok) {
        setEstado({ ocupado: false, error: json?.mensaje ?? `Error ${r.status}.` });
        return;
      }
      setEstado({ ocupado: false, error: null });
      router.refresh();
    } catch {
      setEstado({ ocupado: false, error: "No se pudo contactar al servidor." });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`resp-${id}`} className="text-sm text-ink-2">
        Respuesta a {numero} <span className="text-xs text-ink-4">(queda registrada con fecha; comunícala también al cliente por su contacto)</span>
      </label>
      <textarea
        id={`resp-${id}`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className="field-lux min-h-28 resize-y"
        maxLength={4000}
        placeholder="Qué se revisó, qué se hizo y qué se le ofrece."
      />
      {estado.error ? <p className="text-sm text-danger">{estado.error}</p> : null}
      <div>
        <Button onClick={guardar} variant="primary" size="sm" disabled={estado.ocupado || texto.trim().length < 10}>
          {estado.ocupado ? "Guardando…" : "Registrar respuesta"}
        </Button>
      </div>
    </div>
  );
}
