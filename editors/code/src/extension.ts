import * as vscode from 'vscode';

import { initSync, set_panic_hook } from '../crabviz';
import { CallGraphPanel } from './webview';
import { CommandManager } from './command-manager';

export async function activate(context: vscode.ExtensionContext) {
	await vscode.workspace.fs.readFile(
		vscode.Uri.joinPath(context.extensionUri, 'crabviz/index_bg.wasm')
	).then(bits => {
		initSync(bits);
		set_panic_hook();
	});

	let manager = new CommandManager(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('crabviz.generateCallGraph', manager.generateCallGraph.bind(manager)),
		vscode.commands.registerTextEditorCommand('crabviz.generateFuncCallGraph', manager.generateFuncCallGraph.bind(manager)),
		vscode.commands.registerCommand('crabviz.exportCallGraph', () => {
			CallGraphPanel.currentPanel?.exportSVG();
		}),
		vscode.commands.registerCommand('crabviz.exportCrabViz', () => {
			CallGraphPanel.currentPanel?.exportCrabViz();
		}),
		vscode.commands.registerCommand('crabviz.exportJSON', () => {
			CallGraphPanel.currentPanel?.exportJSON();
		}),
		vscode.commands.registerCommand('crabviz.exportDot', () => {
			CallGraphPanel.currentPanel?.exportDot();
		}),
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
