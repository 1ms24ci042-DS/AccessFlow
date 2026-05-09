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

# Which mode to use: "nvidia", "api" or "local"
# Set via:  $env:VLM_MODE = "nvidia"  (PowerShell)
# Default: tries NVIDIA first, falls back to others
VLM_MODE: str = os.getenv("VLM_MODE", "nvidia")

# Maximum image dimension (pixels) before resizing — keep small for speed
MAX_IMAGE_DIM: int = 512

# Gemini model (API mode)
GEMINI_MODEL: str = "gemini-2.0-flash"

# Ollama model (local mode) - good options for RTX 4070:
#   "llava"       - 7B params, ~4.5GB VRAM, fastest
#   "llava:13b"   - 13B params, ~8GB VRAM, better accuracy
#   "llava:34b"   - 34B params, won't fit 12GB
OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "moondream")
OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://localhost:11434")

# Prompt template — kept concise for speed
ANALYSIS_PROMPT: str = """Traffic analyst for AccessFlow Bengaluru. Analyze this road image.
Return ONLY valid JSON (no markdown, no extra text):
{"type":"ACCIDENT|FLOOD|BLOCKED|CONGESTION|CLEAR","severity":"HIGH|MEDIUM|LOW","description":"<1 sentence>","emergency":true/false,"accessible":true/false}
Rules: ACCIDENT=collision/crash/debris. FLOOD=waterlogging. BLOCKED=barricade/tree. CONGESTION=heavy traffic only. CLEAR=open road.
HIGH=fully blocked/major crash/gridlock. MEDIUM=partial block/slow traffic. LOW=minor issue. CLEAR→LOW.
emergency=true only if injury risk. accessible=true only if wheelchair can safely pass."""


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
    """Analyze using a local Ollama vision model on the GPU."""
    import requests

    img = preprocess_image(image_path)
    b64_image = base64.b64encode(_image_to_bytes(img)).decode("utf-8")

    # Use /api/chat — works with all modern Ollama vision models
    # (moondream, llava, minicpm-v, qwen-vl, etc.)
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {
                "role": "user",
                "content": ANALYSIS_PROMPT,
                "images": [b64_image],
            }
        ],
        "stream": False,
        "keep_alive": -1,
        "options": {
            "num_predict": 200,
            "num_ctx": 2048,
            "temperature": 0.1,
        },
    }

    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json=payload,
            timeout=180,
        )
        resp.raise_for_status()
        data = resp.json()
        # /api/chat returns message.content
        raw_text = data.get("message", {}).get("content", "") or data.get("response", "")
        print(f"  -> Ollama raw response:\n    {raw_text[:300]}")
        if not raw_text.strip():
            raise RuntimeError("Model returned empty response")
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
# METHOD 3: NVIDIA NIM API (Cloud, High Accuracy)
# ---------------------------------------------------------------------------

def analyze_image_nvidia(image_path: str) -> dict:
    """Analyze using NVIDIA NIM API (Llama 3.2 90B Vision)."""
    import requests

    api_key = os.getenv("NVIDIA_API_KEY", "")
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY not set. Get one free at build.nvidia.com")

    invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }

    img = preprocess_image(image_path)
    b64_image = base64.b64encode(_image_to_bytes(img)).decode("utf-8")

    payload = {
        "model": "meta/llama-3.2-90b-vision-instruct",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": ANALYSIS_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_image}"}}
                ]
            }
        ],
        "max_tokens": 512,
        "temperature": 0.1,
        "stream": False
    }

    try:
        resp = requests.post(invoke_url, headers=headers, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        raw_text = data["choices"][0]["message"]["content"]
        print(f"  -> NVIDIA raw response:\n    {raw_text[:200]}")
        parsed = _parse_json_response(raw_text)
        return _validate_result(parsed)
    except Exception as e:
        raise RuntimeError(f"NVIDIA API failed: {e}")


# ---------------------------------------------------------------------------
# Public API - this is what P3's server/main.py calls
# ---------------------------------------------------------------------------

def analyze_image(image_path: str) -> dict:
    """Analyze a traffic/road image and return structured incident data.

    Mode selection (VLM_MODE env var):
      "nvidia" -> NVIDIA NIM API
      "api"   -> Gemini only
      "local" -> Ollama only
      "auto"  -> Try NVIDIA first, fallback to others

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

    # --- NVIDIA mode ---
    if mode == "nvidia":
        try:
            result = analyze_image_nvidia(path)
            print(f"  [OK] NVIDIA: {result['type']} / {result['severity']}")
            return result
        except Exception as e:
            print(f"  [X] NVIDIA failed: {e}")
            return _fallback_clear(str(e))

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

    # --- Auto mode (default): try NVIDIA first, then others ---
    try:
        result = analyze_image_nvidia(path)
        print(f"  [OK] NVIDIA: {result['type']} / {result['severity']}")
        return result
    except Exception as e:
        print(f"  [X] NVIDIA failed: {e}")

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


def analyze_video(video_path: str, frame_interval_sec: float = 5.0,
                  max_frames: int = 5) -> list:
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
