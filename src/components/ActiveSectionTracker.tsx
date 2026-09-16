"use client";

import { useActiveSection } from "@/hooks/useActiveSection";

/**
 * Envoltorio mínimo de `useActiveSection`.
 *
 * Permite que la página que lo monta siga siendo Server Component: el hook
 * necesita `window` y el historial del navegador, pero no pinta nada. Antes,
 * la home entera llevaba 'use client' solo para poder llamarlo, lo que
 * arrastraba al cliente secciones que son HTML estático.
 */
export function ActiveSectionTracker({ ids }: { ids: string[] }) {
  useActiveSection(ids);
  return null;
}
