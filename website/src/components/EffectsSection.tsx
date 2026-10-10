import React, { useState, useEffect, useRef } from 'react';
import { PinnedScrollWrapper } from './PinnedScrollWrapper';

// ─── Shared palette ────────────────────────────────────────────────────────────
const GOLD       = 'rgba(201,162,77,1)';
const GOLD_DIM   = 'rgba(201,162,77,0.38)';
const GOLD_FAINT = 'rgba(201,162,77,0.12)';
const BG         = '#0B0A08';

const EFFECTS = [
  { id: 'cursor-reveal',            name: 'Cursor Reveal',              description: 'A hidden composition revealed beneath the cursor.' },
  { id: 'gravity-lens',             name: 'Gravity Lens',               description: 'A gravitational field that warps and pulls nearby geometry.' },
  { id: 'gravity-lens-transparent', name: 'Gravity Lens – Transparent', description: 'A concave pressure dimple that compresses geometry inward.' },
  { id: 'space-ball',               name: 'Space Ball',                 description: 'A dramatic funnel singularity bending grid lines to the cursor.' },
  { id: 'brick-outline',            name: 'Brick Outline',              description: 'A procedural running-bond brick pattern revealed around the cursor.' },
  { id: 'wallpaper-depth',          name: 'Depth Parallax',             description: 'Multi-layer abstract geometry shifting with natural parallax depth.' },
];

// ─── Shared hooks ──────────────────────────────────────────────────────────────
function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(mq.matches);
    const h = (e: MediaQueryListEvent) => setR(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return r;
}

function useIsTouch() {
  const [t, setT] = useState(false);
  useEffect(() => { setT(window.matchMedia('(hover: none)').matches); }, []);
  return t;
}

// Returns cursor position relative to containerRef, or null when pointer is outside.
// When reduced / touch: drifts in a gentle ellipse instead.
function useCursorPos(
  containerRef: React.RefObject<HTMLDivElement | null>,
  isActive: boolean,
  reduced: boolean,
  isTouch: boolean
) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);
  const tRef   = useRef(0);

  useEffect(() => {
    if (!isActive) { setPos(null); return; }

    if (reduced || isTouch) {
      const drift = () => {
        if (!containerRef.current) return;
        const { width, height } = containerRef.current.getBoundingClientRect();
        tRef.current += 0.004;
        setPos({
          x: width  / 2 + Math.cos(tRef.current)        * width  * 0.22,
          y: height / 2 + Math.sin(tRef.current * 1.31) * height * 0.18,
        });
        rafRef.current = requestAnimationFrame(drift);
      };
      rafRef.current = requestAnimationFrame(drift);
      return () => cancelAnimationFrame(rafRef.current);
    }

    let ticking = false;
    const onMove = (e: PointerEvent) => {
      if (ticking || !containerRef.current) return;
      ticking = true;
      rafRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        ticking = false;
      });
    };
    const el = containerRef.current;
    el?.addEventListener('pointermove', onMove as any);
    return () => {
      el?.removeEventListener('pointermove', onMove as any);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, reduced, isTouch, containerRef]);

  return pos;
}

// ─── Shared text overlay ───────────────────────────────────────────────────────
const EffectLabel: React.FC<{ name: string; description: string }> = ({ name, description }) => (
  <div className="absolute bottom-14 left-6 md:left-16 max-w-md z-30 pointer-events-none">
    <h3
      className="font-display text-4xl md:text-5xl text-[var(--color-primary)] mb-3 tracking-tight"
      style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}
    >
      {name}
    </h3>
    <p
      className="font-sans text-base text-[var(--color-secondary)]"
      style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}
    >
      {description}
    </p>
    <div className="mt-5 h-px bg-[var(--color-border)] w-20" />
  </div>
);

