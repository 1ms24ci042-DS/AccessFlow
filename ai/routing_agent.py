"""
AccessFlow Bengaluru — Routing Agent (P2)
AI-powered accessible route selection using OSRM + Gemma/Ollama.

Pipeline:
  1. OSRM generates real candidate routes (geometry, distance, duration)
  2. Gemma/Ollama scores each route against live incidents + user type
  3. Best route is selected with confidence score + plain-English explanation

Gemma NEVER invents roads — it only scores, reasons, and explains.
OSRM handles all routing, geometry, and distances.
"""

import json
import math
import os
import re
import time
from typing import Any

import polyline
import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# OSRM public demo server (fine for prototype; self-host for production)
OSRM_BASE_URL: str = os.getenv(
    "OSRM_BASE_URL", "https://router.project-osrm.org"
)

# Ollama (local LLM for reasoning — same server your VLM uses)
OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL: str = os.getenv("OLLAMA_ROUTING_MODEL", "gemma3:4b")

# How far (metres) an incident can be from a route to affect it
INCIDENT_PROXIMITY_M: float = float(os.getenv("INCIDENT_RADIUS_M", "500"))

# Route labels
_ROUTE_LABELS = ["Route A", "Route B", "Route C", "Route D", "Route E"]

# ---------------------------------------------------------------------------
# Scoring penalties / bonuses (deterministic baseline)
# ---------------------------------------------------------------------------

_PENALTY_TABLE: dict[str, dict[str, int]] = {
    # incident_type → {severity → penalty}
    "ACCIDENT":   {"HIGH": -40, "MEDIUM": -25, "LOW": -10},
    "FLOOD":      {"HIGH": -50, "MEDIUM": -30, "LOW": -15},
    "BLOCKED":    {"HIGH": -60, "MEDIUM": -35, "LOW": -15},
    "CONGESTION": {"HIGH": -30, "MEDIUM": -15, "LOW": -5},
}

