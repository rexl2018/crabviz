import * as vscode from 'vscode';
import * as path from 'path';

export function handleGotoDefinition(filePath: string, line: number, character: number) {
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