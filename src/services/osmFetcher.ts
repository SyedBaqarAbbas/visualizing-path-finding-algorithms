import { CityGraph, GraphNode, GraphEdge } from '../types/graph';

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
}

interface OSMNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

interface OSMWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

type OSMElement = OSMNode | OSMWay;

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const degToRad = (deg: number) => (deg * Math.PI) / 180;

// Geocode city query using OpenStreetMap Nominatim API (HTTPS + CORS enabled)
export async function geocodeCity(query: string): Promise<{ name: string; lat: number; lon: number }> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Geocoding failed with status: ${res.status}`);
  }

  const data: NominatimResult[] = await res.json();
  if (!data || data.length === 0) {
    throw new Error(`City "${query}" not found. Please try a different location.`);
  }

  const result = data[0];
  const name = result.display_name.split(',')[0].trim();
  return {
    name,
    lat: parseFloat(result.lat),
    lon: parseFloat(result.lon),
  };
}

// Fetch street network from Overpass API (HTTPS + CORS enabled)
export async function fetchCityGraphFromOSM(
  cityName: string,
  centerLat: number,
  centerLon: number,
  radiusKm: number = 2.2
): Promise<CityGraph> {
  const latDelta = radiusKm / 111.0;
  const lonDelta = radiusKm / (111.0 * Math.cos(degToRad(centerLat)));

  const south = centerLat - latDelta;
  const north = centerLat + latDelta;
  const west = centerLon - lonDelta;
  const east = centerLon + lonDelta;

  const overpassQuery = `[out:json][timeout:25];
(
  way["highway"~"motorway|trunk|primary|secondary|tertiary|unclassified|residential"](${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)});
);
out body;
>;
out skel qt;`;

  let res: Response | null = null;
  let lastError: Error | null = null;

  // Try Overpass endpoints with fallback
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const overpassUrl = `${endpoint}?data=${encodeURIComponent(overpassQuery)}`;
      const attempt = await fetch(overpassUrl);
      if (attempt.ok) {
        res = attempt;
        break;
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  if (!res) {
    throw new Error(
      lastError?.message ||
        `Overpass API is currently busy or unreachable. Please try again in a few seconds.`
    );
  }

  const json = await res.json();
  const elements: OSMElement[] = json.elements || [];

  const osmNodesMap = new Map<number, OSMNode>();
  const osmWays: OSMWay[] = [];

  for (const elem of elements) {
    if (elem.type === 'node') {
      osmNodesMap.set(elem.id, elem);
    } else if (elem.type === 'way') {
      osmWays.push(elem);
    }
  }

  if (osmWays.length === 0 || osmNodesMap.size === 0) {
    throw new Error(`No drivable roads found in ${cityName}. Try another location.`);
  }

  const usedNodeIds = new Set<number>();
  for (const way of osmWays) {
    for (const nid of way.nodes) {
      if (osmNodesMap.has(nid)) {
        usedNodeIds.add(nid);
      }
    }
  }

  const nodeIndexMap = new Map<number, number>();
  const nodes: GraphNode[] = [];

  let idx = 0;
  usedNodeIds.forEach((osmId) => {
    const node = osmNodesMap.get(osmId)!;
    nodeIndexMap.set(osmId, idx);

    const meanLatRad = degToRad(centerLat);
    const xMeters = node.lon * 111320 * Math.cos(meanLatRad);
    const yMeters = node.lat * 110574;

    nodes.push({
      id: idx,
      x: 0,
      y: 0,
      px: xMeters,
      py: yMeters,
    });
    idx++;
  });

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;

  nodes.forEach((n) => {
    if (n.px < minX) minX = n.px;
    if (n.px > maxX) maxX = n.px;
    if (n.py < minY) minY = n.py;
    if (n.py > maxY) maxY = n.py;
  });

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  nodes.forEach((n) => {
    n.x = (n.px - minX) / rangeX;
    n.y = 1.0 - (n.py - minY) / rangeY;
  });

  const edges: GraphEdge[] = [];
  let edgeId = 0;

  for (const way of osmWays) {
    const isOneWay = way.tags?.oneway === 'yes';

    for (let i = 0; i < way.nodes.length - 1; i++) {
      const uOsm = way.nodes[i];
      const vOsm = way.nodes[i + 1];

      if (!nodeIndexMap.has(uOsm) || !nodeIndexMap.has(vOsm)) continue;

      const uIdx = nodeIndexMap.get(uOsm)!;
      const vIdx = nodeIndexMap.get(vOsm)!;

      const uNode = nodes[uIdx];
      const vNode = nodes[vIdx];

      const dx = vNode.px - uNode.px;
      const dy = vNode.py - uNode.py;
      const weight = Math.hypot(dx, dy);

      edges.push({
        id: edgeId++,
        source: uIdx,
        target: vIdx,
        weight,
        points: [
          [uNode.x, uNode.y],
          [vNode.x, vNode.y],
        ],
      });

      if (!isOneWay) {
        edges.push({
          id: edgeId++,
          source: vIdx,
          target: uIdx,
          weight,
          points: [
            [vNode.x, vNode.y],
            [uNode.x, uNode.y],
          ],
        });
      }
    }
  }

  return {
    name: cityName,
    full_name: `${cityName}, OpenStreetMap Network`,
    bounds: {
      xmin: minX,
      ymin: minY,
      xmax: maxX,
      ymax: maxY,
    },
    nodes,
    edges,
  };
}