_ACCESSIBILITY_PENALTY: int = -60   # inaccessible incident on route
_ACCESSIBILITY_BONUS: int = 15      # fully accessible route

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in metres between two points."""
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2) ** 2
         + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _fmt_distance(metres: float) -> str:
    """Human-readable distance string."""
    if metres >= 1000:
        return f"{metres / 1000:.1f} km"
    return f"{int(metres)} m"


def _fmt_duration(seconds: float) -> str:
    """Human-readable duration string."""
    mins = seconds / 60
    if mins >= 60:
        h = int(mins // 60)
        m = int(mins % 60)
        return f"{h}h {m}min"
    return f"{int(mins)} min"


def _nearby_incidents(
    route_coords: list[tuple[float, float]],
    incidents: list[dict],
    radius_m: float = INCIDENT_PROXIMITY_M,
) -> list[dict]:
    """Return incidents within `radius_m` of any point on the route.

    We sample every 10th point to keep it fast on long routes.
    """
    nearby: list[dict] = []
    step = max(1, len(route_coords) // 100)  # ~100 sample points
    sampled = route_coords[::step]

    for inc in incidents:
        inc_lat = inc.get("lat", 0.0)
        inc_lng = inc.get("lng", 0.0)
        for rlat, rlng in sampled:
            if _haversine_m(rlat, rlng, inc_lat, inc_lng) <= radius_m:
                nearby.append(inc)
                break  # don't add same incident twice

    return nearby


# ---------------------------------------------------------------------------
# Function 1: get_osrm_routes()
# ---------------------------------------------------------------------------

def get_osrm_routes(
    start: list[float],
    end: list[float],
    num_alternatives: int = 2,
) -> list[dict]:
    """Fetch real candidate routes from the OSRM public API.

    Args:
        start: [latitude, longitude]
        end:   [latitude, longitude]
        num_alternatives: Number of alternative routes to request
                          (OSRM returns 1 main + up to N alternatives).

    Returns:
        List of route dicts, each containing:
            name        – label like "Route A"
            distance    – human-readable string
            distance_m  – raw metres
            time        – human-readable string
            duration_s  – raw seconds
            waypoints   – list of [lat, lng] coordinate pairs
            summary     – OSRM road-name summary
    """
    # OSRM expects lon,lat (not lat,lon)
    start_str = f"{start[1]},{start[0]}"
    end_str = f"{end[1]},{end[0]}"

    url = (
        f"{OSRM_BASE_URL}/route/v1/driving/{start_str};{end_str}"
        f"?overview=full&geometries=polyline"
        f"&alternatives={num_alternatives}"
        f"&steps=true"
    )

    print(f"[OSRM] Requesting routes: {start} -> {end}")
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    if data.get("code") != "Ok":
        raise RuntimeError(f"OSRM error: {data.get('message', data.get('code'))}")

    routes: list[dict] = []
    for idx, route in enumerate(data.get("routes", [])):
        # Decode the polyline to get [lat, lng] pairs
        coords = polyline.decode(route["geometry"])  # returns [(lat, lng), ...]

        # Build a short name from the step road-name summaries
        road_names: list[str] = []
        for leg in route.get("legs", []):
            for step in leg.get("steps", []):
                name = step.get("name", "").strip()
                if name and name not in road_names:
                    road_names.append(name)
        summary = ", ".join(road_names[:4]) or route.get("legs", [{}])[0].get("summary", "unnamed road")

        label = _ROUTE_LABELS[idx] if idx < len(_ROUTE_LABELS) else f"Route {idx + 1}"

        routes.append({
            "name": f"{label} via {summary}",
            "distance": _fmt_distance(route["distance"]),
            "distance_m": route["distance"],
            "time": _fmt_duration(route["duration"]),
            "duration_s": route["duration"],
            "waypoints": coords,
            "summary": summary,
        })

    print(f"[OSRM] Got {len(routes)} candidate route(s)")
    for r in routes:
        print(f"  - {r['name']}  |  {r['distance']}  |  {r['time']}")

    return routes


# ---------------------------------------------------------------------------
# Function 2: score_routes()
# ---------------------------------------------------------------------------

def _deterministic_score(
    route: dict,
    incidents: list[dict],
    user_type: str,
) -> tuple[int, list[str], list[dict]]:
    """Calculate a deterministic baseline score (0-100) for a route.

    Returns (score, reasons_list, nearby_incidents).
    """
    score = 100
    reasons: list[str] = []
    nearby = _nearby_incidents(route["waypoints"], incidents)

    has_accessibility_issue = False

    for inc in nearby:
        inc_type = inc.get("type", "CLEAR").upper()
        severity = inc.get("severity", "LOW").upper()
        penalty = _PENALTY_TABLE.get(inc_type, {}).get(severity, 0)
        score += penalty

        # Natural-language reason
        desc = inc.get("description", "")
        reasons.append(_incident_to_natural(inc_type, severity, desc))

        if not inc.get("accessible", True):
            has_accessibility_issue = True

    # Accessibility-specific adjustments
    if user_type in ("wheelchair", "mobility_aid", "visually_impaired"):
        if has_accessibility_issue:
            score += _ACCESSIBILITY_PENALTY
            reasons.append(
                f"This route has sections that are not safely passable "
                f"for a {user_type.replace('_', ' ')} user."
            )
        elif not nearby:
            score += _ACCESSIBILITY_BONUS
            reasons.append(
                "Fully accessible route with no active incidents detected."
            )

    # Slight preference for shorter routes (1 point per extra km over baseline)
    distance_km = route.get("distance_m", 0) / 1000
    if distance_km > 15:
        dist_penalty = -int((distance_km - 15) * 1)
        score += dist_penalty
        reasons.append(f"This is a longer route at {distance_km:.1f} km.")

    score = max(0, min(100, score))
    return score, reasons, nearby


# Map incident types to plain English
_NATURAL_TEMPLATES: dict[str, dict[str, str]] = {
    "ACCIDENT": {
        "HIGH": "A severe accident has been reported nearby, making this route dangerous.",
        "MEDIUM": "A moderate accident has been reported near this route.",
        "LOW": "A minor accident was reported nearby but the route is mostly clear.",
    },
    "FLOOD": {
        "HIGH": "Severe flooding detected nearby. Road may be impassable.",
        "MEDIUM": "Moderate waterlogging reported near this route.",
        "LOW": "Minor water accumulation reported but the road is passable.",
    },
    "BLOCKED": {
        "HIGH": "Road is fully blocked by an obstruction near this route.",
        "MEDIUM": "A partial obstruction has been reported near this route.",
        "LOW": "A minor obstruction was reported but the road is mostly clear.",
    },
    "CONGESTION": {
        "HIGH": "Heavy bumper-to-bumper congestion detected on this route.",
        "MEDIUM": "Moderate traffic congestion reported on this route.",
        "LOW": "Light traffic on this route, minor delays possible.",
    },
}


def _incident_to_natural(inc_type: str, severity: str, description: str = "") -> str:
    """Convert an incident into a plain-English sentence."""
    template = _NATURAL_TEMPLATES.get(inc_type, {}).get(severity)
    if template:
        # Append VLM description if available
        if description:
            return f"{template} ({description})"
        return template
    if description:
        return description
    return f"{inc_type} ({severity}) detected near route."


def _build_natural_explanation(reasons: list[str], is_recommended: bool) -> str:
    """Build a clean, user-facing explanation from a list of reasons."""
    if not reasons:
        return "No incidents detected. Route appears safe and accessible."
    if is_recommended:
        return "Recommended despite concerns: " + " ".join(reasons)
    return " ".join(reasons)


def _build_gemma_prompt(
    routes: list[dict],
    incidents: list[dict],
    user_type: str,
    deterministic_scores: list[dict],
) -> str:
    """Build a structured prompt for Gemma to reason over scored routes."""

    route_block = ""
    for i, r in enumerate(routes):
        ds = deterministic_scores[i]
        route_block += f"""
