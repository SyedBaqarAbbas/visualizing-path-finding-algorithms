import { AdjacencyEdge, EVENT_TYPE } from '../types/graph';
import { MinHeap } from './minheap';
import { EventRecorder } from './eventRecorder';

export interface InternalNodeData {
  id: number;
  px: number;
  py: number;
}

export interface InternalAlgorithmResult {
  recorder: EventRecorder;
  pathEdgeIds: number[];
  computeTimeMs: number;
  settledCount: number;
  scannedCount: number;
  pathLengthMeters: number;
}

// Reconstruct path from target back to source using previousEdge and previousNode pointers
function reconstructPath(
  start: number,
  destination: number,
  previousNode: Int32Array,
  previousEdge: Int32Array
): { pathEdgeIds: number[]; lengthMeters: number } {
  const pathEdgeIds: number[] = [];
  let cursor = destination;
  let lengthMeters = 0;

  while (cursor !== start && cursor !== -1) {
    const edgeId = previousEdge[cursor];
    if (edgeId === -1) break;
    pathEdgeIds.push(edgeId);
    cursor = previousNode[cursor];
  }

  pathEdgeIds.reverse();
  return { pathEdgeIds, lengthMeters };
}

// 1. DIJKSTRA
export function runDijkstra(
  adjacency: AdjacencyEdge[][],
  start: number,
  destination: number
): InternalAlgorithmResult {
  const t0 = performance.now();
  const numNodes = adjacency.length;
  const distance = new Float64Array(numNodes);
  distance.fill(Number.POSITIVE_INFINITY);
  distance[start] = 0;

  const previousNode = new Int32Array(numNodes).fill(-1);
  const previousEdge = new Int32Array(numNodes).fill(-1);

  const heap = new MinHeap<number>();
  heap.push(0, start);

  const recorder = new EventRecorder(80000);
  let settledCount = 0;
  let scannedCount = 0;

  while (!heap.isEmpty()) {
    const node = heap.pop()!;
    const d = distance[node];

    recorder.add(EVENT_TYPE.SETTLE_NODE, node);
    settledCount++;

    if (node === destination) break;

    for (const edge of adjacency[node]) {
      scannedCount++;
      recorder.add(EVENT_TYPE.SCAN_EDGE, edge.edgeId);

      const candidate = d + edge.weight;
      if (candidate < distance[edge.target]) {
        distance[edge.target] = candidate;
        previousNode[edge.target] = node;
        previousEdge[edge.target] = edge.edgeId;

        recorder.add(EVENT_TYPE.RELAX_EDGE, edge.edgeId);
        heap.push(candidate, edge.target);
      }
    }
  }

  const path = reconstructPath(start, destination, previousNode, previousEdge);
  const computeTimeMs = performance.now() - t0;

  return {
    recorder,
    pathEdgeIds: path.pathEdgeIds,
    computeTimeMs,
    settledCount,
    scannedCount,
    pathLengthMeters: distance[destination] === Number.POSITIVE_INFINITY ? 0 : distance[destination],
  };
}

