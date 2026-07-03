import { useRef } from "preact/hooks";

export function useUndoRedo(getSnapshot, restore) {
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const isUndoRedo = useRef(false);

  const pushUndo = (snap) => {
    if (isUndoRedo.current) return;
    undoStack.current.push(snap);
    redoStack.current = [];
  };

  const undo = () => {
    if (undoStack.current.length === 0) return;
    const snap = undoStack.current.pop();
    redoStack.current.push(getSnapshot());
    isUndoRedo.current = true;
    restore(snap);
    isUndoRedo.current = false;
  };

  const redo = () => {
    if (redoStack.current.length === 0) return;
    const snap = redoStack.current.pop();
    undoStack.current.push(getSnapshot());
    isUndoRedo.current = true;
    restore(snap);
    isUndoRedo.current = false;
  };

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  return { pushUndo, undo, redo, canUndo, canRedo };
}