--- {r['name']} ---
Distance: {r['distance']}
Duration: {r['time']}
Baseline score: {ds['score']}/100
Nearby incidents: {len(ds['nearby_incidents'])}
Scoring notes:
{chr(10).join('  • ' + reason for reason in ds['reasons']) if ds['reasons'] else '  • None — route appears clear'}
"""

    incident_block = ""
    if incidents:
        for inc in incidents:
            incident_block += (
                f"  - {inc.get('type','UNKNOWN')} (severity: {inc.get('severity','?')}) "
                f"at [{inc.get('lat','?')}, {inc.get('lng','?')}] "
                f"| accessible: {inc.get('accessible', '?')}\n"
            )
    else:
        incident_block = "  No active incidents.\n"

    prompt = f"""You are the AccessFlow routing advisor. Your job is to select the
SAFEST and most ACCESSIBLE route for a {user_type} user.

You will be given candidate routes with pre-computed baseline scores and active
incidents. Review them and return your final recommendation.

=== ACTIVE INCIDENTS ===
{incident_block}

=== CANDIDATE ROUTES ===
{route_block}

=== INSTRUCTIONS ===
1. Review each route's baseline score and nearby incidents.
2. Consider accessibility requirements for a "{user_type}" user.
3. Pick the BEST route.
4. Adjust the confidence score if needed (0-100).
5. Write a short, plain-English explanation (2-3 sentences).
6. For each rejected route, write a 1-sentence reason.

