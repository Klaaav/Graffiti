import { useEffect, useRef, useState } from 'react';

export default function ModelStage() {
  const section = useRef<HTMLElement>(null);
  const viewer = useRef<any>(null);
  const raf = useRef<number | null>(null);
  const current = useRef({ yaw: 0, pitch: 72 });
  const target = useRef({ yaw: 0, pitch: 72 });
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting && !customElements.get('model-viewer')) {
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
        document.head.appendChild(script);
      }
    }, { rootMargin: '180px' });
    if (section.current) observer.observe(section.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = section.current;
    if (!node) return;

    const tick = () => {
      const next = current.current;
      const wanted = target.current;
      next.yaw += (wanted.yaw - next.yaw) * 0.1;
      next.pitch += (wanted.pitch - next.pitch) * 0.1;
      if (viewer.current) {
        // The radius is deliberately constant: pointer input changes orientation only.
        viewer.current.setAttribute('camera-orbit', `${next.yaw.toFixed(2)}deg ${next.pitch.toFixed(2)}deg 3.8m`);
      }
      const moving = Math.abs(wanted.yaw - next.yaw) > 0.04 || Math.abs(wanted.pitch - next.pitch) > 0.04;
      if (moving) raf.current = requestAnimationFrame(tick);
      else raf.current = null;
    };

    const wake = () => { if (!raf.current) raf.current = requestAnimationFrame(tick); };
    const handleMove = (event: PointerEvent) => {
      const bounds = node.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const y = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      target.current = { yaw: -Math.max(-1, Math.min(1, x)) * 18, pitch: 72 - Math.max(-1, Math.min(1, y)) * 8 };
      wake();
    };
    const reset = () => { target.current = { yaw: 0, pitch: 72 }; wake(); };

    node.addEventListener('pointermove', handleMove);
    node.addEventListener('pointerleave', reset);
    return () => {
      node.removeEventListener('pointermove', handleMove);
      node.removeEventListener('pointerleave', reset);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <section id="model" className="model-console" ref={section} aria-labelledby="model-title">
      <div className="model-topline"><span>04 / WEB WALLPAPER</span><span>3D MODELS / WEBVIEW</span></div>
      <div className="model-copy">
        <h2 id="model-title">Move through<br /><span>another world.</span></h2>
        <p className="signal-kicker">WEB WALLPAPER MODE</p>
        <p>Import a GLB model and let it live behind the desktop.</p>
        <small>Web Wallpaper renders 3D models in an embedded WebView, which can use more RAM and GPU resources than native image effects.</small>
      </div>
      <div className="model-viewport">
        {visible && <model-viewer ref={viewer} src="/models/model.glb" alt="Interactive 3D wallpaper model" camera-controls={false} interaction-prompt="none" camera-orbit="0deg 72deg 3.8m" min-camera-orbit="auto auto 3.8m" max-camera-orbit="auto auto 3.8m" min-field-of-view="30deg" max-field-of-view="30deg" exposure="1.1" shadow-intensity="0.7" loading="lazy" onLoad={() => setLoaded(true)} />}
        {!loaded && <span className="model-loading" aria-live="polite">Loading scene…</span>}
        <div className="model-lock">WEBVIEW<br /><strong>3D</strong></div>
        <div className="model-hint">Move your pointer to look around</div>
      </div>
    </section>
  );
}
