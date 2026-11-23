import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { BackgroundSection } from './components/background/BackgroundSection';
import { BrushSection } from './components/BrushSection';
import { CropSection } from './components/CropSection';
import { EffectsSection } from './components/EffectsSection';
import { ExportSection } from './components/ExportSection';
import { Filmstrip } from './components/Filmstrip';
import { Header } from './components/Header';
import { ImageSection, unavailableReason } from './components/ImageSection';
import { Stage } from './components/Stage';
import {
  DEFAULT_BG,
  DEFAULT_BRUSH_SIZE,
  DEFAULT_EFFECTS,
  DEFAULT_EXPORT,
  DEFAULT_FRAMING,
  DEFAULT_MODEL,
  MODELS,
} from './constants';
import { useFileDropAndPaste } from './hooks/useFileDropAndPaste';
import { useHistory } from './hooks/useHistory';
import { useItems } from './hooks/useItems';
import { usePersistentState } from './hooks/usePersistentState';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { applyPatch, Stroke } from './lib/brush';
import { extensionFor, isTransparent, renderToBlob, type ComposeParams } from './lib/compose';
import { finalizeCrop, fullRect, largestWithRatio, subjectRect, viewRegion } from './lib/geometry';
import { decodeErrorMessage, loadImageFile, saveBlob, type OpenedImage } from './lib/image';
import { appleGpu as detectAppleGpu, findSubjectBox } from './lib/removal';
import { makeZip } from './lib/zip';
import type { BrushMode, DocSettings, ExportFormat, Item, ModelId, Rect } from './types';

const sameSettings = (a: DocSettings, b: DocSettings) =>
  a.bg === b.bg && a.effects === b.effects && a.framing === b.framing;

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);

