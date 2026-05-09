import { NextResponse } from 'next/server';

const FASTAPI_URL = process.env.FASTAPI_BACKEND_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const res = await fetch(`${FASTAPI_URL}/pins`);
    if (res.ok) {
      const pins = await res.json();
      return NextResponse.json({
        pins,
        timestamp: new Date().toISOString(),
        source: 'fastapi-backend',
      });
    }
  } catch (err) {
    console.error('FastAPI pins error:', err);
  }

  // Fallback if FastAPI is down
  return NextResponse.json({
    pins: [],
    timestamp: new Date().toISOString(),
    source: 'fallback',
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${FASTAPI_URL}/pins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch (err) {
    console.error('FastAPI POST pins error:', err);
  }
  return NextResponse.json({ status: 'error' }, { status: 500 });
}
