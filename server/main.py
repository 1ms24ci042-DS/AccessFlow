"""
AccessFlow Bengaluru — FastAPI Backend
All API endpoints for the AccessFlow system.
"""

import json
import os
import sys

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Ensure project root is on sys.path so imports work when running with
#   uvicorn server.main:app
# from the accessflow/ directory.
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ai.vlm import analyze_image  # noqa: E402
from ai.routing_agent import plan_route  # noqa: E402
from server.alerts import generate_emergency_alert, generate_bbmp_complaint  # noqa: E402

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
IMAGES_DIR = os.path.join(DATA_DIR, "images")
INCIDENTS_FILE = os.path.join(DATA_DIR, "incidents.json")

# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AccessFlow Bengaluru",
    description="AI-powered accessible navigation backend for Bengaluru",
    version="1.0.0",
)

# CORS — allow frontend to call backend from any origin during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve images statically so frontend can reference them
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_incidents() -> list:
    try:
        with open(INCIDENTS_FILE, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return []


def _save_incidents(incidents: list) -> None:
    with open(INCIDENTS_FILE, "w", encoding="utf-8") as fh:
        json.dump(incidents, fh, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class RouteRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float
    user_type: str = "default"


class AlertRequest(BaseModel):
    location: str
    incident_type: str
    severity: str = "HIGH"
    description: str = ""


class ComplaintRequest(BaseModel):
    location: str
    incident_type: str
    description: str = ""
    accessibility_issue: bool = True


class AnalyzePathRequest(BaseModel):
    image_path: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {
        "service": "AccessFlow Bengaluru",
        "status": "running",
        "endpoints": ["/analyze", "/route", "/pins", "/alert", "/complaint"],
    }


# ---- POST /analyze -------------------------------------------------------

@app.post("/analyze")
async def analyze_endpoint(request: AnalyzePathRequest):
    """
    Analyse a traffic image using the VLM pipeline.
    Accepts a JSON body with `image_path` (relative to data/images/).
    """
    # Build full path
    image_path = request.image_path
    if not os.path.isabs(image_path):
        image_path = os.path.join(IMAGES_DIR, image_path)

    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail=f"Image not found: {image_path}")

    result = analyze_image(image_path)
    return result


@app.post("/analyze/upload")
async def analyze_upload_endpoint(file: UploadFile = File(...)):
    """
    Analyse an uploaded traffic image using the VLM pipeline.
    """
    # Save uploaded file temporarily
    temp_path = os.path.join(IMAGES_DIR, f"_upload_{file.filename}")
    try:
        contents = await file.read()
        with open(temp_path, "wb") as fh:
            fh.write(contents)

        result = analyze_image(temp_path)
        return result
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ---- POST /route ----------------------------------------------------------

@app.post("/route")
async def route_endpoint(request: RouteRequest):
    """
    Plan an accessible route between two points.
    """
    incidents = _load_incidents()
    result = plan_route(
        start=[request.start_lat, request.start_lng],
        end=[request.end_lat, request.end_lng],
        user_type=request.user_type,
        incidents=incidents,
    )
    return result


# ---- GET /pins ------------------------------------------------------------

@app.get("/pins")
async def pins_endpoint():
    """
    Return all current incident pins for the map.
    """
    incidents = _load_incidents()
    return incidents


# ---- POST /alert ----------------------------------------------------------

@app.post("/alert")
async def alert_endpoint(request: AlertRequest):
    """
    Generate an emergency alert for a given incident.
    """
    result = generate_emergency_alert(
        location=request.location,
        incident_type=request.incident_type,
        severity=request.severity,
        description=request.description,
    )
    return result


# ---- POST /complaint ------------------------------------------------------

@app.post("/complaint")
async def complaint_endpoint(request: ComplaintRequest):
    """
    Generate a BBMP complaint draft for an infrastructure/accessibility issue.
    """
    result = generate_bbmp_complaint(
        location=request.location,
        incident_type=request.incident_type,
        description=request.description,
        accessibility_issue=request.accessibility_issue,
    )
    return result


# ---------------------------------------------------------------------------
# Run with: uvicorn server.main:app --reload --port 8000
# ---------------------------------------------------------------------------
