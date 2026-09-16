"use client";

import { useCallback } from "react";

/**
 * Enlace "saltar al contenido" (WCAG 2.4.1 Bypass Blocks, nivel A).
 *
 * POR QUÉ EXISTE: todas las páginas públicas empiezan con la Navbar, que son
 * entre 6 y 8 tabulaciones (logo + 5 enlaces + CTA, y en móvil además el
 * hamburguesa). Sin este enlace, alguien que navega con teclado o con un
 * conmutador tiene que atravesar ese bloque entero en CADA página antes de
 * llegar al contenido. Es un incumplimiento de nivel A, el más básico.
 *
 * POR QUÉ BUSCA EL <main> EN LUGAR DE APUNTAR A UN id FIJO: el `<main>` lo
 * declara cada página por su cuenta (src/app/comprar/page.tsx, vender, etc.) y
 * ninguno tiene `id`. Este componente no puede editar esos archivos, así que
 * localiza el `<main>` en tiempo de ejecución y le pone el `id` y el
 * `tabindex="-1"` que necesita. Si mañana alguien le pone un `id` propio al
 * `<main>`, esto lo respeta y sigue funcionando.
 *
 * POR QUÉ MUEVE EL FOCO CON JS Y NO SOLO CON EL HASH: un `href="#x"` mueve el
 * scroll, pero en varios navegadores NO mueve el foco del teclado si el
 * destino no es enfocable. El resultado clásico es que el usuario salta
 * visualmente y la siguiente tabulación lo devuelve a la navbar. Poner
 * `tabindex="-1"` y llamar a `focus()` es lo que hace que el salto sea real.
 */

const MAIN_ID = "contenido-principal";

export function SkipLink() {
  const saltar = useCallback((evento: React.MouseEvent<HTMLAnchorElement>) => {
    const main = document.querySelector("main");
    if (!main) return; // Sin <main> se deja el comportamiento por defecto.

    evento.preventDefault();

    if (!main.id) main.id = MAIN_ID;
    // Sin tabindex, focus() no hace nada sobre un <main>.
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");

    main.focus();
    main.scrollIntoView({ block: "start" });
    // El hash se actualiza para que "volver atrás" y recargar se comporten
    // igual que con un enlace normal.
    history.replaceState(null, "", `#${main.id}`);
  }, []);

  return (
    <a
      href={`#${MAIN_ID}`}
      onClick={saltar}
      /* Fuera de pantalla hasta que recibe foco: no ocupa lugar en el diseño
         pero sigue en el orden de tabulación, que es justo lo que se busca.
         `focus:` y no `focus-visible:`: si algo le da foco por programa, tiene
         que verse igual. */
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:inline-flex focus:items-center focus:rounded-lux focus:border focus:border-silver-bright focus:bg-surface-2 focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:tracking-wide focus:text-ink focus:shadow-[var(--lux-shadow-lg)]"
    >
      Saltar al contenido
    </a>
  );
}
