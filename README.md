# AccessFlow - Smart Bengaluru Access

AI-powered accessibility and commute platform for Bengaluru. Uses VLM (Vision Language Models) for real-time hazard detection and wheelchair-safe routing.

## Local Setup Instructions

To run this application on your local machine, follow these steps:

### 1. Prerequisites

- **Node.js**: Ensure you have Node.js installed (v18 or higher is recommended). You can download it from [nodejs.org](https://nodejs.org/).
- **npm**: npm is usually installed with Node.js.

### 2. Installation

1.  **Download the project**: Export the project as a ZIP file from the AI Studio "Settings" menu and extract it on your computer.
2.  **Open a terminal**: Navigate to the project directory in your terminal or command prompt.
3.  **Install dependencies**:
    ```bash
    npm install
    ```

### 3. Environment Configuration

The application requires a Gemini API key for AI features.

1.  Create a file named `.env` in the root directory (you can copy `.env.example`).
2.  Add your Gemini API key to the `.env` file:
    ```env
    GEMINI_API_KEY=your_gemini_api_key_here
    ```
    *You can get a Gemini API key for free from [Google AI Studio](https://aistudio.google.com/app/apikey).*

### 4. Running the Application

Start the development server:

```bash
npm run dev
```

The application will be running at `http://localhost:3000`.

## Scripts

- `npm run dev`: Starts the development server (Express + Vite).
- `npm run build`: Builds the application for production.
- `npm start`: Runs the built application in production mode.
- `npm run lint`: Checks for TypeScript errors.
