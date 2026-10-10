import React, { useEffect, useRef, useState } from 'react';

interface PinnedScrollWrapperProps {
  steps: number;
  onProgress: (progress: number) => void;
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export const PinnedScrollWrapper: React.FC<PinnedScrollWrapperProps> = ({ 
  steps, 
  onProgress, 
  children,
  id,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    let ticking = false;
    let observer: IntersectionObserver;
    let isInView = false;

    const handleScroll = () => {
      if (!isInView || !containerRef.current) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const rect = containerRef.current!.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          const totalScrollableHeight = rect.height - windowHeight;
          
          // Progress is 0 when the top of the container hits the top of the viewport.
          // Progress is 1 when the bottom of the container hits the bottom of the viewport.
          let progress = -rect.top / totalScrollableHeight;
          progress = Math.max(0, Math.min(1, progress));
          
          onProgress(progress);
          ticking = false;
        });
        ticking = true;
      }
    };

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isInView = entry.isIntersecting;
          if (isInView) {
            // Trigger an immediate calculation when scrolling into view
            handleScroll();
          }
        });
      },
      // Root margin extends slightly to ensure we start tracking right before it pins
      { rootMargin: '100% 0px 100% 0px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [onProgress]);

  return (
    <section 
      id={id}
      ref={containerRef} 
      className={`relative w-full ${className}`}
      style={{ height: `${steps * 100}vh` }}
    >
      {/* Invisible vertical snap points corresponding to each horizontal step */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        {Array.from({ length: steps }).map((_, i) => (
          <div 
            key={i} 
            className="w-full snap-start snap-normal"
            style={{ 
              height: '100vh', 
              position: 'absolute',
              top: `${i * 100}vh`,
              scrollSnapStop: 'normal'
            }} 
          />
        ))}
      </div>

      <div className="sticky top-0 w-full h-screen overflow-hidden z-10">
        {children}
      </div>
    </section>
  );
};
