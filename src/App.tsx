import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { BackgroundSection } from './components/background/BackgroundSection';
import { CropSection } from './components/CropSection';
import { EffectsSection } from './components/EffectsSection';
import { ExportSection } from './components/ExportSection';
import { ImageSection } from './components/ImageSection';
import { Stage } from './components/Stage';
import { DEFAULT_BG, DEFAULT_EFFECTS, DEFAULT_EXPORT } from './constants';
import { useBackgroundRemoval } from './hooks/useBackgroundRemoval';
import { useFileDropAndPaste } from './hooks/useFileDropAndPaste';
import { usePersistentState } from './hooks/usePersistentState';
import { useToast } from './hooks/useToast';
import { extensionFor, isTransparent, renderToBlob, type ComposeParams } from './lib/compose';
import { finalizeCrop, fullRect, largestWithRatio, subjectRect } from './lib/geometry';
import { decodeErrorMessage, loadImageFile, saveBlob } from './lib/image';
import type { ExportFormat, LoadedImage, Rect } from './types';

export default function App() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [removal, retry] = useBackgroundRemoval(image);
  // Background, effects and save options are remembered between visits (photos are not).
  const [bg, setBg] = usePersistentState('bg', DEFAULT_BG, ['image']);
  const [effects, setEffects] = usePersistentState('effects', DEFAULT_EFFECTS);
  const [exportSettings, setExportSettings] = usePersistentState('export', DEFAULT_EXPORT);
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

  // ----- Saving -----
  const transparent = isTransparent(bg);
  const format: ExportFormat = transparent && exportSettings.format === 'jpeg' ? 'png' : exportSettings.format;
  const exportParams = (): ComposeParams | null =>
    image && cutout && size
      ? { original: image.canvas, cutout, bg, effects, region: crop ?? fullRect(size), showOriginal: false }
      : null;
  const fileName = (blob: Blob) => `${image?.name ?? 'image'}-no-bg.${extensionFor(blob)}`;

  const download = async () => {
    const params = exportParams();
    if (!params) return;
    try {
      const blob = await renderToBlob(params, format, exportSettings.maxSide);
      saveBlob(blob, fileName(blob));
    } catch {
      showToast('לא הצלחנו ליצור את הקובץ.');
    }
  };

  const copy = async () => {
    const params = exportParams();
    if (!params) return;
    try {
      // The clipboard only takes PNG. Passing the promise keeps Safari's "user gesture" alive.
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': renderToBlob(params, 'png', exportSettings.maxSide) }),
      ]);
      showToast('התמונה הועתקה. אפשר להדביק אותה בכל מקום.');
    } catch (err) {
      console.error(err);
      showToast('לא הצלחנו להעתיק. אפשר להוריד את התמונה במקום.');
    }
  };

  const share = async () => {
    const params = exportParams();
    if (!params) return;
    try {
      const blob = await renderToBlob(params, format, exportSettings.maxSide);
      await navigator.share({ files: [new File([blob], fileName(blob), { type: blob.type })] });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error(err);
        showToast('לא הצלחנו לשתף. אפשר להוריד את התמונה במקום.');
      }
    }
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
          <EffectsSection effects={effects} onChange={(patch) => setEffects((prev) => ({ ...prev, ...patch }))} />
          <ExportSection
            ready={!!cutout && !editing}
            transparent={transparent}
            settings={exportSettings}
            format={format}
            onSettings={(patch) => setExportSettings((prev) => ({ ...prev, ...patch }))}
            onCompare={setShowOriginal}
            onDownload={download}
            onCopy={copy}
            onShare={share}
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
          effects={effects}
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