// ══════════════════════════════════════════════════════════════════
// EFFECT 1 — CURSOR REVEAL
// Gold line-art mountain silhouette hidden under dark overlay;
// revealed through a radial CSS mask following the cursor.
// ══════════════════════════════════════════════════════════════════
const CursorRevealEffect: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const isTouch = useIsTouch();
  const pos = useCursorPos(containerRef, isActive, reduced, isTouch);
  const maskPos = pos ? `${pos.x}px ${pos.y}px` : '50% 50%';

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ background: BG }}>
      {/* Gold artwork layer — always present */}
      <svg
        viewBox="0 0 1000 600"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {/* Subtle grid */}
        {[100,200,300,400,500,600,700,800,900].map(x => (
          <line key={`v${x}`} x1={x} y1="0" x2={x} y2="600" stroke={GOLD_FAINT} strokeWidth="0.5" />
        ))}
        {[100,200,300,400,500].map(y => (
          <line key={`h${y}`} x1="0" y1={y} x2="1000" y2={y} stroke={GOLD_FAINT} strokeWidth="0.5" />
        ))}
        {/* Horizon */}
        <line x1="0" y1="520" x2="1000" y2="520" stroke={GOLD_DIM} strokeWidth="0.8" />
        {/* Mountain silhouette — continuous line */}
        <polyline
          points="0,520 60,475 120,490 175,400 230,430 290,340 350,370 405,270 460,305 510,220 565,255 620,175 675,215 730,148 785,188 840,118 895,158 950,130 1000,148"
          fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"
        />
        {/* Stars */}
        {[[120,70],[230,50],[360,90],[510,35],[660,65],[790,48],[920,85],[160,155],[460,125],[720,115],[300,195],[580,180]].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="1.3" fill={GOLD_DIM} />
        ))}
      </svg>

      {/* Dark overlay with radial reveal cutout */}
      {/* Real app: brushSize=158px @720p ≈ 280 CSS px @1280px; hardness=0.80 → feather from 80% to 100% of radius */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(11,10,8,0.94)',
          WebkitMaskImage: `radial-gradient(circle 280px at ${maskPos}, transparent 0%, transparent 72%, rgba(0,0,0,0.4) 86%, black 100%)`,
          maskImage:        `radial-gradient(circle 280px at ${maskPos}, transparent 0%, transparent 72%, rgba(0,0,0,0.4) 86%, black 100%)`,
        }}
      />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// EFFECT 2 & 3 — GRAVITY LENS (convex) / GRAVITY LENS TRANSPARENT (concave)
