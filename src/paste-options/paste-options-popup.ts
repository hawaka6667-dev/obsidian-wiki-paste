// @machine:
// Renders an inert paste-options popup after Markdown editor paste events.
// Owns popup positioning, menu visibility, dismissal, and its document-level listeners.
// Menu choices are visual only and never modify editor or clipboard contents.

import type { Menu as ObsidianMenu } from "obsidian";
import { createPasteOptionsMenu, type MenuConstructor } from "./paste-options-menu";
import { positionPasteOptionsPopup } from "./paste-options-positioning";

const activePopups = new WeakMap<Document, HTMLElement>();
const activeMenus = new WeakMap<Document, ObsidianMenu>();
const popupCleanups = new WeakMap<Document, () => void>();

export function showPasteOptionsPopup(editorContainerEl: HTMLElement, Menu: MenuConstructor): HTMLElement {
  const doc = editorContainerEl.ownerDocument;
  closePasteOptionsPopup(doc);

  const root = doc.body.createDiv({
    cls: "wiki-paste-options-popup",
    attr: { "data-placement": "below" },
  });

  const trigger = root.createEl("button", {
    type: "button",
    cls: "wiki-paste-options-trigger",
    title: "Paste options",
    attr: {
      "aria-label": "Paste options",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
    },
  });

  trigger.createSpan({
    cls: "wiki-paste-options-clipboard-icon",
    attr: { "aria-hidden": "true" },
  });
  trigger.createSpan({ cls: "wiki-paste-options-shortcut", text: "(Ctrl)" });
  trigger.createSpan({
    cls: "wiki-paste-options-chevron",
    attr: { "aria-hidden": "true" },
  });

  trigger.addEventListener("pointerdown", (event) => event.preventDefault());
  positionPasteOptionsPopup(root, editorContainerEl);
  activePopups.set(doc, root);

  const onDocumentPointerDown = (event: PointerEvent): void => {
    if (!root.contains(event.target as Node | null) && !activeMenus.has(doc)) {
      closePasteOptionsPopup(doc);
    }
  };
  let controlKeyIsDown = false;
  let controlChordUsed = false;
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Control") {             //ctrl hack 
      if (!controlKeyIsDown) {
        controlKeyIsDown = true;
        controlChordUsed = false;
      }
      return;
    }

    if (controlKeyIsDown) {
      controlChordUsed = true;
    }

    if (event.key === "Escape") {
      const menu = activeMenus.get(doc);
      if (menu) {
        menu.hide();
      } else {
        closePasteOptionsPopup(doc);
      }
      return;
    }
  };
  const onDocumentKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== "Control" || !controlKeyIsDown) {
      return;
    }

    const wasControlTap = !controlChordUsed;
    controlKeyIsDown = false;
    controlChordUsed = false;
    if (wasControlTap && !activeMenus.has(doc)) {
      openPasteOptionsMenu();
    }
  };
  const onDocumentScroll = (): void => {
    const menu = activeMenus.get(doc);
    if (menu) {
      menu.hide();
    } else {
      closePasteOptionsPopup(doc);
    }
  };
  doc.addEventListener("pointerdown", onDocumentPointerDown);
  doc.addEventListener("keydown", onDocumentKeyDown);
  doc.addEventListener("keyup", onDocumentKeyUp);
  doc.addEventListener("scroll", onDocumentScroll, true);
  popupCleanups.set(doc, () => {
    doc.removeEventListener("pointerdown", onDocumentPointerDown);
    doc.removeEventListener("keydown", onDocumentKeyDown);
    doc.removeEventListener("keyup", onDocumentKeyUp);
    doc.removeEventListener("scroll", onDocumentScroll, true);
    const menu = activeMenus.get(doc);
    activeMenus.delete(doc);
    menu?.close();
  });

  trigger.addEventListener("click", () => {
    const menu = activeMenus.get(doc);
    if (menu) {
      menu.hide();
    } else {
      openPasteOptionsMenu();
    }
  });

  return root;

  function openPasteOptionsMenu(): void {
    const menu = createPasteOptionsMenu(doc, Menu, () => {
      if (activeMenus.get(doc) === menu) {
        activeMenus.delete(doc);
      }
      trigger.setAttribute("aria-expanded", "false");
      closePasteOptionsPopup(doc);
    });
    activeMenus.set(doc, menu);
    trigger.setAttribute("aria-expanded", "true");
    const triggerRect = trigger.getBoundingClientRect();
    menu.showAtPosition({ x: triggerRect.left, y: triggerRect.bottom + 5, left: true }, doc);
  }
}

export function closePasteOptionsPopup(doc: Document): void {
  const root = activePopups.get(doc);
  const cleanup = popupCleanups.get(doc);
  activePopups.delete(doc);
  popupCleanups.delete(doc);
  root?.remove();
  cleanup?.();
}
