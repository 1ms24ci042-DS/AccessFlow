"""
AccessFlow Bengaluru - VLM Pipeline (P2)
Visual Language Model for real-time traffic image analysis.

Supports TWO modes:
  1. GEMINI API  (cloud, fast, free tier) - default
  2. OLLAMA LOCAL (runs on your GPU, no internet needed) - fallback / offline

Analyzes traffic/road images and returns structured JSON:
  - type: ACCIDENT | FLOOD | BLOCKED | CONGESTION | CLEAR
  - severity: HIGH | MEDIUM | LOW
  - description: what's happening in the image
  - emergency: bool
  - accessible: bool (can a wheelchair user pass?)
"""

import json
import io
import os
import sys
import base64
from pathlib import Path

from PIL import Image

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# API key for Gemini (only needed if using API mode)
# Set via:  $env:GEMINI_API_KEY = "your-key"  (PowerShell)
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# Which mode to use: "api" or "local"
# Set via:  $env:VLM_MODE = "local"  (PowerShell)
# Default: tries API first, falls back to local
VLM_MODE: str = os.getenv("VLM_MODE", "local")

# Maximum image dimension (pixels) before resizing
MAX_IMAGE_DIM: int = 1024

# Gemini model (API mode)
GEMINI_MODEL: str = "gemini-2.0-flash"

# Ollama model (local mode) - good options for RTX 4070:
#   "llava"       - 7B params, ~4.5GB VRAM, fastest
#   "llava:13b"   - 13B params, ~8GB VRAM, better accuracy
#   "llava:34b"   - 34B params, won't fit 12GB
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma4:e4b")
OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://localhost:11434")

# Prompt template sent alongside every image
ANALYSIS_PROMPT: str = """You are an AI traffic analyst for AccessFlow Bengaluru, a system
that helps differently-abled citizens navigate the city safely.

Analyze the provided traffic/road image and return a JSON object with
EXACTLY these fields (no extra text, no markdown fences):

{
  "type": "<one of: ACCIDENT, FLOOD, BLOCKED, CONGESTION, CLEAR>",
  "severity": "<one of: HIGH, MEDIUM, LOW>",
  "description": "<1-2 sentence description of what you see>",
  "emergency": <true if emergency services are needed, else false>,
  "accessible": <true if a wheelchair user can safely pass, else false>
}

IMPORTANT: Look at the FOREGROUND of the image first. Classify based on the
MOST SERIOUS event visible, not the background.

Rules for TYPE (check in this priority order):
1. ACCIDENT = ANY vehicle collision, crash, overturned vehicle, damaged vehicles,
   debris/broken parts on road, vehicles at abnormal angles, people gathered
   around a crash. If you see EVEN ONE collision or crash, type MUST be ACCIDENT
   regardless of traffic behind it.
2. FLOOD = waterlogging, submerged road, heavy water accumulation.
3. BLOCKED = construction barricade, fallen tree, footpath obstruction.
4. CONGESTION = ONLY heavy traffic with NO accident, NO collision, NO debris.
   Pure bumper-to-bumper traffic jam with all vehicles intact.
5. CLEAR = road is open with no issues.

Rules for SEVERITY (be strict):
- HIGH = road is completely blocked OR bumper-to-bumper gridlock OR
  vehicles are not moving OR major accident OR deep flooding.
  When in doubt between MEDIUM and HIGH, choose HIGH.
- MEDIUM = road is partially blocked, slow-moving traffic, minor obstruction.
- LOW = minor issue, road mostly usable.
- If type is CLEAR, severity must be LOW.

Rules for emergency:
- true only for accidents with visible injury risk or life-threatening flooding.

Rules for accessible:
- true only if a wheelchair/mobility-aid user can CLEARLY and SAFELY
  navigate through without ANY obstruction.
- If there is heavy traffic, congestion, flooding, or blocked paths,
  accessible must be false.

Return ONLY the JSON object. No explanation, no markdown."""


# ---------------------------------------------------------------------------
# Image preprocessing
# ---------------------------------------------------------------------------

