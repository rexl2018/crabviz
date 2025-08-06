function exportSVG() {
  const svg = document.querySelector("svg").cloneNode(true);

  svg.appendChild(document.getElementById("crabviz_style").cloneNode(true));
  svg.insertAdjacentHTML(
    "beforeend",
    "<style>:is(.cell, .edge) { pointer-events: none; }</style>"
  );

  vscode.postMessage({
    command: 'saveSVG',
    svg: svg.outerHTML.replaceAll("&nbsp;", "&#160;")
  });
}

function exportCrabViz() {
  const svg = document.querySelector("svg");
  if (!svg) {
    console.error("No SVG found to export.");
    return;
  }

  const svgContent = svg.outerHTML.replaceAll("&nbsp;", "&#160;");
  vscode.postMessage({
    command: 'saveSVG',
    svg: svgContent
  });
}

function saveJSON() {
  const svg = document.querySelector("svg");
  if (!svg) {
    console.error("No SVG found to export.");
    return;
  }
  
  // 提取图形数据并创建JSON对象
  const nodes = Array.from(svg.querySelectorAll('g.node')).map(node => {
    return {
      id: node.id,
      label: node.querySelector('text')?.textContent || '',
      class: Array.from(node.classList)
    };
  });
  
  const edges = Array.from(svg.querySelectorAll('g.edge')).map(edge => {
    return {
      id: edge.id,
      from: edge.getAttribute('edge-from') || '',
      to: edge.getAttribute('edge-to') || '',
      class: Array.from(edge.classList)
    };
  });
  
  const graphData = {
    nodes: nodes,
    edges: edges,
    metadata: {
      exportTime: new Date().toISOString(),
      graphType: 'crabviz'
    }
};
  
  vscode.postMessage({
    command: 'saveJSON',
    svg: JSON.stringify(graphData)
  });
}

// 初始化VSCode API
const vscode = acquireVsCodeApi();

function exportDot() {
  // 直接请求后端生成并保存dot文件
  vscode.postMessage({
    command: 'exportDot'
  });
}

function exportMermaid() {
  vscode.postMessage({
    command: 'exportMermaid'
  });
}

// 获取DOT源代码并发送回后端
function getDotSource() {
  // 我们不再从SVG中提取数据构建DOT源代码
  // 而是请求后端提供已经生成好的DOT源代码
  
  // 从后端获取DOT源代码
  // 这里我们只是发送一个请求，实际的DOT源代码会由后端提供
  vscode.postMessage({
    command: 'getDotSource'
  });
  
  // 注意：后端会返回dotSourceResponse消息，包含完整的DOT源代码
  // 然后由消息处理器将DOT源代码发送回后端进行保存
}

// 监听来自VSCode扩展的消息
window.addEventListener('message', (e) => {
  const message = e.data;

  switch (message.command) {
    case 'exportSVG':
        exportSVG();
        break;
    case 'exportCrabViz':
        exportCrabViz();
        break;
    case 'saveJSON':
        saveJSON();
        break;
    case 'exportDot':
        exportDot();
        break;
    case 'getDotSource':
        getDotSource();
        break;
    case 'exportMermaid':
        exportMermaid();
        break;
    case 'dotSourceResponse':
        // 收到后端发送的DOT源代码，将其发送回后端进行保存
        vscode.postMessage({
          command: 'dotSourceResponse',
          dotSource: message.dotSource
        });
        break;
  }
});

// 确保DOM加载完成后再添加事件监听器
document.addEventListener('DOMContentLoaded', () => {
  // 这些监听器是备用的，以防HTML中的内联监听器失效
  const exportSVGButton = document.getElementById('exportSVG');
  if (exportSVGButton) {
    exportSVGButton.addEventListener('click', exportSVG);
  }

  const exportCrabVizButton = document.getElementById('exportCrabViz');
  if (exportCrabVizButton) {
    exportCrabVizButton.addEventListener('click', exportCrabViz);
  }

  const exportJSONButton = document.getElementById('exportJSON');
  if (exportJSONButton) {
    exportJSONButton.addEventListener('click', saveJSON);
  }

  const exportDotButton = document.getElementById('exportDot');
  if (exportDotButton) {
    exportDotButton.addEventListener('click', exportDot);
  }

  const exportMermaidButton = document.getElementById('exportMermaid');
  if (exportMermaidButton) {
    exportMermaidButton.addEventListener('click', exportMermaid);
  }
});
