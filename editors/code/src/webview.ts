import * as vscode from 'vscode';

export class CallGraphPanel {
	public static readonly viewType = 'crabviz.callgraph';

	public static currentPanel: CallGraphPanel | null = null;
	private static num = 1;

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	public constructor(extensionUri: vscode.Uri) {
		this._extensionUri = extensionUri;

		const panel = vscode.window.createWebviewPanel(CallGraphPanel.viewType, `Crabviz #${CallGraphPanel.num}`, vscode.ViewColumn.One, {
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
					${svg}

					<script nonce="${nonce}">
						const graph = new CallGraph(document.querySelector("svg"), ${focusMode});
						graph.activate();
						exportSVG(); // Call exportSVG() after graph activation

						panzoom(graph.svg, {
							minZoom: 1,
							smoothScroll: false,
							zoomDoubleClickSpeed: 1
						});
					</script>
			</body>
			</html>`;
		});
	}

	public exportSVG() {
		this._panel.webview.postMessage({ command: 'exportSVG' });
	}

	saveSVG(svg: string) {
		const writeData = Buffer.from(svg, 'utf8');
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const fileName = `${timestamp}.svg`;
		
		// 使用用户的工作区或系统临时目录作为默认保存位置
		let defaultPath;
		if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			// 使用第一个工作区文件夹
			defaultPath = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, fileName);
		} else {
			// 如果没有工作区，使用系统临时目录
			const os = require('os');
			defaultPath = vscode.Uri.file(`${os.tmpdir()}/${fileName}`);
		}
	
		vscode.workspace.fs.writeFile(defaultPath, writeData)
			.then(() => {
				console.log("File Saved");
				vscode.window.showInformationMessage(`SVG saved to ${defaultPath.fsPath}`);
			}, (err: any) => {
				vscode.window.showErrorMessage(`Error on writing file: ${err}`);
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