def preprocess_image(image_path: str) -> Image.Image:
    """Load an image and resize so neither dimension exceeds MAX_IMAGE_DIM."""
    img = Image.open(image_path)

    # Convert RGBA / palette images to RGB
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")

    # Resize if needed, preserving aspect ratio
    w, h = img.size
    if max(w, h) > MAX_IMAGE_DIM:
        scale = MAX_IMAGE_DIM / max(w, h)
        new_w, new_h = int(w * scale), int(h * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        print(f"  -> Resized {w}x{h} -> {new_w}x{new_h}")

    return img


def _image_to_bytes(img: Image.Image, fmt: str = "JPEG") -> bytes:
    """Convert a PIL Image to bytes."""
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# JSON parsing & validation
# ---------------------------------------------------------------------------

def _parse_json_response(raw: str) -> dict:
    """Robustly parse the model response into a dict.
    Handles markdown fences and extra text around JSON."""
    text = raw.strip()

    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)

    # Try to find JSON object in the text
    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        text = text[start:end]

    return json.loads(text)


def _validate_result(result: dict) -> dict:
    """Ensure all required fields exist and values are valid."""

    valid_types = {"ACCIDENT", "FLOOD", "BLOCKED", "CONGESTION", "CLEAR"}
    valid_severities = {"HIGH", "MEDIUM", "LOW"}

    # Normalise type
    t = str(result.get("type", "CLEAR")).upper().strip()
    if t not in valid_types:
        t = "CLEAR"
    result["type"] = t

    # Normalise severity
    s = str(result.get("severity", "LOW")).upper().strip()
    if s not in valid_severities:
        s = "LOW"
    result["severity"] = s

    # Ensure booleans
    result["emergency"] = bool(result.get("emergency", False))
    result["accessible"] = bool(result.get("accessible", True))

    # Ensure description
    if "description" not in result or not result["description"]:
        result["description"] = "No description available."

    return result


# ---------------------------------------------------------------------------
# METHOD 1: Gemini API (cloud)
# ---------------------------------------------------------------------------

def analyze_image_gemini(image_path: str) -> dict:
    """Analyze using Google Gemini Flash API.

    Requires: pip install google-genai
    Requires: GEMINI_API_KEY env var set
    """
    from google import genai
    from google.genai import types

    if not GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY not set. Get one free at https://aistudio.google.com\n"
            "Then run:  $env:GEMINI_API_KEY = 'your-key'"
        )

    client = genai.Client(api_key=GEMINI_API_KEY)

    img = preprocess_image(image_path)
    img_bytes = _image_to_bytes(img)

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
            ANALYSIS_PROMPT,
        ],
    )

    raw_text = response.text
    print(f"  -> Gemini raw response:\n    {raw_text[:200]}")

    parsed = _parse_json_response(raw_text)
    return _validate_result(parsed)


# ---------------------------------------------------------------------------
# METHOD 2: Ollama LLaVA (local GPU)
# ---------------------------------------------------------------------------

def analyze_image_ollama(image_path: str) -> dict:
    """Analyze using local Ollama LLaVA model on your GPU.

    Requires:
      1. Install Ollama: https://ollama.com/download
      2. Pull model:  ollama pull llava
      3. Ollama runs automatically as a service

    RTX 4070 (12GB VRAM) can run:
      - llava (7B)   -> ~4.5GB VRAM, fast, good enough for demo
      - llava:13b    -> ~8GB VRAM, better accuracy
    """
    import requests

    img = preprocess_image(image_path)
    b64_image = base64.b64encode(_image_to_bytes(img)).decode("utf-8")

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": ANALYSIS_PROMPT,
        "images": [b64_image],
        "stream": False,
    }

    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json=payload,
            timeout=120,  # local models can be slower
        )
        resp.raise_for_status()
        raw_text = resp.json().get("response", "")
        print(f"  -> Ollama raw response:\n    {raw_text[:200]}")
        parsed = _parse_json_response(raw_text)
        return _validate_result(parsed)
    except requests.ConnectionError:
        raise RuntimeError(
            "Cannot connect to Ollama. Make sure it's running:\n"
            "  1. Install from https://ollama.com/download\n"
            "  2. Run: ollama pull llava\n"
            "  3. Ollama starts automatically as a service"
        )
    except Exception as e:
        raise RuntimeError(f"Ollama failed: {e}")


