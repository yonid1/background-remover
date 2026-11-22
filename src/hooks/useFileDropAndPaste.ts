import { useEffect, useEffectEvent, useState } from 'react';

/**
 * Accepts an image dropped anywhere on the page or pasted from the clipboard.
 * Returns true while a file is being dragged over the page.
 */
export function useFileDropAndPaste(onFile: (file: File) => void): boolean {
  const [dragging, setDragging] = useState(false);
  const handleFile = useEffectEvent(onFile);

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
      const file = e.dataTransfer?.files[0];
      if (file) handleFile(file);
    };
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        handleFile(file);
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
