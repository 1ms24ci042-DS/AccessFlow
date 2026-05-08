# AccessFlow Bengaluru

> **6 lakh differently-abled citizens. Zero real-time navigation. Until now.**

AccessFlow is a real-time, AI-powered accessible navigation system for Bengaluru. It uses computer vision (VLM) to detect road hazards—accidents, floods, blocked footpaths, and congestion—and dynamically reroutes users with accessibility needs through safe, verified paths.

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│   VLM (AI)   │
│  Leaflet Map │     │   FastAPI    │     │  Gemini Flash │
│  Camera Feed │◀────│  OSRM Route  │◀────│  LLaVA (fb)  │
└──────────────┘     └──────────────┘     └──────────────┘
        │                    │
        ▼                    ▼
   Live Map Pins       data/incidents.json
   Route Display       data/locations.json
   Alert Modals        data/images/
```

---

## 📁 Project Structure

```
accessflow/
├── index.html              # Main UI — two-panel layout (map + camera)
├── style.css               # Dark theme styling
├── map.js                  # Leaflet map logic, pins, routes
├── camera.js               # Camera feed cycling + VLM trigger
│
├── server/
│   ├── main.py             # FastAPI app — all API endpoints
│   ├── routing.py          # OSRM route planning + confidence scoring
│   └── alerts.py           # Emergency alerts + BBMP complaint generation
│
├── ai/
│   └── vlm.py              # Gemini Flash VLM pipeline (+ LLaVA fallback)
│
├── data/
│   ├── incidents.json      # Pre-seeded Bengaluru incident data
│   ├── locations.json      # Key Bengaluru landmark coordinates
│   └── images/             # Sample traffic/road images for demo
│       ├── silk_board_accident.jpg
│       ├── orr_flood.jpg
│       ├── koramangala_blocked.jpg
│       ├── whitefield_congestion.jpg
│       └── clear_road.jpg
│
├── requirements.txt        # Python dependencies
└── README.md               # This file
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js** (optional, for local static serving)
- **Gemini API Key** from [aistudio.google.com](https://aistudio.google.com)

### 1. Clone & Install

```bash
git clone <repo-url>
cd accessflow
pip install -r requirements.txt
```

### 2. Set API Key

```bash
# Linux / macOS
export GEMINI_API_KEY="your-api-key-here"

# Windows (PowerShell)
$env:GEMINI_API_KEY="your-api-key-here"
```

### 3. Start Backend

```bash
uvicorn server.main:app --reload --port 8000
```

### 4. Open Frontend

Open `index.html` in your browser, or serve it locally:

```bash
# Using Python
python -m http.server 5500

# Then navigate to http://localhost:5500
```

---

## 🔌 API Endpoints

| Method | Endpoint       | Description                          |
|--------|---------------|--------------------------------------|
| POST   | `/analyze`    | Analyze a traffic image via VLM      |
| POST   | `/route`      | Get accessible route between points  |
| GET    | `/pins`       | Get all current incident map pins    |
| POST   | `/alert`      | Generate emergency alert             |
| POST   | `/complaint`  | Generate BBMP complaint draft        |

### Sample: POST `/analyze`

**Request:**
```json
{
  "image_path": "data/images/silk_board_accident.jpg"
}
```

**Response:**
```json
{
  "type": "ACCIDENT",
  "severity": "HIGH",
  "description": "Vehicle collision blocking left lane near Silk Board Junction",
  "emergency": true,
  "accessible": false
}
```

### Sample: POST `/route`

**Request:**
```json
{
  "start": {"lat": 12.9698, "lng": 77.7499},
  "end": {"lat": 12.9279, "lng": 77.6271}
}
```

**Response:**
```json
{
  "route": [[12.9698, 77.7499], [12.9500, 77.7000], [12.9279, 77.6271]],
  "distance_km": 14.2,
  "duration_min": 38,
  "confidence": 0.82,
  "avoids": ["Silk Board Junction (ACCIDENT)"]
}
```

---

## 📍 Pin Color Legend

| Color    | Type        | Meaning                        |
|----------|------------|--------------------------------|
| 🔴 Red    | ACCIDENT   | Vehicle collision / crash      |
| 🔵 Blue   | FLOOD      | Waterlogged / flooded road     |
| 🟠 Orange | BLOCKED    | Footpath / road blocked        |
| 🟡 Yellow | CONGESTION | Heavy traffic / slow movement  |
| 🟢 Green  | CLEAR      | Road is clear and accessible   |

---

## 🧪 Demo Flow

> **Scenario:** Priya, a wheelchair user, needs to travel from Whitefield to Koramangala.

1. **Map loads** with live incident pins across Bengaluru
2. **Camera cycles** through traffic feed images
3. **VLM detects** an ACCIDENT at Silk Board Junction
4. **Red pin appears** on the map in real-time
5. **Route replanned** — avoids Silk Board, shows confidence score
6. **Emergency alert** drafted automatically for authorities
7. **BBMP complaint** generated for accessibility violations

**Demo duration:** ~2 minutes

---

## 🗂️ Data Files

### `data/locations.json`

Eight key Bengaluru landmarks with precise coordinates:

| Location     | Latitude  | Longitude |
|-------------|-----------|-----------|
| Silk Board   | 12.9175   | 77.6229   |
| Whitefield   | 12.9698   | 77.7499   |
| Electronic City | 12.8399 | 77.6770  |
| Majestic     | 12.9767   | 77.5713   |
| Hebbal       | 13.0450   | 77.5970   |
| Koramangala  | 12.9279   | 77.6271   |
| MG Road      | 12.9757   | 77.6011   |
| ORR          | 12.9352   | 77.6861   |

### `data/incidents.json`

Five pre-seeded incidents for demo purposes covering ACCIDENT, FLOOD, BLOCKED, CONGESTION, and CLEAR scenarios.

### `data/images/`

Five curated Bengaluru traffic images matching each incident type for VLM analysis testing.

---

## 🛠️ Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | HTML, CSS, JavaScript, Leaflet.js   |
| Backend   | Python, FastAPI, Uvicorn            |
| AI/VLM    | Google Gemini Flash, Ollama LLaVA   |
| Routing   | OSRM (Open Source Routing Machine)  |
| Maps      | OpenStreetMap tiles                 |

---

## 👥 Team

| Person | Responsibility       | Files Owned                              |
|--------|---------------------|------------------------------------------|
| P1     | Frontend            | index.html, style.css, map.js, camera.js |
| P2     | VLM Pipeline        | ai/vlm.py                                |
| P3     | Backend             | server/main.py, routing.py, alerts.py    |
| P4     | Data + Demo + Docs  | data/*, README.md                        |

---

## 📄 License

Built for the AccessFlow Bengaluru Hackathon.
