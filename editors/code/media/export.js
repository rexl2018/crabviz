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

// 获取DOT源代码并发送回后端
function getDotSource() {
  // 获取当前图形的DOT源代码
  const svg = document.querySelector("svg");
  if (!svg) {
    console.error("No SVG found to export DOT.");
    return;
  }
  
  // 从SVG中提取数据，构建DOT源代码
  // 这里我们需要从SVG中提取节点和边的信息，然后构建DOT语言格式
  const nodes = Array.from(svg.querySelectorAll('g.node'));
  const edges = Array.from(svg.querySelectorAll('g.edge'));
  
  // 构建DOT源代码
  let dotSource = "digraph G {\n";
  dotSource += "  graph [rankdir=LR, fontname=\"Arial\"];\n";
  dotSource += "  node [shape=box, style=filled, fillcolor=lightblue, fontname=\"Arial\"];\n";
  dotSource += "  edge [fontname=\"Arial\"];\n\n";
  
  // 添加节点
  nodes.forEach(node => {
    const id = node.id;
    const label = node.querySelector('text')?.textContent || id;
    dotSource += `  "${id}" [label="${label.replace(/"/g, '\\"')}"];\n`;
  });
  
  dotSource += "\n";
  
  // 添加边
  edges.forEach(edge => {
    const from = edge.getAttribute('edge-from') || '';
    const to = edge.getAttribute('edge-to') || '';
    if (from && to) {
      dotSource += `  "${from}" -> "${to}";\n`;
    }
  });
  
  dotSource += "}";
  
  // 发送DOT源代码回后端
  vscode.postMessage({
    command: 'dotSourceResponse',
    dotSource: dotSource
  });
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
});
