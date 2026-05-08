# AccessFlow Bengaluru

> **6 lakh differently-abled citizens. Zero real-time navigation. Until now.**

AI-powered accessibility and commute platform for Bengaluru. Uses VLM (Vision Language Models) for real-time hazard detection and wheelchair-safe routing.

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

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ — [nodejs.org](https://nodejs.org/)
- **Python 3.10+**
- **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 1. Install Dependencies

```bash
# Frontend (React/Vite)
npm install

# Backend (FastAPI)
pip install -r requirements.txt
```

### 2. Environment Configuration

```bash
# Create .env from example
cp .env.example .env

# Add your Gemini API key to .env:
# GEMINI_API_KEY=your_gemini_api_key_here

# Or set directly (PowerShell):
$env:GEMINI_API_KEY="your-api-key-here"
```

### 3. Run the App

```bash
# Start frontend dev server (http://localhost:3000)
npm run dev

# Start backend server
uvicorn server.main:app --reload --port 8000
```

### 4. Test the VLM Pipeline (standalone)

```bash
python ai/vlm.py data/images/silk_board_accident.jpg
```

---

## VLM Modes

| Mode    | Command                          | Needs           |
|---------|----------------------------------|-----------------| 
| API     | `$env:VLM_MODE = "api"`         | Gemini API key  |
| Local   | `$env:VLM_MODE = "local"`       | Ollama + LLaVA  |
| Auto    | `$env:VLM_MODE = "auto"` (default) | Tries both   |

---

## 📁 Project Structure

```
accessflow/
├── src/                        # React frontend (Vite + TypeScript)
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── types.ts
│   ├── components/
│   │   ├── MapView.tsx
│   │   └── CameraPanel.tsx
│   └── services/
│       └── geminiService.ts
│
├── server.ts                   # Express dev server
├── vite.config.ts
├── package.json
│
├── server/                     # Python backend (FastAPI)
│   ├── main.py
│   ├── routing.py
│   └── alerts.py
│
├── ai/
│   └── vlm.py                  # Gemini Flash VLM pipeline (+ LLaVA fallback)
│
├── data/
│   ├── incidents.json
│   ├── locations.json
│   └── images/
│
├── requirements.txt
├── .env.example
└── README.md
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

---

## 🛠️ Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React, TypeScript, Vite, Leaflet.js |
| Backend   | Python, FastAPI, Uvicorn            |
| AI/VLM    | Google Gemini Flash, Ollama LLaVA   |
| Routing   | OSRM (Open Source Routing Machine)  |
| Maps      | OpenStreetMap tiles                 |

---

## Scripts

- `npm run dev`: Starts the development server (Express + Vite)
- `npm run build`: Builds the application for production
- `npm start`: Runs the built application in production mode
- `npm run lint`: Checks for TypeScript errors

---

## 👥 Team

| Person | Responsibility       | Files Owned                              |
|--------|---------------------|------------------------------------------|
| P1     | Frontend            | src/*, index.html, vite.config.ts        |
| P2     | VLM Pipeline        | ai/vlm.py                                |
| P3     | Backend             | server/main.py, routing.py, alerts.py    |
| P4     | Data + Demo + Docs  | data/*, README.md                        |

---

## 📄 License

Built for the AccessFlow Bengaluru Hackathon.
