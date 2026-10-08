// @machine:
// Positions the paste-options trigger beside the current editor caret.
// Owns caret DOM lookup and viewport collision handling for the popup.

const popupWidth = 258;
const triggerWidth = 108;
const triggerHeight = 38;
const popupGap = 6;

export function positionPasteOptionsPopup(root: HTMLElement, editorContainerEl: HTMLElement): void {
  const doc = editorContainerEl.ownerDocument;
  const view = doc.defaultView;
  const caretRect = getCaretRect(doc, editorContainerEl);
  const editorRect = editorContainerEl.querySelector<HTMLElement>(".cm-content")?.getBoundingClientRect()
    ?? editorContainerEl.getBoundingClientRect();
  const anchorX = caretRect?.left ?? editorRect.left + 12;
  const anchorY = caretRect?.bottom ?? editorRect.top + 12;
  const viewportWidth = view?.innerWidth ?? popupWidth;
  const viewportHeight = view?.innerHeight ?? 600;
  const rootWidth = root.getBoundingClientRect().width || triggerWidth;
  const rootHeight = root.getBoundingClientRect().height || triggerHeight;
  const left = Math.max(8, Math.min(anchorX, viewportWidth - rootWidth - 8));
  const belowTop = anchorY + popupGap;
  const top = belowTop + rootHeight <= viewportHeight - 8
    ? belowTop
    : anchorY - rootHeight - popupGap;

  root.style.left = `${left}px`;
  root.style.top = `${Math.max(8, Math.min(top, viewportHeight - rootHeight - 8))}px`;
  root.dataset.placement = top < belowTop ? "above" : "below";
}

function getCaretRect(doc: Document, editorContainerEl: HTMLElement): DOMRect | undefined {
  const selection = doc.getSelection();
  const focusNode = selection?.focusNode;
  if (focusNode && editorContainerEl.contains(focusNode)) {
    const range = doc.createRange();
    range.setStart(focusNode, selection.focusOffset);
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return rect;
    }
  }

  for (const cursor of Array.from(editorContainerEl.querySelectorAll<HTMLElement>(".cm-cursor"))) {
    const rect = cursor.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return rect;
    }
  }
}