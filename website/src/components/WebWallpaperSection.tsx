import React, { useEffect, useRef } from 'react';

// Include the script tag required for model-viewer when mounted
const loadModelViewer = () => {
  if (document.querySelector('script[src*="model-viewer"]')) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
  document.head.appendChild(script);
};

export const WebWallpaperSection: React.FC = () => {
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    loadModelViewer();
  }, []);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!viewerRef.current) return;
    
    // Calculate normalized position (-1 to 1)
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    
    // Map to camera angles (orbit).
    // Invert x and y so the model rotates IN the direction of the cursor instead of away from it.
    // Azimuth (theta) ranges from +45deg to -45deg based on X position.
    const theta = -x * 45;
    
    // Elevation (phi) ranges based on Y position (default is 75).
    const phi = 75 + (-y * 15);
    
    // Apply directly via ref to bypass React re-renders for 60fps performance
    viewerRef.current.setAttribute('camera-orbit', `${theta}deg ${phi}deg auto`);
  };

  return (
    <section 
      id="web-wallpaper" 
      className="relative w-full min-h-screen bg-[#0B0A08] border-t border-[var(--color-border)] flex items-center overflow-hidden snap-start"
      onPointerMove={handlePointerMove}
    >
      {/* 3D Model Viewport - Full Bleed */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(201,162,77,0.1)_0%,transparent_70%)] pointer-events-none" />
        
        {/* @ts-ignore */}
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
      </div>

      {/* Scrim for text readability */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#0B0A08]/90 via-[#0B0A08]/40 to-transparent pointer-events-none" />

      {/* Text Content Overlay */}
      <div className="absolute bottom-16 left-6 md:left-16 max-w-lg z-20 pointer-events-none">
        <span className="font-sans text-xs uppercase tracking-[0.2em] text-[var(--color-accent)] mb-4 block" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
          Optional Feature
        </span>
        <h2 className="font-display text-5xl md:text-6xl text-[var(--color-primary)] mb-6" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
          Web Wallpaper
        </h2>
        
        <div className="space-y-6">
          <p className="font-sans text-lg text-[var(--color-secondary)] leading-relaxed" style={{ textShadow: '0 2px 5px rgba(0,0,0,0.8)' }}>
            Import your own 3D model files (GLTF/GLB) to display as interactive, rotating desktop wallpapers with selectable environments. 
          </p>
          
          <div className="border-l border-[var(--color-accent)] pl-4 py-1 bg-black/20 backdrop-blur-sm rounded-r-md">
            <p className="font-sans text-sm text-[var(--color-secondary)] leading-relaxed italic" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              Note: This is a distinct, heavier mode compared to Graffiti's native 2D effects. It relies on an embedded browser engine and uses noticeably more system resources to render real-time 3D environments.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
