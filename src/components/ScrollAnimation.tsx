"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

type ScrollAnimationProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
  variant?: "fadeUp" | "fadeIn" | "scale";
};

const variants = {
  fadeUp: {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0 },
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
  },
};

export function ScrollAnimation({
  children,
  delay = 0,
  className,
  variant = "fadeUp",
}: ScrollAnimationProps) {
  const variantConfig = variants[variant];
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkVisibility = () => {
      if (!ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const margin = 100;

      const isInViewport =
        rect.top < windowHeight + margin &&
        rect.bottom > -margin;

      if (isInViewport) {
        setIsVisible(true);
      }
    };

    // Verificar inmediatamente al montar
    checkVisibility();

    // Verificar después de un delay para capturar scrolls programáticos
    const timeout1 = setTimeout(checkVisibility, 100);
    const timeout2 = setTimeout(checkVisibility, 500);

    // Escuchar scrolls para detectar scrolls programáticos
    window.addEventListener("scroll", checkVisibility, { passive: true });
    
    // También usar un IntersectionObserver como respaldo
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      {
        rootMargin: "-100px",
        threshold: 0,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      clearTimeout(timeout1);
      clearTimeout(timeout2);
      window.removeEventListener("scroll", checkVisibility);
      observer.disconnect();
    };
  }, []);

  // Usar isVisible o isInView para determinar si debe animar
  const shouldAnimate = isVisible || isInView;

  return (
    <motion.div
      ref={ref}
      initial={variantConfig.initial}
      animate={shouldAnimate ? variantConfig.animate : variantConfig.initial}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

