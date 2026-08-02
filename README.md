# 🗺️ Berlin City Pathfinding Visualizer & Animation Engine

A high-performance, real-time pathfinding algorithm visualizer that converts real-world city road networks into animated graphs. Built with **React**, **TypeScript**, **HTML5 Canvas**, and **Web Workers**.

> **Visualizing Dijkstra, A*, Bidirectional Dijkstra, Greedy Best-First, BFS, and DFS in real-time on 22,000+ Berlin city roads.**

---

## 🚀 Quick Start Guide (Run in 3 Simple Steps)

You don't need any prior technical experience to run this project! Follow these simple steps:

### Step 1: Open your Terminal / Command Prompt
Open your terminal app (Mac: press `Cmd + Space` and search for **Terminal**; Windows: search for **PowerShell** or **Command Prompt**).

Navigate to the project folder:
```bash
cd /path/to/visualizing-path-finding-algorithms
```

### Step 2: Install dependencies
Copy and paste this command, then press `Enter`:
```bash
npm install
```

### Step 3: Launch the visualizer!
Run this command:
```bash
npm run dev
```

You will see a link like `http://localhost:3000` printed on the screen. **Click or open that link in your web browser (Chrome / Safari / Edge)**!

---

## 🌐 Deploy to GitHub Pages (`github.io`)

This project is configured for automated deployment to GitHub Pages via **GitHub Actions** and the `gh-pages` package.

### Option A: Automatic Deployment (Recommended)
1. Push your repository to GitHub (`git push origin main`).
2. On GitHub, navigate to **Settings > Pages**.
3. Under **Build and deployment > Source**, select **GitHub Actions**.
4. Every push to `main` will automatically build and publish your site to `https://<your-username>.github.io/<repository-name>/`.

### Option B: Manual Command Line Deployment
Run:
```bash
npm run deploy
```

---

## 🎮 How to Use the Interface

| Button / Control | What it does |
| :--- | :--- |
| **Algorithm Selector Tabs** | Switch between Dijkstra, A*, Bidirectional Dijkstra, Greedy Best-First, BFS, and DFS. |
| **▶ Run Path** | Starts the live animation of the selected algorithm exploring Berlin's streets. |
| **🔀 Randomize** | Picks a new random starting point (red) and destination point (green) across the city. |
| **🎞️ 30s Showcase** | Plays an automated 30-second presentation that cycles through all 6 algorithms. |
| **📹 Record Video** | Records the canvas directly into a **30-second WebM video file** saved straight to your Downloads folder! |
| **Anim Duration Slider** | Speeds up or slows down the animation (from 1 second to 10 seconds). |
| **❓ Info Icon** | Opens an educational guide explaining the time complexity and math behind each algorithm. |
| **Zoom & Pan Controls** | Use mouse wheel or `+`/`-` buttons to zoom up to 2500%. Click and drag to pan across Berlin. |

---

## 🐍 (Optional) Generating Custom City Graph Data

The project comes pre-loaded with **Berlin, Germany** (`public/data/berlin.json`).

If you wish to re-download or extract fresh map data using OpenStreetMap:

1. **Set up Python environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install osmnx geopandas networkx
   ```

2. **Run the city exporter script:**
   ```bash
   python scripts/export_city.py
   ```

*(This will query OpenStreetMap via `OSMnx`, project geographic coordinates into meters, and save `public/data/berlin.json` automatically).*

---

## 🛠️ Architecture & Tech Stack

- **Frontend Core**: React 18 + TypeScript + Vite
- **Rendering Layer**: 3 Stacked HTML5 Canvases
  1. *Base Canvas*: Dark road network (`rgba(27, 41, 66, 0.55)`), rendered once.
  2. *Exploration Canvas*: Cyan glowing algorithm expansion paths (`rgba(27, 207, 255, 0.92)`).
  3. *Overlay Canvas*: Animated glowing start & destination points and final path lighting.
- **Worker & Algorithms**: Off-main-thread Web Worker using a custom **Binary MinHeap** and zero-copy `Uint32Array` event buffer transfers.
- **Video Export**: Canvas `captureStream()` API with `MediaRecorder`.