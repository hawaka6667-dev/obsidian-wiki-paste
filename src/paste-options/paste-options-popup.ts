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

  const root = doc.createElement("div");
  root.className = "wiki-paste-options-popup";
  root.setAttribute("data-placement", "below");

  const trigger = doc.createElement("button");
  trigger.type = "button";
  trigger.className = "wiki-paste-options-trigger";
  trigger.setAttribute("aria-label", "Paste options");
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.title = "Paste options";

  const clipboardIcon = doc.createElement("span");
  clipboardIcon.className = "wiki-paste-options-clipboard-icon";
  clipboardIcon.setAttribute("aria-hidden", "true");
  trigger.append(clipboardIcon);

  const shortcut = doc.createElement("span");
  shortcut.className = "wiki-paste-options-shortcut";
  shortcut.textContent = "(Ctrl)";
  trigger.append(shortcut);

  const chevron = doc.createElement("span");
  chevron.className = "wiki-paste-options-chevron";
  chevron.setAttribute("aria-hidden", "true");
  trigger.append(chevron);
  root.append(trigger);

  trigger.addEventListener("pointerdown", (event) => event.preventDefault());
  doc.body.append(root);
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
