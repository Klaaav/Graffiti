import React, { useEffect, useState } from 'react';
const FLOURISH_PATH = "M 200 1000 C 300 800, 400 400, 627 467 S 900 800, 1000 600"; // A simple elegant swoop connecting near the center

export const Loader: React.FC = () => {
  const [stage, setStage] = useState(0); // 0: init, 1: flourish, 2: logo draw, 3: shine, 4: settle right, 5: hidden
  const [isRendered, setIsRendered] = useState(true);

  useEffect(() => {
    const hasVisited = sessionStorage.getItem('graffiti_visited');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (hasVisited || prefersReducedMotion) {
      setStage(5);
      setIsRendered(false);
      return;
    }

    sessionStorage.setItem('graffiti_visited', 'true');

    // Stage timings for elegant drawn sequence
    // Total sequence is noticeably longer and deliberate
    const t1 = setTimeout(() => setStage(1), 50);          // Start flourish
    const t2 = setTimeout(() => setStage(2), 1600);        // Switch to logo draw
    const t3 = setTimeout(() => setStage(3), 3200);        // Shine
    const t4 = setTimeout(() => setStage(4), 4400);        // Settle right
    const t5 = setTimeout(() => {
      setStage(5);
      setTimeout(() => setIsRendered(false), 800);
    }, 5400); // Fade out

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5);
    };
  }, []);

  if (!isRendered) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-background)] transition-opacity duration-[800ms] pointer-events-none"
      style={{ 
        opacity: stage >= 5 ? 0 : 1,
        transitionTimingFunction: 'var(--ease-out-quart)'
      }}
    >
      <div 
        className="flex flex-col items-center justify-center w-full h-full transition-transform duration-[1200ms]"
        style={{
          transform: stage >= 4 ? 'translateX(25vw)' : 'translateX(0)',
          transitionTimingFunction: 'var(--ease-in-out-circ)'
        }}
      >
        <div className="relative w-48 h-48 md:w-64 md:h-64 overflow-hidden">
          
          {/* Stage 1: Flourish */}
          <svg viewBox="0 0 1254 1254" className="w-full h-full absolute inset-0 overflow-visible pointer-events-none">
            <path 
              d={FLOURISH_PATH}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="4"
              strokeLinecap="round"
              className="transition-all duration-[1200ms] ease-out"
              style={{
                strokeDasharray: 2500,
                strokeDashoffset: stage >= 1 ? 0 : 2500,
                opacity: stage === 1 ? 1 : 0
              }}
            />
          </svg>

          {/* Stage 2: Logo Reveal (Using the exact PNG as the Hero to fix shape mismatch) */}
          <div 
            className="absolute inset-0 transition-all duration-[1200ms] ease-out pointer-events-none"
            style={{
              WebkitMaskImage: 'linear-gradient(-45deg, transparent 50%, black 50%)',
              maskImage: 'linear-gradient(-45deg, transparent 50%, black 50%)',
              WebkitMaskSize: '300% 300%',
              maskSize: '300% 300%',
              WebkitMaskPosition: stage >= 2 ? '100% 100%' : '0% 0%',
              maskPosition: stage >= 2 ? '100% 100%' : '0% 0%',
            }}
          >
            <img src="/logos/logo_transparent.png" alt="Graffiti Logo" className="w-full h-full object-contain" />
          </div>

          {/* Stage 3: Shine pass over the PNG (masked to logo shape to prevent gray artifact boxes) */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              WebkitMaskImage: 'url(/logos/logo_transparent.png)',
              maskImage: 'url(/logos/logo_transparent.png)',
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center'
            }}
          >
            <div 
              className="absolute inset-0 bg-gradient-to-tr from-transparent via-[var(--color-primary)] to-transparent opacity-50 mix-blend-overlay transition-transform duration-[1000ms]"
              style={{
                transform: stage >= 3 ? 'translate(100%, -100%)' : 'translate(-100%, 100%)'
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
