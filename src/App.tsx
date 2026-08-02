import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CityGraph,
  GraphNode,
  GraphEdge,
  AdjacencyEdge,
  AlgorithmType,
  AlgorithmResult,
  ALGORITHM_COLORS,
} from './types/graph';
import { CanvasRenderer } from './rendering/CanvasRenderer';
import { HUD, ALGORITHMS_INFO } from './components/HUD';
import { Controls } from './components/Controls';
import { MapNavigationControls } from './components/MapNavigationControls';
import { AlgorithmInfoModal } from './components/AlgorithmInfoModal';
import { CanvasVideoRecorder } from './utils/recorder';

export const App: React.FC = () => {
  const [graphData, setGraphData] = useState<CityGraph | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Layout mode
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(false);

  // Camera Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Drag start position
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchDistRef = useRef<number | null>(null);

  // Selected Nodes
  const [startNodeId, setStartNodeId] = useState<number | null>(null);
  const [destNodeId, setDestNodeId] = useState<number | null>(null);

  // Algorithm & Execution state
  const [selectedAlg, setSelectedAlg] = useState<AlgorithmType>('dijkstra');
  const [durationMs, setDurationMs] = useState<number>(4500);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isExploring, setIsExploring] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  // Current Algorithm stats
  const [computeTimeMs, setComputeTimeMs] = useState<number>(0);
  const [settledCount, setSettledCount] = useState<number>(0);
  const [pathLengthMeters, setPathLengthMeters] = useState<number>(0);

  // Modal & Recording
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isAutoShowcase, setIsAutoShowcase] = useState<boolean>(false);

  // Canvas Refs
  const wrapperRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const explorationCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<CanvasRenderer | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const recorderRef = useRef<CanvasVideoRecorder>(new CanvasVideoRecorder());

  // Adjacency list stored in ref for fast worker posts
  const adjacencyRef = useRef<AdjacencyEdge[][]>([]);

  // Cached algorithm result & exploration state
  const currentResultRef = useRef<AlgorithmResult | null>(null);
  const currentEventArrayRef = useRef<Uint32Array | null>(null);
  const currentCursorRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);

  // Load Graph Data
  useEffect(() => {
    fetch('/data/berlin.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data: CityGraph) => {
        setGraphData(data);

        // Build adjacency list
        const adj: AdjacencyEdge[][] = Array.from({ length: data.nodes.length }, () => []);
        for (const edge of data.edges) {
          adj[edge.source].push({
            edgeId: edge.id,
            target: edge.target,
            weight: edge.weight,
          });
        }
        adjacencyRef.current = adj;

        // Pick initial start (west Berlin) and destination (east Berlin)
        let bestStart = 0;
        let bestDest = 0;
        let minX = Infinity;
        let maxX = -Infinity;

        data.nodes.forEach((n) => {
          if (n.x < minX && n.y > 0.3 && n.y < 0.7) {
            minX = n.x;
            bestStart = n.id;
          }
          if (n.x > maxX && n.y > 0.3 && n.y < 0.7) {
            maxX = n.x;
            bestDest = n.id;
          }
        });

        setStartNodeId(bestStart);
        setDestNodeId(bestDest);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load city graph:', err);
        setError('Failed to load Berlin graph data.');
        setLoading(false);
      });
  }, []);

  // Update canvas renderer camera transform on pan/zoom changes
  const updateCameraTransform = useCallback((newZoom: number, newPanX: number, newPanY: number) => {
    if (!rendererRef.current || !graphData) return;
    rendererRef.current.setTransform(newZoom, newPanX, newPanY);
    rendererRef.current.drawBaseNetwork(graphData.edges);

    if (currentEventArrayRef.current && currentCursorRef.current > 0) {
      rendererRef.current.redrawExploration(
        graphData.edges,
        currentEventArrayRef.current,
        currentCursorRef.current,
        ALGORITHM_COLORS[selectedAlg]
      );
    }
  }, [graphData, selectedAlg]);

  // Initialize CanvasRenderer and handle resize
  useEffect(() => {
    if (!baseCanvasRef.current || !explorationCanvasRef.current || !overlayCanvasRef.current) return;

    const renderer = new CanvasRenderer(
      baseCanvasRef.current,
      explorationCanvasRef.current,
      overlayCanvasRef.current
    );
    rendererRef.current = renderer;

    const handleResize = () => {
      if (wrapperRef.current && rendererRef.current) {
        const { clientWidth, clientHeight } = wrapperRef.current;
        if (graphData) {
          rendererRef.current.setWorldBounds(graphData.bounds);
        }
        rendererRef.current.resize(clientWidth, clientHeight);
        rendererRef.current.setTransform(zoom, panX, panY);

        if (graphData) {
          rendererRef.current.drawBaseNetwork(graphData.edges);

          if (currentEventArrayRef.current && currentCursorRef.current > 0) {
            rendererRef.current.redrawExploration(
              graphData.edges,
              currentEventArrayRef.current,
              currentCursorRef.current,
              ALGORITHM_COLORS[selectedAlg]
            );
          }

          const startNode = startNodeId !== null ? graphData.nodes[startNodeId] : null;
          const destNode = destNodeId !== null ? graphData.nodes[destNodeId] : null;
          rendererRef.current.drawOverlay(
            startNode,
            destNode,
            [],
            0,
            ALGORITHM_COLORS[selectedAlg] || ALGORITHM_COLORS.dijkstra,
            performance.now()
          );
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [graphData, startNodeId, destNodeId, isMobileFrame, selectedAlg, zoom, panX, panY]);

  // Initialize Web Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('./workers/pathfinder.worker.ts', import.meta.url), {
      type: 'module',
    });

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Continuous pulse rendering loop for glowing nodes
  useEffect(() => {
    let loopId: number;
    const pulseLoop = () => {
      if (rendererRef.current && graphData && startNodeId !== null && destNodeId !== null) {
        const startNode = graphData.nodes[startNodeId];
        const destNode = graphData.nodes[destNodeId];
        const colorScheme = ALGORITHM_COLORS[selectedAlg];
        
        let pathEdges: GraphEdge[] = [];
        let progress = 0;

        if (isComplete && currentResultRef.current) {
          pathEdges = currentResultRef.current.pathEdgeIds
            .map((id) => graphData.edges[id])
            .filter(Boolean);
          progress = 1.0;
        }

        rendererRef.current.drawOverlay(
          startNode,
          destNode,
          pathEdges,
          progress,
          colorScheme,
          performance.now()
        );

        // Update composite canvas for video recording
        if (compositeCanvasRef.current && isRecording) {
          rendererRef.current.renderCompositeToCanvas(
            compositeCanvasRef.current,
            ALGORITHMS_INFO[selectedAlg].name,
            ALGORITHMS_INFO[selectedAlg].timeComplexity,
            colorScheme,
            graphData.nodes.length,
            computeTimeMs,
            graphData.name
          );
        }
      }
      loopId = requestAnimationFrame(pulseLoop);
    };
    loopId = requestAnimationFrame(pulseLoop);

    return () => cancelAnimationFrame(loopId);
  }, [graphData, startNodeId, destNodeId, isComplete, selectedAlg, computeTimeMs, isRecording]);

  // Run pathfinding worker and start exploration playback
  const runAlgorithm = useCallback(
    (alg: AlgorithmType) => {
      if (!graphData || startNodeId === null || destNodeId === null || !workerRef.current) return;

      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }

      setIsPlaying(true);
      setIsExploring(true);
      setIsComplete(false);
      setSettledCount(0);

      currentEventArrayRef.current = null;
      currentCursorRef.current = 0;
      rendererRef.current?.clearExploration();

      const workerNodes = graphData.nodes.map((n) => ({ id: n.id, px: n.px, py: n.py }));

      workerRef.current.onmessage = (e: MessageEvent<AlgorithmResult>) => {
        const res = e.data;
        currentResultRef.current = res;

        setComputeTimeMs(res.computeTimeMs);
        setPathLengthMeters(res.pathLengthMeters);

        const eventArray = new Uint32Array(res.eventBuffer);
        currentEventArrayRef.current = eventArray;
        const totalEvents = res.eventCount;

        let cursor = 0;
        const startTime = performance.now();
        const colorScheme = ALGORITHM_COLORS[alg];

        const animateFrame = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / durationMs, 1.0);
          const targetCursor = Math.floor(progress * totalEvents);

          if (cursor < targetCursor && rendererRef.current) {
            rendererRef.current.drawExplorationBatch(
              graphData.edges,
              eventArray,
              cursor,
              targetCursor,
              colorScheme
            );
            cursor = targetCursor;
            currentCursorRef.current = targetCursor;
            setSettledCount(Math.floor((targetCursor / totalEvents) * res.settledNodesCount));
          }

          if (progress < 1.0) {
            animFrameIdRef.current = requestAnimationFrame(animateFrame);
          } else {
            setIsExploring(false);
            setIsComplete(true);
            setIsPlaying(false);
            currentCursorRef.current = totalEvents;
            setSettledCount(res.settledNodesCount);
          }
        };

        animFrameIdRef.current = requestAnimationFrame(animateFrame);
      };

      workerRef.current.postMessage({
        adjacency: adjacencyRef.current,
        nodes: workerNodes,
        start: startNodeId,
        destination: destNodeId,
        algorithm: alg,
      });
    },
    [graphData, startNodeId, destNodeId, durationMs]
  );

  // Zoom & Pan Wheel Handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

    setZoom((prevZoom) => {
      const newZoom = Math.min(25, Math.max(0.5, prevZoom * zoomFactor));
      if (!wrapperRef.current) return newZoom;

      const rect = wrapperRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left - rect.width / 2;
      const mouseY = e.clientY - rect.top - rect.height / 2;

      const scaleChange = newZoom - prevZoom;
      const newPanX = panX - (mouseX * scaleChange) / prevZoom;
      const newPanY = panY - (mouseY * scaleChange) / prevZoom;

      setPanX(newPanX);
      setPanY(newPanY);
      updateCameraTransform(newZoom, newPanX, newPanY);

      return newZoom;
    });
  };

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const newPanX = e.clientX - dragStartRef.current.x;
    const newPanY = e.clientY - dragStartRef.current.y;
    setPanX(newPanX);
    setPanY(newPanY);
    updateCameraTransform(zoom, newPanX, newPanY);
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch Handlers for Mobile / Tablet Pinch-to-Zoom & Pan
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.touches[0].clientX - panX, y: e.touches[0].clientY - panY };
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && isDragging) {
      const newPanX = e.touches[0].clientX - dragStartRef.current.x;
      const newPanY = e.touches[0].clientY - dragStartRef.current.y;
      setPanX(newPanX);
      setPanY(newPanY);
      updateCameraTransform(zoom, newPanX, newPanY);
    } else if (e.touches.length === 2 && touchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const scale = newDist / touchDistRef.current;
      const newZoom = Math.min(25, Math.max(0.5, zoom * scale));

      setZoom(newZoom);
      touchDistRef.current = newDist;
      updateCameraTransform(newZoom, panX, panY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchDistRef.current = null;
  };

  // Zoom Button Handlers
  const handleZoomIn = () => {
    const newZoom = Math.min(25, zoom * 1.35);
    setZoom(newZoom);
    updateCameraTransform(newZoom, panX, panY);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.5, zoom / 1.35);
    setZoom(newZoom);
    updateCameraTransform(newZoom, panX, panY);
  };

  const handleResetView = () => {
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
    updateCameraTransform(1.0, 0, 0);
  };

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    if (isPlaying) {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      setIsPlaying(false);
    } else {
      runAlgorithm(selectedAlg);
    }
  };

  // Reset Canvas
  const handleReset = () => {
    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    setIsPlaying(false);
    setIsExploring(false);
    setIsComplete(false);
    setSettledCount(0);
    setComputeTimeMs(0);
    currentResultRef.current = null;
    currentEventArrayRef.current = null;
    currentCursorRef.current = 0;
    rendererRef.current?.clearExploration();
  };

  // Select Algorithm
  const handleSelectAlgorithm = (alg: AlgorithmType) => {
    setSelectedAlg(alg);
    handleReset();
    setTimeout(() => runAlgorithm(alg), 100);
  };

  // Randomize Start & Destination
  const handleRandomizePoints = () => {
    if (!graphData) return;
    handleReset();
    const count = graphData.nodes.length;
    let s = Math.floor(Math.random() * count);
    let d = Math.floor(Math.random() * count);
    while (s === d) d = Math.floor(Math.random() * count);

    setStartNodeId(s);
    setDestNodeId(d);
  };

  // Auto 30s Showcase Mode
  const handleStartAutoShowcase = async () => {
    if (isAutoShowcase) {
      setIsAutoShowcase(false);
      return;
    }

    setIsAutoShowcase(true);
    const algSequence: AlgorithmType[] = ['dijkstra', 'astar', 'bidirectional', 'bfs', 'greedy', 'dfs'];
    
    setDurationMs(4000);

    for (let i = 0; i < algSequence.length; i++) {
      const alg = algSequence[i];
      setSelectedAlg(alg);
      runAlgorithm(alg);
      await new Promise((resolve) => setTimeout(resolve, 4800));
    }

    setIsAutoShowcase(false);
  };

  // Toggle Recording
  const handleToggleRecord = () => {
    if (!compositeCanvasRef.current) return;

    if (isRecording) {
      recorderRef.current.stopRecording();
      setIsRecording(false);
    } else {
      const ok = recorderRef.current.startRecording(compositeCanvasRef.current, 60);
      if (ok) {
        setIsRecording(true);
        handleStartAutoShowcase();
      }
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="hud-overlay" style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#71b6ff' }}>Loading Berlin Road Network...</h2>
          <p style={{ color: '#a0a5ac', marginTop: '10px' }}>Preprocessing 22,386 nodes and 57,023 edges</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div style={{ color: '#ff3b5c' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className={`app-container ${isMobileFrame ? 'mobile-frame-mode' : ''}`}>
      {/* Canvas Visualizer Container with Mouse/Touch Pan & Zoom */}
      <div
        className={`visualizer-wrapper ${isDragging ? 'dragging' : ''}`}
        ref={wrapperRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Layer 1: Base road network */}
        <canvas ref={baseCanvasRef} />
        {/* Layer 2: Incremental exploration */}
        <canvas ref={explorationCanvasRef} />
        {/* Layer 3: Endpoints, final path & glow overlay */}
        <canvas ref={overlayCanvasRef} />

        {/* HUD Overlay */}
        {graphData && (
          <HUD
            currentAlgorithm={ALGORITHMS_INFO[selectedAlg]}
            nodesCount={graphData.nodes.length}
            computeTimeMs={computeTimeMs}
            pathLengthMeters={pathLengthMeters}
            settledNodesCount={settledCount}
            cityName={graphData.name}
            isExploring={isExploring}
            isComplete={isComplete}
          />
        )}

        {/* Floating Zoom & Map Navigation Toolbar */}
        <MapNavigationControls
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
        />
      </div>

      {/* Hidden Composite Canvas for Video Recording */}
      <canvas ref={compositeCanvasRef} className="offscreen-canvas" />

      {/* Control Panel */}
      <Controls
        selectedAlgorithm={selectedAlg}
        onSelectAlgorithm={handleSelectAlgorithm}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onReset={handleReset}
        onRandomizePoints={handleRandomizePoints}
        onStartAutoShowcase={handleStartAutoShowcase}
        isAutoShowcaseRunning={isAutoShowcase}
        isRecording={isRecording}
        onToggleRecord={handleToggleRecord}
        durationMs={durationMs}
        onChangeDuration={setDurationMs}
        onOpenInfo={() => setIsInfoOpen(true)}
        isMobileFrame={isMobileFrame}
        onToggleMobileFrame={() => setIsMobileFrame((prev) => !prev)}
      />

      {/* Educational Modal */}
      <AlgorithmInfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
    </div>
  );
};