# ---------------------------------------------------------------------------
# Public API - this is what P3's server/main.py calls
# ---------------------------------------------------------------------------

def analyze_image(image_path: str) -> dict:
    """Analyze a traffic/road image and return structured incident data.

    Mode selection (VLM_MODE env var):
      "api"   -> Gemini only
      "local" -> Ollama only
      "auto"  -> Try Gemini first, fallback to Ollama (default)

    If everything fails, returns a safe CLEAR result (never crashes).

    Args:
        image_path: Path to a .jpg/.png image file.

    Returns:
        dict with keys: type, severity, description, emergency, accessible
    """
    path = str(Path(image_path).resolve())
    if not os.path.isfile(path):
        print(f"  [X] Image not found: {path}")
        return _fallback_clear(f"Image not found: {image_path}")

    print(f"\n[ANALYZE] {Path(path).name}")

    mode = VLM_MODE.lower()

    # --- API-only mode ---
    if mode == "api":
        try:
            result = analyze_image_gemini(path)
            print(f"  [OK] Gemini: {result['type']} / {result['severity']}")
            return result
        except Exception as e:
            print(f"  [X] Gemini failed: {e}")
            return _fallback_clear(str(e))

    # --- Local-only mode ---
    if mode == "local":
        try:
            result = analyze_image_ollama(path)
            print(f"  [OK] Ollama: {result['type']} / {result['severity']}")
            return result
        except Exception as e:
            print(f"  [X] Ollama failed: {e}")
            return _fallback_clear(str(e))

    # --- Auto mode (default): try API first, then local ---
    try:
        result = analyze_image_gemini(path)
        print(f"  [OK] Gemini: {result['type']} / {result['severity']}")
        return result
    except Exception as e:
        print(f"  [X] Gemini failed: {e}")

    try:
        result = analyze_image_ollama(path)
        print(f"  [OK] Ollama: {result['type']} / {result['severity']}")
        return result
    except Exception as e:
        print(f"  [X] Ollama failed: {e}")

    print("  [!] All models failed - returning CLEAR fallback")
    return _fallback_clear("All analysis models unavailable")


def _fallback_clear(reason: str) -> dict:
    """Return a safe CLEAR result when no model can process the image."""
    return {
        "type": "CLEAR",
        "severity": "LOW",
        "description": f"Unable to analyze image ({reason}). Defaulting to CLEAR.",
        "emergency": False,
        "accessible": True,
    }


# ---------------------------------------------------------------------------
# Video analysis
# ---------------------------------------------------------------------------

# Severity ranking for comparison
_SEVERITY_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
_TYPE_RANK = {"CLEAR": 0, "CONGESTION": 1, "BLOCKED": 2, "FLOOD": 3, "ACCIDENT": 4}

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv", ".wmv"}


def analyze_video(video_path: str, frame_interval_sec: float = 3.0,
                  max_frames: int = 10) -> list:
    """Analyze a video by extracting frames at regular intervals.

    Args:
        video_path: Path to a video file.
        frame_interval_sec: Seconds between frame extractions (default: 3s).
        max_frames: Maximum number of frames to analyze (default: 10).

    Returns:
        List of analysis results (one per frame), sorted by severity
        (worst first). Each result also includes 'frame_number' and
        'timestamp_sec' fields.
    """
    import cv2
    import tempfile

    path = str(Path(video_path).resolve())
    if not os.path.isfile(path):
        print(f"  [X] Video not found: {path}")
        return [_fallback_clear(f"Video not found: {video_path}")]

    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        print(f"  [X] Cannot open video: {path}")
        return [_fallback_clear(f"Cannot open video: {video_path}")]

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps
    frame_skip = int(fps * frame_interval_sec)

    print(f"\n[VIDEO] {Path(path).name}")
    print(f"  Duration: {duration:.1f}s | FPS: {fps:.0f} | "
          f"Extracting every {frame_interval_sec}s (max {max_frames} frames)")

    results = []
    frame_count = 0
    frames_analyzed = 0

    while frames_analyzed < max_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_count)
        ret, frame = cap.read()
        if not ret:
            break

        # Save frame as temp image
        temp_path = os.path.join(
            tempfile.gettempdir(),
            f"accessflow_frame_{frames_analyzed}.jpg"
        )
        cv2.imwrite(temp_path, frame)

        timestamp = frame_count / fps
        print(f"\n  --- Frame {frames_analyzed + 1} "
              f"(t={timestamp:.1f}s) ---")

        result = analyze_image(temp_path)
        result["frame_number"] = frame_count
        result["timestamp_sec"] = round(timestamp, 1)
        results.append(result)

        # Clean up temp file
        os.remove(temp_path)

        frame_count += frame_skip
        frames_analyzed += 1

    cap.release()

    # Sort by severity (worst first)
    results.sort(
        key=lambda r: (
            _TYPE_RANK.get(r["type"], 0),
            _SEVERITY_RANK.get(r["severity"], 0)
        ),
        reverse=True
    )

    return results


