import React, { useState, useEffect } from 'react';

const SECTIONS = [
  { id: 'effects', label: 'Effects' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'web-wallpaper', label: 'Web Wallpaper' },
  { id: 'feedback', label: 'Feedback' },
];

export const FloatingNav: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Detect touch
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
      setIsTouch(true);
      setIsVisible(true); // Always visible on touch as a menu icon
    }

    // IntersectionObserver for active section
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-50% 0px -50% 0px' }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  if (isTouch) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-10 h-10 flex flex-col justify-center items-center gap-1.5 bg-[#16130E]/90 border border-[var(--color-border)] rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
        >
          <span className={`w-5 h-px bg-[var(--color-accent)] transition-transform ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`w-5 h-px bg-[var(--color-accent)] transition-opacity ${mobileMenuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-px bg-[var(--color-accent)] transition-transform ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>

        {mobileMenuOpen && (
          <div className="absolute top-12 right-0 bg-[#16130E]/95 border border-[var(--color-border)] p-4 flex flex-col gap-4 rounded-lg min-w-[200px]">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => handleClick(e, s.id)}
                className={`font-sans text-xs uppercase tracking-widest ${activeSection === s.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-secondary)]'}`}
              >
                {s.label}
              </a>
            ))}
            <div className="h-px w-full bg-[var(--color-border)] my-2" />
            <a
              href="#download"
              onClick={(e) => handleClick(e, 'download')}
              className="font-sans text-xs uppercase tracking-widest text-[var(--color-primary)] flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          </div>
        )}
      </div>
    );
  }

  // Desktop Hover-Reveal Nav
  return (
    <>
      {/* Invisible hover zone */}
      <div 
        className="fixed top-0 left-0 w-full h-24 z-40"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      />

      {/* Affordance Hairline */}
      <div className="fixed top-0 left-0 w-full h-[2px] bg-[var(--color-border)] z-50 pointer-events-none" />

      {/* Actual Nav */}
      <nav
        className={`fixed top-0 left-0 w-full flex justify-center pt-6 pb-4 z-50 pointer-events-none transition-transform duration-500`}
        style={{
          transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
          transitionTimingFunction: 'var(--ease-out-quart)'
        }}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        <div className="pointer-events-auto flex items-center space-x-12">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={(e) => handleClick(e, section.id)}
              className="group relative font-sans text-xs uppercase tracking-[0.15em] text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors py-2 focus:outline-none focus-visible:text-[var(--color-accent)]"
            >
              {section.label}
              {/* Animated Underline */}
              <span className={`absolute bottom-0 left-0 w-full h-px bg-[var(--color-accent)] transform origin-left transition-transform duration-300 ${activeSection === section.id ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`} />
            </a>
          ))}

          {/* Download CTA Link */}
          <a
            href="#download"
            onClick={(e) => handleClick(e, 'download')}
            className="group relative font-sans text-xs uppercase tracking-[0.15em] text-[var(--color-primary)] py-2 flex items-center focus:outline-none"
          >
             <svg className="w-4 h-4 mr-2 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
             </svg>
             <span className="relative z-10 group-hover:tracking-[0.25em] transition-all duration-300 ease-out">
               Download
             </span>
          </a>
        </div>
      </nav>
    </>
  );
};
