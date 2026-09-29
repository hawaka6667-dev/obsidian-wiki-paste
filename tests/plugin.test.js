const assert = require("node:assert/strict");
const Module = require("node:module");
const test = require("node:test");

test("registers literal plain-text paste and migrates the old setting", async () => {
  const originalLoad = Module._load;
  const originalDocument = global.document;
  const documentTarget = {};
  let registered;
  let settingToggle;

  class MockPlugin {
    loadData() {
      return Promise.resolve({ escapeFootnoteReferences: false });
    }

    addSettingTab(tab) {
      this.settingTab = tab;
    }

    saveData(data) {
      this.savedData = data;
      return Promise.resolve();
    }

    registerDomEvent(...args) {
      registered = args;
    }
  }

  class MockMarkdownView {}
  class MockPluginSettingTab {
    constructor(app, plugin) {
      this.app = app;
      this.plugin = plugin;
      this.containerEl = { empty() {} };
    }
  }
  class MockSetting {
    constructor() {}

    setName() { return this; }
    setDesc() { return this; }
    addToggle(callback) {
      const toggle = {
        setValue(value) { this.value = value; return this; },
        onChange(handler) { this.handler = handler; return this; }
      };
      callback(toggle);
      settingToggle = toggle;
      this.toggle = toggle;
      return this;
    }
  }

  Module._load = function (request, parent, isMain) {
    if (request === "obsidian") {
      return {
        MarkdownView: MockMarkdownView,
        Plugin: MockPlugin,
        PluginSettingTab: MockPluginSettingTab,
        Setting: MockSetting
      };
    }

    return originalLoad.call(this, request, parent, isMain);
  };
  global.document = documentTarget;

  try {
    const WikiPastePlugin = require("../src/main.ts").default;
    const plugin = new WikiPastePlugin();
    plugin.loadData = () => Promise.resolve({ escapeFootnoteReferences: false });
    const target = { closest: (selector) => selector === ".cm-content" ? target : null };
    const inserted = [];
    const view = {
      containerEl: { contains: (candidate) => candidate === target },
      editor: { replaceSelection: (text) => inserted.push(text) }
    };
    const eventState = { prevented: false, stopped: false };
    const event = {
      target,
      clipboardData: { getData: (type) => type === "text/plain" ? "Copied [^abc]" : "" },
      preventDefault: () => { eventState.prevented = true; },
      stopPropagation: () => { eventState.stopped = true; }
    };
    plugin.app = { workspace: { getActiveViewOfType: () => view } };

    await plugin.onload();
    assert.equal(plugin.settings.escapeMarkdownSyntax, false);
    plugin.settingTab.display();
    assert.equal(settingToggle.value, false);
    await settingToggle.handler(false);
    assert.equal(plugin.settings.escapeMarkdownSyntax, false);
    assert.equal(plugin.savedData.escapeMarkdownSyntax, false);

    assert.equal(registered[0], documentTarget);
    assert.equal(registered[1], "paste");
    assert.equal(registered[3].capture, true);
    registered[2](event);

    assert.deepEqual(inserted, []);
    assert.equal(eventState.prevented, false);
    assert.equal(eventState.stopped, false);

    await settingToggle.handler(true);
    registered[2](event);
    assert.deepEqual(inserted, ["Copied \\[^abc]"]);
    assert.equal(eventState.prevented, true);
    assert.equal(eventState.stopped, true);
  } finally {
    Module._load = originalLoad;

    if (originalDocument === undefined) {
      delete global.document;
    } else {
      global.document = originalDocument;
    }
  }
});