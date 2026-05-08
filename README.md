# AccessFlow Bengaluru

Real-time accessible navigation for differently-abled citizens using AI-powered traffic analysis.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Set your Gemini API key (or use local Ollama)
$env:GEMINI_API_KEY = "your-key-here"

# Test the VLM pipeline
python ai/vlm.py data/images/silk_board_accident.jpg

# Run the backend server
uvicorn server.main:app --reload

# Open index.html in browser for the frontend
```

## Project Structure

```
accessflow/
  ai/vlm.py           - VLM pipeline (Gemini API + Ollama local)
  server/main.py       - FastAPI backend
  server/routing.py    - Route planning via OSRM
  server/alerts.py     - Emergency alerts & BBMP complaints
  data/incidents.json  - Sample incident data
  data/locations.json  - Bengaluru coordinates
  data/images/         - Traffic images for analysis
  index.html           - Frontend UI
  style.css            - Styles
  map.js               - Leaflet map
  camera.js            - Camera feed cycling
```

## VLM Modes

| Mode    | Command                          | Needs           |
|---------|----------------------------------|-----------------|
| API     | `$env:VLM_MODE = "api"`         | Gemini API key  |
| Local   | `$env:VLM_MODE = "local"`       | Ollama + LLaVA  |
| Auto    | `$env:VLM_MODE = "auto"` (default) | Tries both   |
