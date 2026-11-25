import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIssueUrl, openIssueReport, REPOSITORY_ISSUES_URL } from "../src/shared/issue-report.ts";

const sampleSettings = {
  escapeMarkdownSyntax: false,
  convertLatexOnPaste: true,
  autoExpandCanvasCards: true,
  canvasCardCopyToMarkdown: true,
  selectLineBeforeAll: true,
  moveLinesWithAltArrows: true,
  showPasteOptionsPopup: false,
  pasteWebContentAsHtml: false,
};

test("buildIssueUrl encodes version, platform, and enabled settings", () => {
  const url = buildIssueUrl({
    pluginVersion: "0.2.21",
    platformLabel: "Windows",
    settings: {
      ...sampleSettings,
      escapeMarkdownSyntax: true,
    },
  });

  assert.ok(url.startsWith(`${REPOSITORY_ISSUES_URL}?`));
  const parsed = new URL(url);
  const body = parsed.searchParams.get("body") ?? "";
  assert.match(body, /wiki-paste v0\.2\.21/);
  assert.match(body, /Platform: Windows/);
  assert.match(body, /convertLatexOnPaste/);
  assert.match(body, /escapeMarkdownSyntax/);
});

test("openIssueReport opens the generated URL with noopener,noreferrer", () => {
  const opened = [];
  const url = openIssueReport(
    {
      pluginVersion: "0.2.21",
      platformLabel: "macOS",
      settings: sampleSettings,
    },
    (targetUrl, target, features) => opened.push({ targetUrl, target, features }),
  );

  assert.equal(opened.length, 1);
  assert.equal(opened[0].targetUrl, url);
  assert.equal(opened[0].target, "_blank");
  assert.equal(opened[0].features, "noopener,noreferrer");
});
