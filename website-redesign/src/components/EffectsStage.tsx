import { useEffect, useRef, useState, useCallback } from 'react';
import SignalLoader from './SignalLoader';

const effects = [
  ['Cursor reveal', 'Motion appears exactly where you look.', 'Cursor reveal.mp4', 'Cursor reveal.webp'],
  ['Glass lens', 'A refracted window into the wallpaper beneath.', 'Glass lens.mp4', 'Glass lens.webp'],
  ['Depth parallax', 'A still image with a little more room to breathe.', 'Depth parallax.mp4', 'Depth parallax.webp'],
  ['Gravity lens', 'A soft pull that bends the image around focus.', 'Gravity lens.mp4', 'Gravity lens.webp'],
  ['Brick outline', 'Edges found, traced, and made visible.', 'Brick outline.mp4', 'Brick outline.webp'],
  ['Space ball', 'A sphere that follows the hand of your cursor.', 'Space ball.mp4', 'Space ball.webp'],
] as const;

export default function EffectsStage() {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [queuedIndices, setQueuedIndices] = useState<number[]>([0]);
  const [loadedIndices, setLoadedIndices] = useState<number[]>([]);
  const stage = useRef<HTMLElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Intersection observer: begin loading sequence once stage enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setReady(true);
        // Ensure the initial active effect is in the queue
        setQueuedIndices((prev) => (prev.includes(0) ? prev : [0, ...prev]));
      }
    }, { rootMargin: '240px' });
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  // When a video finishes buffering, trigger the next effect in sequence
  const handleVideoCanPlay = useCallback((index: number) => {
    setLoadedIndices((prev) => (prev.includes(index) ? prev : [...prev, index]));

    // Sequential queue progression: queue next unqueued effect (0 -> 1 -> 2 -> 3 -> 4 -> 5)
    setQueuedIndices((currentQueued) => {
      const nextInOrder = [0, 1, 2, 3, 4, 5].find((i) => !currentQueued.includes(i));
      if (nextInOrder !== undefined) {
        return [...currentQueued, nextInOrder];
      }
      return currentQueued;
    });
  }, []);

  // Proactively queue on hover for zero-lag anticipation
  const handlePreloadHover = useCallback((index: number) => {
    setQueuedIndices((prev) => (prev.includes(index) ? prev : [...prev, index]));
  }, []);

  // Select an effect with top-priority download allocation
  const handleSelect = useCallback((index: number) => {
    setActive(index);
    setQueuedIndices((prev) => (prev.includes(index) ? prev : [index, ...prev]));
  }, []);

  // Control playback: active video plays, inactive videos pause
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
  }, [active, ready, queuedIndices]);

  const [name, description, , poster] = effects[active];
  const isCurrentLoaded = loadedIndices.includes(active);

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
          <div className="stage-header">
            <span>OUTPUT / {String(active + 1).padStart(2, '0')}</span>
            <span>ACTIVE EFFECT / {name}</span>
          </div>

          <div className="effect-stage">
            {/* Visual poster backup for instantaneous frame rendering */}
            <img
              src={`/effects/posters/${encodeURIComponent(poster)}`}
              alt=""
              aria-hidden="true"
              className="effect-stage-poster"
              loading="eager"
            />

            {/* Sequential video elements */}
            {ready && effects.map(([effectName, , file, effectPoster], index) => {
              const isQueued = queuedIndices.includes(index);
              return (
                <video
                  key={file}
                  ref={(el) => (videoRefs.current[index] = el)}
                  src={isQueued ? `/effects/${encodeURIComponent(file)}` : undefined}
                  poster={`/effects/posters/${encodeURIComponent(effectPoster)}`}
                  muted
                  loop
                  playsInline
                  autoPlay={index === active}
                  preload={index === active ? 'auto' : isQueued ? 'metadata' : 'none'}
                  onCanPlay={() => handleVideoCanPlay(index)}
                  onPlaying={() => setLoadedIndices((prev) => (prev.includes(index) ? prev : [...prev, index]))}
                  style={{ display: index === active ? 'block' : 'none' }}
                  aria-label={`${effectName} effect demonstration`}
                />
              );
            })}

            {/* Unique Cyber-Telemetry Loading Animation */}
            <SignalLoader
              visible={!isCurrentLoaded}
              mode="effect"
              title={`ACQUIRING // ${name.toUpperCase()}`}
              subtitle={isCurrentLoaded ? 'STREAM LOCKED' : 'STREAMING HARDWARE BUFFER…'}
            />

            <div className="stage-crosshair" aria-hidden="true"><i></i><i></i></div>
            <div className="stage-label">
              <span>{name}</span>
              <small>{isCurrentLoaded ? 'real screen recording · 60fps' : 'buffering signal…'}</small>
            </div>
          </div>

          <div className="stage-caption">
            <strong>{name}</strong>
            <span>{description}</span>
          </div>
        </div>

        <div className="effect-queue" role="tablist" aria-label="Effect demonstrations">
          {effects.map(([effectName], index) => {
            const isLoaded = loadedIndices.includes(index);
            const isQueued = queuedIndices.includes(index);
            const isActive = index === active;

            return (
              <button
                key={effectName}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`effect-queue-item ${isActive ? 'is-active' : ''}`}
                onClick={() => handleSelect(index)}
                onMouseEnter={() => handlePreloadHover(index)}
                onFocus={() => handlePreloadHover(index)}
              >
                <span className="queue-number">0{index + 1}</span>
                <div className="queue-info">
                  <span className="queue-name">{effectName}</span>
                  <span className="queue-status-tag">
                    {isActive ? '● Live' : isLoaded ? 'Ready' : isQueued ? 'Buffering…' : 'Queued'}
                  </span>
                </div>
                <span className="queue-arrow" aria-hidden="true">↗</span>
              </button>
            );
          })}
          <p className="queue-note">
            Select a clip to preview.<br />
            Priority streaming buffers active clip first.
          </p>
        </div>
      </div>
    </section>
  );
}
