'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook que actualiza el hash en la URL según la sección visible en el viewport
 * @param sectionIds Array de IDs de las secciones a observar (en orden de aparición)
 */
export function useScrollSpy(sectionIds: string[]) {
  const isUpdatingHash = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || sectionIds.length === 0) return;

    // Crear Intersection Observer para detectar qué sección está visible
    const observerOptions: IntersectionObserverInit = {
      root: null, // viewport
      rootMargin: '-10% 0px -60% 0px', // Considerar visible cuando está en el 10% superior del viewport
      threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], // Múltiples thresholds para mejor detección
    };

    const observer = new IntersectionObserver((entries) => {
      // Evitar actualizar el hash si ya estamos actualizándolo (para evitar loops)
      if (isUpdatingHash.current) return;

      // Encontrar la sección más visible y que esté más cerca de la parte superior
      let mostVisible: IntersectionObserverEntry | null = null;
      let maxRatio = 0;
      let minTop = Infinity;

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const rect = entry.boundingClientRect;
          const top = rect.top;
          const ratio = entry.intersectionRatio;
          
          // Priorizar secciones que están más arriba y tienen mayor ratio
          if (ratio > maxRatio || (ratio === maxRatio && top < minTop)) {
            maxRatio = ratio;
            minTop = top;
            mostVisible = entry;
          }
        }
      });

      const currentHash = window.location.hash.slice(1);
      const scrollY = window.scrollY || window.pageYOffset;
      
      // Si estamos en la parte superior (scrollY < 200px), considerar que estamos en hero/home
      const isAtTop = scrollY < 200;

      // Si hay una sección visible y no estamos en la parte superior
      if (mostVisible && !isAtTop) {
        const sectionId = mostVisible.target.id;

        // Solo actualizar si el hash es diferente y la sección tiene un ID válido
        if (sectionId && sectionId !== currentHash) {
          isUpdatingHash.current = true;
          
          // Actualizar el hash sin hacer scroll
          if (window.history && window.history.replaceState) {
            window.history.replaceState(
              null,
              '',
              `#${sectionId}`
            );
          } else {
            window.location.hash = `#${sectionId}`;
          }

          // Resetear el flag después de un pequeño delay
          setTimeout(() => {
            isUpdatingHash.current = false;
          }, 100);
        }
      } else if (isAtTop && currentHash) {
        // Si estamos en la parte superior (hero/home), eliminar el hash
        isUpdatingHash.current = true;
        
        // Eliminar el hash de la URL (raíz de la app)
        if (window.history && window.history.replaceState) {
          window.history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
          );
        } else {
          window.location.hash = '';
        }

        // Resetear el flag después de un pequeño delay
        setTimeout(() => {
          isUpdatingHash.current = false;
        }, 100);
      }
    }, observerOptions);

    // Función para observar las secciones con retry
    const observeSections = () => {
      const sections = sectionIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null);

      // Si no se encontraron todas las secciones, reintentar después de un delay
      if (sections.length < sectionIds.length) {
        setTimeout(observeSections, 100);
        return;
      }

      sections.forEach((section) => {
        observer.observe(section);
      });
    };

    // Función para verificar si estamos en hero/home y actualizar hash
    const checkHeroPosition = () => {
      if (isUpdatingHash.current) return;
      
      const scrollY = window.scrollY || window.pageYOffset;
      const currentHash = window.location.hash.slice(1);
      const isAtTop = scrollY < 200;

      if (isAtTop && currentHash) {
        isUpdatingHash.current = true;
        
        // Eliminar el hash de la URL (raíz de la app)
        if (window.history && window.history.replaceState) {
          window.history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
          );
        } else {
          window.location.hash = '';
        }

        setTimeout(() => {
          isUpdatingHash.current = false;
        }, 100);
      }
    };

    // Escuchar eventos de scroll para detectar cuando estamos en hero
    const handleScroll = () => {
      checkHeroPosition();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Verificar posición inicial
    checkHeroPosition();

    // Iniciar observación después de que el DOM esté listo
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(observeSections, 100);
      checkHeroPosition();
    } else {
      window.addEventListener('load', () => {
        setTimeout(observeSections, 100);
        checkHeroPosition();
      }, { once: true });
    }

    // Limpiar al desmontar
    return () => {
      sectionIds.forEach((id) => {
        const section = document.getElementById(id);
        if (section) {
          observer.unobserve(section);
        }
      });
      window.removeEventListener('scroll', handleScroll);
    };
  }, [sectionIds]);
}

