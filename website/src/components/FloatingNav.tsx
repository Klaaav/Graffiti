import React, { useState, useEffect } from 'react';

const SECTIONS = [
  { id: 'effects', label: 'Effects' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'web-wallpaper', label: '3D Wallpaper' },
  { id: 'download', label: 'Download' },
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
          className="w-10 h-10 flex flex-col justify-center items-center gap-1.5 bg-[#16130E]/90 border border-[var(--color-border)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
        >
          <span className={`w-5 h-px bg-[var(--color-accent)] transition-transform ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`w-5 h-px bg-[var(--color-accent)] transition-opacity ${mobileMenuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-5 h-px bg-[var(--color-accent)] transition-transform ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>

        {mobileMenuOpen && (
          <div className="absolute top-12 right-0 bg-[#16130E]/95 border border-[var(--color-border)] p-4 flex flex-col gap-4 min-w-[200px]">
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

        </div>
      </nav>
    </>
  );
};
