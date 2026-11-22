import { useRef } from 'react';
import { decodeErrorMessage, loadBackgroundImage } from '../../lib/image';
import type { BgSettings, BgType } from '../../types';
import { BlurPanel } from './BlurPanel';
import { ColorPanel } from './ColorPanel';
import { GradientPanel } from './GradientPanel';
import { ImagePanel } from './ImagePanel';

const TABS: { type: BgType; label: string }[] = [
  { type: 'transparent', label: 'שקוף' },
  { type: 'color', label: 'צבע' },
  { type: 'gradient', label: 'מעבר' },
  { type: 'blur', label: 'טשטוש' },
  { type: 'image', label: 'תמונה' },
];

interface Props {
  bg: BgSettings;
  onChange: (patch: Partial<BgSettings>) => void;
  onError: (message: string) => void;
}

export function BackgroundSection({ bg, onChange, onError }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  const chooseType = (type: BgType) => {
    onChange({ type });
    // Picking "image" for the first time goes straight to choosing the photo.
    if (type === 'image' && !bg.image) fileInput.current?.click();
  };

  const openBackground = async (file: File) => {
    try {
      const image = await loadBackgroundImage(file);
      if (bg.image) URL.revokeObjectURL(bg.image.url);
      onChange({ type: 'image', image });
    } catch {
      onError(decodeErrorMessage(file));
    }
  };

  return (
    <section>
      <h2>רקע חדש</h2>
      <div className="tabs" role="group" aria-label="סוג רקע">
        {TABS.map((t) => (
          <button key={t.type} type="button" aria-pressed={bg.type === t.type} onClick={() => chooseType(t.type)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel">
        {bg.type === 'transparent' && (
          <p className="hint flush">הרקע יישמר שקוף. כדי לשמור על השקיפות צריך להוריד כ-PNG.</p>
        )}
        {bg.type === 'color' && <ColorPanel color={bg.color} onChange={(color) => onChange({ color })} />}
        {bg.type === 'gradient' && <GradientPanel g1={bg.g1} g2={bg.g2} dir={bg.gDir} onChange={onChange} />}
        {bg.type === 'blur' && <BlurPanel value={bg.blur} onChange={(blur) => onChange({ blur })} />}
        {bg.type === 'image' && <ImagePanel image={bg.image} onPick={() => fileInput.current?.click()} />}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,.heic,.heif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) openBackground(file);
        }}
      />
    </section>
  );
}
