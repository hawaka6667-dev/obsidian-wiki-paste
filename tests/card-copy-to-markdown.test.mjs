import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import {
	clearPendingCanvasMarkdown,
	handleCanvasCardClipboardEvent,
	handleCardMarkdownPaste,
} from "../src/card-copy-to-markdown/card-copy-to-markdown.ts";

function createEvent(target, type = "paste", hasClipboardData = true) {
	let defaultPrevented = false;
	let propagationStopped = false;
	return {
		type,
		target,
		clipboardData: hasClipboardData ? { getData: () => "" } : null,
		preventDefault() {
			defaultPrevented = true;
		},
		stopPropagation() {
			propagationStopped = true;
		},
		get defaultPrevented() {
			return defaultPrevented;
		},
		get propagationStopped() {
			return propagationStopped;
		},
	};
}

function createCanvasView(containerEl, selection) {
	return {
		getViewType: () => "canvas",
		containerEl,
		canvas: { selection },
	};
}

test("preserves native copy and cut and pastes a text card without clipboard MIME data", () => {
	const dom = new JSDOM("<div class='canvas'><div class='canvas-node'></div></div><div class='editor'><div class='cm-content'></div></div>");
	const document = dom.window.document;
	const canvasContainer = document.querySelector(".canvas");
	const canvasNode = document.querySelector(".canvas-node");
	const editorContainer = document.querySelector(".editor");
	const editorContent = document.querySelector(".cm-content");
	const replacements = [];
	const markdownView = {
		containerEl: editorContainer,
		editor: { replaceSelection: (text) => replacements.push(text) },
	};
	const canvasView = createCanvasView(canvasContainer, new Set([
		{ getData: () => ({ type: "text", text: "# Card\n\nBody" }) },
	]));

	for (const type of ["copy", "cut"]) {
		const clipboardEvent = createEvent(canvasNode, type);
		assert.equal(handleCanvasCardClipboardEvent(clipboardEvent, document, canvasView), true);
		assert.equal(clipboardEvent.defaultPrevented, false);

		const paste = createEvent(editorContent, "paste", false);
		assert.equal(handleCardMarkdownPaste(paste, document, markdownView), true);
		assert.equal(paste.defaultPrevented, true);
		assert.equal(paste.propagationStopped, true);
		assert.equal(handleCardMarkdownPaste(createEvent(editorContent), document, markdownView), false);
	}

	assert.deepEqual(replacements, ["# Card\n\nBody", "# Card\n\nBody"]);
	clearPendingCanvasMarkdown(document);
	dom.window.close();
});

test("ignores multi-card and non-text selections", () => {
	const dom = new JSDOM("<div class='canvas'><div class='canvas-node'></div></div><div class='editor'><div class='cm-content'></div></div>");
	const document = dom.window.document;
	const canvasContainer = document.querySelector(".canvas");
	const canvasNode = document.querySelector(".canvas-node");
	const editorContainer = document.querySelector(".editor");
	const markdownView = {
		containerEl: editorContainer,
		editor: { replaceSelection: () => assert.fail("unsupported selection was pasted") },
	};
	const textNode = { getData: () => ({ type: "text", text: "one" }) };

	assert.equal(handleCanvasCardClipboardEvent(createEvent(canvasNode, "copy"), document, createCanvasView(
		canvasContainer,
		new Set([textNode, { getData: () => ({ type: "text", text: "two" }) }]),
	)), false);
	assert.equal(handleCardMarkdownPaste(createEvent(editorContainer.querySelector(".cm-content")), document, markdownView), false);

	assert.equal(handleCanvasCardClipboardEvent(createEvent(canvasNode, "cut"), document, createCanvasView(
		canvasContainer,
		new Set([{ getData: () => ({ type: "file", file: "note.md" }) }]),
	)), false);
	assert.equal(handleCardMarkdownPaste(createEvent(editorContainer.querySelector(".cm-content")), document, markdownView), false);
	dom.window.close();
});

test("clears pending Markdown after a non-editor paste or an already-handled clipboard event", () => {
	const dom = new JSDOM("<div class='canvas'><div class='canvas-node'></div></div><div class='editor'><div class='cm-content'></div></div>");
	const document = dom.window.document;
	const canvasContainer = document.querySelector(".canvas");
	const canvasNode = document.querySelector(".canvas-node");
	const editorContainer = document.querySelector(".editor");
	const editorContent = document.querySelector(".cm-content");
	const markdownView = {
		containerEl: editorContainer,
		editor: { replaceSelection: () => assert.fail("stale card Markdown was consumed") },
	};
	const canvasView = createCanvasView(canvasContainer, new Set([
		{ getData: () => ({ type: "text", text: "stale" }) },
	]));

	assert.equal(handleCanvasCardClipboardEvent(createEvent(canvasNode, "copy"), document, canvasView), true);
	assert.equal(handleCardMarkdownPaste(createEvent(canvasContainer), document, markdownView), false);
	assert.equal(handleCardMarkdownPaste(createEvent(editorContent), document, markdownView), false);

	assert.equal(handleCanvasCardClipboardEvent(createEvent(canvasNode, "copy"), document, canvasView), true);
	const handledCut = createEvent(canvasNode, "cut");
	handledCut.preventDefault();
	assert.equal(handleCanvasCardClipboardEvent(handledCut, document, canvasView), false);
	assert.equal(handleCardMarkdownPaste(createEvent(editorContent), document, markdownView), false);

	clearPendingCanvasMarkdown(document);
	dom.window.close();
});

test("pastes a copied Canvas text card into another Canvas text card editor (card-to-card)", () => {
	const dom = new JSDOM(`
		<div class='canvas'>
			<div class='canvas-node source'></div>
			<div class='canvas-node target'><div class='cm-content'></div></div>
		</div>
	`);
	const document = dom.window.document;
	const canvasContainer = document.querySelector(".canvas");
	const sourceNodeEl = document.querySelector(".source");
	const targetNodeEl = document.querySelector(".target");
	const targetCmContent = targetNodeEl.querySelector(".cm-content");
	const cardReplacements = [];
	let pastedCallbackNode = null;

	const sourceNode = {
		nodeEl: sourceNodeEl,
		getData: () => ({ type: "text", text: "# Source Card\n\n$E=mc^2$" }),
	};
	const targetNode = {
		nodeEl: targetNodeEl,
		getData: () => ({ type: "text", text: "" }),
		child: {
			editor: {
				replaceSelection: (text) => cardReplacements.push(text),
			},
		},
	};
	const canvasView = {
		getViewType: () => "canvas",
		containerEl: canvasContainer,
		canvas: {
			selection: new Set([sourceNode]),
			nodes: new Map([
				["source", sourceNode],
				["target", targetNode],
			]),
		},
	};

	assert.equal(handleCanvasCardClipboardEvent(createEvent(sourceNodeEl, "copy"), document, canvasView), true);

	const paste = createEvent(targetCmContent, "paste", false);
	assert.equal(
		handleCardMarkdownPaste(paste, document, null, canvasView, (node) => {
			pastedCallbackNode = node;
		}),
		true,
	);
	assert.equal(paste.defaultPrevented, true);
	assert.equal(paste.propagationStopped, true);
	assert.deepEqual(cardReplacements, ["# Source Card\n\n$E=mc^2$"]);
	assert.equal(pastedCallbackNode, targetNode);
	assert.equal(handleCardMarkdownPaste(createEvent(targetCmContent), document, null, canvasView), false);

	clearPendingCanvasMarkdown(document);
	dom.window.close();
});
