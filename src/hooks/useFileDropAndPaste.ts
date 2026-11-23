import { useEffect, useEffectEvent, useState } from 'react';

/**
 * Accepts images dropped anywhere on the page or pasted from the clipboard.
 * Returns true while files are being dragged over the page.
 */
export function useFileDropAndPaste(onFiles: (files: File[]) => void): boolean {
  const [dragging, setDragging] = useState(false);
  const handleFiles = useEffectEvent(onFiles);

  useEffect(() => {
    let depth = 0; // dragenter/dragleave fire for every child element
    const onEnter = (e: DragEvent) => {
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => e.preventDefault();
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length) handleFiles(files);
    };
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.items ?? [])]
        .filter((i) => i.type.startsWith('image/'))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length) {
        e.preventDefault();
        handleFiles(files);
      }
    };

    document.addEventListener('dragenter', onEnter);
    document.addEventListener('dragover', onOver);
    document.addEventListener('dragleave', onLeave);
    document.addEventListener('drop', onDrop);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('dragenter', onEnter);
      document.removeEventListener('dragover', onOver);
      document.removeEventListener('dragleave', onLeave);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('paste', onPaste);
    };
  }, []);

  return dragging;
}
