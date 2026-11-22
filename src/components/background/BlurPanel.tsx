interface Props {
  value: number;
  onChange: (value: number) => void;
}

export function BlurPanel({ value, onChange }: Props) {
  return (
    <>
      <div className="range-head">
        <span>עוצמת הטשטוש</span>
        <span>{value}</span>
      </div>
      <input type="range" min={1} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <p className="hint">הרקע המקורי נשאר, אבל מטושטש, כמו בצילום פורטרט.</p>
    </>
  );
}
