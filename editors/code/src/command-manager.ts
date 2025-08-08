import * as vscode from 'vscode';
import { extname } from 'path';
import * as path from 'path';
import { Ignore } from 'ignore';

import { readIgnores } from './utils/ignore';
import { FileClassifier } from './utils/file-classifier';
import { Generator } from './generator';
import { CallGraphPanel } from './webview';
import { getLanguages } from './utils/languages';
import { CustomCallGraphManager, CustomCallGraphItem } from './custom-callgraph-manager';

export class CommandManager {
  private context: vscode.ExtensionContext;

	// TODO: listen to .gitignore file modifications
	private ignores: Map<string, Ignore>;

	private languages: Map<string, string>;

  public constructor(context: vscode.ExtensionContext) {
    this.context = context;
		this.ignores = new Map();
		this.languages = getLanguages();
  }

  public async generateCallGraph(contextSelection: vscode.Uri, allSelections: vscode.Uri[]) {
		let cancelled = false;

		// selecting no file is actually selecting the entire workspace
		if (allSelections.length === 0) {
			allSelections.push(contextSelection);
		}

		const root = vscode.workspace.workspaceFolders!
			.find(folder => contextSelection.path.startsWith(folder.uri.path))!;

		const ig = await this.readIgnores(root);

		for await (const uri of allSelections) {
			if (!uri.path.startsWith(root.uri.path)) {
				vscode.window.showErrorMessage("Can not generate call graph across multiple workspace folders");
				return;
			}
		}

		// classify files by programming language

		const files = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Detecting project languages",
			cancellable: true
		}, (_, token) => {
			token.onCancellationRequested(() => cancelled = true);

			const classifer = new FileClassifier(root.uri.path, this.languages, ig);
			return classifer.classifyFilesByLanguage(allSelections, token);
		});

		if (cancelled) {
			return;
		}

		const languages = Array.from(files.keys()).map(lang => ({ label: lang }));
		let lang: string;
		if (languages.length > 1) {
			const selectedItem = await vscode.window.showQuickPick(languages, {
				title: "Pick a language to generate call graph",
			});

			if (!selectedItem) {
				return;
			}
			lang = selectedItem.label;
		} else if (languages.length === 1) {
			lang = languages[0].label;
		} else {
			return;
		}

		// 在外部创建generator变量，以便在then回调中可用
		const generator = new Generator(root.uri, lang);

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Crabviz: Generating call graph",
			cancellable: true,
		}, (progress, token) => {
			token.onCancellationRequested(() => cancelled = true);

			return generator.generateCallGraph(files.get(lang)!, progress, token);
		})
		.then(svg => {
			if (cancelled) { return; }

			const panel = new CallGraphPanel(this.context.extensionUri);
			// 设置当前的Generator实例，以便在导出DOT文件时能够访问它
			CallGraphPanel.setCurrentGenerator(generator);
			panel.showCallGraph(svg, false);
		});
	}

  public async generateFuncCallGraph(editor: vscode.TextEditor) {
		const uri = editor.document.uri;
		const anchor = editor.selection.start;

		const root = vscode.workspace.workspaceFolders!
			.find(folder => uri.path.startsWith(folder.uri.path))!;

		const ig = await this.readIgnores(root);

		const lang = this.languages.get(extname(uri.path)) ?? "";

		const generator = new Generator(root.uri, lang);

		vscode.window.withProgress({
			location: vscode.ProgressLocation.Window,
			title: "Crabviz: Generating call graph",
		}, _ => {
			return generator.generateFuncCallGraph(uri, anchor, ig);
		})
		.then(svg => {
			if (!svg) {
				vscode.window.showErrorMessage('No results');
				return;
			}

			const panel = new CallGraphPanel(this.context.extensionUri);
			// 设置当前的Generator实例，以便在导出DOT文件时能够访问它
			CallGraphPanel.setCurrentGenerator(generator);
			panel.showCallGraph(svg, true);
		});
	}

	async readIgnores(root: vscode.WorkspaceFolder): Promise<Ignore> {
		if (this.ignores.has(root.uri.path)) {
			return this.ignores.get(root.uri.path)!;
		} else {
			const ig = await readIgnores(root);
			this.ignores.set(root.uri.path, ig);

			return ig;
		}
	}

	/**
	 * 添加项目到自定义调用图
	 * @param contextSelection 右键选中的文件/文件夹
	 * @param allSelections 所有选中的文件/文件夹
	 */
	public async customCallGraphAdd(contextSelection: vscode.Uri, allSelections: vscode.Uri[]) {
		const manager = CustomCallGraphManager.getInstance();
		
		// 首先检查是否是在编辑器中选中了函数
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.selection) {
			const uri = editor.document.uri;
			const position = editor.selection.start;
			
			// 获取当前位置的函数信息
			const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
				'vscode.prepareCallHierarchy', 
				uri, 
				position
			);
			
			if (items && items.length > 0) {
				const added = manager.addItem({
					type: 'function',
					uri,
					position,
					name: items[0].name
				});
				
				if (added) {
					vscode.window.showInformationMessage(`Added function '${items[0].name}' to custom call graph`);
				} else {
					vscode.window.showInformationMessage(`Function '${items[0].name}' already in custom call graph`);
				}
				return;
			}
		}
		
		// 处理文件选择
		if (allSelections && allSelections.length > 0) {
			let addedCount = 0;
			for (const uri of allSelections) {
				const added = manager.addItem({
					type: 'file',
					uri,
					name: path.basename(uri.fsPath)
				});
				if (added) {
					addedCount++;
				}
			}
			vscode.window.showInformationMessage(`Added ${addedCount} file(s) to custom call graph`);
			return;
		} else if (contextSelection) {
			// 如果allSelections为空但有contextSelection，则添加单个文件
			const added = manager.addItem({
				type: 'file',
				uri: contextSelection,
				name: path.basename(contextSelection.fsPath)
			});
			
			if (added) {
				vscode.window.showInformationMessage(`Added file '${path.basename(contextSelection.fsPath)}' to custom call graph`);
			} else {
				vscode.window.showInformationMessage(`File '${path.basename(contextSelection.fsPath)}' already in custom call graph`);
			}
			return;
		}
		
		// 如果没有选择文件或函数，显示提示信息
		vscode.window.showWarningMessage('Please select a file or function to add to custom call graph');
	}

	/**
	 * 列出自定义调用图项目
	 */
	public async customCallGraphList() {
		const manager = CustomCallGraphManager.getInstance();
		const items = manager.getItems();
		
		if (items.length === 0) {
			vscode.window.showInformationMessage('No items in custom call graph');
			return;
		}
		
		// 创建WebView显示项目列表
		const panel = vscode.window.createWebviewPanel(
			'crabviz.customCallGraphList',
			'Custom Call Graph Items',
			vscode.ViewColumn.One,
			{}
		);
		
		panel.webview.html = this.getItemListHtml(items);
	}

	/**
	 * 从自定义调用图中删除项目
	 */
	public async customCallGraphDelete() {
		const manager = CustomCallGraphManager.getInstance();
		const items = manager.getItems();
		
		if (items.length === 0) {
			vscode.window.showInformationMessage('No items in custom call graph');
			return;
		}
		
		const selectedItem = await vscode.window.showQuickPick(
			items.map((item, index) => ({
				label: item.name,
				description: item.type === 'file' ? 'File' : 'Function',
				detail: item.uri.fsPath,
				index
			})),
			{ canPickMany: false, placeHolder: 'Select item to delete' }
		);
		
		if (selectedItem) {
			manager.removeItem(selectedItem.index);
			vscode.window.showInformationMessage(`Removed '${selectedItem.label}' from custom call graph`);
		}
	}

	/**
	 * 生成自定义调用图
	 */
	public async customCallGraphGenerate() {
		const manager = CustomCallGraphManager.getInstance();
		const items = manager.getItems();
		
		if (items.length === 0) {
			vscode.window.showInformationMessage('No items in custom call graph');
			return;
		}
		
		// 获取工作区根目录
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder found');
			return;
		}
		
		// 使用第一个项目的URI来确定工作区根目录
		const firstItemUri = items[0].uri;
		
		// 尝试多种方式确定工作区根目录
		let root: vscode.WorkspaceFolder | undefined;
		
		// 方法1：检查URI路径是否以工作区路径开头
		root = workspaceFolders.find(folder => {
			const folderPath = folder.uri.path;
			const itemPath = firstItemUri.path;
			return itemPath.startsWith(folderPath);
		});
		
		// 方法2：如果方法1失败，尝试使用文件系统路径比较
		if (!root) {
			root = workspaceFolders.find(folder => {
				const folderFsPath = folder.uri.fsPath;
				const itemFsPath = firstItemUri.fsPath;
				return itemFsPath.startsWith(folderFsPath);
			});
		}
		
		// 方法3：如果前两种方法都失败，使用第一个工作区文件夹
		if (!root && workspaceFolders.length > 0) {
			root = workspaceFolders[0];
			vscode.window.showInformationMessage('Using first workspace folder as root');
		}
		
		if (!root) {
			vscode.window.showErrorMessage('Cannot determine workspace root');
			return;
		}
		
		// 读取忽略文件
		const ig = await this.readIgnores(root);
		
		// 处理文件项目
		const fileItems = manager.getFileItems();
		const fileUris = fileItems.map(item => item.uri);
		
		// 处理函数项目
		const funcItems = manager.getFunctionItems();
		
		// 确定语言
		let lang = 'auto';
		if (fileUris.length > 0 || funcItems.length > 0) {
			// 尝试从文件扩展名确定语言
			const extensions = new Set<string>();
			
			for (const uri of fileUris) {
				const ext = extname(uri.path);
				if (ext) {
					extensions.add(ext);
				}
			}
			
			for (const item of funcItems) {
				const ext = extname(item.uri.path);
				if (ext) {
					extensions.add(ext);
				}
			}
			
			if (extensions.size === 1) {
				const ext = Array.from(extensions)[0];
				lang = this.languages.get(ext) ?? 'auto';
			} else if (extensions.size > 1) {
				// 如果有多种语言，让用户选择
				const languages = Array.from(extensions)
					.map(ext => this.languages.get(ext))
					.filter((lang): lang is string => !!lang)
					.map(lang => ({ label: lang }));
				
				if (languages.length > 0) {
					const selectedItem = await vscode.window.showQuickPick(languages, {
						title: "Pick a language to generate call graph",
					});
					
					if (!selectedItem) {
						return;
					}
					lang = selectedItem.label;
				}
			}
		}
		
		// 创建生成器实例
		const generator = new Generator(root.uri, lang);
		
		// 显示进度
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Crabviz: Generating custom call graph",
			cancellable: true,
		}, async (progress, token) => {
			let cancelled = false;
			token.onCancellationRequested(() => cancelled = true);
			
			// 先处理文件
			if (fileUris.length > 0) {
				await this.processFilesForCustomGraph(generator, fileUris, progress, token);
				if (cancelled) { return; }
			}
			
			// 再处理函数
			if (funcItems.length > 0) {
				await this.processFunctionsForCustomGraph(generator, funcItems, progress, token);
				if (cancelled) { return; }
			}
			
			// 生成调用图
			const dot = generator.generateDotSource();
			const viz = await import('@viz-js/viz');
			const vizInstance = await viz.instance();
			const renderOptions = { format: 'svg', engine: 'dot' };
			const svg = await vizInstance.renderString(dot, renderOptions);
			
			// 显示结果
			const panel = new CallGraphPanel(this.context.extensionUri);
			CallGraphPanel.setCurrentGenerator(generator);
			panel.showCallGraph(svg, false);
		});
	}

	/**
	 * 处理文件项目
	 */
	private async processFilesForCustomGraph(
		generator: Generator, 
		files: vscode.Uri[], 
		progress: vscode.Progress<{ message?: string; increment?: number }>,
		token: vscode.CancellationToken
	) {
		// 类似于generateCallGraph方法中的处理逻辑
		progress.report({ message: "Processing files..." });
		
		// 使用FileClassifier对文件进行分类
		const root = vscode.workspace.workspaceFolders![0];
		const ig = await this.readIgnores(root);
		const classifier = new FileClassifier(root.uri.path, this.languages, ig);
		
		// 直接传入文件列表，不进行递归扫描
		const filesByLang = await classifier.classifyFilesByLanguage(files, token);
		
		// 获取当前语言的文件
		const lang = generator.getLanguage();
		const langFiles = filesByLang.get(lang) || [];
		
		// 生成调用图
		await generator.generateCallGraph(langFiles, progress, token);
	}

	/**
	 * 处理函数项目
	 */
	private async processFunctionsForCustomGraph(
		generator: Generator, 
		items: CustomCallGraphItem[], 
		progress: vscode.Progress<{ message?: string; increment?: number }>,
		token: vscode.CancellationToken
	) {
		// 类似于generateFuncCallGraph方法中的处理逻辑
		progress.report({ message: "Processing functions..." });
		
		const root = vscode.workspace.workspaceFolders![0];
		const ig = await this.readIgnores(root);
		
		// 逐个处理函数项目
		for (let i = 0; i < items.length; i++) {
			if (token.isCancellationRequested) {
				return;
			}
			
			const item = items[i];
			progress.report({ 
				message: `Processing function ${i+1}/${items.length}: ${item.name}`,
				increment: 100 / items.length 
			});
			
			// 生成函数调用图
			await generator.generateFuncCallGraph(item.uri, item.position!, ig);
		}
	}

	/**
	 * 生成项目列表HTML
	 */
	private getItemListHtml(items: CustomCallGraphItem[]): string {
		const fileItems = items.filter(item => item.type === 'file');
		const funcItems = items.filter(item => item.type === 'function');
		
		return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Custom Call Graph Items</title>
			<style>
				body {
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
					padding: 20px;
					color: var(--vscode-foreground);
					background-color: var(--vscode-editor-background);
				}
				h2 {
					color: var(--vscode-editor-foreground);
					border-bottom: 1px solid var(--vscode-panel-border);
					padding-bottom: 5px;
				}
				.item-list {
					margin-bottom: 20px;
				}
				.item {
					padding: 8px;
					border-bottom: 1px solid var(--vscode-panel-border);
				}
				.item-name {
					font-weight: bold;
				}
				.item-path {
					font-size: 0.9em;
					color: var(--vscode-descriptionForeground);
					margin-top: 4px;
					word-break: break-all;
				}
				.empty-message {
					color: var(--vscode-descriptionForeground);
					font-style: italic;
				}
			</style>
		</head>
		<body>
			<h2>Files (${fileItems.length})</h2>
			<div class="item-list">
				${fileItems.length > 0 ? 
					fileItems.map(item => `
						<div class="item">
							<div class="item-name">${this.escapeHtml(item.name)}</div>
							<div class="item-path">${this.escapeHtml(item.uri.fsPath)}</div>
						</div>
					`).join('') : 
					'<div class="empty-message">No files added</div>'
				}
			</div>
			
			<h2>Functions (${funcItems.length})</h2>
			<div class="item-list">
				${funcItems.length > 0 ? 
					funcItems.map(item => `
						<div class="item">
							<div class="item-name">${this.escapeHtml(item.name)}</div>
							<div class="item-path">${this.escapeHtml(item.uri.fsPath)}:${item.position?.line}:${item.position?.character}</div>
						</div>
					`).join('') : 
					'<div class="empty-message">No functions added</div>'
				}
			</div>
			
			<h2>Actions</h2>
			<div>
				<p>Use the context menu to:</p>
				<ul>
					<li>Add more files or functions</li>
					<li>Delete items from the list</li>
					<li>Generate a combined call graph</li>
				</ul>
			</div>
		</body>
		</html>
		`;
	}

	/**
	 * 转义HTML特殊字符
	 */
	private escapeHtml(unsafe: string): string {
		return unsafe
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}
}
