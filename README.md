# Berlin City Pathfinding Visualizer

An interactive pathfinding algorithm visualizer and animation engine built on OpenStreetMap road networks. The system converts real-world city geometry into projected NetworkX graphs and renders path exploration off the main thread using Web Workers and layered HTML5 Canvases.

## Features

- **Real-World Graph Topology**: Preprocessed road network of central Berlin containing 22,386 nodes and 57,023 edges exported via OSMnx and GeoPandas.
- **Instrumented Pathfinding Algorithms**:
  - **Dijkstra**: Guarantees the shortest path using exact distance weights.
  - **A\* Search**: Heuristic-guided search utilizing projected metric Euclidean distance.
  - **Bidirectional Dijkstra**: Simultaneous forward and backward search from source and destination.
  - **Greedy Best-First Search**: Fast heuristic exploration.
  - **Breadth-First Search (BFS)**: Level-by-level unit-cost graph traversal.
  - **Depth-First Search (DFS)**: Branch-first graph traversal.
- **Off-Thread Web Worker Engine**: Algorithms run off the main UI thread with binary min-heaps and zero-copy `Uint32Array` event buffer transfers.
- **Layered HTML5 Canvas Renderer**: High-DPI canvas engine separating static base networks, dynamic exploration frontiers, and animated luminous route overlays.
- **Interactive Map Viewport**: Metric 1:1 aspect-ratio containment with mouse wheel zoom, click-and-drag panning, and touch pinch gestures.
- **Video Recording Showcase**: Captures canvas playback into downloadable 30-second WebM videos via the `MediaRecorder` API.

---

## Quick Start

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18 or higher) installed on your system.

### Running Locally

1. Clone the repository and navigate into the project directory:
   ```bash
   git clone https://github.com/SyedBaqarAbbas/visualizing-path-finding-algorithms.git
   cd visualizing-path-finding-algorithms
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`.

---

## Deployment

### GitHub Pages (Automated via GitHub Actions)

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and publishes the application to GitHub Pages upon pushing to the `main` branch.

To enable GitHub Pages:
1. Navigate to repository **Settings > Pages**.
2. Under **Build and deployment > Source**, select **GitHub Actions**.

### Manual Deployment

You can also trigger a manual production build and deploy to the `gh-pages` branch:
```bash
npm run deploy
```

---

## Custom City Graph Preprocessing

The default dataset uses pre-processed Berlin graph data stored in `public/data/berlin.json`.

To download and process a custom bounding box or city graph using OSMnx:

1. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install osmnx geopandas networkx
   ```

2. Run the export script:
   ```bash
   python scripts/export_city.py
   ```

---

## Architecture & Data Flow

```text
OpenStreetMap / OSMnx  ──>  Projected Metric Graph  ──>  public/data/berlin.json
                                                                 │
                                                                 ▼
React UI  <── [Uint32Array Buffer] <── Pathfinder Worker <── Graph Adjacency
   │
   ├── Base Canvas (Static Network)
   ├── Exploration Canvas (Frontier Progression)
   └── Overlay Canvas (Endpoints, Pulses & Glow Path)
```

## License

MIT License.