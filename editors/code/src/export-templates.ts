/**
 * Export templates for different formats
 */

/**
 * Generate HTML export template
 * @param svgContent - The SVG content to embed
 * @param title - Title for the HTML document
 * @returns Complete HTML document string
 */
export function generateHTMLTemplate(
  svgContent: string,
  title: string = "Crabviz Call Graph"
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      background: #1e1e1e;
      color: #d4d4d4;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      overflow: hidden;
    }
    
    .container {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .toolbar {
      background: #2d2d30;
      padding: 8px 16px;
      border-bottom: 1px solid #3e3e42;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    
    .toolbar button {
      background: #0e639c;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 13px;
    }
    
    .toolbar button:hover {
      background: #1177bb;
    }
    
    .graph-container {
      flex: 1;
      overflow: hidden;
      position: relative;
    }
    
    .callgraph {
      width: 100%;
      height: 100%;
      cursor: grab;
    }
    
    .callgraph:active {
      cursor: grabbing;
    }
    
    /* Graph styling */
    .node {
      cursor: pointer;
    }
    
    .node:hover {
      opacity: 0.8;
    }
    
    .cell {
      cursor: pointer;
    }
    
    .cell:hover {
      opacity: 0.9;
    }
    
    .edge {
      cursor: pointer;
    }
    
    .edge:hover {
      opacity: 0.8;
    }
    
    /* Highlight styles */
    .highlight {
      stroke: #ffd700 !important;
      stroke-width: 2px !important;
    }
    
    .fade {
      opacity: 0.3 !important;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar">
      <span>Crabviz Call Graph</span>
      <button onclick="resetView()">Reset View</button>
      <button onclick="zoomIn()">Zoom In</button>
      <button onclick="zoomOut()">Zoom Out</button>
      <button onclick="exportSVG()">Export SVG</button>
    </div>
    <div class="graph-container">
      ${svgContent}
    </div>
  </div>
  
  <script>
    // Pan and zoom functionality
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    
    const svg = document.querySelector('.callgraph');
    const container = document.querySelector('.graph-container');
    
    // Mouse events for panning
    svg.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;
      
      translateX += deltaX;
      translateY += deltaY;
      
      updateTransform();
      
      lastX = e.clientX;
      lastY = e.clientY;
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    // Wheel event for zooming
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      const rect = svg.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(5, scale * zoomFactor));
      
      if (newScale !== scale) {
        const scaleChange = newScale / scale;
        translateX = centerX - (centerX - translateX) * scaleChange;
        translateY = centerY - (centerY - translateY) * scaleChange;
        scale = newScale;
        updateTransform();
      }
    });
    
    function updateTransform() {
      svg.style.transform = \`translate(\${translateX}px, \${translateY}px) scale(\${scale})\`;
    }
    
    function resetView() {
      scale = 1;
      translateX = 0;
      translateY = 0;
      updateTransform();
    }
    
    function zoomIn() {
      scale = Math.min(5, scale * 1.2);
      updateTransform();
    }
    
    function zoomOut() {
      scale = Math.max(0.1, scale / 1.2);
      updateTransform();
    }
    
    function exportSVG() {
      const svgElement = document.querySelector('.callgraph');
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'callgraph.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    
    // Click handling for interactive elements
    svg.addEventListener('click', (e) => {
      // Remove previous highlights
      document.querySelectorAll('.highlight').forEach(el => {
        el.classList.remove('highlight');
      });
      
      // Find clicked element
      let target = e.target;
      while (target && target !== svg) {
        if (target.classList.contains('node') || 
            target.classList.contains('cell') || 
            target.classList.contains('edge')) {
          target.classList.add('highlight');
          break;
        }
        target = target.parentElement;
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Generate standalone SVG with embedded styles
 * @param svgContent - The SVG content
 * @param width - SVG width
 * @param height - SVG height
 * @returns Styled SVG string
 */
export function generateStandaloneSVG(
  svgContent: string,
  width: number = 800,
  height: number = 600
): string {
  return `<svg class="callgraph" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}">
  <style>
    .node { cursor: pointer; }
    .node:hover { opacity: 0.8; }
    .cell { cursor: pointer; }
    .cell:hover { opacity: 0.9; }
    .edge { cursor: pointer; }
    .edge:hover { opacity: 0.8; }
  </style>
  ${svgContent}
</svg>`;
}