import { PathfinderWorkerRequest, AlgorithmResult } from '../types/graph';
import {
  runDijkstra,
  runAStar,
  runBidirectional,
  runGreedy,
  runBFS,
  runDFS,
  InternalAlgorithmResult,
} from '../algorithms/pathfinders';

self.onmessage = (e: MessageEvent<PathfinderWorkerRequest>) => {
  const { adjacency, nodes, start, destination, algorithm } = e.data;

  let res: InternalAlgorithmResult;

  switch (algorithm) {
    case 'dijkstra':
      res = runDijkstra(adjacency, start, destination);
      break;
    case 'astar':
      res = runAStar(adjacency, nodes, start, destination);
      break;
    case 'bidirectional':
      res = runBidirectional(adjacency, start, destination);
      break;
    case 'greedy':
      res = runGreedy(adjacency, nodes, start, destination);
      break;
    case 'bfs':
      res = runBFS(adjacency, start, destination);
      break;
    case 'dfs':
      res = runDFS(adjacency, start, destination);
      break;
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }

  const uintArray = res.recorder.getTypedArray();
  // Transfer the underlying ArrayBuffer
  const buffer = uintArray.buffer.slice(0, uintArray.byteLength) as ArrayBuffer;

  const response: AlgorithmResult = {
    eventBuffer: buffer,
    eventCount: res.recorder.getCount(),
    pathEdgeIds: res.pathEdgeIds,
    computeTimeMs: res.computeTimeMs,
    settledNodesCount: res.settledCount,
    scannedEdgesCount: res.scannedCount,
    pathLengthMeters: res.pathLengthMeters,
    algorithm,
  };

  // Transfer the buffer for maximum performance
  (self as unknown as Worker).postMessage(response, [buffer]);
};
