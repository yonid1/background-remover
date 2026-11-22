import { SWATCHES } from '../../constants';

interface Props {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPanel({ color, onChange }: Props) {
  return (
    <>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className="swatch"
            style={{ background: c }}
            title={c}
            aria-label={`צבע ${c}`}
            aria-pressed={c === color}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
      <div className="color-row">
        <input type="color" value={color} aria-label="צבע אחר" onChange={(e) => onChange(e.target.value)} />
        <span>צבע אחר לבחירה</span>
      </div>
    </>
  );
}
