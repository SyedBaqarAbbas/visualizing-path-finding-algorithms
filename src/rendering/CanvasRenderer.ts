import { GraphEdge, GraphNode, EVENT_TYPE } from '../types/graph';
import { drawGlowingPoint, drawFinalPath } from './effects';

export interface ViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export class CanvasRenderer {
  private baseCanvas: HTMLCanvasElement;
  private explorationCanvas: HTMLCanvasElement;
  private overlayCanvas: HTMLCanvasElement;

  private baseCtx: CanvasRenderingContext2D;
  private explorationCtx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;

  private width: number = 0;
  private height: number = 0;
  private dpr: number = 1;

  // Viewport padding to ensure nodes aren't cut off
  private padding: number = 30;

  constructor(
    baseCanvas: HTMLCanvasElement,
    explorationCanvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement
  ) {
    this.baseCanvas = baseCanvas;
    this.explorationCanvas = explorationCanvas;
    this.overlayCanvas = overlayCanvas;

    this.baseCtx = baseCanvas.getContext('2d', { alpha: true })!;
    this.explorationCtx = explorationCanvas.getContext('2d', { alpha: true })!;
    this.overlayCtx = overlayCanvas.getContext('2d', { alpha: true })!;
  }

  public resize(cssWidth: number, cssHeight: number) {
    this.dpr = window.devicePixelRatio || 1;
    this.width = cssWidth;
    this.height = cssHeight;

    const canvasWidth = Math.floor(cssWidth * this.dpr);
    const canvasHeight = Math.floor(cssHeight * this.dpr);

    [this.baseCanvas, this.explorationCanvas, this.overlayCanvas].forEach((canvas) => {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    });

    this.baseCtx.scale(this.dpr, this.dpr);
    this.explorationCtx.scale(this.dpr, this.dpr);
    this.overlayCtx.scale(this.dpr, this.dpr);
  }

  // Convert normalized [0..1] x, y coordinates to canvas pixels with padding
  public toScreenCoords(normX: number, normY: number): [number, number] {
    const usableW = this.width - this.padding * 2;
    const usableH = this.height - this.padding * 2;
    const px = this.padding + normX * usableW;
    const py = this.padding + normY * usableH;
    return [px, py];
  }

  // Clear base canvas and draw dark background road network
  public drawBaseNetwork(edges: GraphEdge[]) {
    this.baseCtx.clearRect(0, 0, this.width, this.height);

    this.baseCtx.save();
    this.baseCtx.beginPath();

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      if (!edge.points || edge.points.length === 0) continue;

      const [startX, startY] = this.toScreenCoords(edge.points[0][0], edge.points[0][1]);
      this.baseCtx.moveTo(startX, startY);

      for (let j = 1; j < edge.points.length; j++) {
        const [ptX, ptY] = this.toScreenCoords(edge.points[j][0], edge.points[j][1]);
        this.baseCtx.lineTo(ptX, ptY);
      }
    }

