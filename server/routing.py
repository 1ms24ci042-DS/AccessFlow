"""
AccessFlow Bengaluru — Routing Module
Handles route planning via OSRM public API with accessibility-aware confidence scoring.
"""

import json
import math
import os
import requests


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


def _load_incidents() -> list:
    """Load current incidents from the shared JSON file."""
    path = os.path.join(DATA_DIR, "incidents.json")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return []


def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in kilometres between two lat/lng points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# OSRM Route Fetcher
# ---------------------------------------------------------------------------

OSRM_BASE = "https://router.project-osrm.org/route/v1/driving"


def _fetch_osrm_route(
    start_lat: float, start_lng: float, end_lat: float, end_lng: float
) -> dict | None:
    """Call OSRM public API and return the first route, or None on failure."""
    url = (
        f"{OSRM_BASE}/{start_lng},{start_lat};{end_lng},{end_lat}"
        f"?overview=full&geometries=geojson&steps=true"
    )
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") == "Ok" and data.get("routes"):
            return data["routes"][0]
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# Confidence Scoring
# ---------------------------------------------------------------------------

SEVERITY_PENALTY = {"HIGH": 0.25, "MEDIUM": 0.15, "LOW": 0.05, "NONE": 0.0}
INCIDENT_PROXIMITY_KM = 0.8  # incidents within this radius lower confidence


def _compute_confidence(route_coords: list[list[float]], incidents: list) -> tuple:
    """
    Walk the route polyline and check proximity to known incidents.
    Returns (confidence: float, avoids: list[str]).
    """
    confidence = 1.0
    avoids: list[str] = []

    for inc in incidents:
        if inc.get("type") == "CLEAR":
            continue
        inc_lat = inc["lat"]
        inc_lng = inc["lng"]
        # Check if any route coordinate passes near this incident
        for coord in route_coords:
            # GeoJSON is [lng, lat]
            rlng, rlat = coord[0], coord[1]
            dist = _haversine(rlat, rlng, inc_lat, inc_lng)
            if dist <= INCIDENT_PROXIMITY_KM:
                penalty = SEVERITY_PENALTY.get(inc.get("severity", "LOW"), 0.05)
                confidence -= penalty
                label = f"{inc['location']} ({inc['type']})"
                if label not in avoids:
                    avoids.append(label)
                break  # one penalty per incident

    confidence = max(round(confidence, 2), 0.1)
    return confidence, avoids


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def plan_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
) -> dict:
    """
    Plan a route from start to end, score it against current incidents,
    and return a structured result.
    """
    osrm_route = _fetch_osrm_route(start_lat, start_lng, end_lat, end_lng)

    if osrm_route is None:
        # Fallback: straight-line route with low confidence
        distance_km = round(_haversine(start_lat, start_lng, end_lat, end_lng), 2)
        return {
            "route": [[start_lat, start_lng], [end_lat, end_lng]],
            "distance_km": distance_km,
            "duration_min": round(distance_km / 0.5, 1),  # ~30 km/h avg
            "confidence": 0.4,
            "avoids": [],
            "fallback": True,
        }

    # Extract coordinates (convert GeoJSON [lng, lat] → [lat, lng] for frontend)
    geojson_coords = osrm_route["geometry"]["coordinates"]
    route_latlng = [[c[1], c[0]] for c in geojson_coords]

    distance_km = round(osrm_route["distance"] / 1000, 2)
    duration_min = round(osrm_route["duration"] / 60, 1)

    incidents = _load_incidents()
    confidence, avoids = _compute_confidence(geojson_coords, incidents)

    return {
        "route": route_latlng,
        "distance_km": distance_km,
        "duration_min": duration_min,
        "confidence": confidence,
        "avoids": avoids,
        "fallback": False,
    }
