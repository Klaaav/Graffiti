import React, { useEffect, useRef, useState } from 'react';

export const GallerySection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      id="gallery" 
      ref={containerRef}
      className="relative w-full min-h-screen bg-[#0B0A08] border-t border-[var(--color-border)] flex items-center justify-center overflow-hidden py-24 snap-start"
    >
      <div className="container mx-auto px-6 md:px-12 flex flex-col lg:flex-row items-center gap-16 z-10">
        
        {/* Text Column - Asymmetric Layout */}
        <div 
          className={`w-full lg:w-5/12 flex flex-col transition-all duration-1000 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="inline-flex items-center space-x-2 mb-4">
            <span className="w-8 h-px bg-[var(--color-accent)]"></span>
            <span className="font-sans text-xs uppercase tracking-widest text-[var(--color-accent)]">Feature 02</span>
          </div>
          
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-[var(--color-primary)] mb-6 leading-tight">
            Gallery
          </h2>
          
          <div className="space-y-6 font-sans text-lg text-[var(--color-secondary)] leading-relaxed">
            <p>
              Move beyond the boundaries of a single photograph. The Gallery toolset lets you architect custom geometric polygon shapes, placing entirely different images inside each facet.
            </p>
            <p>
              Pan, zoom, and rotate individual slices until your composition is perfect. Save your intricate arrangements as reusable projects, or bake them directly into one unified, GPU-accelerated desktop wallpaper instantly.
            </p>
          </div>
        </div>

        {/* Image Column */}
        <div 
          className={`w-full lg:w-7/12 relative transition-all duration-1000 delay-300 ease-out ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
          }`}
        >
          <div className="relative aspect-square md:aspect-[4/3] rounded-sm overflow-hidden border border-[var(--color-border)]/50 shadow-2xl bg-[#16130E] p-2">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#C9A24D]/5 to-transparent pointer-events-none z-10 mix-blend-overlay"></div>
            <img 
              src="/wallpapers/gallery_hero.jpg" 
              alt="Gallery Polygon Collage Interface" 
              className="w-full h-full object-cover rounded-sm filter contrast-125 saturate-50"
            />
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute -bottom-6 -right-6 w-32 h-32 border-b-2 border-r-2 border-[var(--color-accent)]/30 z-0"></div>
          <div className="absolute -top-6 -left-6 w-32 h-32 border-t-2 border-l-2 border-[var(--color-accent)]/30 z-0"></div>
        </div>

      </div>
    </section>
  );
};
