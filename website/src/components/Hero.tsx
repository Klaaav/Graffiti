import React, { useEffect, useState, useRef } from 'react';

export const Hero: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasVisited = sessionStorage.getItem('graffiti_hero_animated_v2');
    const delay = hasVisited ? 100 : 4800;

    const timer = setTimeout(() => {
      setMounted(true);
      sessionStorage.setItem('graffiti_hero_animated_v2', 'true');
    }, delay);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const observer = new IntersectionObserver((entries) => {
      setIsIntersecting(entries[0].isIntersecting);
    }, { threshold: 0.1 });

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={sectionRef}
      className="w-full min-h-screen flex flex-col justify-center items-center relative overflow-hidden"
    >
      {/* Subtle radial ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 45%, rgba(201,162,77,0.04) 0%, transparent 70%)',
        }}
      />

      {/* Thin decorative gold line — left vertical accent */}
      <div
        className={`absolute left-8 md:left-16 top-1/4 w-px bg-[var(--color-accent)] transition-all duration-[2000ms] ${
          isIntersecting || reducedMotion ? 'h-32 opacity-20' : 'h-0 opacity-0'
        }`}
        style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
      />

      {/* Main content — centered stack */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl mx-auto">

        {/* Logo */}
        <div
          className={`w-40 h-40 md:w-56 md:h-56 lg:w-72 lg:h-72 mb-8 md:mb-12 transition-all duration-[1200ms] ${
            mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}
          style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
        >
          <img
            src="/logos/logo_transparent.png"
            alt="Graffiti"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Tagline */}
        <h1
          className={`font-display text-5xl sm:text-6xl md:text-7xl lg:text-[96px] font-medium text-[var(--color-primary)] leading-none mb-6 md:mb-8 transition-all duration-[1400ms] ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{
            transitionTimingFunction: 'var(--ease-out-expo)',
            transitionDelay: '200ms',
          }}
        >
          Your wallpapers, alive.
        </h1>

        {/* Description */}
        <p
          className={`font-sans text-lg md:text-xl text-[var(--color-secondary)] max-w-xl leading-relaxed mb-10 md:mb-14 transition-all duration-[1500ms] ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{
            transitionTimingFunction: 'var(--ease-out-expo)',
            transitionDelay: '400ms',
          }}
        >
          A native, GPU-accelerated engine that turns your local images into
          interactive desktop experiences — zero cloud, zero bloat.
        </p>

        {/* CTA row */}
        <div
          className={`flex flex-col sm:flex-row items-center gap-4 transition-all duration-[1200ms] ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{
            transitionTimingFunction: 'var(--ease-out-expo)',
            transitionDelay: '600ms',
          }}
        >
          <a
            href="#download"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector('#download')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group relative inline-flex items-center justify-center px-10 py-4 border border-[var(--color-accent)] font-sans text-sm uppercase tracking-[0.15em] text-[var(--color-primary)] overflow-hidden transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0A08] focus-visible:ring-[var(--color-accent)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#D4AF6A] to-[#F4E2B8] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out" />
            <span className="relative z-10 flex items-center group-hover:text-[#0B0A08] transition-colors duration-300">
              <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </span>
          </a>

          <a
            href="#effects"
            onClick={(e) => {
              e.preventDefault();
              document.querySelector('#effects')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="font-sans text-sm uppercase tracking-[0.15em] text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors py-4 px-6"
          >
            See Effects
          </a>
        </div>
      </div>

      {/* Scroll hint */}
      <div
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-opacity duration-1000 ${
          mounted ? 'opacity-40' : 'opacity-0'
        }`}
        style={{ transitionDelay: '1200ms' }}
      >
        <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-[var(--color-secondary)]">
          Scroll
        </span>
        <div className="w-px h-8 bg-[var(--color-accent)] opacity-40" />
      </div>
    </div>
  );
};
