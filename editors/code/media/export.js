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
});