def get_worst_incident(results: list) -> dict:
    """From a list of frame results, return the single worst incident."""
    if not results:
        return _fallback_clear("No frames analyzed")
    return results[0]  # Already sorted worst-first


def is_video_file(filepath: str) -> bool:
    """Check if a file is a video based on extension."""
    return Path(filepath).suffix.lower() in VIDEO_EXTENSIONS


# ---------------------------------------------------------------------------
# CLI - standalone testing
# ---------------------------------------------------------------------------

def print_banner():
    print("=" * 60)
    print("  AccessFlow Bengaluru - VLM Pipeline")
    print(f"  Mode: {VLM_MODE.upper()}")
    print(f"  Gemini API key: {'SET' if GEMINI_API_KEY else 'NOT SET'}")
    print(f"  Ollama model: {OLLAMA_MODEL} @ {OLLAMA_URL}")
    print("=" * 60)


if __name__ == "__main__":
    print_banner()

    if len(sys.argv) < 2:
        print("\nUsage:")
        print("  python ai/vlm.py <image_or_video> [file2 ...]")
        print("\nExamples:")
        print("  python ai/vlm.py data/images/silk_board_accident.jpg")
        print("  python ai/vlm.py traffic_clip.mp4")
        print("  python ai/vlm.py data/images/*.jpg")
        print("\nSupported formats:")
        print("  Images: .jpg .jpeg .png .bmp .webp")
        print("  Videos: .mp4 .avi .mov .mkv .webm")
        print("\nEnvironment variables:")
        print("  GEMINI_API_KEY  - Your Gemini API key")
        print('  VLM_MODE        - "api", "local", or "auto"')
        print(f'  OLLAMA_MODEL    - Model name (current: "{OLLAMA_MODEL}")')
        sys.exit(1)

    all_results = []

    for filepath in sys.argv[1:]:
        if is_video_file(filepath):
            # --- Video analysis ---
            frame_results = analyze_video(filepath)
            worst = get_worst_incident(frame_results)

            print(f"\n{'='*60}")
            print(f"  VIDEO ANALYSIS: {Path(filepath).name}")
            print(f"  Frames analyzed: {len(frame_results)}")
            print(f"{'='*60}")
            for r in frame_results:
                status = "!! EMERGENCY !!" if r["emergency"] else r["severity"]
                access = "Accessible" if r["accessible"] else "NOT accessible"
                print(f"  t={r['timestamp_sec']:5.1f}s -> "
                      f"{r['type']:12s} [{status}] [{access}]")

            print(f"\n  WORST INCIDENT:")
            print(f"  {json.dumps(worst, indent=2)}")
            print(f"{'='*60}\n")
            all_results.append({"file": filepath, **worst})
        else:
            # --- Image analysis ---
            result = analyze_image(filepath)
            all_results.append({"file": filepath, **result})
            print(f"\n{'-'*60}")
            print(json.dumps(result, indent=2))
            print(f"{'-'*60}\n")

    # Summary
    print("\n" + "=" * 60)
    print("  SUMMARY")
    print("=" * 60)
    for r in all_results:
        status = "!! EMERGENCY !!" if r["emergency"] else r["severity"]
        access = "Accessible" if r["accessible"] else "NOT accessible"
        print(f"  {Path(r['file']).name:30s} -> "
              f"{r['type']:12s} [{status}] [{access}]")
    print("=" * 60)
