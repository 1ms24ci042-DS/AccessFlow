"""
AccessFlow Bengaluru — VLM (Vision Language Model) Pipeline
Analyses traffic camera images using Google Gemini Flash.
Returns structured incident classification JSON.
"""

import json
import os

from PIL import Image

# ---------------------------------------------------------------------------
# Gemini setup
# ---------------------------------------------------------------------------
_gemini_model = None

try:
    import google.generativeai as genai

    _api_key = os.environ.get("GEMINI_API_KEY", "")
    if _api_key:
        genai.configure(api_key=_api_key)
        _gemini_model = genai.GenerativeModel("gemini-2.0-flash")
except Exception:
    pass


# ---------------------------------------------------------------------------
# Image preprocessing
# ---------------------------------------------------------------------------

MAX_DIMENSION = 1024


def _preprocess_image(image_path: str) -> Image.Image:
    """Open and resize the image so the longest side is ≤ MAX_DIMENSION."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    if max(w, h) > MAX_DIMENSION:
        scale = MAX_DIMENSION / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return img


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a traffic analysis AI for Bengaluru, India.
Analyse the provided traffic camera image and return ONLY a JSON object with these fields:

{
  "type": "ACCIDENT" | "FLOOD" | "BLOCKED" | "CONGESTION" | "CLEAR",
  "severity": "HIGH" | "MEDIUM" | "LOW" | "NONE",
  "description": "<one-sentence description of what you see>",
  "emergency": true | false,
  "accessible": true | false
}

Rules:
- "type" must be exactly one of the five values listed.
- "severity" is HIGH for life-threatening or fully blocked, MEDIUM for partial, LOW for minor, NONE for clear.
- "emergency" is true only if immediate emergency services are needed.
- "accessible" is true only if a wheelchair user could safely navigate the visible road/footpath.
- Return ONLY valid JSON. No markdown, no explanation, no code fences."""


def analyze_image(image_path: str) -> dict:
    """
    Analyse a traffic image and return a structured incident dict.
    Uses Gemini Flash if available; falls back to a CLEAR default.
    """
    # Fallback result used when VLM is unavailable or fails
    fallback = {
        "type": "CLEAR",
        "severity": "NONE",
        "description": "Unable to analyse image — defaulting to CLEAR.",
        "emergency": False,
        "accessible": True,
    }

    if _gemini_model is None:
        fallback["description"] = "VLM unavailable (no API key). Defaulting to CLEAR."
        return fallback

    try:
        img = _preprocess_image(image_path)
        response = _gemini_model.generate_content([_SYSTEM_PROMPT, img])
        text = response.text.strip()

        # Strip markdown code fences if the model wraps the JSON
        if text.startswith("```"):
            text = text.split("\n", 1)[1]  # remove first line
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
        text = text.strip()

        result = json.loads(text)

        # Validate required keys
        required_keys = {"type", "severity", "description", "emergency", "accessible"}
        if not required_keys.issubset(result.keys()):
            raise ValueError("Missing keys in VLM response")

        # Clamp type to known values
        valid_types = {"ACCIDENT", "FLOOD", "BLOCKED", "CONGESTION", "CLEAR"}
        if result["type"] not in valid_types:
            result["type"] = "CLEAR"

        return result

    except Exception as exc:
        fallback["description"] = f"VLM analysis failed ({exc}). Defaulting to CLEAR."
        return fallback
