// @machine: Validates package/manifest versions, bundles src/wiki-paste-plugin-entry.ts with Obsidian external into .dist/<version>/main.js, copies the root manifest, and retains only the two newest version folders.
import { copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, ".dist");
const packageJson = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8"));
const manifestPath = path.join(repoRoot, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

function compareVersions(leftVersion, rightVersion) {
	const left = leftVersion.split(".").map(Number);
	const right = rightVersion.split(".").map(Number);
	for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0);
		if (difference !== 0) {
			return difference;
		}
	}
	return 0;
}

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

const versionDirectories = (await readdir(distRoot, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory()
		&& /^\d+(?:\.\d+)+$/.test(entry.name))
	.sort((left, right) => {
		const versionOrder = compareVersions(right.name, left.name);
		if (versionOrder !== 0) {
			return versionOrder;
		}
		return right.name.localeCompare(left.name);
	});

const staleVersionDirectories = versionDirectories.slice(2);

await Promise.all(staleVersionDirectories.map((entry) =>
	rm(path.join(distRoot, entry.name), { recursive: true, force: true }),
));