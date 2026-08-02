import json
from pathlib import Path
import osmnx as ox

# Central Berlin coordinates (around Mitte / Alexanderplatz / Tiergarten)
LAT = 52.5200
LON = 13.4050
RADIUS = 12000  # meters to get ~25,000 - 30,000 nodes

PLACE = "Berlin, Germany"
OUTPUT = Path("public/data/berlin.json")


def normalize(value: float, minimum: float, maximum: float) -> float:
    if maximum == minimum:
        return 0.0
    return (value - minimum) / (maximum - minimum)


def main():
    print(f"Fetching network for {PLACE} around ({LAT}, {LON}) with radius {RADIUS}m...")
    
    try:
        graph = ox.graph_from_point(
            (LAT, LON),
            dist=RADIUS,
            network_type="drive",
            simplify=True,
        )
    except Exception as e:
        print(f"Failed with point search ({e}), falling back to graph_from_place...")
        graph = ox.graph_from_place(
            PLACE,
            network_type="drive",
            simplify=True,
        )

    print("Projecting graph coordinates...")
    graph = ox.project_graph(graph)

    nodes_gdf, edges_gdf = ox.graph_to_gdfs(graph)

    xmin, ymin, xmax, ymax = edges_gdf.total_bounds

    node_indices = {
        osm_node_id: index
        for index, osm_node_id in enumerate(graph.nodes)
    }

    nodes = []

    for osm_node_id, attributes in graph.nodes(data=True):
        proj_x = float(attributes["x"])
        proj_y = float(attributes["y"])
        nodes.append(
            {
                "id": node_indices[osm_node_id],
                "x": normalize(proj_x, xmin, xmax),
                # Invert Y because canvas coordinates increase downward.
                "y": 1.0 - normalize(proj_y, ymin, ymax),
                "px": proj_x,
                "py": proj_y,
            }
        )

    edges = []

    for (source, target, key), row in edges_gdf.iterrows():
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

        edges.append(
            {
                "id": len(edges),
                "source": node_indices[source],
                "target": node_indices[target],
                "weight": float(row["length"]),
                "points": points,
            }
        )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "name": "BERLIN",
        "full_name": PLACE,
        "nodes": nodes,
        "edges": edges,
        "bounds": {"xmin": float(xmin), "ymin": float(ymin), "xmax": float(xmax), "ymax": float(ymax)},
    }

    OUTPUT.write_text(
        json.dumps(data, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"Exported {len(nodes):,} nodes and {len(edges):,} edges to {OUTPUT}")


if __name__ == "__main__":
    main()
