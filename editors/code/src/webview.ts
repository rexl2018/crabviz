import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { Generator } from './generator';
import { GraphGenerator } from '../crabviz';

export class CallGraphPanel {
	public static readonly viewType = 'crabviz.callgraph';

	public static currentPanel: CallGraphPanel | null = null;
	private static num = 1;

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	private static _currentGenerator: Generator | null = null; // 存储当前的Generator实例

	public constructor(extensionUri: vscode.Uri) {
		this._extensionUri = extensionUri;

		const panel = vscode.window.createWebviewPanel(CallGraphPanel.viewType, `Crabviz Debug #${CallGraphPanel.num}`, vscode.ViewColumn.One, {
			localResourceRoots: [
				vscode.Uri.joinPath(this._extensionUri, 'media')
			],
			enableScripts: true
		});

		panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'icon.svg');

		this._panel = panel;

		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'saveSVG':
						this.saveSVG(message.svg);
						break;
					case 'saveJSON':
						this.saveJSON(message.svg);
						break;
					case 'exportDot':
						this.saveDot();
						break;
					case 'getDotSource':
						this.handleGetDotSource();
						break;
					case 'dotSourceResponse':
						this.saveDotFile(message.dotSource);
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
		const resourceUri = vscode.Uri.joinPath(this._extensionUri, 'media');

		const filePromises = ['variables.css', 'styles.css', 'graph.js', 'panzoom.min.js', 'export.js'].map(fileName =>
			vscode.workspace.fs.readFile(vscode.Uri.joinPath(resourceUri, fileName))
		);

		CallGraphPanel.currentPanel = this;

		const nonce = getNonce();

		Promise.all(filePromises).then(([cssVariables, cssStyles, ...scripts]) => {
			this._panel.webview.html = `<!DOCTYPE html>
			<html lang="en">
			<head>
					<meta charset="UTF-8">
					<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-${nonce}';">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<style id="crabviz_style">
						${cssVariables.toString()}
						${cssStyles.toString()}
					</style>
					${scripts.map((s) => `<script nonce="${nonce}">${s.toString()}</script>`)}
					<title>crabviz</title>
			</head>
			<body data-vscode-context='{ "preventDefaultContextMenuItems": true }'>
					<span class="main-container">
						<span class="crabviz-title">Crabviz Debug #${CallGraphPanel.num - 1}</span>
						<span>${svg}</span>
						<span class="carbviz-toolbar">
							<button id="exportSVG" class="crabviz-button">Export SVG</button>
							<button id="exportCrabViz" class="crabviz-button">Export CrabViz</button>
							<button id="exportJSON" class="crabviz-button">Export JSON</button>
							<button id="exportDot" class="crabviz-button">Export DOT</button>
						</span>
					</span>


					<script nonce="${nonce}">
						const graph = new CallGraph(document.querySelector("svg"), ${focusMode});
						graph.activate();

						panzoom(graph.svg, {
							minZoom: 0.5,
							smoothScroll: false,
							zoomDoubleClickSpeed: 1
						});

						// 添加按钮事件监听器
						document.getElementById('exportSVG').addEventListener('click', function() {
							acquireVsCodeApi().postMessage({ command: 'exportSVG' });
						});
						document.getElementById('exportCrabViz').addEventListener('click', function() {
							acquireVsCodeApi().postMessage({ command: 'exportCrabViz' });
						});
						document.getElementById('exportJSON').addEventListener('click', function() {
							acquireVsCodeApi().postMessage({ command: 'saveJSON' });
						});
						document.getElementById('exportDot').addEventListener('click', function() {
							acquireVsCodeApi().postMessage({ command: 'exportDot' });
						});
					</script>
			</body>
			</html>`;
		});
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

	public saveDot() {
		console.debug("Saving DOT file");
		// 获取DOT源代码
		this._panel.webview.postMessage({ command: 'getDotSource' });
	}

