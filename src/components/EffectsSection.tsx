import { OUTLINE_SWATCHES } from '../constants';
import type { Effects } from '../types';
import { Range } from './Range';

interface Props {
  effects: Effects;
  onChange: (patch: Partial<Effects>) => void;
}

export function EffectsSection({ effects, onChange }: Props) {
  return (
    <section>
      <h2>אפקטים</h2>

      <label className="switch-row">
        <input
          type="checkbox"
          className="switch"
          checked={effects.shadow}
          onChange={(e) => onChange({ shadow: e.target.checked })}
        />
        <span>צל מתחת לאובייקט</span>
      </label>
      {effects.shadow && (
        <div className="sub-controls">
          <Range label="גודל" min={1} max={100} value={effects.shadowSize} onChange={(shadowSize) => onChange({ shadowSize })} />
          <Range
            label="כהות"
            min={5}
            max={100}
            value={effects.shadowOpacity}
            onChange={(shadowOpacity) => onChange({ shadowOpacity })}
          />
        </div>
      )}

      <label className="switch-row mt-10">
        <input
          type="checkbox"
          className="switch"
          checked={effects.outline}
          onChange={(e) => onChange({ outline: e.target.checked })}
        />
        <span>קו מתאר מסביב (סטיקר)</span>
      </label>
      {effects.outline && (
        <div className="sub-controls">
          <div className="color-row tight">
            {OUTLINE_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                className="swatch small"
                style={{ background: c }}
                aria-label={`צבע קו ${c}`}
                aria-pressed={c === effects.outlineColor}
                onClick={() => onChange({ outlineColor: c })}
              />
            ))}
            <input
              type="color"
              value={effects.outlineColor}
              aria-label="צבע קו אחר"
              onChange={(e) => onChange({ outlineColor: e.target.value })}
            />
          </div>
          <Range label="עובי" min={1} max={40} value={effects.outlineWidth} onChange={(outlineWidth) => onChange({ outlineWidth })} />
        </div>
      )}
    </section>
  );
}
