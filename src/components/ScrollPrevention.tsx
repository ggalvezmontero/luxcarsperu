'use client';

import { useEffect } from 'react';

/**
 * Componente que previene el scroll automático al recargar la página
 * y restaura el scroll suave después de la carga inicial
 */
export function ScrollPrevention() {
  useEffect(() => {
    // Prevenir scroll automático al cargar
    if (typeof window === 'undefined') return;

    // Guardar la posición actual del scroll antes de cualquier cambio
    const savedScrollY = window.scrollY;

    // Desactivar scroll suave temporalmente
    document.documentElement.style.scrollBehavior = 'auto';

    // Prevenir cualquier scroll automático
    const preventAutoScroll = () => {
      if (Math.abs(window.scrollY - savedScrollY) > 10) {
        window.scrollTo({
          top: savedScrollY,
          behavior: 'auto'
        });
      }
    };

    // Ejecutar inmediatamente y después de múltiples frames
    preventAutoScroll();
    requestAnimationFrame(() => {
      preventAutoScroll();
      requestAnimationFrame(() => {
        preventAutoScroll();
      });
    });

    // Restaurar scroll suave después de que la página se haya cargado.
    //
    // Antes esto también añadía la clase `js-scroll-initialized` al <html>.
    // Se eliminó: ningún selector de globals.css ni ningún componente la leía
    // nunca, así que era una escritura en el DOM que no producía efecto. Si
    // alguien la vuelve a necesitar, que la agregue junto con el selector que
    // la consume.
    const restoreSmoothScroll = () => {
      document.documentElement.style.scrollBehavior = '';
    };

    // Restaurar después de un pequeño delay
    const timeoutId = setTimeout(restoreSmoothScroll, 100);

    // También restaurar cuando la página esté completamente cargada
    if (document.readyState === 'complete') {
      restoreSmoothScroll();
    } else {
      window.addEventListener('load', restoreSmoothScroll, { once: true });
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('load', restoreSmoothScroll);
    };
  }, []);

  return null;
}