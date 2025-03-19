// hooks/useScrollFade.ts
import { useEffect, useRef } from 'react';

export const useScrollFade = () => {
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target.classList.contains('fade-ready')) {
            if (entry.isIntersecting) {
              entry.target.classList.add('fade-in');
            } else {
              entry.target.classList.remove('fade-in');
            }
          }
        });
      },
      {
        root: null,
        threshold: 0.1, // Start animation when 10% of the section is visible
        rootMargin: '-50px' // Slight offset for better timing
      }
    );

    if (elementRef.current) {
      elementRef.current.classList.add('fade-ready');
      observer.observe(elementRef.current);
    }

    return () => {
      if (elementRef.current) {
        observer.unobserve(elementRef.current);
      }
    };
  }, []);

  return elementRef;
};