// 2. A* SEARCH
export function runAStar(
  adjacency: AdjacencyEdge[][],
  nodes: InternalNodeData[],
  start: number,
  destination: number
): InternalAlgorithmResult {
  const t0 = performance.now();
  const numNodes = adjacency.length;

  const destNode = nodes[destination];
  const destPx = destNode ? destNode.px : 0;
  const destPy = destNode ? destNode.py : 0;

  const heuristic = (nodeIdx: number): number => {
    const n = nodes[nodeIdx];
    if (!n) return 0;
    const dx = n.px - destPx;
    const dy = n.py - destPy;
    return Math.hypot(dx, dy);
  };

  const gScore = new Float64Array(numNodes).fill(Number.POSITIVE_INFINITY);
  gScore[start] = 0;

  const previousNode = new Int32Array(numNodes).fill(-1);
  const previousEdge = new Int32Array(numNodes).fill(-1);

  const heap = new MinHeap<number>();
  heap.push(heuristic(start), start);

  const recorder = new EventRecorder(80000);
  let settledCount = 0;
  let scannedCount = 0;

  while (!heap.isEmpty()) {
    const node = heap.pop()!;
    const currentG = gScore[node];

    recorder.add(EVENT_TYPE.SETTLE_NODE, node);
    settledCount++;

    if (node === destination) break;

    for (const edge of adjacency[node]) {
      scannedCount++;
      recorder.add(EVENT_TYPE.SCAN_EDGE, edge.edgeId);

      const candidateG = currentG + edge.weight;
      if (candidateG < gScore[edge.target]) {
        gScore[edge.target] = candidateG;
        previousNode[edge.target] = node;
        previousEdge[edge.target] = edge.edgeId;

        recorder.add(EVENT_TYPE.RELAX_EDGE, edge.edgeId);
        const fScore = candidateG + heuristic(edge.target);
        heap.push(fScore, edge.target);
      }
    }
  }

  const path = reconstructPath(start, destination, previousNode, previousEdge);
  const computeTimeMs = performance.now() - t0;

  return {
    recorder,
    pathEdgeIds: path.pathEdgeIds,
    computeTimeMs,
    settledCount,
    scannedCount,
    pathLengthMeters: gScore[destination] === Number.POSITIVE_INFINITY ? 0 : gScore[destination],
  };
}

// 3. BIDIRECTIONAL DIJKSTRA
export function runBidirectional(
  adjacency: AdjacencyEdge[][],
  start: number,
  destination: number
): InternalAlgorithmResult {
  const t0 = performance.now();
  const numNodes = adjacency.length;

  // Build reverse adjacency for backward search if graph is directed
  const reverseAdjacency: AdjacencyEdge[][] = Array.from({ length: numNodes }, () => []);
  for (let u = 0; u < numNodes; u++) {
    for (const edge of adjacency[u]) {
      reverseAdjacency[edge.target].push({
        edgeId: edge.edgeId,
        target: u,
        weight: edge.weight,
      });
    }
  }

  const distF = new Float64Array(numNodes).fill(Number.POSITIVE_INFINITY);
  const distB = new Float64Array(numNodes).fill(Number.POSITIVE_INFINITY);
  distF[start] = 0;
  distB[destination] = 0;

  const prevNodeF = new Int32Array(numNodes).fill(-1);
  const prevEdgeF = new Int32Array(numNodes).fill(-1);
  const prevNodeB = new Int32Array(numNodes).fill(-1);
  const prevEdgeB = new Int32Array(numNodes).fill(-1);

  const heapF = new MinHeap<number>();
  const heapB = new MinHeap<number>();
  heapF.push(0, start);
  heapB.push(0, destination);

  const settledF = new Uint8Array(numNodes);
  const settledB = new Uint8Array(numNodes);

  const recorder = new EventRecorder(80000);
  let settledCount = 0;
  let scannedCount = 0;

  let bestCost = Number.POSITIVE_INFINITY;
  let intersectionNode = -1;

  while (!heapF.isEmpty() && !heapB.isEmpty()) {
    // Forward step
    if (!heapF.isEmpty()) {
      const u = heapF.pop()!;
      if (!settledF[u]) {
        settledF[u] = 1;
        recorder.add(EVENT_TYPE.SETTLE_NODE, u);
        settledCount++;

        if (settledB[u]) {
          intersectionNode = u;
          bestCost = distF[u] + distB[u];
          break;
        }

        for (const edge of adjacency[u]) {
          scannedCount++;
          recorder.add(EVENT_TYPE.SCAN_EDGE, edge.edgeId);
          const cand = distF[u] + edge.weight;
          if (cand < distF[edge.target]) {
            distF[edge.target] = cand;
            prevNodeF[edge.target] = u;
            prevEdgeF[edge.target] = edge.edgeId;
            recorder.add(EVENT_TYPE.RELAX_EDGE, edge.edgeId);
            heapF.push(cand, edge.target);

            if (settledB[edge.target] && cand + distB[edge.target] < bestCost) {
              bestCost = cand + distB[edge.target];
              intersectionNode = edge.target;
            }
          }
        }
      }
    }

    // Backward step
    if (!heapB.isEmpty()) {
      const v = heapB.pop()!;
      if (!settledB[v]) {
        settledB[v] = 1;
        recorder.add(EVENT_TYPE.SETTLE_NODE, v);
        settledCount++;

        if (settledF[v]) {
          intersectionNode = v;
          bestCost = distF[v] + distB[v];
          break;
        }

        for (const edge of reverseAdjacency[v]) {
          scannedCount++;
          recorder.add(EVENT_TYPE.SCAN_EDGE, edge.edgeId);
          const cand = distB[v] + edge.weight;
          if (cand < distB[edge.target]) {
            distB[edge.target] = cand;
            prevNodeB[edge.target] = v;
            prevEdgeB[edge.target] = edge.edgeId;
            recorder.add(EVENT_TYPE.RELAX_EDGE, edge.edgeId);
            heapB.push(cand, edge.target);

            if (settledF[edge.target] && cand + distF[edge.target] < bestCost) {
              bestCost = cand + distF[edge.target];
              intersectionNode = edge.target;
            }
          }
        }
      }
    }
  }

  // Reconstruct bidirectional path
  const pathEdgeIds: number[] = [];
  if (intersectionNode !== -1) {
    // Forward path from start to intersectionNode
    const fEdges: number[] = [];
    let curr = intersectionNode;
    while (curr !== start && curr !== -1) {
      const edgeId = prevEdgeF[curr];
      if (edgeId === -1) break;
      fEdges.push(edgeId);
      curr = prevNodeF[curr];
    }
    fEdges.reverse();
    pathEdgeIds.push(...fEdges);

    // Backward path from intersectionNode to destination
    curr = intersectionNode;
    while (curr !== destination && curr !== -1) {
      const edgeId = prevEdgeB[curr];
      if (edgeId === -1) break;
      pathEdgeIds.push(edgeId);
      curr = prevNodeB[curr];
    }
  }

  const computeTimeMs = performance.now() - t0;
  return {
    recorder,
    pathEdgeIds,
    computeTimeMs,
    settledCount,
    scannedCount,
    pathLengthMeters: bestCost === Number.POSITIVE_INFINITY ? 0 : bestCost,
  };
}

