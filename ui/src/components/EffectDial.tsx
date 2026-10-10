import { useCallback } from 'react';
import { MousePointer, Magnet, Circle, Hexagon, Grid3x3, Layers } from 'lucide-react';

export interface EffectInfo {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export const EFFECTS: EffectInfo[] = [
  { id: 'cursor_reveal',            label: 'Cursor Reveal',  icon: <MousePointer size={16} /> },
  { id: 'gravity_lens',             label: 'Gravity Lens',   icon: <Magnet size={16} /> },
  { id: 'gravity_lens_transparent', label: 'Glass Lens',     icon: <Circle size={16} /> },
  { id: 'stone_press_v2',           label: 'Space Ball',     icon: <Hexagon size={16} /> },
  { id: 'brick_outline',            label: 'Brick Outline',  icon: <Grid3x3 size={16} /> },
  { id: 'depth_parallax',           label: 'Depth Parallax', icon: <Layers size={16} /> },
];

const ITEM_H = 68; // px — height of each slot in the strip

// Selected item gets the large forward circle; others recede by distance
const CIRCLE_SIZES: [number, number, number] = [66, 44, 32]; // [selected, ±1, ±2+]
const X_OFFSETS:   [number, number, number] = [52, 30, 10];  // translateX per distance tier

function getTier(relIdx: number): 0 | 1 | 2 {
  const abs = Math.abs(relIdx);
  if (abs === 0) return 0;
  if (abs === 1) return 1;
  return 2;
}

interface EffectDialProps {
  selectedEffect: string | null;
  activeEffect: string | null;
  onSelect: (id: string) => void;
}

export default function EffectDial({ selectedEffect, activeEffect, onSelect }: EffectDialProps) {
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const currentIdx = EFFECTS.findIndex(ef => ef.id === selectedEffect);
    const dir = e.deltaY > 0 ? 1 : -1;
    const nextIdx = Math.max(0, Math.min(EFFECTS.length - 1, (currentIdx === -1 ? 0 : currentIdx) + dir));
    onSelect(EFFECTS[nextIdx].id);
  }, [selectedEffect, onSelect]);

  const selectedIdx = EFFECTS.findIndex(e => e.id === selectedEffect);
  const effectiveIdx = selectedIdx === -1 ? 0 : selectedIdx;

  // Vertical translation: keeps the selected item centered in the container
  const stripTranslateY = (EFFECTS.length / 2 - 0.5 - effectiveIdx) * ITEM_H;

  return (
    <div className="effect-dial" onWheel={handleWheel}>
      {/* Decorative arc track */}
      <svg className="dial-track-svg" viewBox="0 0 90 420" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dialTrackGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(212,165,116,0)" />
            <stop offset="18%"  stopColor="rgba(212,165,116,0.25)" />
            <stop offset="82%"  stopColor="rgba(212,165,116,0.25)" />
            <stop offset="100%" stopColor="rgba(212,165,116,0)" />
          </linearGradient>
          <linearGradient id="dialGlowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="rgba(212,165,116,0)" />
            <stop offset="18%"  stopColor="rgba(212,165,116,0.09)" />
            <stop offset="82%"  stopColor="rgba(212,165,116,0.09)" />
            <stop offset="100%" stopColor="rgba(212,165,116,0)" />
          </linearGradient>
        </defs>
        <path d="M 20 20 Q 82 210 20 400" fill="none" stroke="url(#dialGlowGrad)" strokeWidth="20" />
        <path d="M 20 20 Q 82 210 20 400" fill="none" stroke="url(#dialTrackGrad)" strokeWidth="1.5" />
      </svg>

      <div className="dial-items">
        <div
          className="dial-items-strip"
          style={{ transform: `translateY(${stripTranslateY}px)` }}
        >
          {EFFECTS.map((effect, i) => {
            const isSelected = effect.id === selectedEffect;
            const isActive   = effect.id === activeEffect;
            const tier = getTier(i - effectiveIdx);
            const circleSize = CIRCLE_SIZES[tier];
            const xOffset    = X_OFFSETS[tier];

            return (
              <button
                key={effect.id}
                className={`dial-node${isSelected ? ' selected' : ''}${isActive ? ' active' : ''}`}
                style={{ '--x-offset': `${xOffset}px` } as React.CSSProperties}
                onClick={() => onSelect(effect.id)}
                title={effect.label}
              >
                <span
                  className="dial-node-circle"
                  style={{ width: `${circleSize}px`, height: `${circleSize}px` }}
                >
                  <span className="dial-node-icon">{effect.icon}</span>
                  {isActive && <span className="dial-node-live" />}
                </span>
                <span className="dial-node-label">{effect.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
