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
    const title = doc.createDocumentFragment();
    title.createSpan({ cls: "wiki-paste-options-heading", text: "Paste Options:" });
    item.setTitle(title).setIsLabel(true).setDisabled(true);
  });
  menu.addSeparator();

  for (const option of pasteOptions) {
    const title = doc.createDocumentFragment();
    title.createSpan({
      cls: `wiki-paste-options-item-icon is-${option.icon}`,
      attr: { "aria-hidden": "true" },
    });
    title.createSpan({ cls: "wiki-paste-options-label", text: option.label });
    menu.addItem((item) => item.setTitle(title));
  }

  menu.onHide(onHide);
  return menu;
}
