import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Hook para detectar qué sección está visible en el viewport
 * y actualizar el hash de la URL automáticamente.
 *
 * ---------------------------------------------------------------------------
 * POR QUÉ ESTE ARCHIVO SE REESCRIBIÓ (rendimiento, no estética)
 * ---------------------------------------------------------------------------
 * La versión anterior tenía tres defectos que se multiplicaban entre sí y que
 * pegaban directo al INP, que es una métrica de Core Web Vitals:
 *
 *  1. `setIsScrolling(true)` corría en CADA evento de scroll. Un setState por
 *     evento de scroll es un render por evento de scroll.
 *  2. `activeSection` e `isScrolling` estaban en el array de dependencias del
 *     mismo `useEffect` que registra el listener. Como el punto 1 cambiaba
 *     `isScrolling` en cada scroll, el efecto se desmontaba y se volvía a
 *     montar en cada scroll: `removeEventListener` + `addEventListener` por
 *     evento, más el trabajo de limpiar y recrear dos timeouts.
 *  3. `sectionIds` llega como literal de array. En `como-funciona/Contenido.tsx`
 *     se declara DENTRO del componente, así que cambia de identidad en cada
 *     render y por sí solo ya reiniciaba el efecto en cada render.
 *
 * Sumado: mover el dedo por la home disparaba decenas de ciclos
 * render → teardown → re-subscribe por segundo, cada uno con un
 * `getBoundingClientRect()` por sección (reflow forzado).
 *
 * Ahora:
 *  - El estado que solo el efecto necesita leer vive en refs, así que el
 *    efecto se suscribe UNA vez y no se vuelve a suscribir.
 *  - `setActiveSection` se llama solo cuando la sección realmente cambia.
 *  - La medición se agrupa en un `requestAnimationFrame`: como mucho un
 *    reflow por frame, en vez de uno por evento.
 *  - La dependencia es la lista serializada, no la identidad del array.
 *
 * El comportamiento observable (qué hash se escribe y cuándo) es el mismo.
 */
export function useActiveSection(sectionIds: string[]) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Refs: el efecto los lee sin necesitar estar suscrito a sus cambios.
  const activeRef = useRef<string | null>(null);
  const scrollingRef = useRef(false);

  // Clave estable: dos arrays con los mismos ids son el mismo trabajo, aunque
  // sean objetos distintos. Esto es lo que impide que el efecto se reinicie en
  // cada render de quien nos llama.
  const idsKey = sectionIds.join("|");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ids = idsKey ? idsKey.split("|") : [];
    if (ids.length === 0) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | undefined;
    let hashUpdateTimeout: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;

    const commitHash = (hash: string | null) => {
      if (scrollingRef.current) return;
      clearTimeout(hashUpdateTimeout);
      hashUpdateTimeout = setTimeout(() => {
        const target = hash ? `${pathname}#${hash}` : pathname;
        const current = `${window.location.pathname}${window.location.hash}`;
        if (current !== target) {
          window.history.replaceState(null, "", target);
        }
      }, 100);
    };

    const measure = () => {
      frame = 0;
      const scrollY = window.scrollY;
      const scrollPosition = scrollY + 200; // Offset para considerar el navbar

      // Cerca del top (en el hero): sin hash.
      if (scrollY < 300) {
        if (activeRef.current !== null || window.location.hash) {
          activeRef.current = null;
          setActiveSection(null);
          commitHash(null);
        }
        return;
      }

      // Una sola pasada de medición por frame. Se busca la sección cuyo borde
      // superior esté más cerca del punto de lectura; el segundo criterio
      // (contención en el viewport) gana sobre el primero, igual que antes.
      let contained: string | null = null;
      let containedDistance = Infinity;
      let nearest: string | null = null;
      let nearestDistance = Infinity;

      for (const id of ids) {
        const element = document.getElementById(id);
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        const elementTop = rect.top + scrollY;
        const elementBottom = elementTop + rect.height;
        const distance = Math.abs(scrollPosition - elementTop);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = id;
        }

        if (
          scrollPosition >= elementTop - 100 &&
          scrollPosition <= elementBottom + 100 &&
          distance < containedDistance
        ) {
          containedDistance = distance;
          contained = id;
        }
      }

      const current = contained ?? nearest;
      if (current && current !== activeRef.current) {
        activeRef.current = current;
        setActiveSection(current);
        commitHash(current);
      }
    };

    // Agrupa las mediciones en el frame: el scroll puede disparar decenas de
    // eventos entre dos pintados y solo el último importa.
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    const handleScroll = () => {
      scrollingRef.current = true;
      clearTimeout(scrollTimeout);
      schedule();
      scrollTimeout = setTimeout(() => {
        scrollingRef.current = false;
        schedule();
      }, 150);
    };

    measure();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(scrollTimeout);
      clearTimeout(hashUpdateTimeout);
    };
  }, [idsKey, pathname]);

  return activeSection;
}
