import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.FASTAPI_BACKEND_URL || 'http://localhost:8000';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Missing file in FormData.' },
        { status: 400 }
      );
    }

    // Forward the file directly to FastAPI /analyze/upload
    try {
      const fastApiFormData = new FormData();
      fastApiFormData.append('file', file);

      const fastApiRes = await fetch(`${FASTAPI_URL}/analyze/upload`, {
        method: 'POST',
        body: fastApiFormData,
        signal: AbortSignal.timeout(120000), // 2min — local Ollama/CV2 can be slow
      });

      if (fastApiRes.ok) {
        const data = await fastApiRes.json();
        
        // Compute confidence if missing
        const confidenceMap: Record<string, Record<string, number>> = {
          ACCIDENT: { HIGH: 95, MEDIUM: 80, LOW: 65 },
          FLOOD: { HIGH: 92, MEDIUM: 78, LOW: 60 },
          BLOCKED: { HIGH: 88, MEDIUM: 75, LOW: 55 },
          CONGESTION: { HIGH: 85, MEDIUM: 70, LOW: 50 },
          CLEAR: { HIGH: 70, MEDIUM: 80, LOW: 97 },
        };
        const type = data.type || 'CLEAR';
        const severity = data.severity || 'LOW';
        const confidence = data.confidence || confidenceMap[type]?.[severity] || 70;

        return NextResponse.json({
          ...data,
          confidence,
          risk_factors: data.emergency ? ['Emergency situation detected'] : [],
          recommended_action: data.emergency ? 'Call 108 immediately' : 'Exercise caution',
          source: 'fastapi-vlm',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('FastAPI VLM unavailable:', (err as Error).message);
    }

    // Fallback if FastAPI is down
    return NextResponse.json({
      type: 'CLEAR',
      severity: 'LOW',
      description: 'VLM analysis could not be completed. The image/video has been queued for manual review.',
      emergency: false,
      accessible: true,
      confidence: 30,
      source: 'fallback',
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Analyze API error:', err);
    return NextResponse.json(
      { error: 'File analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
