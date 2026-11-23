interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/** A labeled slider that shows its current value. */
export function Range({ label, value, min, max, onChange }: Props) {
  return (
    <label className="range">
      <span className="range-head">
        <span>{label}</span>
        <span>{value}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
