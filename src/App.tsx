import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { BackgroundSection } from './components/background/BackgroundSection';
import { CropSection } from './components/CropSection';
import { ExportSection, type ExportType } from './components/ExportSection';
import { ImageSection } from './components/ImageSection';
import { Stage } from './components/Stage';
import { DEFAULT_BG } from './constants';
import { useBackgroundRemoval } from './hooks/useBackgroundRemoval';
import { useFileDropAndPaste } from './hooks/useFileDropAndPaste';
import { useToast } from './hooks/useToast';
import { composeInto, isTransparent } from './lib/compose';
import { finalizeCrop, fullRect, largestWithRatio, subjectRect } from './lib/geometry';
import { decodeErrorMessage, loadImageFile, saveBlob } from './lib/image';
import type { BgSettings, LoadedImage, Rect } from './types';

export default function App() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [removal, retry] = useBackgroundRemoval(image);
  const [bg, setBg] = useState<BgSettings>(DEFAULT_BG);
  const [crop, setCrop] = useState<Rect | null>(null); // applied crop, null = whole image
  const [cropEdit, setCropEdit] = useState<Rect | null>(null); // frame being edited
  const [cropRatio, setCropRatio] = useState(0); // width / height, 0 = free
  const [showOriginal, setShowOriginal] = useState(false);
  const [toast, showToast] = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const cutout = removal.status === 'done' ? removal.cutout : null;
  const subjectBox = removal.status === 'done' ? removal.subjectBox : null;
  const size = useMemo(() => (image ? { w: image.canvas.width, h: image.canvas.height } : null), [image]);
  const editing = cropEdit !== null;
  // What the preview shows: the whole image while the crop frame is open, otherwise the crop.
  const region = useMemo(() => (size ? (!editing && crop) || fullRect(size) : null), [size, crop, editing]);

  const openFile = useCallback(
    async (file: File) => {
      try {
        const loaded = await loadImageFile(file);
        setImage(loaded);
        setCrop(null);
        setCropEdit(null);
        if (loaded.scaledDown) {
          showToast(`התמונה גדולה מאוד, אז הקטנו אותה ל-${loaded.canvas.width}×${loaded.canvas.height} פיקסלים.`);
        }
      } catch {
        showToast(decodeErrorMessage(file));
      }
    },
    [showToast],
  );
  const dragging = useFileDropAndPaste(openFile);
  const openPicker = () => fileInput.current?.click();

  // ----- Crop -----
  const startCrop = () => {
    if (!size || !cutout) return;
    setShowOriginal(false);
    let frame = crop ?? fullRect(size);
    if (!crop && cropRatio) frame = largestWithRatio(size, cropRatio, frame);
    setCropEdit(frame);
  };
  const applyCrop = () => {
    if (!size || !cropEdit) return;
    setCrop(finalizeCrop(size, cropEdit));
    setCropEdit(null);
  };
  const chooseRatio = (ratio: number) => {
    setCropRatio(ratio);
    if (ratio && size && cropEdit) setCropEdit(largestWithRatio(size, ratio, cropEdit));
  };
  const fitToSubject = () => {
    if (size && subjectBox) setCropEdit(subjectRect(size, subjectBox, cropRatio));
  };

  // Enter applies the crop and Escape cancels it, while the frame is open.
  const onCropKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') setCropEdit(null);
    else if (e.key === 'Enter' && !(e.target as Element).closest('button, input, select, a')) applyCrop();
  });
  useEffect(() => {
    if (!editing) return;
    document.addEventListener('keydown', onCropKey);
    return () => document.removeEventListener('keydown', onCropKey);
  }, [editing]);

  // ----- Download -----
  const download = (type: ExportType) => {
    if (!image || !cutout || !size) return;
    const canvas = document.createElement('canvas');
    composeInto(canvas, { original: image.canvas, cutout, bg, region: crop ?? fullRect(size), showOriginal: false });
    canvas.toBlob(
      (blob) => {
        if (blob) saveBlob(blob, `${image.name}-no-bg.${type === 'image/png' ? 'png' : 'jpg'}`);
        else showToast('לא הצלחנו ליצור את הקובץ.');
      },
      type,
      0.92,
    );
  };

  return (
    <>
      <header className="app-header">
        <h1>מסיר רקע</h1>
        <p>מסירים את הרקע מתמונה ומחליפים אותו בצבע, מעבר צבעים, טשטוש או תמונה אחרת.</p>
      </header>

      <main className="app-main">
        <aside className="sidebar">
          <ImageSection onPick={openPicker} />
          <BackgroundSection bg={bg} onChange={(patch) => setBg((prev) => ({ ...prev, ...patch }))} onError={showToast} />
          <CropSection
            ready={!!cutout}
            editing={editing}
            hasCrop={!!crop}
            ratio={cropRatio}
            canFit={!!subjectBox}
            onStart={startCrop}
            onApply={applyCrop}
            onCancel={() => setCropEdit(null)}
            onReset={() => setCrop(null)}
            onRatio={chooseRatio}
            onFit={fitToSubject}
          />
          <ExportSection
            ready={!!cutout && !editing}
            transparent={isTransparent(bg)}
            onCompare={setShowOriginal}
            onDownload={download}
          />
          <p className="privacy">
            התמונות לא נשלחות לשום שרת: העיבוד כולו נעשה בדפדפן, אצלכם במחשב. בשימוש הראשון הדף מוריד את מודל הבינה
            המלאכותית (בערך 90MB), ולכן צריך חיבור לאינטרנט. אחרי זה הדפדפן שומר את המודל ולא מוריד אותו שוב.
            <br />
            מבוסס על הספרייה ‎@imgly/background-removal‎ (רישיון AGPL).
          </p>
        </aside>

        <Stage
          image={image}
          cutout={cutout}
          bg={bg}
          region={region}
          showOriginal={showOriginal}
          cropEdit={cropEdit}
          cropRatio={cropRatio}
          onCropChange={setCropEdit}
          removal={removal}
          onRetry={retry}
          onPick={openPicker}
          dragging={dragging}
          toast={toast}
        />
      </main>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,.heic,.heif"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) openFile(file);
        }}
      />
    </>
  );
}
