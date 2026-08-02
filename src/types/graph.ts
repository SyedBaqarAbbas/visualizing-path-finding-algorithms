export type Point = [number, number];

export interface GraphNode {
  id: number;
  x: number;     // Normalized 0..1 for rendering
  y: number;     // Normalized 0..1 (inverted Y)
  px: number;    // Projected metric coordinate X
  py: number;    // Projected metric coordinate Y
}

export interface GraphEdge {
  id: number;
  source: number;
  target: number;
  weight: number; // Length in meters
  points: Point[];
}

export interface CityGraph {
  name: string;
  full_name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  bounds?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

export interface AdjacencyEdge {
  edgeId: number;
  target: number;
  weight: number;
}

export type AlgorithmType =
  | 'dijkstra'
  | 'astar'
  | 'bidirectional'
  | 'greedy'
  | 'bfs'
  | 'dfs';

export interface AlgorithmInfo {
  id: AlgorithmType;
  name: string;
  timeComplexity: string;
  spaceComplexity: string;
  description: string;
  isOptimal: boolean;
  category: 'shortest-path' | 'heuristic' | 'traversal';
}

// Event type constants encoded into Uint32Array buffer:
// [eventType, entityId]
export const EVENT_TYPE = {
  SCAN_EDGE: 1,
  RELAX_EDGE: 2,
  SETTLE_NODE: 3,
  COMPLETE: 4,
} as const;

export interface AlgorithmResult {
  eventBuffer: ArrayBuffer;
  eventCount: number;
  pathEdgeIds: number[];
  computeTimeMs: number;
  settledNodesCount: number;
  scannedEdgesCount: number;
  pathLengthMeters: number;
  algorithm: AlgorithmType;
}

export interface PathfinderWorkerRequest {
  adjacency: AdjacencyEdge[][];
  nodes: { id: number; px: number; py: number }[];
  start: number;
  destination: number;
  algorithm: AlgorithmType;
}
