import { useEffect, useRef, useState } from 'react';

const images = [
  ['/gallery/wp8121949-formula-one-2021-wallpapers.jpg', 'Ferrari wallpaper', 'A'],
  ['/gallery/astonmartin.jpg', 'Aston Martin wallpaper', 'B'],
  ['/gallery/wp8277185-formula-one-2021-wallpapers.jpg', 'Formula One wallpaper', 'C'],
  ['/gallery/wp9616278.webp', 'Art car wallpaper', 'D'],
] as const;

const starts = [
  { x: -38, y: -22, rotate: -11 },
  { x: 34, y: -24, rotate: 8 },
  { x: -31, y: 25, rotate: 7 },
  { x: 35, y: 23, rotate: -8 },
];

export default function GallerySection() {
  const section = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (!section.current) return;
      const rect = section.current.getBoundingClientRect();
      const scrollable = Math.max(1, rect.height - window.innerHeight);
      setProgress(Math.max(0, Math.min(1, -rect.top / scrollable)));
      frame = 0;
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    update();
    return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, []);

  const arrange = Math.min(1, Math.max(0, (progress - 0.14) / 0.52));
  const finalOpacity = Math.min(1, Math.max(0, (progress - 0.62) / 0.16));

  return (
    <section id="gallery" className="gallery-section" ref={section} aria-labelledby="gallery-title">
      <div className="gallery-sticky">
        <div className="gallery-topline"><span>03 / GALLERY</span><span>SHAPES / IMAGES / COLOR</span></div>
        <div className="gallery-intro">
          <h2 id="gallery-title">Shape your<br /><span>own canvas.</span></h2>
          <p>Draw custom shapes and fill them with images or solid colors to create a wallpaper that’s entirely your own.</p>
          <div className="gallery-progress"><span style={{ transform: `scaleX(${progress})` }}></span></div>
          <small className="gallery-status-motion">{progress < 0.72 ? 'SOURCE FILES IN MOTION' : 'COMPOSITION RESOLVED'}</small>
          <small className="gallery-status-static">GALLERY COMPOSITION EXAMPLE</small>
        </div>

        <div className="gallery-board" aria-label="Gallery wallpaper composition">
          <div className="board-grid" aria-hidden="true"></div>
          {images.map(([src, alt, label], index) => {
            const start = starts[index];
            const x = start.x * (1 - arrange);
            const y = start.y * (1 - arrange);
            const rotate = start.rotate * (1 - arrange);
            return (
              <figure key={src} className={`gallery-image gallery-image-${index + 1}`} style={{ transform: `translate(${x}%, ${y}%) rotate(${rotate}deg) scale(${0.74 + arrange * 0.26})`, opacity: Math.max(0.08, 1 - arrange * 0.88) }}>
                <img src={src} alt={alt} loading="lazy" />
                <figcaption>{label} / {alt}</figcaption>
              </figure>
            );
          })}
          <img className="resolved-collage" src="/gallery/gallery-687040847e79317109d01c56117af16628f95e6cde2148ec984e09d1b2cee8d9.png" alt="Completed Gallery wallpaper collage" loading="lazy" style={{ opacity: finalOpacity }} />
          <div className="board-stamp">GALLERY</div>
        </div>
      </div>
    </section>
  );
}
