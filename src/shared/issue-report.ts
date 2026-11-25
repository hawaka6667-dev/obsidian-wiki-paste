// @machine:
// Builds pre-filled GitHub Issue URLs and opens the plugin's issue submission page in the browser.
// Collects non-sensitive plugin version, platform, and enabled-feature context for bug reports.

import type { WikiPasteSettings } from "../settings";

export const REPOSITORY_ISSUES_URL = "https://github.com/hawaka6667-dev/obsidian-wiki-paste/issues/new";

export interface IssueEnvironmentInfo {
  pluginVersion: string;
  platformLabel: string;
  settings: WikiPasteSettings;
}

export function buildIssueUrl(info: IssueEnvironmentInfo): string {
  const enabledFeatures = Object.entries(info.settings)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key);

  const body = [
    "## Describe the issue / feature request",
    "",
    "<!-- Please describe what happened, what you expected, and steps to reproduce. -->",
    "",
    "## Environment",
    `- Plugin: wiki-paste v${info.pluginVersion}`,
    `- Platform: ${info.platformLabel}`,
    `- Enabled options: ${enabledFeatures.length > 0 ? enabledFeatures.join(", ") : "none"}`,
  ].join("\n");

  const params = new URLSearchParams({
    title: "[Bug/Feature]: ",
    body,
  });
  return `${REPOSITORY_ISSUES_URL}?${params.toString()}`;
}

export function openIssueReport(
  info: IssueEnvironmentInfo,
  opener: (url: string, target?: string, features?: string) => unknown = (url, target, features) =>
    window.open(url, target, features),
): string {
  const url = buildIssueUrl(info);
  opener(url, "_blank", "noopener,noreferrer");
  return url;
}
