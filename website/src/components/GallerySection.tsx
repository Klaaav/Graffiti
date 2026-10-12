import React, { useEffect, useRef, useState, useCallback } from 'react';

const IMAGES = [
  { src: '/gallery/ferrari1000.jpg', alt: 'Ferrari 1000 GP celebration' },
  { src: '/gallery/astonmartin.jpg', alt: 'Aston Martin F1 car' },
  { src: '/gallery/bugatti.jpg', alt: 'Bugatti concept F1 design' },
  { src: '/gallery/artcar.webp', alt: 'Graffiti-wrapped art car' },
];

const COLLAGE_SRC = '/gallery/collage.png';

// Diagonal strip clip-paths matching the actual collage composition.
// The collage has 5 diagonal strips angled ~25deg. We use 4 images in 4 strips
// and let the collage resolve the full composition.
const STRIP_CLIPS = [
  'polygon(0% 0%, 28% 0%, 8% 100%, 0% 100%)',
  'polygon(16% 0%, 48% 0%, 28% 100%, 0% 100%)',
  'polygon(38% 0%, 78% 0%, 62% 100%, 22% 100%)',
  'polygon(68% 0%, 100% 0%, 100% 100%, 52% 100%)',
];

// Scattered starting positions (percentage offsets from center)
const SCATTER_POSITIONS = [
  { x: -35, y: -20, rotate: -8, scale: 0.7 },
  { x: -12, y: 25, rotate: 5, scale: 0.75 },
  { x: 18, y: -15, rotate: -3, scale: 0.72 },
  { x: 40, y: 12, rotate: 7, scale: 0.68 },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeOutQuart(t: number) {
  return 1 - Math.pow(1 - t, 4);
}

export const GallerySection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rafRef = useRef(0);
  const isInViewRef = useRef(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const handleScroll = useCallback(() => {
    if (!isInViewRef.current || !sectionRef.current) return;
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const vh = window.innerHeight;
      const totalScroll = rect.height - vh;
      const raw = -rect.top / totalScroll;
      setProgress(Math.max(0, Math.min(1, raw)));
    });
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        isInViewRef.current = entry.isIntersecting;
        if (entry.isIntersecting) handleScroll();
      },
      { rootMargin: '100% 0px 100% 0px' }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleScroll]);

  // Phase breakdown:
  // 0.00–0.10: Text intro fades in
  // 0.10–0.55: Images scatter → assemble into diagonal strips
  // 0.55–0.75: Strips merge, collage crossfades in
  // 0.75–1.00: Collage holds, subtle parallax on scroll

  const textOpacity = reducedMotion ? 1 : Math.min(1, progress / 0.10);
  const textY = reducedMotion ? 0 : lerp(40, 0, Math.min(1, progress / 0.10));

  const assembleProgress = reducedMotion ? 1 : Math.max(0, Math.min(1, (progress - 0.10) / 0.45));
  const assembleEased = easeOutQuart(assembleProgress);

  const collageFade = reducedMotion ? 1 : Math.max(0, Math.min(1, (progress - 0.55) / 0.20));

  const holdParallax = reducedMotion ? 0 : Math.max(0, (progress - 0.75) / 0.25) * -20;

  return (
    <section
      id="gallery"
      ref={sectionRef}
      className="relative w-full"
      style={{ height: '400vh' }}
    >
      <div
        ref={stickyRef}
        className="sticky top-0 w-full h-screen overflow-hidden flex flex-col justify-center items-center"
        style={{ background: '#0B0A08' }}
      >
        {/* Section heading */}
        <div
          className="absolute top-16 left-6 md:left-16 z-20 max-w-lg pointer-events-none"
          style={{
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
          }}
        >
          <div className="inline-flex items-center space-x-2 mb-4">
            <span className="w-8 h-px bg-[var(--color-accent)]" />
            <span className="font-sans text-xs uppercase tracking-widest text-[var(--color-accent)]">
              Gallery
            </span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-[var(--color-primary)] mb-4 leading-tight">
            Collage Builder
          </h2>
          <p className="font-sans text-lg text-[var(--color-secondary)] leading-relaxed max-w-md">
            Architect custom polygon layouts from multiple images and bake them into a single interactive wallpaper.
          </p>
        </div>

        {/* Collage assembly area */}
        <div
          className="relative w-full max-w-5xl mx-auto aspect-video"
          style={{
            transform: `translateY(${holdParallax}px)`,
          }}
        >
          {/* Individual images in diagonal strips */}
          {IMAGES.map((img, i) => {
            const scatter = SCATTER_POSITIONS[i];
            const x = lerp(scatter.x, 0, assembleEased);
            const y = lerp(scatter.y, 0, assembleEased);
            const rotate = lerp(scatter.rotate, 0, assembleEased);
            const scale = lerp(scatter.scale, 1, assembleEased);

            const imgOpacity = reducedMotion
              ? 1
              : Math.min(1, assembleProgress * 3) * (1 - collageFade);

            return (
              <div
                key={i}
                className="absolute inset-0"
                style={{
                  clipPath: assembleEased > 0.3 ? STRIP_CLIPS[i] : 'none',
                  transform: `translate(${x}%, ${y}%) rotate(${rotate}deg) scale(${scale})`,
                  opacity: imgOpacity,
                  transition: reducedMotion ? 'none' : undefined,
                  willChange: 'transform, opacity, clip-path',
                }}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            );
          })}

          {/* Final collage overlay */}
          <div
            className="absolute inset-0"
            style={{
              opacity: collageFade,
              willChange: 'opacity',
            }}
          >
            <img
              src={COLLAGE_SRC}
              alt="Completed wallpaper collage assembled from individual images"
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>

          {/* Subtle gold border frame that appears with the collage */}
          <div
            className="absolute inset-0 border border-[var(--color-border)] pointer-events-none"
            style={{ opacity: collageFade * 0.6 }}
          />
        </div>

        {/* Bottom caption */}
        <div
          className="absolute bottom-16 right-6 md:right-16 z-20 pointer-events-none text-right"
          style={{
            opacity: Math.max(0, (collageFade - 0.3) / 0.7),
          }}
        >
          <p className="font-sans text-sm text-[var(--color-secondary)] uppercase tracking-widest">
            4 images → 1 wallpaper
          </p>
          <div className="mt-3 h-px bg-[var(--color-accent)] w-16 ml-auto" />
        </div>
      </div>
    </section>
  );
};