// 4. GREEDY BEST-FIRST SEARCH
export function runGreedy(
  adjacency: AdjacencyEdge[][],
  nodes: InternalNodeData[],
  start: number,
  destination: number
): InternalAlgorithmResult {
  const t0 = performance.now();
  const numNodes = adjacency.length;

  const destNode = nodes[destination];
  const destPx = destNode ? destNode.px : 0;
  const destPy = destNode ? destNode.py : 0;

  const heuristic = (nodeIdx: number): number => {
    const n = nodes[nodeIdx];
    if (!n) return 0;
    const dx = n.px - destPx;
    const dy = n.py - destPy;
    return Math.hypot(dx, dy);
  };

  const visited = new Uint8Array(numNodes);
  const previousNode = new Int32Array(numNodes).fill(-1);
  const previousEdge = new Int32Array(numNodes).fill(-1);

  const heap = new MinHeap<number>();
  heap.push(heuristic(start), start);
  visited[start] = 1;

  const recorder = new EventRecorder(80000);
  let settledCount = 0;
  let scannedCount = 0;

  let reached = false;

  while (!heap.isEmpty()) {
    const node = heap.pop()!;

    recorder.add(EVENT_TYPE.SETTLE_NODE, node);
    settledCount++;

    if (node === destination) {
      reached = true;
      break;
    }

    for (const edge of adjacency[node]) {
      scannedCount++;
      recorder.add(EVENT_TYPE.SCAN_EDGE, edge.edgeId);

      if (!visited[edge.target]) {
        visited[edge.target] = 1;
        previousNode[edge.target] = node;
        previousEdge[edge.target] = edge.edgeId;

        recorder.add(EVENT_TYPE.RELAX_EDGE, edge.edgeId);
        heap.push(heuristic(edge.target), edge.target);
      }
    }
  }

  const path = reconstructPath(start, destination, previousNode, previousEdge);
  
  // Compute path total weight
  let pathLengthMeters = 0;
  if (reached) {
    for (const edgeId of path.pathEdgeIds) {
      // Find edge weight
      for (const adjList of adjacency) {
        const found = adjList.find(e => e.edgeId === edgeId);
        if (found) {
          pathLengthMeters += found.weight;
          break;
        }
      }
    }
  }

  const computeTimeMs = performance.now() - t0;
  return {
    recorder,
    pathEdgeIds: path.pathEdgeIds,
    computeTimeMs,
    settledCount,
    scannedCount,
    pathLengthMeters,
  };
}

