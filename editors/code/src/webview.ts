import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { Generator } from './generator';
import { GraphGenerator } from '../crabviz';
import { generateHTMLTemplate } from './export-templates';

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
					case 'exportSVG':
						this.exportSVG();
						break;
					case 'saveSVG':
						this.saveSVG(message.svg);
						break;
					case 'saveJSON':
						this.saveJSON(message.svg);
						break;
					case 'exportHTML':
						this.saveHTML(message.svg);
						break;
					case 'gotoDefinition':
						this.handleGotoDefinition(message.filePath, message.line, message.character);
						break;
					case 'getDotSource':
						this.handleGetDotSource();
						break;
					case 'dotSourceResponse':
						this.saveDotFile(message.dotSource);
						break;
					case 'exportDot':
						this.saveDot();
						break;
					case 'exportMermaid':
						this.saveMermaid();
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
					body {
						margin: 0;
						padding: 0;
						background: var(--vscode-editor-background);
						color: var(--vscode-editor-foreground);
						font-family: var(--vscode-font-family);
						height: 100vh;
						overflow: hidden;
					}
					.toolbar {
						display: flex;
						justify-content: space-between;
						align-items: center;
						padding: 10px 15px;
						background: var(--vscode-editor-background);
						border-bottom: 1px solid var(--vscode-panel-border);
						gap: 15px;
					}
					.search-container {
						display: flex;
						align-items: center;
						gap: 8px;
						flex: 1;
					}
					.export-container {
						display: flex;
						align-items: center;
						gap: 8px;
					}
					#search-input {
						padding: 8px 12px;
						border: 1px solid var(--vscode-input-border);
						border-radius: 3px;
						background: var(--vscode-input-background);
						color: var(--vscode-input-foreground);
						font-size: 13px;
						min-width: 250px;
						outline: none;
					}
					#search-input:focus {
						border-color: var(--vscode-focusBorder);
						box-shadow: 0 0 0 1px var(--vscode-focusBorder);
					}
					button {
						padding: 8px 12px;
						background: var(--vscode-button-background);
						color: var(--vscode-button-foreground);
						border: 1px solid var(--vscode-button-border);
						border-radius: 3px;
						cursor: pointer;
						font-size: 12px;
						margin-left: 4px;
					}
					button:hover {
						background: var(--vscode-button-hoverBackground);
					}
					.graph-container {
						height: calc(100vh - 60px);
						overflow: auto;
						padding: 20px;
					}
					svg {
						max-width: 100%;
						height: auto;
					}
					.search-highlight {
						background-color: #ffeb3b !important;
						color: #000 !important;
						border-radius: 3px;
						padding: 2px 4px;
						box-shadow: 0 0 3px rgba(255, 235, 59, 0.6);
						transition: all 0.2s ease;
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
				</script>
			</body>
			</html>`;
	}

	public exportSVG() {
		this._panel.webview.postMessage({ command: 'exportSVG' });
	}

	public exportCrabViz() {
		this._panel.webview.postMessage({ command: 'exportCrabViz' });
	}

	public exportJSON(){
		console.debug("Exporting JSON metadata");
		this._panel.webview.postMessage({ command: 'saveJSON' });
	}

	public exportDot(){
		console.debug("Exporting DOT file");
		this._panel.webview.postMessage({ command: 'exportDot' });
	}

	public exportMermaid(){
		console.debug("Exporting Mermaid file");
		this._panel.webview.postMessage({ command: 'exportMermaid' });
	}

	public exportHTML(){
		console.debug("Exporting HTML file");
		this._panel.webview.postMessage({ command: 'exportHTML' });
	}

	public saveDot() {
		console.debug("Saving DOT file - button clicked");
		console.debug("Current generator:", CallGraphPanel._currentGenerator);
		if (CallGraphPanel._currentGenerator) {
			console.debug("Generator methods:", Object.getOwnPropertyNames(CallGraphPanel._currentGenerator));
			console.debug("generateDotSource method:", typeof (CallGraphPanel._currentGenerator as any).generateDotSource);
		}
		this.handleGetDotSource();
	}

	private handleGetDotSource() {
		console.debug("handleGetDotSource called");
		if (CallGraphPanel._currentGenerator) {
			try {
				console.debug("Attempting to generate DOT source");
				// Use existing generateDotSource method if available
				const dotSource = (CallGraphPanel._currentGenerator as any).generateDotSource?.() || 'digraph G { }';
				console.debug("Generated DOT source length:", dotSource.length);
				console.debug("DOT source preview:", dotSource.substring(0, 100));
				
				// 直接调用saveDotFile而不是通过消息传递
				this.saveDotFile(dotSource);
			} catch (error) {
				console.error("Error generating DOT source:", error);
				vscode.window.showErrorMessage(`Failed to generate DOT source: ${error}`);
			}
		} else {
			console.debug("No current generator available");
			vscode.window.showErrorMessage('No generator available for DOT export');
		}
	}

	public static setCurrentGenerator(generator: Generator) {
		CallGraphPanel._currentGenerator = generator;
	}

	public saveDotFile(dotSource: string) {
		console.debug("Processing DOT file save");
		if (!dotSource) {
			vscode.window.showErrorMessage('No DOT source available');
			return;
		}

		const writeData = Buffer.from(dotSource, 'utf8');
		
		let defaultPath: string | undefined;
		
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			defaultPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		} else {
			defaultPath = os.homedir();
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const defaultFilePath = path.join(defaultPath, `crabviz-${timestamp}.dot`);

		vscode.window.showSaveDialog({
			saveLabel: "export",
			defaultUri: vscode.Uri.file(defaultFilePath),
			filters: { 'DOT': ['dot'] },
		}).then((fileUri) => {
			if (fileUri) {
				vscode.workspace.fs.writeFile(fileUri, writeData).then(() => {
					vscode.window.showInformationMessage(`DOT file saved to ${fileUri.fsPath}`);
				}, (error) => {
					vscode.window.showErrorMessage(`Failed to save DOT file: ${error.message}`);
				});
			}
		});
	}

	private cleanSVGContent(svg: string): string {
		// 修复SVG内容中的XML字符转义问题
		let cleaned = svg;
		
		// 首先撤销可能的过度转义
		cleaned = cleaned
			.replace(/&quot;/g, '"')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&amp;/g, '&');
		
		// 修复属性值中的特殊字符
		cleaned = cleaned.replace(/([a-zA-Z-]+="[^"]*?)(<|>|&)([^"]*?")/g, (match, before, char, after) => {
			let escapedChar;
			switch (char) {
				case '<':
					escapedChar = '&lt;';
					break;
				case '>':
					escapedChar = '&gt;';
					break;
				case '&':
					escapedChar = '&amp;';
					break;
				default:
					escapedChar = char;
			}
			return before + escapedChar + after;
		});
		
		// 验证SVG是否以正确的XML声明开始
		if (!cleaned.startsWith('<?xml')) {
			cleaned = '<?xml version="1.0" encoding="UTF-8"?>\n' + cleaned;
		}
		
		return cleaned;
	}

	saveJSON(svg: string) {
		console.debug("Saving JSON metadata");
		let json;
		try{
			// Use existing getMetadata method if available, otherwise create basic metadata
			json = (CallGraphPanel._currentGenerator as any)?.getMetadata?.() || { type: 'crabviz-callgraph', timestamp: new Date().toISOString() };
		}catch (e) {
			vscode.window.showErrorMessage(`Failed to get metadata: ${e}`);
			return;
		}
		console.debug("Saving JSON metadata:", json);
		const writeData = Buffer.from(JSON.stringify(json, null, 2), 'utf8');
		
		let defaultPath: string | undefined;
		
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			defaultPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		} else {
			defaultPath = os.homedir();
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const defaultFilePath = path.join(defaultPath, `crabviz-data-${timestamp}.json`);

		vscode.window.showSaveDialog({
			saveLabel: "export",
			defaultUri: vscode.Uri.file(defaultFilePath),
			filters: { 'JSON': ['json'] },
		}).then((fileUri) => {
			if (fileUri) {
				vscode.workspace.fs.writeFile(fileUri, writeData).then(() => {
					vscode.window.showInformationMessage(`JSON file saved to ${fileUri.fsPath}`);
				}, (error) => {
					vscode.window.showErrorMessage(`Failed to save JSON file: ${error.message}`);
				});
			}
		});
	}

	public saveSVG(svg: string) {
		// 清理和修复SVG内容中的XML字符转义问题
		const cleanedSvg = this.cleanSVGContent(svg);
		const writeData = Buffer.from(cleanedSvg, 'utf8');
		
		let defaultPath: string | undefined;
		
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			defaultPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		} else {
			defaultPath = os.homedir();
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const defaultFilePath = path.join(defaultPath, `crabviz-${timestamp}.svg`);
		
		vscode.window.showSaveDialog({
			saveLabel: "export",
			defaultUri: vscode.Uri.file(defaultFilePath),
			filters: { 'Images': ['svg'] },
		}).then((fileUri) => {
			if (fileUri) {
				vscode.workspace.fs.writeFile(fileUri, writeData).then(() => {
					vscode.window.showInformationMessage(`SVG file saved to ${fileUri.fsPath}`);
				}, (error) => {
					vscode.window.showErrorMessage(`Failed to save SVG file: ${error.message}`);
				});
			}
		});
	}

	public saveMermaid() {
		console.debug("Exporting Mermaid file");
		if (!CallGraphPanel._currentGenerator) {
			vscode.window.showErrorMessage('No generator available for Mermaid export');
			return;
		}

		try {
			// Use existing generateMermaidSource method if available
			const mermaidContent = (CallGraphPanel._currentGenerator as any).generateMermaidSource?.() || 'graph TD\n    A[Start] --> B[End]';
			const writeData = Buffer.from(mermaidContent, 'utf8');
			
			let defaultPath: string | undefined;
			
			if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
				defaultPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
			} else {
				defaultPath = os.homedir();
			}

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const defaultFilePath = path.join(defaultPath, `crabviz-${timestamp}.mmd`);

			vscode.window.showSaveDialog({
				saveLabel: "export",
				defaultUri: vscode.Uri.file(defaultFilePath),
				filters: { 'Mermaid': ['mmd'] },
			}).then((fileUri) => {
				if (fileUri) {
					vscode.workspace.fs.writeFile(fileUri, writeData).then(() => {
						vscode.window.showInformationMessage(`Mermaid file saved to ${fileUri.fsPath}`);
					}, (error) => {
						vscode.window.showErrorMessage(`Failed to save Mermaid file: ${error.message}`);
					});
				}
			});
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to generate Mermaid: ${error}`);
		}
	}

	public saveHTML(svgContent: string) {
		console.debug("Exporting HTML file");
		
		try {
			const htmlContent = generateHTMLTemplate(svgContent);
			const writeData = Buffer.from(htmlContent, 'utf8');
			
			let defaultPath: string | undefined;
			
			if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
				defaultPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
			} else {
				defaultPath = os.homedir();
			}

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const defaultFilePath = path.join(defaultPath, `crabviz-${timestamp}.html`);

			vscode.window.showSaveDialog({
				saveLabel: "export",
				defaultUri: vscode.Uri.file(defaultFilePath),
				filters: { 'HTML': ['html'] },
			}).then((fileUri) => {
				if (fileUri) {
					vscode.workspace.fs.writeFile(fileUri, writeData).then(() => {
						vscode.window.showInformationMessage(`HTML file saved to ${fileUri.fsPath}`);
					}, (error) => {
						vscode.window.showErrorMessage(`Failed to save HTML file: ${error.message}`);
					});
				}
			});
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to generate HTML: ${error}`);
		}
	}
	
	private handleGotoDefinition(filePath: string, line: number, character: number) {
		try {
			let absolutePath = filePath;
			if (!path.isAbsolute(filePath)) {
				const workspaceFolders = vscode.workspace.workspaceFolders;
				if (workspaceFolders && workspaceFolders.length > 0) {
					absolutePath = path.join(workspaceFolders[0].uri.fsPath, filePath);
				}
			}
			
			const fileUri = vscode.Uri.file(absolutePath);
			const position = new vscode.Position(line, character);
			const range = new vscode.Range(position, position);
			
			vscode.workspace.openTextDocument(fileUri)
				.then(document => {
					return vscode.window.showTextDocument(document);
				})
				.then(editor => {
					editor.selection = new vscode.Selection(position, position);
					editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
				}, (error: any) => {
					vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
				});
				
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to navigate to definition: ${error}`);
		}
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
