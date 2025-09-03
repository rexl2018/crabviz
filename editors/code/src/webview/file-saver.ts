import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { Generator } from '../generator';

export function saveFile(filter: { [name: string]: string[] }, extension: string, data: string) {
    const writeData = Buffer.from(data, 'utf8');

    let defaultPath: string | undefined;

    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        defaultPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else {
        defaultPath = os.homedir();
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultFilePath = path.join(defaultPath, `crabviz-${timestamp}.${extension}`);

    vscode.window.showSaveDialog({
        saveLabel: "export",
        defaultUri: vscode.Uri.file(defaultFilePath),
        filters: filter,
    }).then((fileUri) => {
        if (fileUri) {
            vscode.workspace.fs.writeFile(fileUri, writeData).then(() => {
                vscode.window.showInformationMessage(`${extension.toUpperCase()} file saved to ${fileUri.fsPath}`);
            }, (error) => {
                vscode.window.showErrorMessage(`Failed to save ${extension.toUpperCase()} file: ${error.message}`);
            });
        }
    });
}