Return ONLY a JSON object (no markdown fences, no extra text):
{{
  "best_route_index": <0-based index>,
  "confidence": <0-100>,
  "accessibility_score": <0-100>,
  "explanation": "<why this route is best>",
  "route_notes": [
    "<note for route 0>",
    "<note for route 1>",
    "<note for route 2>"
  ]
}}
"""
    return prompt


def _call_ollama(prompt: str) -> dict | None:
    """Call Ollama (Gemma) and parse the JSON response."""
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
    }

    try:
        print(f"[GEMMA] Calling Ollama ({OLLAMA_MODEL})...")
        t0 = time.time()
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
        elapsed = time.time() - t0
        raw = resp.json().get("response", "")
        print(f"[GEMMA] Response received in {elapsed:.1f}s")
        print(f"[GEMMA] Raw (first 300 chars): {raw[:300]}")

        # Robust JSON extraction
        text = raw.strip()
        # Strip markdown fences
        if "```" in text:
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines)

        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(text[start:end])

        print("[GEMMA] Could not extract JSON from response")
        return None

    except requests.ConnectionError:
        print(
            "[GEMMA] Cannot connect to Ollama. "
            "Make sure it's running: ollama serve"
        )
        return None
    except Exception as e:
        print(f"[GEMMA] Error: {e}")
        return None


def score_routes(
    routes: list[dict],
    incidents: list[dict],
    user_type: str = "general",
) -> list[dict]:
    """Score candidate routes using deterministic rules + AI reasoning.

    Args:
        routes:     List of route dicts from get_osrm_routes().
        incidents:  List of incident dicts from the VLM pipeline.
        user_type:  "wheelchair", "visually_impaired", "mobility_aid", or "general".

    Returns:
        List of scored route dicts (one per input route), each with:
            name, distance, time, score, accessibility_score,
            explanation, nearby_incidents, is_recommended
    """
    if not routes:
        return []

    # --- Step 1: Deterministic baseline scoring ---
    deterministic_scores: list[dict] = []
    for route in routes:
        score, reasons, nearby = _deterministic_score(route, incidents, user_type)
        deterministic_scores.append({
            "score": score,
            "reasons": reasons,
            "nearby_incidents": nearby,
        })

    # --- Step 2: AI reasoning via Gemma/Ollama ---
    ai_result = None
    prompt = _build_gemma_prompt(routes, incidents, user_type, deterministic_scores)
    ai_result = _call_ollama(prompt)

    # --- Step 3: Merge deterministic + AI results ---
    scored_routes: list[dict] = []

    # Find best route index
    if ai_result and isinstance(ai_result.get("best_route_index"), int):
        best_idx = ai_result["best_route_index"]
        if best_idx < 0 or best_idx >= len(routes):
            best_idx = max(range(len(routes)),
                           key=lambda i: deterministic_scores[i]["score"])
    else:
        best_idx = max(range(len(routes)),
                       key=lambda i: deterministic_scores[i]["score"])

    for i, route in enumerate(routes):
        ds = deterministic_scores[i]

        # Use AI confidence if available, otherwise use deterministic score
        if ai_result:
            confidence = (
                ai_result.get("confidence", ds["score"])
                if i == best_idx
                else ds["score"]
            )
            accessibility = ai_result.get("accessibility_score", 100 - len(ds["nearby_incidents"]) * 20)
            note = (
                ai_result.get("route_notes", [None] * len(routes))[i]
                if i < len(ai_result.get("route_notes", []))
                else None
            )
        else:
            confidence = ds["score"]
            accessibility = max(0, 100 - len(ds["nearby_incidents"]) * 20)
            note = None

        # Build explanation
        if i == best_idx and ai_result and ai_result.get("explanation"):
            explanation = ai_result["explanation"]
        elif note:
            explanation = note
        else:
            explanation = _build_natural_explanation(ds["reasons"], i == best_idx)

        scored_routes.append({
            "name": route["name"],
            "distance": route["distance"],
            "time": route["time"],
            "distance_m": route["distance_m"],
            "duration_s": route["duration_s"],
            "waypoints": route["waypoints"],
            "confidence": int(max(0, min(100, confidence))),
            "accessibility_score": int(max(0, min(100, accessibility))),
            "explanation": explanation,
            "nearby_incidents": ds["nearby_incidents"],
            "is_recommended": i == best_idx,
        })

    print(f"\n[SCORE] Scoring complete — recommended: {scored_routes[best_idx]['name']}")
    for sr in scored_routes:
        marker = "*" if sr["is_recommended"] else " "
        print(
            f"  {marker} {sr['name']:40s}  "
            f"confidence={sr['confidence']:3d}  "
            f"accessibility={sr['accessibility_score']:3d}  "
            f"incidents={len(sr['nearby_incidents'])}"
        )

    return scored_routes


# ---------------------------------------------------------------------------
# Function 3: plan_route()
# ---------------------------------------------------------------------------

def plan_route(
    start: list[float],
    end: list[float],
    user_type: str = "general",
    incidents: list[dict] | None = None,
) -> dict:
    """Main orchestration: generate routes → score → return best with alternates.

    Args:
        start:      [latitude, longitude]
        end:        [latitude, longitude]
        user_type:  "wheelchair", "visually_impaired", "mobility_aid", or "general"
        incidents:  List of incident dicts from VLM (or empty list)

    Returns:
        Clean JSON-serialisable dict:
        {
            "status": "ok",
            "user_type": "wheelchair",
            "recommended_route": { ... },
            "alternate_routes": [ ... ],
            "total_incidents_considered": 3,
            "model_used": "gemma3:4b"
        }
    """
    incidents = incidents or []

    print("\n" + "=" * 60)
    print("  AccessFlow — Routing Agent")
    print(f"  From: {start}  ->  To: {end}")
    print(f"  User: {user_type}  |  Active incidents: {len(incidents)}")
    print("=" * 60)

    # --- Step 1: Get real routes from OSRM ---
    try:
        routes = get_osrm_routes(start, end)
    except Exception as e:
        print(f"[ERROR] OSRM failed: {e}")
        return {
            "status": "error",
            "error": f"Could not fetch routes from OSRM: {e}",
            "user_type": user_type,
            "recommended_route": None,
            "alternate_routes": [],
        }

    if not routes:
        return {
            "status": "error",
            "error": "OSRM returned no routes for the given coordinates.",
            "user_type": user_type,
            "recommended_route": None,
            "alternate_routes": [],
        }

    # --- Step 2: Score all routes ---
    scored = score_routes(routes, incidents, user_type)

    # --- Step 3: Split into recommended + alternates ---
    recommended = None
    alternates: list[dict] = []

    for sr in scored:
        # Build a clean output dict (strip waypoints for alternates to save bandwidth)
        clean = {
            "name": sr["name"],
            "distance": sr["distance"],
            "time": sr["time"],
            "confidence": sr["confidence"],
            "accessibility_score": sr["accessibility_score"],
            "explanation": sr["explanation"],
            "incidents_nearby": len(sr["nearby_incidents"]),
        }

        if sr["is_recommended"]:
            clean["waypoints"] = sr["waypoints"]  # frontend needs geometry
            recommended = clean
        else:
            # Include waypoints for alternates too (frontend may draw them)
            clean["waypoints"] = sr["waypoints"]
            alternates.append(clean)

    # Sort alternates by confidence descending
    alternates.sort(key=lambda x: x["confidence"], reverse=True)

    result = {
        "status": "ok",
        "user_type": user_type,
        "recommended_route": recommended,
        "alternate_routes": alternates,
        "total_incidents_considered": len(incidents),
        "model_used": OLLAMA_MODEL,
    }

    print("\n" + "=" * 60)
    print("  RESULT")
    print("=" * 60)
    # Print without waypoints for readability
    display = json.loads(json.dumps(result))
    if display.get("recommended_route"):
        wp_count = len(display["recommended_route"].get("waypoints", []))
        display["recommended_route"]["waypoints"] = f"[{wp_count} points]"
    for alt in display.get("alternate_routes", []):
        wp_count = len(alt.get("waypoints", []))
        alt["waypoints"] = f"[{wp_count} points]"
    print(json.dumps(display, indent=2))

    return result


# ---------------------------------------------------------------------------
# CLI — standalone testing
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    print("=" * 60)
    print("  AccessFlow — Routing Agent Test")
    print(f"  OSRM: {OSRM_BASE_URL}")
    print(f"  Ollama: {OLLAMA_MODEL} @ {OLLAMA_URL}")
    print("=" * 60)

    # Default test: Silk Board → Majestic, Bengaluru
    start_coord = [12.9175, 77.6229]   # Silk Board Junction
    end_coord = [12.9716, 77.5946]     # Majestic / KSR Station

    user = "wheelchair"

    # Simulated incidents (normally these come from VLM)
    test_incidents = [
        {
            "type": "FLOOD",
            "severity": "HIGH",
            "lat": 12.9340,
            "lng": 77.6100,
            "accessible": False,
            "description": "Heavy waterlogging on Hosur Road underpass",
        },
        {
            "type": "ACCIDENT",
            "severity": "MEDIUM",
            "lat": 12.9520,
            "lng": 77.5980,
            "accessible": False,
            "description": "Two-wheeler collision near Lalbagh gate",
        },
        {
            "type": "CONGESTION",
            "severity": "HIGH",
            "lat": 12.9600,
            "lng": 77.5950,
            "accessible": True,
            "description": "Bumper-to-bumper traffic on JC Road",
        },
    ]

    # Allow overriding via CLI args
    if len(sys.argv) >= 5:
        start_coord = [float(sys.argv[1]), float(sys.argv[2])]
        end_coord = [float(sys.argv[3]), float(sys.argv[4])]
    if len(sys.argv) >= 6:
        user = sys.argv[5]

    result = plan_route(
        start=start_coord,
        end=end_coord,
        user_type=user,
        incidents=test_incidents,
    )

    # Write result to file for inspection
    out_path = os.path.join(os.path.dirname(__file__), "..", "data", "route_result.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\n[SAVED] {os.path.abspath(out_path)}")
