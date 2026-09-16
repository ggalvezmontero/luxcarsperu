import type { CSSProperties, ReactNode } from "react";

/* ---------------------------------------------------------------------------
   SCROLL ANIMATION — animación de entrada con CERO JavaScript
   ---------------------------------------------------------------------------
   Antes esto era un componente cliente con framer-motion. Costaba 112 KB de
   JS (sin comprimir) en la carga inicial de la home, y la home monta NUEVE
   instancias. Peor para Core Web Vitals: `motion.div` serializa
   `style="opacity:0"` en el HTML del servidor, así que la portada —el
   elemento LCP— nacía invisible y no se pintaba hasta que framer-motion
   terminaba de hidratar. El LCP quedaba atado al JS.

   Además el componente anterior duplicaba la detección tres veces sobre el
   mismo nodo: `useInView` de framer, un listener de scroll y un
   IntersectionObserver propio, más dos setTimeout. Nueve copias de eso en la
   home.

   Ahora es un componente de servidor: no viaja NADA al cliente. La animación
   vive en `globals.css` y la conduce `animation-timeline: view()`, el
   timeline de scroll nativo del navegador.

   POR QUÉ ESTO NO REPITE EL PROBLEMA DE LCP
   El estado base del elemento es VISIBLE. La opacidad 0 solo existe dentro
   del keyframe, y el keyframe solo corre donde el navegador soporta el
   timeline. Un elemento que ya está dentro del viewport en el primer pintado
   está más allá del rango `entry`, así que con `animation-fill-mode: both`
   se pinta directamente en su estado final. La portada nunca parpadea.

   DEGRADACIÓN
   Donde no hay soporte de `animation-timeline` (o donde el usuario pidió
   `prefers-reduced-motion: reduce`) simplemente no hay animación y el
   contenido se ve. Nunca al revés. Esa es la regla: si la animación no puede
   correr, el contenido se muestra, no se esconde.

   La API pública es idéntica a la anterior (`variant`, `delay`, `className`)
   porque `src/app/page.tsx` y `src/app/como-funciona/Contenido.tsx` la
   consumen y no se tocan.
   ------------------------------------------------------------------------- */

type ScrollAnimationProps = {
  children: ReactNode;
  /** Escalonado, en segundos, como en la API anterior de framer-motion. */
  delay?: number;
  className?: string;
  variant?: "fadeUp" | "fadeIn" | "scale";
};

/**
 * El `delay` en segundos no tiene equivalente directo en una animación
 * conducida por scroll: no avanza con el tiempo, avanza con la posición. Se
 * traduce a píxeles de scroll, que es el mismo efecto de escalonado. El tope
 * de 150 px evita que una tarjeta del final de una fila quede notoriamente
 * más apagada que la primera.
 */
function staggerOffset(delay: number): string {
  if (!Number.isFinite(delay) || delay <= 0) return "0px";
  return `${Math.min(Math.round(delay * 200), 150)}px`;
}

export function ScrollAnimation({
  children,
  delay = 0,
  className,
  variant = "fadeUp",
}: ScrollAnimationProps) {
  const style =
    delay > 0
      ? ({ "--lux-reveal-stagger": staggerOffset(delay) } as CSSProperties)
      : undefined;

  return (
    <div data-lux-reveal={variant} style={style} className={className}>
      {children}
    </div>
  );
}
