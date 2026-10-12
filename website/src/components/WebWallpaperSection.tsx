import React, { useEffect, useRef, useState } from 'react';

const loadModelViewer = () => {
  if (document.querySelector('script[src*="model-viewer"]')) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
  document.head.appendChild(script);
};

export const WebWallpaperSection: React.FC = () => {
  const viewerRef = useRef<any>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          loadModelViewer();
        }
      },
      { rootMargin: '200px' }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!viewerRef.current) return;
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    const theta = -x * 45;
    const phi = 75 + (-y * 15);
    viewerRef.current.setAttribute('camera-orbit', `${theta}deg ${phi}deg auto`);
  };

  return (
    <section
      id="web-wallpaper"
      ref={sectionRef}
      className="relative w-full min-h-screen bg-[var(--color-background)] border-t border-[var(--color-border)] flex items-center overflow-hidden"
      onPointerMove={handlePointerMove}
    >
      {/* 3D Model Viewport */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,162,77,0.06)_0%,transparent_60%)] pointer-events-none" />

        {isInView && (
          // @ts-ignore
          <model-viewer
            ref={viewerRef}
            src="/models/model.glb"
            alt="A 3D model demonstrating Web Wallpaper capabilities"
            shadow-intensity="1"
            environment-image="neutral"
            exposure="1.5"
            loading="lazy"
            interaction-prompt="none"
            style={{ width: '100%', height: '100%', backgroundColor: 'transparent', pointerEvents: 'none' }}
          />
        )}
      </div>

      {/* Gradient scrim for text readability */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#0B0A08]/90 via-[#0B0A08]/30 to-transparent pointer-events-none" />

      {/* Text overlay */}
      <div className="absolute bottom-16 left-6 md:left-16 max-w-lg z-20 pointer-events-none">
        <div className="inline-flex items-center space-x-2 mb-4">
          <span className="w-6 h-px bg-[var(--color-accent)]" />
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Optional Feature
          </span>
        </div>

        <h2
          className="font-display text-5xl md:text-6xl text-[var(--color-primary)] mb-6"
          style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}
        >
          Web Wallpaper
        </h2>

        <p
          className="font-sans text-lg text-[var(--color-secondary)] leading-relaxed mb-6"
          style={{ textShadow: '0 2px 5px rgba(0,0,0,0.8)' }}
        >
          Import 3D model files (GLTF/GLB) to display as interactive, rotating
          desktop wallpapers with selectable environments.
        </p>

        <div className="border-l-2 border-[var(--color-accent)] pl-4 py-2">
          <p className="font-sans text-sm text-[var(--color-secondary)] leading-relaxed italic">
            This is a heavier mode — it uses an embedded browser engine and
            more system resources than Graffiti's native 2D effects.
          </p>
        </div>
      </div>

      {/* Interaction hint */}
      <div className="absolute bottom-16 right-6 md:right-16 z-20 pointer-events-none">
        <p className="font-sans text-xs uppercase tracking-widest text-[var(--color-secondary)] opacity-50">
          Move cursor to orbit
        </p>
      </div>
    </section>
  );
};
