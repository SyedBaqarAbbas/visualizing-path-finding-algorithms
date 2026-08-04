import React from 'react';
import { AlgorithmType, AlgorithmInfo, ALGORITHM_COLORS } from '../types/graph';

interface HUDProps {
  currentAlgorithm: AlgorithmInfo;
  nodesCount: number;
  computeTimeMs: number;
  pathLengthMeters: number;
  settledNodesCount: number;
  cityName: string;
  isExploring: boolean;
  isComplete: boolean;
}

export const ALGORITHMS_INFO: Record<AlgorithmType, AlgorithmInfo> = {
  dijkstra: {
    id: 'dijkstra',
    name: 'Dijkstra',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
    description: 'Guarantees shortest path by exploring nodes in order of distance from source.',
    isOptimal: true,
    category: 'shortest-path',
  },
  astar: {
    id: 'astar',
    name: 'A* Search',
    timeComplexity: 'O(E)',
    spaceComplexity: 'O(V)',
    description: 'Heuristic-guided search combining path cost with Euclidean distance estimate.',
    isOptimal: true,
    category: 'heuristic',
  },
  bidirectional: {
    id: 'bidirectional',
    name: 'Bidirectional Dijkstra',
    timeComplexity: 'O((V + E) log V)',
    spaceComplexity: 'O(V)',
    description: 'Searches simultaneously from start and target until meeting in the middle.',
    isOptimal: true,
    category: 'shortest-path',
  },
  greedy: {
    id: 'greedy',
    name: 'Greedy Best-First',
    timeComplexity: 'O(V log V)',
    spaceComplexity: 'O(V)',
    description: 'Expands nodes closest to destination heuristic. Fast but not always optimal.',
    isOptimal: false,
    category: 'heuristic',
  },
  bfs: {
    id: 'bfs',
    name: 'Breadth-First Search',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    description: 'Graph traversal algorithm exploring level-by-level (unweighted shortest path).',
    isOptimal: false,
    category: 'traversal',
  },
  dfs: {
    id: 'dfs',
    name: 'Depth-First Search',
    timeComplexity: 'O(V + E)',
    spaceComplexity: 'O(V)',
    description: 'Graph traversal algorithm exploring deep branches first (non-optimal).',
    isOptimal: false,
    category: 'traversal',
  },
};

export const HUD: React.FC<HUDProps> = ({
  currentAlgorithm,
  nodesCount,
  computeTimeMs,
  pathLengthMeters,
  settledNodesCount,
  cityName,
  isExploring,
  isComplete,
}) => {
  const km = (pathLengthMeters / 1000).toFixed(2);
  const colorScheme = ALGORITHM_COLORS[currentAlgorithm.id];

  return (
    <div className="hud-container">
      {/* City Title */}
      <div
        className="city-title"
        style={{
          color: colorScheme.soft,
          textShadow: `0 0 12px ${colorScheme.rgba(0.4)}`,
        }}
      >
        {cityName.toUpperCase()}
      </div>

      {/* Main HUD overlay text box */}
      <div className="hud-overlay">
        <div className="hud-top">
          <div className="algorithm-name-container">
            <h2
              className="algorithm-name"
              style={{
                color: colorScheme.soft,
                textShadow: `0 0 16px ${colorScheme.glow}`,
              }}
            >
              {currentAlgorithm.name}
            </h2>
            {currentAlgorithm.category === 'traversal' && (
              <span className="category-badge traversal">Graph Traversal</span>
            )}
            {currentAlgorithm.isOptimal && (
              <span className="category-badge optimal">Shortest Path</span>
            )}
          </div>

          <div className="metrics">
            <div className="metric-row">
              <span className="complexity-label">TC: </span>
              <span className="complexity-val">{currentAlgorithm.timeComplexity}</span>
            </div>
            <div className="metric-row">
              <span className="node-stat">
                Nodes: <strong className="stat-num">{nodesCount.toLocaleString()}</strong>
              </span>
              <span className="time-stat">
                Time:{' '}
                <strong className="stat-num">
                  {computeTimeMs > 0 ? computeTimeMs.toFixed(1) : '---'} ms
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Live execution statistics bar */}
        {(isExploring || isComplete) && (
          <div className="hud-stats-bar">
            <div
              className="stat-pill"
              style={{ borderColor: colorScheme.rgba(0.3) }}
            >
              <span className="stat-label">Explored</span>
              <span className="stat-value" style={{ color: colorScheme.primary }}>
                {settledNodesCount.toLocaleString()} nodes
              </span>
            </div>
            {isComplete && pathLengthMeters > 0 && (
              <div
                className="stat-pill highlight"
                style={{
                  borderColor: colorScheme.primary,
                  boxShadow: `0 0 14px ${colorScheme.rgba(0.25)}`,
                }}
              >
                <span className="stat-label">Route Length</span>
                <span className="stat-value" style={{ color: '#ffffff' }}>
                  {km} km
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
