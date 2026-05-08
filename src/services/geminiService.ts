import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeTrafficImage(base64Image: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image
          }
        },
        {
          text: "Analyze this image from a Bengaluru traffic camera. Decide if there is an Accident, Flood, Blocked road, or heavy Congestion. Return the result in JSON format with fields: 'type' (one of: accident, flood, blocked, congestion, clear), 'severity' (low, medium, high), and a short 'description'."
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["accident", "flood", "blocked", "congestion", "clear"] },
            severity: { type: Type.STRING, enum: ["low", "medium", "high"] },
            description: { type: Type.STRING }
          },
          required: ["type", "severity", "description"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return { type: 'clear', severity: 'low', description: 'Real-time analysis unavailable.' };
  }
}
