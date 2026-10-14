import { useCallback } from 'react';
import { MousePointer, Magnet, Circle, Hexagon, Grid3x3, Layers } from 'lucide-react';

export interface EffectInfo {
  id: string;
  label: string;
  icon: React.ReactNode;
  detail: string;
}

export const EFFECTS: EffectInfo[] = [
  { id: 'cursor_reveal',            label: 'Cursor Reveal',  detail: 'Two image layers', icon: <MousePointer size={16} /> },
  { id: 'gravity_lens',             label: 'Gravity Lens',   detail: 'Fluid distortion', icon: <Magnet size={16} /> },
  { id: 'gravity_lens_transparent', label: 'Glass Lens',     detail: 'Transparent refraction', icon: <Circle size={16} /> },
  { id: 'stone_press_v2',           label: 'Space Ball',     detail: 'Surface deformation', icon: <Hexagon size={16} /> },
  { id: 'brick_outline',            label: 'Brick Outline',  detail: 'Cursor-lit outlines', icon: <Grid3x3 size={16} /> },
  { id: 'depth_parallax',           label: 'Depth Parallax', detail: 'On-device depth map', icon: <Layers size={16} /> },
];

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

  return (
    <section className="effect-dial" aria-label="Effect library" onWheel={handleWheel}>
      <div className="effect-library-heading"><strong>Effect library</strong><span>{EFFECTS.length} effects</span></div>
      <div className="dial-items-strip">
          {EFFECTS.map((effect) => {
            const isSelected = effect.id === selectedEffect;
            const isActive   = effect.id === activeEffect;

            return (
              <button
                key={effect.id}
                className={`dial-node${isSelected ? ' selected' : ''}${isActive ? ' active' : ''}`}
                onClick={() => onSelect(effect.id)}
                aria-pressed={isSelected}
              >
                <span className="dial-node-icon" aria-hidden="true">{effect.icon}</span>
                <span className="dial-node-copy"><span className="dial-node-label">{effect.label}</span><span className="dial-node-detail">{effect.detail}</span></span>
                {isActive && <span className="dial-node-live" title="Running" aria-label="Running" />}
              </button>
            );
          })}
      </div>
    </section>
  );
}
