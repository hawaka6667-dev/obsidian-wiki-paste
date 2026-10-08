// @machine:
// Builds the inert Obsidian Menu used by the paste-options popup.
// Owns the menu heading and option labels, icons, and hide callback.

import type { Menu as ObsidianMenu } from "obsidian";

export type MenuConstructor = new () => ObsidianMenu;

const pasteOptions = [
  { label: "Keep Source Formatting", icon: "format" },
  { label: "Paste Text Only", icon: "text" },
  { label: "Merge Formatting", icon: "merge" },
] as const;

export function createPasteOptionsMenu(
  doc: Document,
  Menu: MenuConstructor,
  onHide: () => void,
): ObsidianMenu {
  const menu = new Menu();
  menu.setUseNativeMenu(false);
  menu.addItem((item) => {
    const heading = doc.createElement("span");
    heading.className = "wiki-paste-options-heading";
    heading.textContent = "Paste Options:";
    heading.style.textAlign = "left";
    const title = doc.createDocumentFragment();
    title.append(heading);
    item.setTitle(title).setIsLabel(true).setDisabled(true);
  });
  menu.addSeparator();

  for (const option of pasteOptions) {
    const icon = doc.createElement("span");
    icon.className = `wiki-paste-options-item-icon is-${option.icon}`;
    icon.setAttribute("aria-hidden", "true");
    const label = doc.createElement("span");
    label.className = "wiki-paste-options-label";
    label.textContent = option.label;
    label.style.textAlign = "left";
    const title = doc.createDocumentFragment();
    title.append(icon, label);
    menu.addItem((item) => item.setTitle(title));
  }

  menu.onHide(onHide);
  return menu;
}