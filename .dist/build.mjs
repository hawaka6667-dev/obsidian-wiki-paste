// @machine: Validates package/manifest versions, bundles src/wiki-paste-plugin-entry.ts with Obsidian external into .dist/<version>/main.js, copies the root manifest, and removes stale version folders.
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, ".dist");
const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const manifestPath = path.join(repoRoot, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (packageJson.version !== manifest.version) {
	throw new Error(`package.json version ${packageJson.version} does not match manifest version ${manifest.version}`);
}

const versionPath = path.join(distRoot, manifest.version);

await mkdir(versionPath, { recursive: true });
await build({
	entryPoints: [path.join(repoRoot, "src", "wiki-paste-plugin-entry.ts")],
	bundle: true,
	external: ["obsidian"],
	platform: "browser",
	format: "cjs",
	target: "es2020",
	outfile: path.join(versionPath, "main.js"),
});
await copyFile(
	manifestPath,
	path.join(versionPath, "manifest.json"),
);

const staleVersionDirectories = (await readdir(distRoot, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory()
		&& entry.name !== manifest.version
		&& /^\d+(?:\.\d+)+(?:[-+][0-9A-Za-z.-]+)?$/.test(entry.name));

await Promise.all(staleVersionDirectories.map((entry) =>
	rm(path.join(distRoot, entry.name), { recursive: true, force: true }),
));