	// 添加处理getDotSource命令的方法
	private handleGetDotSource() {
		// 从Generator获取DOT源代码
		if (CallGraphPanel._currentGenerator) {
			// 使用Generator实例的公共方法获取DOT源代码
			const dotSource = CallGraphPanel._currentGenerator.generateDotSource();
			// 发送dotSourceResponse消息，包含DOT源代码
			this._panel.webview.postMessage({
				command: 'dotSourceResponse',
				dotSource: dotSource
			});
		} else {
			// 如果没有Generator实例，显示错误消息
			vscode.window.showErrorMessage('No call graph generator available');
			// 发送空的DOT源代码
			this._panel.webview.postMessage({
				command: 'dotSourceResponse',
				dotSource: '// No call graph generator available'
			});
		}
	}

	// 添加设置当前Generator实例的方法
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
		
		// 确定默认保存路径
		let defaultPath: string | undefined;
		
		// 优先使用工作区文件夹
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			defaultPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		} else {
			// 否则使用系统临时目录
			defaultPath = os.tmpdir();
		}
		
		// 创建带时间戳的文件名
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const defaultFilePath = path.join(defaultPath, `crabviz-${timestamp}.dot`);

		vscode.window.showSaveDialog({
			saveLabel: "export",
			defaultUri: vscode.Uri.file(defaultFilePath),
			filters: { 'DOT': ['dot'] },
		}).then((fileUri) => {
			if (fileUri) {
				try {
					vscode.workspace.fs.writeFile(fileUri, writeData)
						.then(() => {
							console.log("DOT File Saved");
							vscode.window.showInformationMessage(`DOT file saved to ${fileUri.fsPath}`);
						}, (err: any) => {
							vscode.window.showErrorMessage(`Error on writing DOT file: ${err}`);
						});
				} catch (err) {
					vscode.window.showErrorMessage(`Error on writing DOT file: ${err}`);
				}
			}
		});
	}

	saveJSON(svg: string) {
		console.debug("Saving JSON metadata");
		let json;
		try{
			json = JSON.parse(svg);
		}catch (e) {
			vscode.window.showErrorMessage(`Error parsing JSON: ${e}`);
			return; // 解析失败时提前返回，避免继续执行
		}
		
		console.debug("Saving JSON metadata:", json);
		const writeData = Buffer.from(JSON.stringify(json, null, 2), 'utf8');

		// 确定默认保存路径
		let defaultPath: string | undefined;
		
		// 优先使用工作区文件夹
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			defaultPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		} else {
			// 否则使用系统临时目录
			defaultPath = os.tmpdir();
		}
		
		// 创建带时间戳的文件名
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const defaultFilePath = path.join(defaultPath, `crabviz-data-${timestamp}.json`);

		vscode.window.showSaveDialog({
			saveLabel: "export",
			defaultUri: vscode.Uri.file(defaultFilePath),
			filters: { 'JSON': ['json'] },
		}).then((fileUri) => {
			if (fileUri) {
				try {
					vscode.workspace.fs.writeFile(fileUri, writeData)
						.then(() => {
							console.log("File Saved");
							vscode.window.showInformationMessage(`JSON data saved to ${fileUri.fsPath}`);
						}, (err: any) => {
							vscode.window.showErrorMessage(`Error on writing file: ${err}`);
						});
				} catch (err) {
					vscode.window.showErrorMessage(`Error on writing file: ${err}`);
				}
			}
		});
	}
	public saveSVG(svg: string) {
		const writeData = Buffer.from(svg, 'utf8');
		
		// 确定默认保存路径
		let defaultPath: string | undefined;
		
		// 优先使用工作区文件夹
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			defaultPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		} else {
			// 否则使用系统临时目录
			defaultPath = os.tmpdir();
		}
		
		// 创建带时间戳的文件名
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const defaultFilePath = path.join(defaultPath, `crabviz-${timestamp}.svg`);
		
		// 允许用户选择保存位置，但提供默认路径
		vscode.window.showSaveDialog({
			saveLabel: "export",
			defaultUri: vscode.Uri.file(defaultFilePath),
			filters: { 'Images': ['svg'] },
		}).then((fileUri) => {
			if (fileUri) {
				try {
					vscode.workspace.fs.writeFile(fileUri, writeData)
						.then(() => {
							console.log("File Saved");
							vscode.window.showInformationMessage(`SVG saved to ${fileUri.fsPath}`);
						}, (err : any) => {
							vscode.window.showErrorMessage(`Error on writing file: ${err}`);
						});
				} catch (err) {
					vscode.window.showErrorMessage(`Error on writing file: ${err}`);
				}
			}
		});
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
