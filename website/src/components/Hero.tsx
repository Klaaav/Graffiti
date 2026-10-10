import React, { useEffect, useState, useRef } from 'react';

// Art-Nouveau style vine anchored to the right edge, curling down with small leaf accents
const VINE_PATH = "M 1200 150 Q 1150 180, 1100 250 T 1150 400 T 1050 600 T 1150 750 M 1100 250 Q 1070 230, 1050 250 Q 1070 270, 1100 250 M 1125 400 Q 1090 380, 1080 400 Q 1090 420, 1125 400 M 1050 600 Q 1010 590, 1000 610 Q 1020 630, 1050 600 M 1120 680 Q 1090 670, 1080 690 Q 1100 710, 1120 680";
// Thick twisted trunk originating from top-right corner, sweeping across top and branching
const VINE2_PATH = "M 1200 -20 Q 1100 50, 900 60 T 600 30 T 400 80 M 900 60 Q 850 90, 800 120 T 700 150 M 600 30 Q 550 0, 500 -10";

export const Hero: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasVisited = sessionStorage.getItem('graffiti_hero_animated_v2');
    // Loader sequence is ~5400ms now for first visit
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
      if (entries[0].isIntersecting) {
        setIsIntersecting(true);
      } else {
        // Reset so it replays when coming back
        setIsIntersecting(false);
      }
    }, { threshold: 0.1 });

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sectionRef} className="w-full max-w-7xl mx-auto px-6 lg:px-8 py-24 flex items-center min-h-[85vh] relative">
      
      {/* Background Golden Vine SVG (Task 7) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-20">
        <svg viewBox="0 0 1200 800" className="w-full h-full absolute inset-0 preserve-3d">
          <path 
            d={VINE_PATH}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-[2500ms] ease-out"
            style={{
              strokeDasharray: 3000,
              strokeDashoffset: (isIntersecting || reducedMotion) ? 0 : 3000,
            }}
          />
          <path 
            d={VINE2_PATH}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-[3000ms] ease-out"
            style={{
              strokeDasharray: 3000,
              strokeDashoffset: (isIntersecting || reducedMotion) ? 0 : 3000,
              transitionDelay: '300ms'
            }}
          />
        </svg>
      </div>

      {/* Hero Layout: md:flex-row-reverse to move Text to Left and Logo to Right (Task 6) */}
      <div className="w-full flex flex-col md:flex-row-reverse items-center justify-between gap-12 relative z-10">
        
        {/* RIGHT SIDE: Logo Mark */}
        <div 
          className={`w-56 h-56 md:w-80 md:h-80 lg:w-[32rem] lg:h-[32rem] flex-shrink-0 transition-all duration-[1200ms] ${
            mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
          }`}
          style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
        >
          <img src="/logos/logo_transparent.png" alt="Graffiti Mark" className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(201,162,77,0.3)]" />
        </div>

        {/* LEFT SIDE: Text Content */}
        <div className="w-full md:w-2/3 lg:w-1/2 flex flex-col items-start text-left">
          <h1 
            className={`font-display text-7xl md:text-8xl lg:text-9xl font-medium text-[var(--color-primary)] mb-8 transition-all duration-[1200ms] ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
            }`}
            style={{ 
              transitionTimingFunction: 'var(--ease-out-expo)',
              transitionDelay: '150ms'
            }}
          >
            Graffiti
          </h1>

          <div className="overflow-hidden mb-12 pl-2 md:pl-4 border-l border-[var(--color-border)]">
            <p 
              className={`font-sans text-xl md:text-2xl text-[var(--color-secondary)] max-w-2xl leading-relaxed transition-all duration-[1500ms] ${
                mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
              }`}
              style={{ 
                transitionTimingFunction: 'var(--ease-out-expo)',
                transitionDelay: '400ms'
              }}
            >
              Your wallpapers, alive. A native, GPU-accelerated engine that turns your local images into interactive desktop experiences—with zero cloud dependencies and a footprint so small you'll forget it's there.
            </p>
          </div>

          {/* Download CTA */}
          <div 
            className={`transition-all duration-[1000ms] ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
            style={{ 
              transitionTimingFunction: 'var(--ease-out-expo)',
              transitionDelay: '600ms'
            }}
          >
            <a 
              href="#download" 
              onClick={(e) => {
                e.preventDefault();
                document.querySelector('#download')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="group relative inline-flex items-center justify-center px-8 py-4 border border-[var(--color-accent)] font-sans text-sm uppercase tracking-widest text-[var(--color-primary)] overflow-hidden transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0A08] focus-visible:ring-[var(--color-accent)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#D4AF6A] to-[#F4E2B8] transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out" />
              
              <span className="relative z-10 flex items-center group-hover:text-[#0B0A08] transition-colors duration-300">
                <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Jump to Download
              </span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
