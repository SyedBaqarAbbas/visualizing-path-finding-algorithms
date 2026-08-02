import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CityGraph,
  GraphNode,
  GraphEdge,
  AdjacencyEdge,
  AlgorithmType,
  AlgorithmResult,
} from './types/graph';
import { CanvasRenderer } from './rendering/CanvasRenderer';
import { HUD, ALGORITHMS_INFO } from './components/HUD';
import { Controls } from './components/Controls';
import { AlgorithmInfoModal } from './components/AlgorithmInfoModal';
import { CanvasVideoRecorder } from './utils/recorder';

export const App: React.FC = () => {
  const [graphData, setGraphData] = useState<CityGraph | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Layout mode: default to Fullscreen desktop view (false = full bleed desktop)
  const [isMobileFrame, setIsMobileFrame] = useState<boolean>(false);

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

  // Refs
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

  // Cached algorithm result data
  const currentResultRef = useRef<AlgorithmResult | null>(null);
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

        // Pick initial start (west Berlin) and destination (east Berlin) matching image.png
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
        rendererRef.current.resize(clientWidth, clientHeight);
        if (graphData) {
          rendererRef.current.drawBaseNetwork(graphData.edges);
          // Redraw overlay
          const startNode = startNodeId !== null ? graphData.nodes[startNodeId] : null;
          const destNode = destNodeId !== null ? graphData.nodes[destNodeId] : null;
          rendererRef.current.drawOverlay(startNode, destNode, [], 0, performance.now());
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [graphData, startNodeId, destNodeId, isMobileFrame]);

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
        
        let pathEdges: GraphEdge[] = [];
        let progress = 0;

        if (isComplete && currentResultRef.current) {
          pathEdges = currentResultRef.current.pathEdgeIds
            .map((id) => graphData.edges[id])
            .filter(Boolean);
          progress = 1.0;
        }

        rendererRef.current.drawOverlay(startNode, destNode, pathEdges, progress, performance.now());

        // Update composite canvas for video recording
        if (compositeCanvasRef.current && isRecording) {
          rendererRef.current.renderCompositeToCanvas(
            compositeCanvasRef.current,
            ALGORITHMS_INFO[selectedAlg].name,
            ALGORITHMS_INFO[selectedAlg].timeComplexity,
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

      rendererRef.current?.clearExploration();

      const workerNodes = graphData.nodes.map((n) => ({ id: n.id, px: n.px, py: n.py }));

      workerRef.current.onmessage = (e: MessageEvent<AlgorithmResult>) => {
        const res = e.data;
        currentResultRef.current = res;

        setComputeTimeMs(res.computeTimeMs);
        setPathLengthMeters(res.pathLengthMeters);

        // Start playback animation
        const eventArray = new Uint32Array(res.eventBuffer);
        const totalEvents = res.eventCount;

        let cursor = 0;
        const startTime = performance.now();

        const animateFrame = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / durationMs, 1.0);
          const targetCursor = Math.floor(progress * totalEvents);

          if (cursor < targetCursor && rendererRef.current) {
            rendererRef.current.drawExplorationBatch(graphData.edges, eventArray, cursor, targetCursor);
            cursor = targetCursor;
            setSettledCount(Math.floor((targetCursor / totalEvents) * res.settledNodesCount));
          }

          if (progress < 1.0) {
            animFrameIdRef.current = requestAnimationFrame(animateFrame);
          } else {
            setIsExploring(false);
            setIsComplete(true);
            setIsPlaying(false);
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
    
    // Set 4.0s per algorithm sequence
    setDurationMs(4000);

    for (let i = 0; i < algSequence.length; i++) {
      const alg = algSequence[i];
      setSelectedAlg(alg);
      runAlgorithm(alg);
      // Wait for algorithm animation + pause
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
      {/* Canvas Visualizer Container (Full screen on desktop by default) */}
      <div className="visualizer-wrapper" ref={wrapperRef}>
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
