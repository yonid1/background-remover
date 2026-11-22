import type { CSSProperties } from 'react';
import { GRADIENT_DIRS, GRADIENT_PRESETS } from '../../constants';
import type { BgSettings, GradientDir } from '../../types';
import { ArrowIcon, RadialIcon, SwapIcon } from '../icons';

interface Props {
  g1: string;
  g2: string;
  dir: GradientDir;
  onChange: (patch: Partial<BgSettings>) => void;
}

export function GradientPanel({ g1, g2, dir, onChange }: Props) {
  return (
    <>
      <div className="swatches gpresets">
        {GRADIENT_PRESETS.map(([a, b], i) => (
          <button
            key={i}
            type="button"
            className="swatch"
            style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
            aria-label={`מעבר צבעים ${i + 1}`}
            aria-pressed={a === g1 && b === g2}
            onClick={() => onChange({ g1: a, g2: b })}
          />
        ))}
      </div>

      <div className="color-row">
        <input type="color" value={g1} aria-label="צבע ראשון" onChange={(e) => onChange({ g1: e.target.value })} />
        <span>אל</span>
        <input type="color" value={g2} aria-label="צבע שני" onChange={(e) => onChange({ g2: e.target.value })} />
        <button
          className="btn icon-btn"
          type="button"
          title="החלפה בין שני הצבעים"
          aria-label="החלפה בין שני הצבעים"
          onClick={() => onChange({ g1: g2, g2: g1 })}
        >
          <SwapIcon />
        </button>
      </div>

      <div className="dir-label">כיוון המעבר</div>
      <div className="dir-row">
        {/* A 3×3 compass laid out physically (left is left), so each arrow sits where it points. */}
        <div className="dirs" role="group" aria-label="כיוון המעבר">
          {GRADIENT_DIRS.map((d) => (
            <button
              key={d.id}
              type="button"
              title={d.name}
              aria-label={d.name}
              aria-pressed={d.id === dir}
              style={d.vec ? ({ '--rot': `${(Math.atan2(d.vec[1], d.vec[0]) * 180) / Math.PI}deg` } as CSSProperties) : undefined}
              onClick={() => onChange({ gDir: d.id })}
            >
              {d.vec ? <ArrowIcon /> : <RadialIcon />}
            </button>
          ))}
        </div>
        <span className="dir-name">{GRADIENT_DIRS.find((d) => d.id === dir)?.name}</span>
      </div>
    </>
  );
}
