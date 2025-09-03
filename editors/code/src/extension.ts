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
		// 注册自定义调用图命令
		vscode.commands.registerCommand('crabviz.customCallGraphAdd', manager.customCallGraphAdd.bind(manager)),
		vscode.commands.registerCommand('crabviz.customCallGraphList', manager.customCallGraphList.bind(manager)),
		vscode.commands.registerCommand('crabviz.customCallGraphDelete', manager.customCallGraphDelete.bind(manager)),
		vscode.commands.registerCommand('crabviz.customCallGraphGenerate', manager.customCallGraphGenerate.bind(manager)),

	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