export default function App() {
  // ----- Settings (remembered between visits; photos are not) -----
  const [modelPref, setModelPref] = usePersistentState<{ id: ModelId }>('model', { id: DEFAULT_MODEL });
  const [appleGpu, setAppleGpu] = useState(false);
  useEffect(() => {
    detectAppleGpu.then(setAppleGpu);
  }, []);
  // A remembered model that can't run here (or no longer exists) falls back to the default.
  const model = (
    MODELS.find((m) => m.id === modelPref.id && !unavailableReason(m, appleGpu)) ??
    MODELS.find((m) => m.id === DEFAULT_MODEL)!
  ).id;
  const [bg, setBg] = usePersistentState('bg', DEFAULT_BG, ['image']);
  const [effects, setEffects] = usePersistentState('effects', DEFAULT_EFFECTS);
  const [framing, setFraming] = usePersistentState('framing', DEFAULT_FRAMING);
  const [exportSettings, setExportSettings] = usePersistentState('export', DEFAULT_EXPORT);
  const [brush, setBrush] = usePersistentState<{ mode: BrushMode; size: number }>('brush', {
    mode: 'erase',
    size: DEFAULT_BRUSH_SIZE,
  });

  // ----- Photos -----
  const { items, add, remove, patch, retry, bump } = useItems(model);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = items.find((i) => i.id === currentId) ?? null;
  const cutout = current?.status === 'done' ? current.cutout : null;
  const size = current ? { w: current.original.width, h: current.original.height } : null;

  // ----- Editing state for the current photo -----
  const [cropEdit, setCropEdit] = useState<Rect | null>(null);
  const [cropRatio, setCropRatio] = useState(0);
  const [brushOn, setBrushOn] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [zipProgress, setZipProgress] = useState<string | null>(null);
  const [toast, showToast] = useToast();
  const [theme, cycleTheme] = useTheme();
  const fileInput = useRef<HTMLInputElement>(null);

  const editingCrop = cropEdit !== null;
  const region = useMemo(
    () => (current ? viewRegion(current, framing, editingCrop) : null),
    [current, framing, editingCrop],
  );

  // ----- Undo / redo -----
  const settings: DocSettings = { bg, effects, framing };
  const latest = useRef(settings);
  latest.current = settings;
  const committed = useRef(settings);

  const history = useHistory((entry, direction) => {
    if (entry.kind === 'settings') {
      const s = direction === 'undo' ? entry.before : entry.after;
      committed.current = s;
      setBg(s.bg);
      setEffects(s.effects);
      setFraming(s.framing);
    } else if (entry.kind === 'crop') {
      setCurrentId(entry.itemId);
      setCropEdit(null);
      patch(entry.itemId, { crop: direction === 'undo' ? entry.before : entry.after });
    } else {
      const it = items.find((i) => i.id === entry.itemId);
      if (!it?.cutout) return;
      applyPatch(it.cutout, entry.x, entry.y, direction === 'undo' ? entry.before : entry.after);
      setCurrentId(it.id);
      patch(it.id, { subjectBox: findSubjectBox(it.cutout) });
      bump(it.id);
    }
  });
  const pushHistory = history.push;

  // Setting changes (background, effects, framing) become one undo step once they settle,
  // so dragging a slider is a single step rather than dozens.
  const commitSettings = useCallback(() => {
    const now = latest.current;
    if (sameSettings(now, committed.current)) return;
    pushHistory({ kind: 'settings', before: committed.current, after: now });
    committed.current = now;
  }, [pushHistory]);
  useEffect(() => {
    if (sameSettings({ bg, effects, framing }, committed.current)) return;
    const timer = setTimeout(commitSettings, 400);
    return () => clearTimeout(timer);
  }, [bg, effects, framing, commitSettings]);

  const undo = () => {
    commitSettings();
    history.undo();
  };
  const redo = () => {
    commitSettings();
    history.redo();
  };

  // ----- Opening, choosing and removing photos -----
  const openFiles = useCallback(
    async (files: File[]) => {
      const opened: OpenedImage[] = [];
      for (const file of files) {
        try {
          opened.push(await loadImageFile(file));
        } catch {
          showToast(decodeErrorMessage(file));
        }
      }
      if (!opened.length) return;
      const created = add(opened);
      setCurrentId(created[0].id);
      setCropEdit(null);
      const scaled = opened.filter((o) => o.scaledDown);
      if (scaled.length === 1 && opened.length === 1) {
        const o = scaled[0].original;
        showToast(`התמונה גדולה מאוד, אז הקטנו אותה ל-${o.width}×${o.height} פיקסלים.`);
      } else if (scaled.length > 0) {
        showToast(`${scaled.length} תמונות גדולות מאוד הוקטנו ל-16 מגה-פיקסל.`);
      }
    },
    [add, showToast],
  );
  const dragging = useFileDropAndPaste(openFiles);
  const openPicker = () => fileInput.current?.click();

  const selectItem = (id: string) => {
    setCurrentId(id);
    setCropEdit(null);
    setShowOriginal(false);
  };

  const removeItem = (id: string) => {
    const index = items.findIndex((i) => i.id === id);
    if (id === currentId) {
      const neighbor = items[index + 1] ?? items[index - 1] ?? null;
      setCurrentId(neighbor?.id ?? null);
      setCropEdit(null);
    }
    remove(id);
    history.forget((e) => e.kind !== 'settings' && e.itemId === id);
  };

  const chooseModel = (id: ModelId) => {
    setModelPref({ id });
    setBrushOn(false);
    setCropEdit(null);
    // Every photo is processed again, so earlier brush strokes no longer apply.
    history.forget((e) => e.kind === 'mask');
  };

  // ----- Crop -----
  const startCrop = () => {
    if (!current || !size || !cutout) return;
    setBrushOn(false);
    setShowOriginal(false);
    let frame = current.crop ?? fullRect(size);
    if (!current.crop && cropRatio) frame = largestWithRatio(size, cropRatio, frame);
    setCropEdit(frame);
  };
  const applyCrop = () => {
    if (!current || !size || !cropEdit) return;
    const next = finalizeCrop(size, cropEdit);
    if (!sameRect(next, current.crop)) pushHistory({ kind: 'crop', itemId: current.id, before: current.crop, after: next });
    patch(current.id, { crop: next });
    setCropEdit(null);
  };
  const resetCrop = () => {
    if (!current?.crop) return;
    pushHistory({ kind: 'crop', itemId: current.id, before: current.crop, after: null });
    patch(current.id, { crop: null });
  };
  const chooseRatio = (ratio: number) => {
    setCropRatio(ratio);
    if (ratio && size && cropEdit) setCropEdit(largestWithRatio(size, ratio, cropEdit));
  };
  const fitToSubject = () => {
    if (size && current?.subjectBox) setCropEdit(subjectRect(size, current.subjectBox, cropRatio));
  };

  // ----- Touch-up brush -----
  const brushRadius =
    brushOn && current ? (Math.max(current.original.width, current.original.height) * brush.size) / 800 : null;
  const stroke = useRef<{ itemId: string; stroke: Stroke } | null>(null);
  const frameRequest = useRef(0);
  // Redraw at most once per frame while painting.
  const redrawSoon = (id: string) => {
    if (frameRequest.current) return;
    frameRequest.current = requestAnimationFrame(() => {
      frameRequest.current = 0;
      bump(id);
    });
  };
  const strokeStart = (p: { x: number; y: number }) => {
    if (!current?.cutout || brushRadius === null) return;
    stroke.current = { itemId: current.id, stroke: new Stroke(current.cutout, current.original, brush.mode, brushRadius) };
    stroke.current.stroke.to(p.x, p.y);
    redrawSoon(current.id);
  };
  const strokeMove = (p: { x: number; y: number }) => {
    const s = stroke.current;
    if (!s) return;
    s.stroke.to(p.x, p.y);
    redrawSoon(s.itemId);
  };
  const strokeEnd = () => {
    const s = stroke.current;
    stroke.current = null;
    if (!s) return;
    const changed = s.stroke.finish();
    if (changed) pushHistory({ kind: 'mask', itemId: s.itemId, ...changed });
    const it = items.find((i) => i.id === s.itemId);
    if (it?.cutout) patch(s.itemId, { subjectBox: findSubjectBox(it.cutout) });
    bump(s.itemId);
  };

  // ----- Keyboard shortcuts -----
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if (mod && key === 'y') {
      e.preventDefault();
      redo();
    } else if (editingCrop && e.key === 'Escape') {
      setCropEdit(null);
    } else if (editingCrop && e.key === 'Enter' && !(e.target as Element).closest('button, input, select, a')) {
      applyCrop();
    }
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ----- Saving -----
  const transparent = isTransparent(bg);
  const format: ExportFormat = transparent && exportSettings.format === 'jpeg' ? 'png' : exportSettings.format;
  const paramsFor = (it: Item): ComposeParams | null =>
    it.status === 'done' && it.cutout
      ? {
          original: it.original,
          cutout: it.cutout,
          version: it.version,
          bg,
          effects,
          region: viewRegion(it, framing, false),
          showOriginal: false,
        }
      : null;
  const fileName = (it: Item, blob: Blob) => `${it.name}-no-bg.${extensionFor(blob)}`;

  const download = async () => {
    const params = current && paramsFor(current);
    if (!current || !params) return;
    try {
      const blob = await renderToBlob(params, format, exportSettings.maxSide);
      saveBlob(blob, fileName(current, blob));
    } catch {
      showToast('לא הצלחנו ליצור את הקובץ.');
    }
  };

  const copy = async () => {
    const params = current && paramsFor(current);
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
    const params = current && paramsFor(current);
    if (!current || !params) return;
    try {
      const blob = await renderToBlob(params, format, exportSettings.maxSide);
      await navigator.share({ files: [new File([blob], fileName(current, blob), { type: blob.type })] });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error(err);
        showToast('לא הצלחנו לשתף. אפשר להוריד את התמונה במקום.');
      }
    }
  };

  const readyItems = items.filter((i) => i.status === 'done');
  const downloadAll = async () => {
    if (!readyItems.length) return;
    try {
      const files: { name: string; blob: Blob }[] = [];
      for (let i = 0; i < readyItems.length; i++) {
        setZipProgress(`${i + 1}/${readyItems.length}`);
        const it = readyItems[i];
        const blob = await renderToBlob(paramsFor(it)!, format, exportSettings.maxSide);
        files.push({ name: fileName(it, blob), blob });
      }
      saveBlob(await makeZip(files), 'background-remover.zip');
    } catch (err) {
      console.error(err);
      showToast('לא הצלחנו ליצור את קובץ ה-ZIP.');
    } finally {
      setZipProgress(null);
    }
  };

  const busy = editingCrop || brushOn;

  return (
    <>
      <Header
        canUndo={history.canUndo || !sameSettings(settings, committed.current)}
        canRedo={history.canRedo}
        onUndo={undo}
        onRedo={redo}
        theme={theme}
        onTheme={cycleTheme}
      />

      <main className="app-main">
        <aside className="sidebar">
          <ImageSection
            onPick={openPicker}
            model={model}
            onModel={chooseModel}
            appleGpu={appleGpu}
            hasPhotos={items.length > 0}
          />
          <BackgroundSection bg={bg} onChange={(p) => setBg((prev) => ({ ...prev, ...p }))} onError={showToast} />
          <EffectsSection effects={effects} onChange={(p) => setEffects((prev) => ({ ...prev, ...p }))} />
          <CropSection
            ready={!!cutout}
            editing={editingCrop}
            hasCrop={!!current?.crop}
            ratio={cropRatio}
            canFit={!!current?.subjectBox}
            framing={framing}
            onFraming={(p) => {
              setCropEdit(null);
              setFraming((prev) => ({ ...prev, ...p }));
            }}
            onStart={startCrop}
            onApply={applyCrop}
            onCancel={() => setCropEdit(null)}
            onReset={resetCrop}
            onRatio={chooseRatio}
            onFit={fitToSubject}
          />
          <BrushSection
            ready={!!cutout}
            active={brushOn}
            mode={brush.mode}
            size={brush.size}
            onStart={() => {
              setCropEdit(null);
              setShowOriginal(false);
              setBrushOn(true);
            }}
            onDone={() => setBrushOn(false)}
            onMode={(mode) => setBrush((b) => ({ ...b, mode }))}
            onSize={(s) => setBrush((b) => ({ ...b, size: s }))}
          />
          <ExportSection
            ready={!!cutout && !busy}
            transparent={transparent}
            settings={exportSettings}
            format={format}
            onSettings={(p) => setExportSettings((prev) => ({ ...prev, ...p }))}
            onCompare={setShowOriginal}
            onDownload={download}
            onCopy={copy}
            onShare={share}
            total={items.length}
            readyCount={readyItems.length}
            zipProgress={zipProgress}
            onDownloadAll={downloadAll}
          />
          <p className="privacy">
            התמונות לא נשלחות לשום שרת: העיבוד כולו נעשה בדפדפן, אצלכם במחשב. בשימוש הראשון במודל הדף מוריד אותו,
            ולכן צריך אינטרנט. אחרי זה הכלי עובד גם בלי חיבור.
            <br />
            ISNet דרך ‎@imgly/background-removal‎ (רישיון AGPL). שאר המודלים דרך Transformers.js: ‏MODNet
            (Apache 2.0), ‏BiRefNet (MIT), ו-RMBG 1.4 של BRIA, שמותר לשימוש לא מסחרי בלבד.
          </p>
        </aside>

        <div className="workspace">
          <Stage
            item={current}
            bg={bg}
            effects={effects}
            region={region}
            showOriginal={showOriginal}
            cropEdit={cropEdit}
            cropRatio={cropRatio}
            onCropChange={setCropEdit}
            brushRadius={brushRadius}
            onStrokeStart={strokeStart}
            onStrokeMove={strokeMove}
            onStrokeEnd={strokeEnd}
            onRetry={() => current && retry(current.id)}
            onPick={openPicker}
            dragging={dragging}
            toast={toast}
          />
          {items.length > 0 && (
            <Filmstrip items={items} currentId={currentId} onSelect={selectItem} onRemove={removeItem} onAdd={openPicker} />
          )}
        </div>
      </main>

      <input
        ref={fileInput}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) openFiles(files);
        }}
      />
    </>
  );
}
