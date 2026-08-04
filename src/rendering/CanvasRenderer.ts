import { GraphEdge, GraphNode, EVENT_TYPE, ColorScheme, ENDPOINT_COLORS } from '../types/graph';
import { drawGlowingPoint, drawFinalPath } from './effects';

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

  // World aspect ratio (width / height in meters). Default ~1.0 for Berlin
  private worldAspectRatio: number = 1.0018;

  // Viewport paddings to prevent overlap with HUD and bottom controls
  private paddingX: number = 40;
  private paddingTop: number = 100;
  private paddingBottom: number = 170;

  // Camera Pan & Zoom Transform
  private zoom: number = 1.0;
  private panX: number = 0;
  private panY: number = 0;

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

  public setWorldBounds(bounds?: { xmin: number; ymin: number; xmax: number; ymax: number }) {
    if (bounds) {
      const w = bounds.xmax - bounds.xmin;
      const h = bounds.ymax - bounds.ymin;
      if (h > 0) {
        this.worldAspectRatio = w / h;
      }
    }
  }

  public setTransform(zoom: number, panX: number, panY: number) {
    this.zoom = zoom;
    this.panX = panX;
    this.panY = panY;
  }

  public getTransform() {
    return { zoom: this.zoom, panX: this.panX, panY: this.panY };
  }

  public resetTransform() {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  public resize(cssWidth: number, cssHeight: number) {
    this.dpr = window.devicePixelRatio || 1;
    this.width = cssWidth;
    this.height = cssHeight;

    if (cssWidth < 640) {
      this.paddingX = 15;
      this.paddingTop = 15;
      this.paddingBottom = 15;
    } else {
      this.paddingX = 40;
      this.paddingTop = 100;
      this.paddingBottom = 170;
    }

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

  // Convert normalized [0..1] x, y coordinates to canvas pixels applying camera zoom & pan transform
  public toScreenCoords(normX: number, normY: number): [number, number] {
    const availableW = Math.max(10, this.width - this.paddingX * 2);
    const availableH = Math.max(10, this.height - this.paddingTop - this.paddingBottom);

    const screenAspect = availableW / availableH;

    let renderW: number;
    let renderH: number;

    if (screenAspect > this.worldAspectRatio) {
      renderH = availableH;
      renderW = availableH * this.worldAspectRatio;
    } else {
      renderW = availableW;
      renderH = availableW / this.worldAspectRatio;
    }

    const unzoomedOffsetX = (this.width - renderW) / 2;
    const unzoomedOffsetY = this.paddingTop + (availableH - renderH) / 2;

    const baseX = unzoomedOffsetX + normX * renderW;
    const baseY = unzoomedOffsetY + normY * renderH;

    // Center pivot for zoom
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    const screenX = (baseX - centerX) * this.zoom + centerX + this.panX;
    const screenY = (baseY - centerY) * this.zoom + centerY + this.panY;

    return [screenX, screenY];
  }

  // Clear base canvas and draw dark background road network (#1B2942 at 55% opacity)
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

    // Unexplored roads: #1B2942 at 55% opacity (rgba(27, 41, 66, 0.55))
    this.baseCtx.strokeStyle = ENDPOINT_COLORS.unexplored;
    // Scale line width slightly with zoom for clear visibility
    this.baseCtx.lineWidth = Math.max(0.4, 0.65 * Math.sqrt(this.zoom));
    this.baseCtx.stroke();
    this.baseCtx.restore();
  }

  // Clear exploration layer
  public clearExploration() {
    this.explorationCtx.clearRect(0, 0, this.width, this.height);
  }

  // Incremental or batch exploration drawing
  public drawExplorationBatch(
    edges: GraphEdge[],
    eventArray: Uint32Array,
    startCursor: number,
    endCursor: number,
    colorScheme: ColorScheme
  ) {
    if (startCursor >= endCursor) return;

    this.explorationCtx.save();
    this.explorationCtx.lineCap = 'round';
    this.explorationCtx.lineJoin = 'round';

    this.explorationCtx.beginPath();
    this.explorationCtx.strokeStyle = colorScheme.rgba(0.92);
    this.explorationCtx.lineWidth = Math.max(0.8, 1.25 * Math.sqrt(this.zoom));

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

  // Redraw all explored paths up to endCursor (used during panning / zooming)
  public redrawExploration(
    edges: GraphEdge[],
    eventArray: Uint32Array,
    endCursor: number,
    colorScheme: ColorScheme
  ) {
    this.clearExploration();
    this.drawExplorationBatch(edges, eventArray, 0, endCursor, colorScheme);
  }

  // Draw overlay canvas elements (Start, Destination, Final Path, pulses)
  public drawOverlay(
    startNode: GraphNode | null,
    destNode: GraphNode | null,
    pathEdges: GraphEdge[],
    pathProgress: number,
    colorScheme: ColorScheme,
    timeMs: number
  ) {
    this.overlayCtx.clearRect(0, 0, this.width, this.height);

    if (pathEdges.length > 0 && pathProgress > 0) {
      const pointsList: [number, number][][] = pathEdges.map((edge) =>
        edge.points.map((pt) => this.toScreenCoords(pt[0], pt[1]))
      );
      drawFinalPath(this.overlayCtx, pointsList, colorScheme, pathProgress);
    }

    if (startNode) {
      const [sx, sy] = this.toScreenCoords(startNode.x, startNode.y);
      drawGlowingPoint(this.overlayCtx, sx, sy, ENDPOINT_COLORS.start, timeMs, 'START');
    }

    if (destNode) {
      const [dx, dy] = this.toScreenCoords(destNode.x, destNode.y);
      drawGlowingPoint(this.overlayCtx, dx, dy, ENDPOINT_COLORS.destination, timeMs, 'DESTINATION');
    }
  }

  // Composite canvas export for video recording
  public renderCompositeToCanvas(
    targetCanvas: HTMLCanvasElement,
    algorithmName: string,
    timeComplexity: string,
    colorScheme: ColorScheme,
    nodesCount: number,
    computeTimeMs: number,
    cityName: string,
    topHeaderTitle: string = 'Visualizing all pathfinding algorithms within 30 seconds'
  ) {
    const ctx = targetCanvas.getContext('2d')!;
    targetCanvas.width = Math.floor(this.width * this.dpr);
    targetCanvas.height = Math.floor(this.height * this.dpr);

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    ctx.fillStyle = '#020406';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.drawImage(this.baseCanvas, 0, 0, this.width, this.height);
    ctx.drawImage(this.explorationCanvas, 0, 0, this.width, this.height);
    ctx.drawImage(this.overlayCanvas, 0, 0, this.width, this.height);

    ctx.font = '600 16px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(topHeaderTitle, this.width / 2, 42);

    const hudTop = Math.floor(this.height * 0.12);
    const hudLeft = Math.floor(this.width * 0.08);
    const hudRight = Math.floor(this.width * 0.92);

    ctx.font = '800 28px "Outfit", sans-serif';
    ctx.fillStyle = colorScheme.soft;
    ctx.textAlign = 'left';
    ctx.shadowColor = colorScheme.glow;
    ctx.shadowBlur = 10;
    ctx.fillText(algorithmName, hudLeft, hudTop);

    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#A0A5AC';
    ctx.textAlign = 'right';
    ctx.shadowBlur = 0;
    ctx.fillText(`TC: ${timeComplexity}`, hudRight, hudTop - 6);

    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.fillStyle = '#E5E7EB';
    ctx.fillText(
      `Nodes: ${nodesCount.toLocaleString()}        Time: ${computeTimeMs.toFixed(1)} ms`,
      hudRight,
      hudTop + 14
    );

    ctx.font = '900 36px "Outfit", sans-serif';
    ctx.fillStyle = colorScheme.soft;
    ctx.textAlign = 'center';
    ctx.shadowColor = colorScheme.glow;
    ctx.shadowBlur = 16;
    ctx.fillText(cityName.toUpperCase(), this.width / 2, this.height - Math.floor(this.height * 0.08));

    ctx.restore();
  }
}
