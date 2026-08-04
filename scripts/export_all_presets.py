import json
from pathlib import Path
import osmnx as ox

PRESET_CITIES = [
    {"key": "berlin", "name": "BERLIN", "place": "Berlin, Germany", "lat": 52.5200, "lon": 13.4050, "dist": 11000},
    {"key": "lahore", "name": "LAHORE", "place": "Lahore, Pakistan", "lat": 31.5204, "lon": 74.3587, "dist": 8000},
    {"key": "london", "name": "LONDON", "place": "London, United Kingdom", "lat": 51.5074, "lon": -0.1278, "dist": 8000},
    {"key": "new_york", "name": "NEW YORK", "place": "New York, United States", "lat": 40.7128, "lon": -74.0060, "dist": 8000},
    {"key": "tokyo", "name": "TOKYO", "place": "Tokyo, Japan", "lat": 35.6762, "lon": 139.6503, "dist": 8000},
    {"key": "paris", "name": "PARIS", "place": "Paris, France", "lat": 48.8566, "lon": 2.3522, "dist": 7000},
]

OUTPUT_DIR = Path("public/data")

def normalize(value: float, minimum: float, maximum: float) -> float:
    if maximum == minimum:
        return 0.0
    return (value - minimum) / (maximum - minimum)

def export_city(city_info):
    name = city_info["name"]
    place = city_info["place"]
    lat = city_info["lat"]
    lon = city_info["lon"]
    dist = city_info["dist"]
    key = city_info["key"]
    output_path = OUTPUT_DIR / f"{key}.json"

    print(f"\n==========================================")
    print(f"Fetching network for {name} ({place}) around ({lat}, {lon}) dist={dist}m...")

    try:
        graph = ox.graph_from_point((lat, lon), dist=dist, network_type="drive", simplify=True)
    except Exception as e:
        print(f"Point search failed ({e}), trying place search...")
        graph = ox.graph_from_place(place, network_type="drive", simplify=True)

    print("Projecting graph coordinates...")
    graph = ox.project_graph(graph)

    nodes_gdf, edges_gdf = ox.graph_to_gdfs(graph)
    xmin, ymin, xmax, ymax = edges_gdf.total_bounds

    node_indices = {osm_node_id: index for index, osm_node_id in enumerate(graph.nodes)}

    nodes = []
    for osm_node_id, attributes in graph.nodes(data=True):
        proj_x = float(attributes["x"])
        proj_y = float(attributes["y"])
        nodes.append({
            "id": node_indices[osm_node_id],
            "x": normalize(proj_x, xmin, xmax),
            "y": 1.0 - normalize(proj_y, ymin, ymax),
            "px": proj_x,
            "py": proj_y,
        })

    edges = []
    for (source, target, key_idx), row in edges_gdf.iterrows():
        geometry = row.geometry
        if geometry is not None:
            coordinates = list(geometry.coords)
        else:
            source_node = graph.nodes[source]
            target_node = graph.nodes[target]
            coordinates = [
                (source_node["x"], source_node["y"]),
                (target_node["x"], target_node["y"]),
            ]

        points = [
            [
                normalize(float(x), xmin, xmax),
                1.0 - normalize(float(y), ymin, ymax),
            ]
            for x, y in coordinates
        ]

        edges.append({
            "id": len(edges),
            "source": node_indices[source],
            "target": node_indices[target],
            "weight": float(row["length"]),
            "points": points,
        })

    data = {
        "name": name,
        "full_name": place,
        "nodes": nodes,
        "edges": edges,
        "bounds": {"xmin": float(xmin), "ymin": float(ymin), "xmax": float(xmax), "ymax": float(ymax)},
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"SUCCESS: Exported {len(nodes):,} nodes and {len(edges):,} edges to {output_path}")

def main():
    for city in PRESET_CITIES:
        export_city(city)

if __name__ == "__main__":
    main()
