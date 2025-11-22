import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Hook para detectar qué sección está visible en el viewport
 * y actualizar el hash de la URL automáticamente
 */
export function useActiveSection(sectionIds: string[]) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let scrollTimeout: NodeJS.Timeout;
    let hashUpdateTimeout: NodeJS.Timeout;

    const updateActiveSection = () => {
      const scrollPosition = window.scrollY + 200; // Offset para considerar el navbar
      const scrollY = window.scrollY;

      // Si estamos cerca del top (en el hero), eliminar el hash
      if (scrollY < 300) {
        if (activeSection !== null || window.location.hash) {
          setActiveSection(null);
          if (!isScrolling) {
            hashUpdateTimeout = setTimeout(() => {
              if (window.location.hash) {
                window.history.replaceState(null, "", pathname);
              }
            }, 100);
          }
        }
        return;
      }

      // Encontrar la sección más cercana al viewport
      let currentSection: string | null = null;
      let minDistance = Infinity;

      for (const id of sectionIds) {
        const element = document.getElementById(id);
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        const elementTop = rect.top + window.scrollY;
        const elementBottom = elementTop + rect.height;

        // Si el elemento está en el viewport o cerca
        if (
          scrollPosition >= elementTop - 100 &&
          scrollPosition <= elementBottom + 100
        ) {
          const distance = Math.abs(scrollPosition - elementTop);
          if (distance < minDistance) {
            minDistance = distance;
            currentSection = id;
          }
        }
      }

      // Si no encontramos ninguna sección visible, buscar la más cercana
      if (!currentSection) {
        for (const id of sectionIds) {
          const element = document.getElementById(id);
          if (!element) continue;

          const rect = element.getBoundingClientRect();
          const elementTop = rect.top + window.scrollY;
          const distance = Math.abs(scrollPosition - elementTop);

          if (distance < minDistance) {
            minDistance = distance;
            currentSection = id;
          }
        }
      }

      if (currentSection && currentSection !== activeSection) {
        setActiveSection(currentSection);

        // Actualizar el hash sin hacer scroll
        if (!isScrolling) {
          hashUpdateTimeout = setTimeout(() => {
            const newHash = `#${currentSection}`;
            if (window.location.hash !== newHash) {
              window.history.replaceState(
                null,
                "",
                `${pathname}${newHash}`
              );
            }
          }, 100);
        }
      }
    };

    const handleScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimeout);
      clearTimeout(hashUpdateTimeout);

      updateActiveSection();

      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    // Ejecutar al montar
    updateActiveSection();

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateActiveSection, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateActiveSection);
      clearTimeout(scrollTimeout);
      clearTimeout(hashUpdateTimeout);
    };
  }, [sectionIds, activeSection, isScrolling, pathname]);

  return activeSection;
}