    // Subtle dark blue road network styling matching image.png
    this.baseCtx.strokeStyle = 'rgba(39, 55, 88, 0.58)';
    this.baseCtx.lineWidth = 0.65;
    this.baseCtx.stroke();
    this.baseCtx.restore();
  }

  // Clear exploration layer
  public clearExploration() {
    this.explorationCtx.clearRect(0, 0, this.width, this.height);
  }

  // Incremental exploration drawing without clearing the exploration canvas
  public drawExplorationBatch(
    edges: GraphEdge[],
    eventArray: Uint32Array,
    startCursor: number,
    endCursor: number
  ) {
    if (startCursor >= endCursor) return;

    this.explorationCtx.save();
    this.explorationCtx.lineCap = 'round';
    this.explorationCtx.lineJoin = 'round';

    // Relaxed cyan edges stroke
    this.explorationCtx.beginPath();
    this.explorationCtx.strokeStyle = 'rgba(27, 207, 255, 0.92)';
    this.explorationCtx.lineWidth = 1.15;

    for (let i = startCursor; i < endCursor; i++) {
      const idx = i * 2;
      const eventType = eventArray[idx];
      const entityId = eventArray[idx + 1];

      if (eventType === EVENT_TYPE.RELAX_EDGE || eventType === EVENT_TYPE.SCAN_EDGE) {
        const edge = edges[entityId];
        if (edge && edge.points && edge.points.length > 0) {
          const [sx, sy] = this.toScreenCoords(edge.points[0][0], edge.points[0][1]);
          this.explorationCtx.moveTo(sx, sy);
          for (let j = 1; j < edge.points.length; j++) {
            const [px, py] = this.toScreenCoords(edge.points[j][0], edge.points[j][1]);
            this.explorationCtx.lineTo(px, py);
          }
        }
      }
    }

    this.explorationCtx.stroke();
    this.explorationCtx.restore();
  }

  // Draw overlay canvas elements (Start, Destination, Final Path, pulses)
  public drawOverlay(
    startNode: GraphNode | null,
    destNode: GraphNode | null,
    pathEdges: GraphEdge[],
    pathProgress: number,
    timeMs: number
  ) {
    this.overlayCtx.clearRect(0, 0, this.width, this.height);

    // Draw final path if pathProgress > 0
    if (pathEdges.length > 0 && pathProgress > 0) {
      const pointsList: [number, number][][] = pathEdges.map((edge) =>
        edge.points.map((pt) => this.toScreenCoords(pt[0], pt[1]))
      );
      drawFinalPath(this.overlayCtx, pointsList, pathProgress);
    }

    // Draw start node (red glow)
    if (startNode) {
      const [sx, sy] = this.toScreenCoords(startNode.x, startNode.y);
      drawGlowingPoint(this.overlayCtx, sx, sy, '#ff3b5c', timeMs, 'START');
    }

    // Draw destination node (green glow)
    if (destNode) {
      const [dx, dy] = this.toScreenCoords(destNode.x, destNode.y);
      drawGlowingPoint(this.overlayCtx, dx, dy, '#00ff88', timeMs, 'DESTINATION');
    }
  }

  // Composite canvas export for video recording (merges base, exploration, overlay + HUD into 1 frame)
  public renderCompositeToCanvas(
    targetCanvas: HTMLCanvasElement,
    algorithmName: string,
    timeComplexity: string,
    nodesCount: number,
    computeTimeMs: number,
    cityName: string,
    topHeaderTitle: string = 'Visualizing all pathfinding algorithms within 30 seconds 🗺️'
  ) {
    const ctx = targetCanvas.getContext('2d')!;
    targetCanvas.width = Math.floor(this.width * this.dpr);
    targetCanvas.height = Math.floor(this.height * this.dpr);

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Dark Background
    ctx.fillStyle = '#020406';
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Base Canvas Layer
    ctx.drawImage(this.baseCanvas, 0, 0, this.width, this.height);

    // 3. Exploration Layer
    ctx.drawImage(this.explorationCanvas, 0, 0, this.width, this.height);

    // 4. Overlay Layer
    ctx.drawImage(this.overlayCanvas, 0, 0, this.width, this.height);

    // 5. Draw Header & HUD Text onto Composite Canvas (matching image.png)
    // Top header banner
    ctx.font = '600 16px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(topHeaderTitle, this.width / 2, 42);

    // HUD Top Left: Algorithm Title
    const hudTop = Math.floor(this.height * 0.14);
    const hudLeft = Math.floor(this.width * 0.1);
    const hudRight = Math.floor(this.width * 0.9);

    ctx.font = '800 24px "Outfit", sans-serif';
    ctx.fillStyle = '#71b6ff';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(113, 182, 255, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillText(algorithmName, hudLeft, hudTop);

    // HUD Top Right: Complexity & Stats
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'right';
    ctx.shadowBlur = 0;
    ctx.fillText(`TC: ${timeComplexity}`, hudRight, hudTop - 6);

    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#a0a5ac';
    ctx.fillText(
      `Nodes: ${nodesCount.toLocaleString()}    Time: ${computeTimeMs.toFixed(1)} ms`,
      hudRight,
      hudTop + 14
    );

    // Bottom City Name
    ctx.font = '900 34px "Outfit", sans-serif';
    ctx.fillStyle = '#64aaff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(100, 170, 255, 0.5)';
    ctx.shadowBlur = 16;
    ctx.fillText(cityName.toUpperCase(), this.width / 2, this.height - Math.floor(this.height * 0.08));

    ctx.restore();
  }
}