// 5. BREADTH-FIRST SEARCH (BFS)
export function runBFS(
  adjacency: AdjacencyEdge[][],
  start: number,
  destination: number
): InternalAlgorithmResult {
  const t0 = performance.now();
  const numNodes = adjacency.length;

  const visited = new Uint8Array(numNodes);
  const previousNode = new Int32Array(numNodes).fill(-1);
  const previousEdge = new Int32Array(numNodes).fill(-1);

  const queue: number[] = [start];
  visited[start] = 1;

  let head = 0;
  const recorder = new EventRecorder(80000);
  let settledCount = 0;
  let scannedCount = 0;
  let reached = false;

  while (head < queue.length) {
    const node = queue[head++];

    recorder.add(EVENT_TYPE.SETTLE_NODE, node);
    settledCount++;

    if (node === destination) {
      reached = true;
      break;
    }

    for (const edge of adjacency[node]) {
      scannedCount++;
      recorder.add(EVENT_TYPE.SCAN_EDGE, edge.edgeId);

      if (!visited[edge.target]) {
        visited[edge.target] = 1;
        previousNode[edge.target] = node;
        previousEdge[edge.target] = edge.edgeId;

        recorder.add(EVENT_TYPE.RELAX_EDGE, edge.edgeId);
        queue.push(edge.target);
      }
    }
  }

  const path = reconstructPath(start, destination, previousNode, previousEdge);
  
  let pathLengthMeters = 0;
  if (reached) {
    for (const edgeId of path.pathEdgeIds) {
      for (const adjList of adjacency) {
        const found = adjList.find(e => e.edgeId === edgeId);
        if (found) {
          pathLengthMeters += found.weight;
          break;
        }
      }
    }
  }

  const computeTimeMs = performance.now() - t0;
  return {
    recorder,
    pathEdgeIds: path.pathEdgeIds,
    computeTimeMs,
    settledCount,
    scannedCount,
    pathLengthMeters,
  };
}

// 6. DEPTH-FIRST SEARCH (DFS)
export function runDFS(
  adjacency: AdjacencyEdge[][],
  start: number,
  destination: number
): InternalAlgorithmResult {
  const t0 = performance.now();
  const numNodes = adjacency.length;

  const visited = new Uint8Array(numNodes);
  const previousNode = new Int32Array(numNodes).fill(-1);
  const previousEdge = new Int32Array(numNodes).fill(-1);

  const stack: number[] = [start];
  visited[start] = 1;

  const recorder = new EventRecorder(80000);
  let settledCount = 0;
  let scannedCount = 0;
  let reached = false;

  while (stack.length > 0) {
    const node = stack.pop()!;

    recorder.add(EVENT_TYPE.SETTLE_NODE, node);
    settledCount++;

    if (node === destination) {
      reached = true;
      break;
    }

    for (const edge of adjacency[node]) {
      scannedCount++;
      recorder.add(EVENT_TYPE.SCAN_EDGE, edge.edgeId);

      if (!visited[edge.target]) {
        visited[edge.target] = 1;
        previousNode[edge.target] = node;
        previousEdge[edge.target] = edge.edgeId;

        recorder.add(EVENT_TYPE.RELAX_EDGE, edge.edgeId);
        stack.push(edge.target);
      }
    }
  }

  const path = reconstructPath(start, destination, previousNode, previousEdge);

  let pathLengthMeters = 0;
  if (reached) {
    for (const edgeId of path.pathEdgeIds) {
      for (const adjList of adjacency) {
        const found = adjList.find(e => e.edgeId === edgeId);
        if (found) {
          pathLengthMeters += found.weight;
          break;
        }
      }
    }
  }

  const computeTimeMs = performance.now() - t0;
  return {
    recorder,
    pathEdgeIds: path.pathEdgeIds,
    computeTimeMs,
    settledCount,
    scannedCount,
    pathLengthMeters,
  };
}
