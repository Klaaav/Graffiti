import { useEffect, useRef, useState } from 'react';

const effects = [
  ['Cursor reveal', 'Motion appears exactly where you look.', 'Cursor reveal.mp4'],
  ['Glass lens', 'A refracted window into the wallpaper beneath.', 'Glass lens.mp4'],
  ['Depth parallax', 'A still image with a little more room to breathe.', 'Depth parallax.mp4'],
  ['Gravity lens', 'A soft pull that bends the image around focus.', 'Gravity lens.mp4'],
  ['Brick outline', 'Edges found, traced, and made visible.', 'Brick outline.mp4'],
  ['Space ball', 'A sphere that follows the hand of your cursor.', 'Space ball.mp4'],
] as const;

export default function EffectsStage() {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const stage = useRef<HTMLElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setReady(true);
    }, { rootMargin: '240px' });
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  /* Preload all videos and control play/pause without unmounting to eliminate latency */
  useEffect(() => {
    if (!ready) return;
    videoRefs.current.forEach((video, idx) => {
      if (!video) return;
      if (idx === active) {
        video.style.display = 'block';
        video.play().catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      } else {
        video.style.display = 'none';
        video.pause();
      }
    });
  }, [active, ready]);

  const [name, description] = effects[active];

  return (
    <section id="effects" className="effects-console" ref={stage} aria-labelledby="effects-title">
      <div className="console-heading">
        <div className="utility-index">02 / EFFECTS</div>
        <h2 id="effects-title">Pick a signal.<br /><span>Wake an image.</span></h2>
        <p className="signal-kicker">LIVE EFFECT LIBRARY</p>
        <p>Take your wallpaper to a whole new level with six cursor-reactive effects.</p>
      </div>

      <div className="effects-console-body">
        <div className="effect-stage-shell">
          <div className="stage-header"><span>OUTPUT / {String(active + 1).padStart(2, '0')}</span><span>ACTIVE EFFECT / {name}</span></div>
          <div className="effect-stage">
            {ready && effects.map(([effectName, , file], index) => (
              <video
                key={file}
                ref={(el) => (videoRefs.current[index] = el)}
                src={`/effects/${encodeURIComponent(file)}`}
                muted
                loop
                playsInline
                autoPlay={index === active}
                preload="auto"
                style={{ display: index === active ? 'block' : 'none' }}
                aria-label={`${effectName} effect demonstration`}
              />
            ))}
            {!ready && <div className="stage-placeholder">Scroll to initialize signal</div>}
            <div className="stage-crosshair" aria-hidden="true"><i></i><i></i></div>
            <div className="stage-label"><span>{name}</span><small>real screen recording</small></div>
          </div>
          <div className="stage-caption"><strong>{name}</strong><span>{description}</span></div>
        </div>

        <div className="effect-queue" role="tablist" aria-label="Effect demonstrations">
          {effects.map(([effectName], index) => (
            <button
              key={effectName}
              type="button"
              role="tab"
              aria-selected={index === active}
              className={`effect-queue-item ${index === active ? 'is-active' : ''}`}
              onClick={() => setActive(index)}
            >
              <span className="queue-number">0{index + 1}</span>
              <span className="queue-name">{effectName}</span>
              <span className="queue-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
          <p className="queue-note">Select a clip to preview it.<br />Instant zero-lag hardware accelerated playback.</p>
        </div>
      </div>
    </section>
  );
}
