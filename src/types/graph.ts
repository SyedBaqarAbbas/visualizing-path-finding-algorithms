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

export interface ColorScheme {
  primary: string;      // Full-intensity neon color
  glow: string;         // Glow color for shadows & light blending
  soft: string;         // Softer, slightly desaturated color for headings
  rgba: (alpha: number) => string;
}

export const ALGORITHM_COLORS: Record<AlgorithmType, ColorScheme> = {
  dijkstra: {
    primary: '#29C7FF',
    glow: 'rgba(41, 199, 255, 0.85)',
    soft: '#79DCFF',
    rgba: (a: number) => `rgba(41, 199, 255, ${a})`,
  },
  astar: {
    primary: '#22E5E5',
    glow: 'rgba(34, 229, 229, 0.85)',
    soft: '#7CEEEE',
    rgba: (a: number) => `rgba(34, 229, 229, ${a})`,
  },
  bidirectional: {
    primary: '#FF6B6B',
    glow: 'rgba(255, 107, 107, 0.85)',
    soft: '#FFA8A8',
    rgba: (a: number) => `rgba(255, 107, 107, ${a})`,
  },
  greedy: {
    primary: '#E879F9',
    glow: 'rgba(232, 121, 249, 0.85)',
    soft: '#F3B2FB',
    rgba: (a: number) => `rgba(232, 121, 249, ${a})`,
  },
  bfs: {
    primary: '#FF9F43',
    glow: 'rgba(255, 159, 67, 0.85)',
    soft: '#FFC58D',
    rgba: (a: number) => `rgba(255, 159, 67, ${a})`,
  },
  dfs: {
    primary: '#8B5CF6',
    glow: 'rgba(139, 92, 246, 0.85)',
    soft: '#B99AF8',
    rgba: (a: number) => `rgba(139, 92, 246, ${a})`,
  },
};

export const ENDPOINT_COLORS = {
  start: '#FF5349',
  destination: '#25F58B',
  unexplored: 'rgba(27, 41, 66, 0.55)',
};

// Event type constants encoded into Uint32Array buffer:
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
