import * as vscode from 'vscode';
import { Generator } from './generator';
import { getNonce } from './webview/utils';
import { saveSVG, saveJSON, saveDot, saveMermaid, saveHTML } from './webview/exporters';
import { handleGotoDefinition } from './webview/navigation';

export class CallGraphPanel {
	public static readonly viewType = 'crabviz.callgraph';

	public static currentPanel: CallGraphPanel | null = null;
	private static num = 1;

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	private static _currentGenerator: Generator | null = null;

	public constructor(extensionUri: vscode.Uri) {
		this._extensionUri = extensionUri;

		const panel = vscode.window.createWebviewPanel(CallGraphPanel.viewType, `Crabviz #${CallGraphPanel.num}`, vscode.ViewColumn.One, {
			localResourceRoots: [
				vscode.Uri.joinPath(this._extensionUri, 'out'),
			],
			enableScripts: true
		});

		panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg');

		this._panel = panel;

		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'saveSVG':
						saveSVG(message.svg);
						break;
					case 'saveJSON':
						saveJSON(CallGraphPanel._currentGenerator);
						break;
					case 'exportDot':
						saveDot(CallGraphPanel._currentGenerator);
						break;
					case 'exportMermaid':
						saveMermaid(CallGraphPanel._currentGenerator);
						break;
					case 'exportHTML':
						saveHTML(message.svg);
						break;
					case 'gotoDefinition':
						handleGotoDefinition(message.filePath, message.line, message.character);
						break;
				}
			},
			null,
			this._disposables
		);

		this._panel.onDidChangeViewState(
			e => {
				if (panel.active) {
					CallGraphPanel.currentPanel = this;
				} else if (CallGraphPanel.currentPanel !== this) {
					return;
				} else {
					CallGraphPanel.currentPanel = null;
				}
			},
			null,
			this._disposables
		);

		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		CallGraphPanel.num += 1;
	}

	public dispose() {
		if (CallGraphPanel.currentPanel === this) {
			CallGraphPanel.currentPanel = null;
		}

		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	public showCallGraph(svg: string, focusMode: boolean) {
		CallGraphPanel.currentPanel = this;

		const nonce = getNonce();
		const webview = this._panel.webview;

		this._panel.webview.html = `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval'; img-src ${webview.cspSource} data:;">
				<title>Crabviz Call Graph</title>
				<style>
					:root {
						--color-scheme: light;
						--palette-hue: 180;
						--palette-chroma: 0.89;
						--primary: oklch(0.6 0.15 180);
						--primary-light: oklch(0.75 0.15 180);
						--primary-dark: oklch(0.45 0.15 180);
						--text-color-1: oklch(0.15 0.02 180);
						--text-color-2: oklch(0.35 0.02 180);
						--surface-default: oklch(0.98 0.01 180);
						--surface-filled: oklch(0.95 0.01 180);
						--surface-elevated: oklch(0.98 0.01 180);
						--border-color: oklch(0.85 0.02 180);
						--button-bg: oklch(0.97 0.01 180);
						--button-border: oklch(0.75 0.1 210);
						--button-text: oklch(0.45 0.15 210);
						--button-hover: oklch(0.92 0.05 210);
						--button-active: oklch(0.88 0.08 210);
						
						/* Graph color scheme from crabviz-ref */
						--background-color: #f5fffa;
						--selected-color: #4fe1f4;
						--edge-color: #548f9e;
						--edge-incoming-color: #698b69;
						--edge-outgoing-color: #008acd;
						--edge-incoming-outgoing-color: #2c3e50;
						--cluster-label-bg-color: #f8f9fa;
						--node-bg-color: #f4f5f1;
						--symbol-default-bg-color: var(--node-bg-color);
						--symbol-default-border-color: #6c757d;
						--symbol-default-text-color: #363636;
						--interface-bg-color: #fff8dc;
						--interface-border-color: #a69348;
						--module-bg-color: #ffebcd;
						--module-border-color: #a67e43;
						--constructor-bg-color: #ffdab9;
						--constructor-border-color: #a66e3c;
						--method-bg-color: #fff8c5;
						--method-border-color: #d4a72c;
						--function-bg-color: #e8f5e8;
						--function-border-color: #7cb342;
						--struct-bg-color: #ddf4ff;
						--struct-border-color: #54aeff;
						--type-icon-color: #8969da;
						--property-icon-color: #5f9348;
					}
					
					@media (prefers-color-scheme: dark) {
						:root {
							--color-scheme: dark;
							--text-color-1: oklch(0.95 0.01 180);
							--text-color-2: oklch(0.75 0.02 180);
							--surface-default: oklch(0.15 0.02 180);
							--surface-filled: oklch(0.12 0.02 180);
							--surface-elevated: oklch(0.18 0.02 180);
							--border-color: oklch(0.25 0.02 180);
							--button-bg: oklch(0.2 0.02 180);
							--button-border: oklch(0.4 0.1 210);
							--button-text: oklch(0.7 0.15 210);
							--button-hover: oklch(0.25 0.05 210);
							--button-active: oklch(0.3 0.08 210);
							
							/* Dark theme graph colors */
							--background-color: #1a1a1a;
							--node-bg-color: #2d2d2d;
							--symbol-default-bg-color: var(--node-bg-color);
							--symbol-default-text-color: #e0e0e0;
							--cluster-label-bg-color: #3a3a3a;
						}
					}
					
					body {
						margin: 0;
						padding: 0;
						background: var(--surface-default);
						color: var(--text-color-1);
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						height: 100vh;
						overflow: hidden;
						color-scheme: var(--color-scheme);
					}
					
					.toolbar {
						height: 56px;
						width: 100%;
						flex-shrink: 0;
						display: flex;
						justify-content: center;
						align-items: center;
						gap: 10px;
						border-bottom: 1px solid var(--border-color);
						background: var(--surface-elevated);
						padding: 0 15px;
					}
					
					.search-container {
						display: flex;
						align-items: center;
						gap: 8px;
						flex: 1;
						max-width: 400px;
					}
					
					.export-container {
						display: flex;
						align-items: center;
						gap: 8px;
					}
					
					#search-input {
						padding: 8px 12px;
						border: 1px solid var(--border-color);
						border-radius: 6px;
						background: var(--surface-filled);
						color: var(--text-color-1);
						font-size: 14px;
						min-width: 250px;
						outline: none;
						transition: border-color 0.2s ease, box-shadow 0.2s ease;
					}
					
					#search-input:focus {
						border-color: var(--primary);
						box-shadow: 0 0 0 2px oklch(from var(--primary) l c h / 0.2);
					}
					
					button {
						-webkit-tap-highlight-color: transparent;
						-webkit-touch-callout: none;
						align-items: center;
						background: var(--button-bg);
						border-radius: 6px;
						border: 1px solid var(--button-border);
						color: var(--button-text);
						display: inline-flex;
						font-size: 13px;
						font-weight: 600;
						gap: 6px;
						justify-content: center;
						min-height: 38px;
						padding: 8px 16px;
						text-align: center;
						text-decoration: none;
						user-select: none;
						cursor: pointer;
						transition: all 0.2s ease;
					}
					
					button:hover {
						background: var(--button-hover);
						transform: translateY(-1px);
						box-shadow: 0 2px 8px oklch(from var(--primary) l c h / 0.15);
					}
					
					button:active {
						background: var(--button-active);
						transform: translateY(0);
						box-shadow: 0 1px 3px oklch(from var(--primary) l c h / 0.2);
					}
					
					.graph-container {
						height: calc(100vh - 56px);
						overflow: auto;
						padding: 20px;
						background: var(--background-color);
					}
					
					svg {
						max-width: 100%;
						height: auto;
						filter: drop-shadow(0 2px 8px oklch(from var(--primary) l c h / 0.1));
					}
					
					/* Graph interaction styles from crabviz-ref */
					.callgraph {
						--bold-border: 3.2;
						width: 100%;
						height: 100%;
						outline: none;
						cursor: default;
						user-select: none;
					}
					
					.callgraph > #graph0 > polygon:first-of-type {
						fill: var(--background-color);
					}
					
					.callgraph > #graph0 > #faded-group > .node,
					.callgraph > #graph0 > #faded-group > .cluster {
						opacity: 0.2;
					}
					
					.callgraph > #graph0 > #faded-group > .edge {
						opacity: 0.05;
					}
					
					/* Edge styles */
					.edge > path:not(.hover-path) {
						stroke: var(--edge-color);
						stroke-width: 3;
					}
					
					.edge > polygon {
						stroke: var(--edge-color);
						fill: var(--edge-color);
					}
					
					.edge > path.hover-path {
						stroke: transparent;
						stroke-width: 15;
					}
					
					.edge:hover {
						--edge-color: var(--selected-color);
					}
					
					.edge.incoming {
						--edge-color: var(--edge-incoming-color);
					}
					
					.edge.outgoing {
						--edge-color: var(--edge-outgoing-color);
					}
					
					.edge.incoming.outgoing {
						--edge-color: var(--edge-incoming-outgoing-color);
					}
					
					/* Node styles */
					.node > rect {
						rx: 20px;
						fill: var(--node-bg-color);
						filter: url(#shadow);
					}
					
					.node.selected > rect {
						stroke: var(--selected-color);
						stroke-width: var(--bold-border);
					}
					
					.node > .title {
						cursor: pointer;
					}
					
					.node > .title > text {
						font-weight: bold;
					}
					
					/* Cell (symbol) styles */
					.cell {
						--bg-color: var(--symbol-default-bg-color);
						--border-color: var(--symbol-default-border-color);
						--border-width: 1.6;
						cursor: pointer;
					}
					
					.cell > rect {
						rx: 10px;
						fill: var(--bg-color);
						stroke: var(--border-color);
						stroke-width: var(--border-width);
					}
					
					.cell > text {
						fill: var(--symbol-default-text-color);
					}
					
					.cell:hover,
					.cell.selected {
						--border-width: var(--bold-border);
					}
					
					.cell.selected > rect {
						filter: drop-shadow(3px 3px 6px var(--border-color));
						stroke: var(--selected-color);
						stroke-width: 3;
					}
					
					.cell.selected > text {
						font-weight: bold;
						fill: var(--selected-color);
					}
					
					/* Symbol type specific styles */
					.cell.interface {
						--bg-color: var(--interface-bg-color);
						--border-color: var(--interface-border-color);
					}
					
					.cell.interface > rect {
						stroke-dasharray: 7, 5;
					}
					
					.cell.module {
						--bg-color: var(--module-bg-color);
						--border-color: var(--module-border-color);
					}
					
					.cell.constructor {
						--bg-color: var(--constructor-bg-color);
						--border-color: var(--constructor-border-color);
					}
					
					.cell.function {
						--bg-color: var(--function-bg-color);
						--border-color: var(--function-border-color);
					}
					
					.cell.method {
						--bg-color: var(--method-bg-color);
						--border-color: var(--method-border-color);
					}
					
					.cell.class,
					.cell.struct,
					.cell.enum {
						--bg-color: var(--struct-bg-color);
						--border-color: var(--struct-border-color);
					}
					
					.cell.class > rect,
					.cell.struct > rect,
					.cell.enum > rect {
						rx: unset;
					}
					
					.cell.class > text:first-of-type,
					.cell.struct > text:first-of-type,
					.cell.enum > text:first-of-type {
						fill: var(--type-icon-color);
						transform: translateY(1.5px);
					}
					
					.cell.field > rect,
					.cell.property > rect {
						rx: unset;
					}
					
					.cell.field > text:first-of-type,
					.cell.property > text:first-of-type {
						font-style: italic;
						fill: var(--property-icon-color);
					}
					
					/* Cluster styles */
					.cluster polygon {
						stroke-width: 1.6;
					}
					
					.cluster .cluster-label {
						cursor: pointer;
						fill: var(--cluster-label-bg-color);
						rx: 18px;
					}
					
					.cluster text {
						pointer-events: none;
					}
					
					.cluster.selected polygon {
						stroke-width: var(--bold-border);
						stroke: var(--selected-color);
					}
					
					.cluster.selected .cluster-label {
						fill: color-mix(in srgb, var(--selected-color) 30%, transparent);
					}
					
					.search-highlight {
						background-color: oklch(0.85 0.15 60) !important;
						color: oklch(0.2 0.1 60) !important;
						border-radius: 4px;
						padding: 2px 6px;
						box-shadow: 0 0 8px oklch(0.85 0.15 60 / 0.4);
						transition: all 0.3s ease;
						animation: highlight-pulse 0.6s ease-out;
					}
					
					@keyframes highlight-pulse {
						0% { transform: scale(1); }
						50% { transform: scale(1.05); }
						100% { transform: scale(1); }
					}
				</style>
			</head>
			<body>
				<div class="toolbar">
					<div class="search-container">
						<input type="text" id="search-input" placeholder="Search symbols and files..." />
						<button id="search-btn" title="Search">🔍</button>
						<button id="clear-search-btn" title="Clear search">✕</button>
					</div>
					<div class="export-container">
						<button id="export-svg-btn" title="Export as SVG">📄 SVG</button>
						<button id="export-json-btn" title="Export as JSON">📋 JSON</button>
						<button id="export-dot-btn" title="Export as DOT">🔗 DOT</button>
						<button id="export-mermaid-btn" title="Export as Mermaid">🧜 Mermaid</button>
						<button id="export-html-btn" title="Export as HTML">🌐 HTML</button>
					</div>
				</div>
				<div class="graph-container">
					${svg}
				</div>
				<script nonce="${nonce}">
					const vscode = acquireVsCodeApi();
					
					// Search functionality
					const searchInput = document.getElementById('search-input');
					const searchBtn = document.getElementById('search-btn');
					const clearBtn = document.getElementById('clear-search-btn');
					
					function performSearch(query) {
						if (!query.trim()) {
							clearSearchHighlights();
							return;
						}
						
						const svgElement = document.querySelector('svg');
						if (!svgElement) return;
						
						const textElements = svgElement.querySelectorAll('text');
						textElements.forEach(element => {
							const text = element.textContent.toLowerCase();
							if (text.includes(query.toLowerCase())) {
								element.classList.add('search-highlight');
							}
						});
					}
					
					function clearSearchHighlights() {
						const highlightedElements = document.querySelectorAll('.search-highlight');
						highlightedElements.forEach(element => {
							element.classList.remove('search-highlight');
						});
					}
					
					// Event listeners
					searchBtn.addEventListener('click', () => {
						performSearch(searchInput.value);
					});
					
					clearBtn.addEventListener('click', () => {
						searchInput.value = '';
						clearSearchHighlights();
					});
					
					searchInput.addEventListener('keydown', (e) => {
						if (e.key === 'Enter') {
							performSearch(searchInput.value);
						}
						if (e.key === 'Escape') {
							searchInput.value = '';
							clearSearchHighlights();
						}
					});
					
					// Export buttons
					document.getElementById('export-svg-btn').addEventListener('click', () => {
						const svgElement = document.querySelector('svg');
						const svgContent = svgElement ? svgElement.outerHTML : '';
						vscode.postMessage({ command: 'saveSVG', svg: svgContent });
					});
					
					document.getElementById('export-json-btn').addEventListener('click', () => {
						vscode.postMessage({ command: 'saveJSON' });
					});
					
					document.getElementById('export-dot-btn').addEventListener('click', () => {
						vscode.postMessage({ command: 'exportDot' });
					});
					
					document.getElementById('export-mermaid-btn').addEventListener('click', () => {
						vscode.postMessage({ command: 'exportMermaid' });
					});
					
					document.getElementById('export-html-btn').addEventListener('click', () => {
						const svgElement = document.querySelector('svg');
						const svgContent = svgElement ? svgElement.outerHTML : '';
						vscode.postMessage({ command: 'exportHTML', svg: svgContent });
					});
					
					// Keyboard shortcut for search (Ctrl+F)
					document.addEventListener('keydown', (e) => {
						if (e.ctrlKey && e.key === 'f') {
							e.preventDefault();
							searchInput.focus();
						}
					});
					
					// Post-process SVG to add data attributes for edges and nodes
					function addDataAttributes(svg) {
						console.log('[SVG Post-processing] Adding data attributes');
						
						// Process edges
						const edges = svg.querySelectorAll('g.edge');
						console.log('[SVG Post-processing] Found edges:', edges.length);
						
						edges.forEach(edge => {
							const id = edge.id;
							if (id && id.includes(' -> ')) {
								const [from, to] = id.split(' -> ');
								edge.setAttribute('data-from', from);
								edge.setAttribute('data-to', to);
								console.log('[SVG Post-processing] Added attributes to edge:', { id, from, to });
							}
						});
						
						// Process nodes - convert HREF to data-path
						const links = svg.querySelectorAll('a');
						console.log('[SVG Post-processing] Found links:', links.length);
						
						links.forEach(a => {
							const href = a.href.baseVal;
							const g = a.parentNode;
							
							// Replace the <a> element with its children
							a.replaceWith(...a.childNodes);
							g.id = g.id.replace(/^a_/, '');
							
							// Check if href is a file path (not a symbol kind number)
							const kind = parseInt(href);
							if (isNaN(kind) && href !== 'remove_me_url.title') {
								g.classList.add('title');
								const node = g.closest('.node');
								if (node) {
									node.setAttribute('data-path', href);
									console.log('[SVG Post-processing] Added data-path to node:', { nodeId: node.id, path: href });
								}
							} else if (!isNaN(kind)) {
								g.setAttribute('data-kind', kind.toString());
								g.classList.add('cell');
							}
						});
					}
						
						// Graph interaction logic from crabviz-ref
						class CallGraphInteraction {
							constructor(svg, focus = null, onSelectElem = null) {
								this.svg = svg;
								this.nodes = svg.querySelectorAll('g.node');
								this.edges = svg.querySelectorAll('g.edge');
								this.clusters = svg.querySelectorAll('g.cluster');
								this.width = this.svg.viewBox.baseVal.width;
								this.height = this.svg.viewBox.baseVal.height;
								this.selectedElem = null;
								this.setupInteraction(onSelectElem || this.onSelectElem.bind(this));
								this.setupFadedGroup();
								
								this.focus = focus;
								if (focus) {
									const incomings = new Map();
									const outgoings = new Map();
									
									this.edges.forEach((edge) => {
									const fromCell = edge.dataset.from;
									const toCell = edge.dataset.to;
										
										if (toCell) {
											if (incomings.has(toCell)) {
												incomings.get(toCell).push(edge);
											} else {
												incomings.set(toCell, [edge]);
											}
										}
										if (fromCell) {
											if (outgoings.has(fromCell)) {
												outgoings.get(fromCell).push(edge);
											} else {
												outgoings.set(fromCell, [edge]);
											}
										}
									});
									
									this.incomings = incomings;
								this.outgoings = outgoings;
							}
							
							// Initialize pan and zoom
							this.setupPanZoom();
						}
						
						setupFadedGroup() {
							const fadedGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
							fadedGroup.id = 'faded-group';
							const graph0 = this.svg.getElementById('graph0');
							if (graph0) {
								graph0.appendChild(fadedGroup);
							}
							
							// Add shadow filter and gradient definitions
							const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
							defs.innerHTML = '<filter id="shadow"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-opacity="0.5"/></filter><linearGradient id="highlightGradient"><stop offset="0%" stop-color="var(--edge-incoming-color)" /><stop offset="100%" stop-color="var(--edge-outgoing-color)" /></linearGradient>';
							this.svg.appendChild(defs);
						}
						
						setupInteraction(onSelectElem) {
							const svg = this.svg;
							let clickPoint = [0, 0];
							
							svg.onmousedown = function (e) {
								clickPoint = [e.pageX, e.pageY];
							};
							
							svg.onmouseup = function (e) {
								const delta = 6;
								const [x, y] = clickPoint;
								const diffX = Math.abs(e.pageX - x);
								const diffY = Math.abs(e.pageY - y);
								
								if (diffX > delta || diffY > delta) {
									// a mouse drag event
									return;
								}
								
								for (
									let elem = e.target;
									elem && elem instanceof SVGElement && elem !== svg;
									elem = elem.parentNode
								) {
									const classes = elem.classList;
									if (
										classes.contains('node') ||
										classes.contains('cell') ||
										classes.contains('edge') ||
										classes.contains('cluster-label')
									) {
										onSelectElem(elem);
										return;
									}
								}
								onSelectElem(null);
							};
						}
						
						setupPanZoom() {
						this.panZoomState = this.createPanZoomState();
					}
						
						createPanZoomState() {
							const g0 = this.svg.querySelector('#graph0');
							if (!g0) return null;
							
							// Simple pan/zoom implementation without external library
							let scale = 1;
							let translateX = 0;
							let translateY = 0;
							let isDragging = false;
							let lastX = 0;
							let lastY = 0;
							
							const updateTransform = () => {
								g0.style.transform = 'translate(' + translateX + 'px, ' + translateY + 'px) scale(' + scale + ')';
							};
							
							// Mouse wheel zoom
							this.svg.addEventListener('wheel', (e) => {
								e.preventDefault();
								const delta = e.deltaY > 0 ? 0.9 : 1.1;
								scale *= delta;
								scale = Math.max(0.1, Math.min(5, scale));
								updateTransform();
							});
							
							// Mouse drag pan
							this.svg.addEventListener('mousedown', (e) => {
								if (e.button === 1 || e.ctrlKey) { // Middle button or Ctrl+click
									isDragging = true;
									lastX = e.clientX;
									lastY = e.clientY;
									e.preventDefault();
								}
							});
							
							document.addEventListener('mousemove', (e) => {
								if (isDragging) {
									const deltaX = e.clientX - lastX;
									const deltaY = e.clientY - lastY;
									translateX += deltaX;
									translateY += deltaY;
									lastX = e.clientX;
									lastY = e.clientY;
									updateTransform();
								}
							});
							
							document.addEventListener('mouseup', () => {
								isDragging = false;
							});
							
							const cRect = g0.getBoundingClientRect();
							const cx = cRect.x + cRect.width / 2;
							const cy = cRect.y + cRect.height / 2;
							const sRect = this.svg.getBoundingClientRect();
							
							return {
								scale,
								x: translateX,
								y: translateY,
								cx,
								cy,
								sRect,
								smoothZoom: (cx, cy, newScale) => {
									scale = newScale;
									updateTransform();
								},
								centerOn: (elem) => {
									const rect = elem.getBoundingClientRect();
									const svgRect = this.svg.getBoundingClientRect();
									translateX = svgRect.width / 2 - (rect.x + rect.width / 2 - svgRect.x);
									translateY = svgRect.height / 2 - (rect.y + rect.height / 2 - svgRect.y);
									updateTransform();
								},
								moveTo: (x, y) => {
									translateX = x;
									translateY = y;
									updateTransform();
								},
								zoomAbs: (x, y, newScale) => {
									scale = newScale;
									updateTransform();
								}
							};
						}
						
						smoothZoom(newScale) {
							if (!this.panZoomState) return;
							const { cx, cy } = this.panZoomState;
							this.panZoomState.smoothZoom(cx, cy, newScale);
						}
						
						resetPanZoom() {
							if (!this.panZoomState) return;
							const { x, y, scale } = this.panZoomState;
							this.panZoomState.moveTo(x, y);
							this.panZoomState.zoomAbs(x, y, scale);
						}
						
						onSelectElem(elem) {
							console.log('[CallGraphInteraction] onSelectElem called with:', elem);
							this.resetStyles();
							this.selectedElem = elem;
							
							if (!elem) {
								console.log('[CallGraphInteraction] No element selected, returning');
								return;
							}
							
							// Auto-center on selected element if needed
							if (this.panZoomState) {
								const { sRect } = this.panZoomState;
								const eRect = elem.getBoundingClientRect();
								if (
									eRect.left < sRect.left ||
									eRect.top < sRect.top ||
									eRect.right > sRect.right ||
									eRect.bottom > sRect.bottom
								) {
									this.panZoomState.centerOn(elem);
								}
							}
							
							const classes = elem.classList;
							console.log('[CallGraphInteraction] Element classes:', Array.from(classes));
							if (classes.contains('node')) {
								console.log('[CallGraphInteraction] Calling onSelectNode');
								this.onSelectNode(elem);
							} else if (classes.contains('cell')) {
								console.log('[CallGraphInteraction] Calling onSelectCell');
								this.onSelectCell(elem);
							} else if (classes.contains('edge')) {
								console.log('[CallGraphInteraction] Calling onSelectEdge');
								this.onSelectEdge(elem);
							} else if (classes.contains('cluster-label')) {
								console.log('[CallGraphInteraction] Calling onSelectCluster');
								this.onSelectCluster(elem);
							} else {
								console.log('[CallGraphInteraction] No matching element type found');
							}
							
							// Call the selection callback if it exists
							if (this.onElementSelected) {
								this.onElementSelected(elem);
							}
						}
						

						
						onSelectNode(node) {
							const id = node.id;
							console.log('[CallGraphInteraction] onSelectNode called with id:', id);
							console.log('[CallGraphInteraction] Total edges found:', this.edges.length);
							
							this.highlightEdges((edge) => {
								const incoming = edge.dataset.to && edge.dataset.to.startsWith(id + ':');
								const outgoing = edge.dataset.from && edge.dataset.from.startsWith(id + ':');
								if (incoming || outgoing) {
									console.log('[CallGraphInteraction] Edge match found:', {
										edge: edge,
										datafrom: edge.dataset.from,
										datato: edge.dataset.to,
										incoming,
										outgoing
									});
								}
								return [incoming, outgoing];
							});
							
							node.classList.add('selected');
							this.fadeOutNodes(new Set([id]));
						}
						
						onSelectCell(cell) {
							const id = cell.id;
							
							if (this.focus) {
								this.onSelectCellInFocusMode(id);
							} else {
								const cellIds = new Set([cell.id]);
								cell.querySelectorAll('.cell').forEach((c) => {
									cellIds.add(c.id);
								});
								
								this.highlightEdges((edge) => [
									cellIds.has(edge.dataset.to),
									cellIds.has(edge.dataset.from)
								]);
							}
							
							cell.classList.add('selected');
							this.fadeOutNodes(new Set([this.getNodeId(cell.id)]));
						}
						
						onSelectCellInFocusMode(cellId) {
							const highlights = [new Set(), new Set()];
							const inout = [this.incomings, this.outgoings];
							
							for (let i = 0; i < inout.length; ++i) {
								const visited = new Set([cellId, this.focus]);
								const map = inout[i];
								const highlightEdges = highlights[i];
								
								for (let newEdges = map.get(cellId) || []; newEdges.length > 0; ) {
									newEdges = newEdges.flatMap((edge) => {
										highlightEdges.add(edge);
										
										const id = i == 0 ? edge.dataset.from : edge.dataset.to;
										if (visited.has(id)) {
											return [];
										}
										
										visited.add(id);
										return map.get(id) || [];
									});
								}
							}
							
							this.highlightEdges((edge) => [
								highlights[0].has(edge),
								highlights[1].has(edge),
							]);
							
							this.fadeOutNodes(new Set([this.getNodeId(cellId)]));
						}
						
						onSelectEdge(edge) {
							const g0 = this.svg.getElementById('graph0');
							const fadedGroup = this.svg.getElementById('faded-group');
							
							fadedGroup.append(...this.edges);
							g0.appendChild(edge);
							
							this.fadeOutNodes();
						}
						
						onSelectCluster(clusterLabel) {
							const cluster = clusterLabel.parentNode;
							const rect = cluster.getBoundingClientRect();
							
							cluster.classList.add('selected');
							
							const selected = new Set();
							this.nodes.forEach((node) => {
								if (this.rectContains(rect, node.getBoundingClientRect())) {
									selected.add(node.id);
								}
							});
							
							this.highlightEdges((edge) => [
								selected.has(this.getNodeId(edge.dataset.to)),
								selected.has(this.getNodeId(edge.dataset.from)),
							]);
							
							this.fadeOutNodes(selected);
						}
						
						highlightEdges(judge) {
							const fadedGroup = this.svg.getElementById('faded-group');
							console.log('[CallGraphInteraction] highlightEdges called, fadedGroup:', fadedGroup);
							
							let highlightedCount = 0;
							let fadedCount = 0;
							
							for (const edge of this.edges) {
								const [incoming, outgoing] = judge(edge);
								if (incoming) {
									edge.classList.add('incoming');
									highlightedCount++;
								}
								if (outgoing) {
									edge.classList.add('outgoing');
									highlightedCount++;
								}
								
								if (!(incoming || outgoing)) {
									fadedGroup.appendChild(edge);
									fadedCount++;
								}
							}
							
							console.log('[CallGraphInteraction] Highlight summary:', {
								totalEdges: this.edges.length,
								highlightedCount,
								fadedCount
							});
						}
						
						fadeOutNodes(kept = new Set()) {
							const fadedGroup = this.svg.getElementById('faded-group');
							
							for (const edge of this.edges) {
								if (edge.parentElement === fadedGroup) {
									continue;
								}
								
								if (edge.dataset.from) {
									kept.add(this.getNodeId(edge.dataset.from));
								}
								if (edge.dataset.to) {
									kept.add(this.getNodeId(edge.dataset.to));
								}
							}
							
							const clusters = new Set(this.clusters);
							
							for (const node of this.nodes) {
								if (!kept.has(node.id)) {
									fadedGroup.appendChild(node);
									continue;
								}
								
								const rect = node.getBoundingClientRect();
								for (const cluster of clusters) {
									if (this.rectContains(cluster.getBoundingClientRect(), rect)) {
										clusters.delete(cluster);
									}
								}
							}
							
							fadedGroup.append(...clusters);
						}
						
						getNodeId(id) {
							const colonIndex = id.indexOf(':');
							return colonIndex > 0 ? id.substring(0, colonIndex) : id;
						}
						
						rectContains(rect1, rect2) {
							return (
								rect1.left < rect2.left &&
								rect1.right > rect2.right &&
								rect1.bottom > rect2.bottom &&
								rect1.top < rect2.top
							);
						}
						
						resetStyles() {
						const g0 = this.svg.getElementById('graph0');
						const fadedGroup = this.svg.getElementById('faded-group');
						
						this.selectedElem?.closest('.selected')?.classList.remove('selected');
						g0.querySelectorAll(':scope > .edge').forEach((edge) =>
							edge.classList.remove('incoming', 'outgoing')
						);
						
						const firstNode = g0.querySelector('.node');
						for (const cluster of fadedGroup.querySelectorAll('.cluster')) {
							g0.insertBefore(cluster, firstNode);
						}
						for (const node of fadedGroup.querySelectorAll('.node')) {
							g0.insertBefore(node, firstNode);
						}
						
						// Move faded edges back to main graph
						for (const edge of Array.from(fadedGroup.querySelectorAll('.edge'))) {
							g0.appendChild(edge);
						}
					}
					}
					
					// Initialize graph interaction with enhanced features
						const svgElement = document.querySelector('svg');
						if (svgElement) {
							svgElement.classList.add('callgraph');
							
							// Add data attributes to edges and nodes for interaction
						addDataAttributes(svgElement);
							
							const interaction = new CallGraphInteraction(svgElement);
						
						// Enhanced selection callback with search bar integration
						interaction.onElementSelected = (elem) => {
							if (elem) {
								// Auto-fill search input with selected element info
								const searchInput = document.getElementById('search-input');
								if (searchInput && elem.classList.contains('cell')) {
									// For cells, find function name by looking for clickable cell elements
									const clickableCell = elem.querySelector('a[xlink\\:href*="clickable.cell"] text');
									let targetText = '';
									if (clickableCell) {
										// Use the text from clickable cell (function/method name)
										targetText = clickableCell.textContent || '';
									} else {
										// Fallback to the last text element
										const textElements = elem.querySelectorAll('text');
										if (textElements.length > 0) {
											targetText = textElements[textElements.length - 1].textContent || '';
										}
									}
									console.log('[Search] Auto-filling with cell text:', targetText);
									searchInput.value = targetText;
								} else if (searchInput && elem.classList.contains('node')) {
									const titleElement = elem.querySelector('text');
									if (titleElement) {
										console.log('[Search] Auto-filling with node text:', titleElement.textContent);
										searchInput.value = titleElement.textContent || '';
									}
								}
								
								// Add goto definition functionality
								if (elem.classList.contains('cell') || elem.classList.contains('node')) {
									elem.style.cursor = 'pointer';
									elem.addEventListener('dblclick', () => {
										let filePath, line = 0, character = 0;
										
										if (elem.classList.contains('node')) {
											filePath = elem.dataset.path;
										} else {
											const parts = elem.id.split(':');
											if (parts.length > 1) {
												const nodeId = parts[0];
												const nodeElement = document.getElementById(nodeId);
												filePath = nodeElement?.dataset.path;
												
												const coords = parts[1].split('_');
												if (coords.length === 2) {
													line = parseInt(coords[0]) || 0;
													character = parseInt(coords[1]) || 0;
												}
											}
										}
										
										if (filePath) {
											vscode.postMessage({
												command: 'gotoDefinition',
												filePath: filePath,
												line: line,
												character: character
											});
										}
									});
								}
							}
						};
					}
					
					// Enhanced search with element selection
					function performSearchWithSelection(query) {
						if (!query.trim()) {
							clearSearchHighlights();
							return;
						}
						
						const svgElement = document.querySelector('svg');
						if (!svgElement) return;
						
						// Search and highlight matching elements
						const textElements = svgElement.querySelectorAll('text');
						let firstMatch = null;
						
						textElements.forEach(element => {
							const text = element.textContent.toLowerCase();
							if (text.includes(query.toLowerCase())) {
								element.classList.add('search-highlight');
								
								// Auto-select first match
								if (!firstMatch) {
									const parentCell = element.closest('.cell');
									const parentNode = element.closest('.node');
									firstMatch = parentCell || parentNode;
								}
							}
						});
						
						// Auto-select and highlight first match
						if (firstMatch && window.graphInteraction) {
							window.graphInteraction.onSelectElem(firstMatch);
						}
					}
					
					// Store interaction instance globally for search integration
					if (svgElement) {
						window.graphInteraction = interaction;
					}
					
					// Update search event listeners to use enhanced search
					searchBtn.addEventListener('click', () => {
						performSearchWithSelection(searchInput.value);
					});
					
					searchInput.addEventListener('keydown', (e) => {
						if (e.key === 'Enter') {
							performSearchWithSelection(searchInput.value);
						}
						if (e.key === 'Escape') {
							searchInput.value = '';
							clearSearchHighlights();
							if (window.graphInteraction) {
								window.graphInteraction.onSelectElem(null);
							}
						}
					})
				</script>
			</body>
			</html>`;
	}

	public static setCurrentGenerator(generator: Generator) {
		CallGraphPanel._currentGenerator = generator;
	}

	// Export methods for backward compatibility with extension.ts
	public exportSVG() {
		// Trigger SVG export via webview message
		this._panel.webview.postMessage({ command: 'exportSVG' });
	}

	public exportCrabViz() {
		// Legacy method - same as exportSVG
		this.exportSVG();
	}

	public exportJSON() {
		saveJSON(CallGraphPanel._currentGenerator);
	}

	public exportDot() {
		saveDot(CallGraphPanel._currentGenerator);
	}

	public exportMermaid() {
		saveMermaid(CallGraphPanel._currentGenerator);
	}

	public exportHTML() {
		// Trigger HTML export via webview message
		this._panel.webview.postMessage({ command: 'exportHTML' });
	}
}
