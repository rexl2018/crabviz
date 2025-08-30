import * as vscode from 'vscode';
import { Generator } from '../generator';
import { saveFile } from './file-saver';
import { generateHTMLTemplate } from '../export-templates';

function cleanSVGContent(svg: string): string {
    // 修复SVG内容中的XML字符转义问题
    let cleaned = svg;
    
    // HTML实体映射表 - 将HTML实体转换为对应字符
    const htmlEntities: { [key: string]: string } = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&copy;': '©',
        '&reg;': '®',
        '&trade;': '™',
        '&hellip;': '…',
        '&mdash;': '—',
        '&ndash;': '–',
        '&lsquo;': "'",
        '&rsquo;': "'",
        '&ldquo;': '"',
        '&rdquo;': '"',
        '&bull;': '•',
        '&middot;': '·',
        '&times;': '×',
        '&divide;': '÷'
    };
    
    // 替换所有HTML实体
    for (const [entity, replacement] of Object.entries(htmlEntities)) {
        cleaned = cleaned.replace(new RegExp(entity, 'g'), replacement);
    }
    
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

export function saveSVG(svg: string) {
    const cleanedSvg = cleanSVGContent(svg);
    saveFile({ 'Images': ['svg'] }, 'svg', cleanedSvg);
}

export function saveJSON(generator: Generator | null) {
    if (!generator) {
        vscode.window.showErrorMessage('No generator available for JSON export');
        return;
    }
    try {
        const json = (generator as any)?.getMetadata?.() || { type: 'crabviz-callgraph', timestamp: new Date().toISOString() };
        const jsonData = JSON.stringify(json, null, 2);
        saveFile({ 'JSON': ['json'] }, 'json', jsonData);
    } catch (e) {
        vscode.window.showErrorMessage(`Failed to get metadata: ${e}`);
    }
}

export function saveDot(generator: Generator | null) {
    if (!generator) {
        vscode.window.showErrorMessage('No generator available for DOT export');
        return;
    }
    try {
        const dotSource = (generator as any).generateDotSource?.() || 'digraph G { }';
        saveFile({ 'DOT': ['dot'] }, 'dot', dotSource);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate DOT source: ${error}`);
    }
}

export function saveMermaid(generator: Generator | null) {
    if (!generator) {
        vscode.window.showErrorMessage('No generator available for Mermaid export');
        return;
    }
    try {
        const mermaidContent = (generator as any).generateMermaidSource?.() || 'graph TD\n    A[Start] --> B[End]';
        saveFile({ 'Mermaid': ['mmd'] }, 'mmd', mermaidContent);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate Mermaid: ${error}`);
    }
}

export function saveHTML(svgContent: string) {
    try {
        const htmlContent = generateHTMLTemplate(svgContent);
        saveFile({ 'HTML': ['html'] }, 'html', htmlContent);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate HTML: ${error}`);
    }
}