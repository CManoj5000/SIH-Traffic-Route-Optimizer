import sys
import json
import math
import random

def haversine(lat1, lon1, lat2, lon2):
    """Calculates real-world distance between GPS coordinates in km."""
    R = 6371.0 
    lat1, lon1 = math.radians(lat1), math.radians(lon1)
    lat2, lon2 = math.radians(lat2), math.radians(lon2)
    
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def calculate_total_distance(routes):
    total = 0
    for route in routes:
        if len(route) > 1:
            for i in range(len(route) - 1):
                total += haversine(route[i]['lat'], route[i]['lon'], route[i+1]['lat'], route[i+1]['lon'])
    return total

def quantum_inspired_sa(nodes, fleet_size):
    if not nodes:
        return {"status": "error", "message": "No valid locations provided."}

    # --- CALCULATE THE "GOOGLE MAPS" BASELINE (Unoptimized Order) ---
    baseline_routes = [[] for _ in range(fleet_size)]
    for i, node in enumerate(nodes):
        baseline_routes[i % fleet_size].append(node)
    
    baseline_routes = [r for r in baseline_routes if r] 
    baseline_cost = calculate_total_distance(baseline_routes)

    # --- RUN QUANTUM-INSPIRED OPTIMIZATION ---
    # Give the algorithm a random starting state to shake things up
    shuffled_nodes = list(nodes)
    random.shuffle(shuffled_nodes)
    
    routes = [[] for _ in range(fleet_size)]
    for i, node in enumerate(shuffled_nodes):
        routes[i % fleet_size].append(node)
    
    routes = [r for r in routes if r] 
    
    current_cost = calculate_total_distance(routes)
    best_routes = [list(r) for r in routes]
    best_cost = current_cost
    
    temperature = 1000.0
    cooling_rate = 0.95
    min_temp = 1.0
    
    while temperature > min_temp:
        neighbor = [list(r) for r in routes]
        
        if len(nodes) > 1:
            route_idx = random.randint(0, len(neighbor) - 1)
            if len(neighbor[route_idx]) > 1 and random.random() > 0.5:
                i, j = random.sample(range(len(neighbor[route_idx])), 2)
                neighbor[route_idx][i], neighbor[route_idx][j] = neighbor[route_idx][j], neighbor[route_idx][i]
            elif len(neighbor) > 1:
                source_idx, target_idx = random.sample(range(len(neighbor)), 2)
                if neighbor[source_idx]:
                    node_to_move = neighbor[source_idx].pop(random.randint(0, len(neighbor[source_idx]) - 1))
                    neighbor[target_idx].append(node_to_move)

        if random.random() < 0.05: 
            random.shuffle(neighbor)
            for r in neighbor: random.shuffle(r)
        
        neighbor_cost = calculate_total_distance(neighbor)
        
        if neighbor_cost < current_cost:
            routes = neighbor
            current_cost = neighbor_cost
            if neighbor_cost < best_cost:
                best_routes = [list(r) for r in routes]
                best_cost = neighbor_cost
        else:
            probability = math.exp((current_cost - neighbor_cost) / temperature)
            if random.random() < probability:
                routes = neighbor
                current_cost = neighbor_cost
        
        temperature *= cooling_rate

    # Ensure best cost is never worse than baseline (safeguard)
    if baseline_cost < best_cost:
        best_cost = baseline_cost
        best_routes = baseline_routes

    # Calculate real mathematical savings (assuming average fleet speed of 60 km/h)
    distance_saved = max(0, baseline_cost - best_cost)
    time_saved_minutes = int((distance_saved / 60.0) * 60) # 1 km saved = roughly 1 min saved at 60km/h

    return {
        "status": "success",
        "baseline_distance_km": round(baseline_cost, 2),
        "total_distance_km": round(best_cost, 2),
        "distance_saved_km": round(distance_saved, 2),
        "estimated_time_saved_minutes": time_saved_minutes,
        "optimized_routes": [
            {"vehicle_id": i + 1, "path": [n["name"] for n in path], "full_nodes": path} for i, path in enumerate(best_routes)
        ]
    }

if __name__ == "__main__":
    try:
        input_string = sys.argv[1]
        input_data = json.loads(input_string)
        result = quantum_inspired_sa(input_data.get("nodes", []), input_data.get("fleet_size", 1))
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)