// Canvas 2D dot field; dots near cursor pushed outward (convex) or
// compressed inward (concave).
// ══════════════════════════════════════════════════════════════════
// Smoothstep utility matching HLSL smoothstep(edge0, edge1, x)
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const GravityLensEffect: React.FC<{ isActive: boolean; mode: 'convex' | 'concave' }> = ({ isActive, mode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const reduced      = useReducedMotion();
  const isTouch      = useIsTouch();
  const pos          = useCursorPos(containerRef, isActive, reduced, isTouch);
  const posRef       = useRef(pos);
  posRef.current     = pos;

  // Spring-damped cursor for the lens (stiffness=50, damping=0.90 matching real app)
  const springRef = useRef({ x: -1, y: -1, vx: 0, vy: 0 });

  const COLS = 32, ROWS = 20;

  useEffect(() => {
    if (!isActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;
    let lastT = performance.now();

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      // Reset spring to avoid jumps on resize
      const s = springRef.current;
      s.x = canvas.width / 2; s.y = canvas.height / 2; s.vx = 0; s.vy = 0;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now: number) => {
      const dt = Math.min((now - lastT) / 1000, 0.033);
      lastT = now;

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Damped spring toward actual cursor (matches lensStrength physics feel)
      const targetX = posRef.current?.x ?? W / 2;
      const targetY = posRef.current?.y ?? H / 2;
      const s = springRef.current;
      if (s.x < 0) { s.x = targetX; s.y = targetY; }
      const STIFFNESS = 50, DAMPING = 0.90;
      s.vx += (targetX - s.x) * STIFFNESS * dt;
      s.vy += (targetY - s.y) * STIFFNESS * dt;
      s.vx *= Math.pow(DAMPING, dt * 60);
      s.vy *= Math.pow(DAMPING, dt * 60);
      s.x  += s.vx * dt;
      s.y  += s.vy * dt;

      const cx = s.x, cy = s.y;
      // lensRadius=0.10 in UV space, viewport ~720p height → at 1280px ≈ 14% of min(W,H)
      const RADIUS = Math.min(W, H) * 0.14;

      for (let row = 0; row <= ROWS; row++) {
        for (let col = 0; col <= COLS; col++) {
          const bx = (col / COLS) * W;
          const by = (row / ROWS) * H;
          const dx = bx - cx, dy = by - cy;
          // Aspect-corrected distance like real shader: aspectToPt.x *= aspectRatio
          const aspect = W / H;
          const distA = Math.sqrt(dx * dx * aspect * aspect + dy * dy) / aspect;
          const dist   = Math.sqrt(dx * dx + dy * dy);

          let drawX = bx, drawY = by, alpha = 0.38, r = 1.8;

          if (distA < RADIUS) {
            // Real shader: pull = 1 - smoothstep(0, lensRadius, dist)
            const pull = (1 - smoothstep(0, RADIUS, distA));
            const rawDist = dist < 0.001 ? 0.001 : dist;
            const dirX = dx / rawDist, dirY = dy / rawDist;
            // lensStrength=6.5 → scale to canvas: strength * RADIUS * 0.10
            const strength = pull * 6.5 * RADIUS * 0.1;
            if (mode === 'convex') {
              // GL: baseUV = input.uv - disp (pulls toward cursor)
              drawX = bx - dirX * strength;
              drawY = by - dirY * strength;
              alpha = 0.38 + pull * 0.58;
              r = 1.8 + pull * 3.2;
            } else {
              // GLT: inverted displacement (concave — away from cursor)
              drawX = bx + dirX * strength * 0.6;
              drawY = by + dirY * strength * 0.6;
              alpha = 0.38 - pull * 0.20;
              r = Math.max(0.5, 1.8 - pull * 0.8);
            }
          }

          ctx.beginPath();
          ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(201,162,77,${Math.min(1, Math.max(0, alpha))})`;
          ctx.fill();
        }
      }

      // GLT: coreDarkening shadow at cursor (simulates the concave dent depth shadow)
      if (mode === 'concave' && posRef.current) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, RADIUS);
        // coreDarkening=0.15 in real app but very visible due to shading pass — use 0.50 here
        grad.addColorStop(0,    'rgba(0,0,0,0.50)');
        grad.addColorStop(0.45, 'rgba(0,0,0,0.20)');
        grad.addColorStop(1,    'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      // GL: subtle convex glow
      if (mode === 'convex' && posRef.current) {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, RADIUS);
        grad.addColorStop(0,    'rgba(201,162,77,0.07)');
        grad.addColorStop(0.65, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [isActive, mode]);

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ background: BG }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// EFFECT 4 — SPACE BALL
// Canvas 2D wireframe grid; line vertices near cursor pulled sharply
// into a funnel singularity with clamped centre to avoid tearing.
// ══════════════════════════════════════════════════════════════════
const SpaceBallEffect: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const reduced      = useReducedMotion();
  const isTouch      = useIsTouch();
  const pos          = useCursorPos(containerRef, isActive, reduced, isTouch);
  const posRef       = useRef(pos);
  posRef.current     = pos;

  // SP2 spring: stiffness=300, damping=0.99 (critically-damped hooke's law → very responsive)
  const springRef = useRef({ x: -1, y: -1, vx: 0, vy: 0 });

  const GRID = 36;

  useEffect(() => {
    if (!isActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;
    let lastT = performance.now();

    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    // Real SP2 funnel formula: stretch = S * normDist * (1-normDist) * exp(-4*normDist)
    // S = clamp(depth*8, 0, 6), depth=2.80 → S=6 (max), parallaxStrength=0.3 → currentDepth=0.84
    // So effective S = clamp(0.84*8, 0, 6) = 6
    const displace = (bx: number, by: number, cx: number, cy: number, W: number, H: number) => {
      const dx = bx - cx, dy = by - cy;
      const aspect = W / H;
      // Aspect-corrected dist like real shader
      const distScr = Math.sqrt(dx * dx * aspect * aspect + dy * dy) / aspect;
      // pressRadius=0.09 of viewport height → at 1280px canvas min(W,H) ≈ use 0.18
      const RADIUS = Math.min(W, H) * 0.18;
      if (distScr >= RADIUS) return { x: bx, y: by };

      const safeDist = Math.max(distScr, RADIUS * 0.015);
      const normDist = safeDist / RADIUS;
      const S = 6.0;
      const stretch = S * normDist * (1 - normDist) * Math.exp(-4 * normDist);

      const rawDist = Math.sqrt(dx * dx + dy * dy);
      const safeFull = Math.max(rawDist, 0.001);
      const dirX = dx / safeFull, dirY = dy / safeFull;

      return {
        x: bx + dirX * stretch * RADIUS,
        y: by + dirY * stretch * RADIUS,
      };
    };

    const draw = (now: number) => {
      const dt = Math.min((now - lastT) / 1000, 0.033);
      lastT = now;

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // SP2 spring (stiffness=300, critically damped)
      const targetX = posRef.current?.x ?? W / 2;
      const targetY = posRef.current?.y ?? H / 2;
      const s = springRef.current;
      if (s.x < 0) { s.x = targetX; s.y = targetY; }
      const k = 300, c = 0.99 * 2 * Math.sqrt(k);
      s.vx += ((targetX - s.x) * k - s.vx * c) * dt;
      s.vy += ((targetY - s.y) * k - s.vy * c) * dt;
      s.x  += s.vx * dt;
      s.y  += s.vy * dt;

      const cx = s.x, cy = s.y;

      ctx.lineWidth   = 0.7;
      ctx.strokeStyle = GOLD_DIM;

      // Vertical lines
      for (let col = 0; col <= GRID; col++) {
        ctx.beginPath();
        for (let row = 0; row <= GRID; row++) {
          const { x, y } = displace((col / GRID) * W, (row / GRID) * H, cx, cy, W, H);
          row === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Horizontal lines
      for (let row = 0; row <= GRID; row++) {
        ctx.beginPath();
        for (let col = 0; col <= GRID; col++) {
          const { x, y } = displace((col / GRID) * W, (row / GRID) * H, cx, cy, W, H);
          col === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Core darkening: real shader uses exp(-8*normDist)*depthDarkening (depthDarkening=1.35)
      // Map to canvas: exponential falloff, tight radius matching pressRadius
      const RADIUS = Math.min(W, H) * 0.18;
      const coreR = RADIUS * 0.7; // event horizon zone
      // Draw exponential darkening via discrete gradient stops
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      grad.addColorStop(0,    'rgba(0,0,0,0.95)'); // exp(-8*0) = 1 → fully black
      grad.addColorStop(0.12, 'rgba(0,0,0,0.88)'); // exp(-8*0.12)
      grad.addColorStop(0.30, 'rgba(0,0,0,0.55)');
      grad.addColorStop(0.55, 'rgba(0,0,0,0.22)');
      grad.addColorStop(0.80, 'rgba(0,0,0,0.07)');
      grad.addColorStop(1,    'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [isActive]);

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ background: BG }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// EFFECT 5 — BRICK OUTLINE
// SVG running-bond pattern revealed by radial CSS mask at cursor.
// ══════════════════════════════════════════════════════════════════
const BrickOutlineEffect: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const isTouch = useIsTouch();
  const pos = useCursorPos(containerRef, isActive, reduced, isTouch);
  const maskPos = pos ? `${pos.x}px ${pos.y}px` : '50% 50%';

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ background: BG }}>
      {/* SVG running-bond pattern — full bleed */}
      <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
        <defs>
          <pattern id="bricks" x="0" y="0" width="80" height="40" patternUnits="userSpaceOnUse">
            <rect x="1"   y="1"  width="77" height="18" fill="none" stroke={GOLD} strokeWidth="0.9" />
            <rect x="-39" y="21" width="77" height="18" fill="none" stroke={GOLD} strokeWidth="0.9" />
            <rect x="41"  y="21" width="77" height="18" fill="none" stroke={GOLD} strokeWidth="0.9" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bricks)" />
      </svg>

      {/* Dark overlay — bricks only visible inside the reveal radius */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(11,10,8,0.96)',
          WebkitMaskImage: `radial-gradient(circle 180px at ${maskPos}, transparent 28%, black 100%)`,
          maskImage:        `radial-gradient(circle 180px at ${maskPos}, transparent 28%, black 100%)`,
        }}
      />
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// EFFECT 6 — WALLPAPER DEPTH PARALLAX
// Three SVG layers of abstract gold shapes at different parallax rates.
// ══════════════════════════════════════════════════════════════════
const DepthParallaxEffect: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const layer0Ref = useRef<SVGSVGElement>(null);
  const layer1Ref = useRef<SVGSVGElement>(null);
  const layer2Ref = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();
  const isTouch = useIsTouch();
  const pos = useCursorPos(containerRef, isActive, reduced, isTouch);
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => {
    if (!isActive) return;
    let raf: number;
    let currentX = 0;
    let currentY = 0;

    const tick = () => {
      const container = containerRef.current;
      if (!container) return;

      const { width: W, height: H } = container.getBoundingClientRect();
      const targetX = posRef.current ? posRef.current.x - W / 2 : 0;
      const targetY = posRef.current ? posRef.current.y - H / 2 : 0;

      // Smooth lerp (linear interpolation)
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      if (layer0Ref.current) layer0Ref.current.style.transform = `translate(${currentX * 0.012}px, ${currentY * 0.012}px)`;
      if (layer1Ref.current) layer1Ref.current.style.transform = `translate(${currentX * 0.032}px, ${currentY * 0.032}px)`;
      if (layer2Ref.current) layer2Ref.current.style.transform = `translate(${currentX * 0.065}px, ${currentY * 0.065}px)`;

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isActive]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" style={{ background: BG }}>
      {/* Layer 0 — Back (large faint ellipses, slowest) */}
      <svg
        ref={layer0Ref}
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{ willChange: 'transform' }}
      >
        <ellipse cx="500" cy="300" rx="380" ry="220" fill="none" stroke={GOLD_FAINT} strokeWidth="1" />
        <ellipse cx="180" cy="140" rx="155" ry="88"  fill="none" stroke={GOLD_FAINT} strokeWidth="0.8" />
        <ellipse cx="820" cy="470" rx="195" ry="108" fill="none" stroke={GOLD_FAINT} strokeWidth="0.8" />
        <line x1="0" y1="300" x2="1000" y2="300" stroke={GOLD_FAINT} strokeWidth="0.5" />
        <line x1="500" y1="0"  x2="500" y2="600"  stroke={GOLD_FAINT} strokeWidth="0.5" />
      </svg>

      {/* Layer 1 — Mid (triangles + rectangle, medium speed) */}
      <svg
        ref={layer1Ref}
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{ willChange: 'transform' }}
      >
        <polygon points="500,75 625,265 375,265"   fill="none" stroke={GOLD_DIM} strokeWidth="1.1" />
        <polygon points="115,395 215,545 15,545"   fill="none" stroke={GOLD_DIM} strokeWidth="0.9" />
        <polygon points="865,115 945,270 785,270"  fill="none" stroke={GOLD_DIM} strokeWidth="0.9" />
        <rect x="345" y="215" width="310" height="170" fill="none" stroke={GOLD_DIM} strokeWidth="0.9" />
      </svg>

      {/* Layer 2 — Front (sharp accent dots + crosshair, fastest) */}
      <svg
        ref={layer2Ref}
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        style={{ willChange: 'transform' }}
      >
        <circle cx="500" cy="300" r="6"   fill={GOLD} />
        <circle cx="195" cy="145" r="3"   fill={GOLD} />
        <circle cx="810" cy="465" r="4"   fill={GOLD} />
        <circle cx="355" cy="478" r="2.5" fill={GOLD} />
        <circle cx="725" cy="118" r="3.5" fill={GOLD} />
        {/* Crosshair accent at centre */}
        <line x1="458" y1="300" x2="542" y2="300" stroke={GOLD} strokeWidth="1.4" />
        <line x1="500" y1="258" x2="500" y2="342" stroke={GOLD} strokeWidth="1.4" />
      </svg>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// MAIN — EffectsSection
// ══════════════════════════════════════════════════════════════════
export const EffectsSection: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const activeIndex = Math.min(Math.floor(progress * EFFECTS.length), EFFECTS.length - 1);

  // Container is N * 100vw wide. To scroll from the first to the last, we move by -(N-1) * 100vw.
  // In percentages of the container width, that is -(N-1)/N * 100 %.
  const translatePct = -(progress * ((EFFECTS.length - 1) / EFFECTS.length) * 100);

  const renderEffect = (index: number) => {
    const eff     = EFFECTS[index];
    const visible = index === activeIndex;

    const inner = () => {
      switch (index) {
        case 0: return <CursorRevealEffect  isActive={visible} />;
        case 1: return <GravityLensEffect   isActive={visible} mode="convex"  />;
        case 2: return <GravityLensEffect   isActive={visible} mode="concave" />;
        case 3: return <SpaceBallEffect     isActive={visible} />;
        case 4: return <BrickOutlineEffect  isActive={visible} />;
        case 5: return <DepthParallaxEffect isActive={visible} />;
        default: return null;
      }
    };

    return (
      <div
        key={eff.id}
        className="relative w-[100vw] h-full flex-shrink-0"
        style={{ pointerEvents: visible ? 'auto' : 'none' }}
      >
        {inner()}
        <EffectLabel name={eff.name} description={eff.description} />
      </div>
    );
  };

  return (
    <PinnedScrollWrapper id="effects" steps={EFFECTS.length} onProgress={setProgress}>
      <div 
        className="h-full flex touch-none" 
        style={{ 
          background: BG,
          width: `${EFFECTS.length * 100}vw`,
          transform: `translateX(${translatePct}%)`,
        }}
      >
        {EFFECTS.map((_, i) => renderEffect(i))}
      </div>
    </PinnedScrollWrapper>
  );
};